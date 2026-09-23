/* ===== tools/stage-growth-calculator.mjs =====
   게임 코드의 실제 수치와 계산 함수를 읽어 다음 순서로 계산한다.
   1) 입력 스테이지 도달 시 누적 골드·별불
   2) 미사일 한 계열 집중 / 네 계열 균등 성장 스펙(스킬 제외)
   3) 스펙 × 목표 배수에 맞춘 기존 적 변수 위치의 권장값

   이 모듈은 파일을 생성하지 않는다. 호출한 쪽에 계산 결과 객체만 반환한다. */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname,'..');
const DEFAULT_TARGET_MULTIPLIER = 10.35;
const FACTOR_KEYS = [
  'attackPct','damagePct','critChance','critDamagePct',
  'defensePct','defenseIgnore','pierceRate','attackSpeedPct','bossDamagePct',
];

function read(relativePath){
  return fs.readFileSync(path.join(ROOT,relativePath),'utf8');
}

/* 브라우저 전역 스크립트를 격리해 실행하고 계산에 필요한 순수 데이터와 함수만 꺼낸다. */
function loadGameModel(){
  const context=vm.createContext({
    console,
    structuredClone,
    COMBAT_FACTOR_KEYS:FACTOR_KEYS,
    GameState:{current:'lobby'},
    Analytics:{track(){}},
    t:key=>key,
    choice:values=>values[0],
    clamp:(value,min,max)=>Math.max(min,Math.min(max,value)),
  });

  vm.runInContext(`${read('js/config.js')}\nglobalThis.__balanceConfig={
  CONFIG,DEFAULT_CONFIG,ENEMY_TYPE_KEYS,MISSILE_KEYS,SKILL_KEYS,
  buildStageWaves,buildBossCompositions
};`,context,{filename:'js/config.js'});

  vm.runInContext(`${read('js/characters.js')}\nglobalThis.__balanceCharacters={
  campaignStage,stageEnemyDefense,CharacterGrowthRules,
  CharacterRepository,CharacterInventorySystem,SkillInventorySystem,
  LevelTrackSystem,UnlockSystem,CharacterGrowthSystem
};`,context,{filename:'js/characters.js'});

  vm.runInContext(`${read('js/character-ui.js')}\nglobalThis.__balanceMilestones={MILESTONE_TABLE,MilestoneSystem};`,context,{filename:'js/character-ui.js'});

  return {
    ...context.__balanceConfig,
    ...context.__balanceCharacters,
    ...context.__balanceMilestones,
  };
}

const MODEL=loadGameModel();

function integer(value,name,min=0){
  const number=Number(value);
  if(!Number.isSafeInteger(number)||number<min) throw new RangeError(`${name}은(는) ${min} 이상의 정수여야 한다.`);
  return number;
}

function freshState(){
  return {
    cleared:[],
    best:{wave:0,score:0},
    lifetime:{waves:0,clears:0,bosses:0,orders:0,merges:0,skillsUsed:0},
    milestoneClaims:{},
    trackLevels:MODEL.LevelTrackSystem.fresh(),
    characterInventory:MODEL.CharacterInventorySystem.fresh(),
    skillInventory:MODEL.SkillInventorySystem.fresh(),
  };
}

function claimMilestones(state){
  const reward={gold:0,starfire:0,claims:[]};
  for(const row of MODEL.MILESTONE_TABLE){
    const status=MODEL.MilestoneSystem.status(state,row);
    if(!status.ready) continue;
    state.milestoneClaims[row.id]=status.tier+status.count;
    reward[row.currencyId]+=status.total;
    reward.claims.push({id:row.id,currencyId:row.currencyId,tiers:status.count,amount:status.total});
  }
  return reward;
}

function bossCount(stage){
  return MODEL.buildStageWaves(stage.waves,MODEL.CONFIG.stage,stage.id)
    .filter(wave=>wave.type!=='normal').length;
}

function progressionOptions(options={}){
  return {
    skillsUsedPerClear:integer(options.skillsUsedPerClear??0,'skillsUsedPerClear'),
    ordersPerClear:integer(options.ordersPerClear??0,'ordersPerClear'),
    mergesPerClear:integer(options.mergesPerClear??0,'mergesPerClear'),
  };
}

/* S스테이지 도달은 1~S-1스테이지를 각각 한 번 클리어한 상태다. */
export function resourcesAtStage(stageId,options={}){
  const target=integer(stageId,'stageId',1);
  const scenario=progressionOptions(options);
  const state=freshState();
  const totals={stageGold:0,milestoneGold:0,starfire:0};
  const ledger=[];

  for(let clearedStage=1;clearedStage<target;clearedStage++){
    const stage=MODEL.campaignStage(clearedStage);
    const stageGold=stage.waves*stage.waveGold+stage.clearGold;
    state.cleared.push(clearedStage);
    state.best.wave=Math.max(state.best.wave,stage.waves);
    state.lifetime.waves+=stage.waves;
    state.lifetime.clears+=1;
    state.lifetime.bosses+=bossCount(stage);
    state.lifetime.skillsUsed+=scenario.skillsUsedPerClear;
    state.lifetime.orders+=scenario.ordersPerClear;
    state.lifetime.merges+=scenario.mergesPerClear;

    const milestone=claimMilestones(state);
    totals.stageGold+=stageGold;
    totals.milestoneGold+=milestone.gold;
    totals.starfire+=milestone.starfire;
    ledger.push({
      clearedStage,
      stageGold,
      milestoneGold:milestone.gold,
      milestoneStarfire:milestone.starfire,
      claims:milestone.claims,
    });
  }

  return {
    stage:target,
    clearedThrough:target-1,
    gold:totals.stageGold+totals.milestoneGold,
    starfire:totals.starfire,
    stageGold:totals.stageGold,
    milestoneGold:totals.milestoneGold,
    milestoneStarfire:totals.starfire,
    scenario,
    ledger,
    state,
  };
}

function spendGoldFocused(state,gold,moduleId){
  let spent=0;
  while(MODEL.LevelTrackSystem.allowed(MODEL.LevelTrackSystem.moduleLevel(state,moduleId))){
    const level=MODEL.LevelTrackSystem.moduleLevel(state,moduleId);
    const cost=MODEL.LevelTrackSystem.cost(level);
    if(!(cost>0)||spent+cost>gold) break;
    state.trackLevels[moduleId]=level+1;
    spent+=cost;
  }
  MODEL.UnlockSystem.apply(state);
  return spent;
}

function spendGoldEvenly(state,gold){
  let spent=0;
  while(true){
    const levels=MODEL.MISSILE_KEYS.map(moduleId=>MODEL.LevelTrackSystem.moduleLevel(state,moduleId));
    if(levels.some(level=>!MODEL.LevelTrackSystem.allowed(level))) break;
    const batchCost=levels.reduce((sum,level)=>sum+MODEL.LevelTrackSystem.cost(level),0);
    if(!(batchCost>0)||spent+batchCost>gold) break;
    MODEL.MISSILE_KEYS.forEach((moduleId,index)=>{state.trackLevels[moduleId]=levels[index]+1;});
    spent+=batchCost;
  }
  MODEL.UnlockSystem.apply(state);
  return spent;
}

function highestOwnedCharacter(state,moduleId){
  const owned=state.characterInventory.characters;
  return MODEL.UnlockSystem.roster(moduleId).filter(character=>owned[character.characterId]?.owned).at(-1);
}

function equipHighestOwned(state){
  for(const moduleId of MODEL.MISSILE_KEYS){
    const character=highestOwnedCharacter(state,moduleId);
    if(character) state.characterInventory.formation[moduleId]=character.characterId;
  }
}

function characterStarCost(characterId,star){
  const character=MODEL.CharacterRepository.list().find(item=>item.characterId===characterId);
  return Number(MODEL.CONFIG.meta.rarity[character.rarityId].starfireSteps[star-1])||0;
}

function addMilestoneCurrency(balance,state,history){
  const reward=claimMilestones(state);
  balance.gold+=reward.gold;
  balance.starfire+=reward.starfire;
  if(reward.claims.length) history.push(...reward.claims);
  return reward.claims.length>0;
}

function spendStarfireFocused(state,balance,moduleId,history){
  const character=highestOwnedCharacter(state,moduleId);
  if(!character) return 0;
  const owned=state.characterInventory.characters[character.characterId];
  let spent=0;
  while(owned.star<MODEL.CharacterGrowthRules.maxStars){
    const cost=characterStarCost(character.characterId,owned.star);
    if(!(cost>0)||balance.starfire<cost) break;
    balance.starfire-=cost;
    spent+=cost;
    owned.star++;
    addMilestoneCurrency(balance,state,history);
  }
  return spent;
}

function spendStarfireEvenly(state,balance,history){
  const characters=MODEL.MISSILE_KEYS.map(moduleId=>highestOwnedCharacter(state,moduleId)).filter(Boolean);
  let spent=0;
  while(characters.length===MODEL.MISSILE_KEYS.length){
    const stars=characters.map(character=>state.characterInventory.characters[character.characterId].star);
    if(stars.some(star=>star>=MODEL.CharacterGrowthRules.maxStars)) break;
    const costs=characters.map((character,index)=>characterStarCost(character.characterId,stars[index]));
    const batchCost=costs.reduce((sum,cost)=>sum+cost,0);
    if(!(batchCost>0)||balance.starfire<batchCost) break;
    balance.starfire-=batchCost;
    spent+=batchCost;
    characters.forEach(character=>state.characterInventory.characters[character.characterId].star++);
    addMilestoneCurrency(balance,state,history);
  }
  return spent;
}

function formationStats(state){
  const members=MODEL.MISSILE_KEYS.map(moduleId=>{
    const characterId=state.characterInventory.formation[moduleId];
    const character=MODEL.CharacterRepository.list().find(item=>item.characterId===characterId);
    const owned=MODEL.CharacterGrowthSystem.view(state,characterId);
    return {
      moduleId,
      characterId,
      rarityId:character.rarityId,
      level:owned.level,
      star:owned.star,
      stats:MODEL.CharacterGrowthSystem.stats(characterId,owned),
    };
  });
  const totals=members.reduce((sum,member)=>{
    for(const stat of ['atk','def','hp']) sum[stat]+=member.stats[stat];
    return sum;
  },{atk:0,def:0,hp:0});
  const reference=Object.fromEntries(Object.entries(totals).map(([key,value])=>[key,value/members.length]));
  return {members,totals,reference};
}

export function growthAtStage(stageId,{mode='focused',focusModule='chain',targetMultiplier=DEFAULT_TARGET_MULTIPLIER,...options}={}){
  if(!['focused','even'].includes(mode)) throw new RangeError("mode는 'focused' 또는 'even'이어야 한다.");
  if(!MODEL.MISSILE_KEYS.includes(focusModule)) throw new RangeError(`알 수 없는 미사일 계열: ${focusModule}`);
  const resources=resourcesAtStage(stageId,options);
  const state=structuredClone(resources.state);
  const balance={gold:resources.gold,starfire:resources.starfire};
  const growthMilestones=[];

  const goldSpent=mode==='focused'
    ?spendGoldFocused(state,balance.gold,focusModule)
    :spendGoldEvenly(state,balance.gold);
  balance.gold-=goldSpent;
  addMilestoneCurrency(balance,state,growthMilestones);
  equipHighestOwned(state);

  const starfireBeforeSpending=balance.starfire;
  const starfireSpent=mode==='focused'
    ?spendStarfireFocused(state,balance,focusModule,growthMilestones)
    :spendStarfireEvenly(state,balance,growthMilestones);
  const stats=formationStats(state);
  const target=Object.fromEntries(Object.entries(stats.reference)
    .map(([key,value])=>[key,value*Number(targetMultiplier)]));

  return {
    stage:integer(stageId,'stageId',1),
    mode,
    focusModule:mode==='focused'?focusModule:null,
    targetMultiplier:Number(targetMultiplier),
    resources:{gold:resources.gold,starfire:resources.starfire},
    spending:{gold:goldSpent,starfire:starfireSpent},
    remaining:{gold:balance.gold,starfire:balance.starfire},
    starfireBeforeSpending,
    growthMilestones,
    trackLevels:Object.fromEntries(MODEL.MISSILE_KEYS.map(moduleId=>[moduleId,state.trackLevels[moduleId]])),
    formation:stats.members,
    stats:{totals:stats.totals,reference:stats.reference,target},
  };
}

function fitSharedExponential(rows){
  const meanX=rows.reduce((sum,row)=>sum+row.x,0)/rows.length;
  const series=['hp','atk'];
  let numerator=0,denominator=0;
  for(const key of series){
    const meanY=rows.reduce((sum,row)=>sum+row[key],0)/rows.length;
    for(const row of rows){
      numerator+=(row.x-meanX)*(row[key]-meanY);
      denominator+=(row.x-meanX)**2;
    }
  }
  const slope=denominator>0?numerator/denominator:0;
  const ratio=Math.exp(slope);
  const base={};
  for(const key of series){
    base[key]=Math.exp(rows.reduce((sum,row)=>sum+row[key]-slope*row.x,0)/rows.length);
  }
  return {ratio,base};
}

function fitExponential(rows,key){
  const meanX=rows.reduce((sum,row)=>sum+row.x,0)/rows.length;
  const meanY=rows.reduce((sum,row)=>sum+row[key],0)/rows.length;
  const denominator=rows.reduce((sum,row)=>sum+(row.x-meanX)**2,0);
  const slope=denominator>0
    ?rows.reduce((sum,row)=>sum+(row.x-meanX)*(row[key]-meanY),0)/denominator
    :0;
  return {
    base:Math.exp(meanY-slope*meanX),
    ratio:Math.exp(slope),
  };
}

/* 기존 변수 위치에 넣을 값을 스테이지별 목표 스펙에 최소제곱으로 맞춘다. */
export function fitEnemyVariables(maxStage,{mode='even',focusModule='chain',targetMultiplier=DEFAULT_TARGET_MULTIPLIER,...options}={}){
  const end=integer(maxStage,'maxStage',2);
  const growth=[];
  const rows=[];
  for(let stage=1;stage<=end;stage++){
    const result=growthAtStage(stage,{mode,focusModule,targetMultiplier,...options});
    growth.push(result);
    const intro=stage<=MODEL.CONFIG.stage.introHpMul.length
      ?Number(MODEL.CONFIG.stage.introHpMul[stage-1])||1
      :1;
    rows.push({
      stage,
      x:stage-1,
      hp:Math.log(Math.max(1,result.stats.target.hp/intro)),
      atk:Math.log(Math.max(1,result.stats.target.atk)),
      def:Math.max(0,result.stats.target.def),
    });
  }

  const exponential=fitSharedExponential(rows);
  const freeStages=MODEL.CONFIG.enemy.defenseGrowth.freeStages;
  const defenseRows=rows
    .filter(row=>row.stage>freeStages)
    .map(row=>({x:row.stage-freeStages-1,def:Math.log(Math.max(1,row.def))}));
  const defenseExponential=defenseRows.length
    ?fitExponential(defenseRows,'def')
    :{
      base:MODEL.CONFIG.enemy.defenseGrowth.base,
      ratio:MODEL.CONFIG.enemy.defenseGrowth.scaleRatio,
    };

  const values={
    'CONFIG.enemy.base.hp':Math.round(exponential.base.hp),
    'CONFIG.enemy.base.atk':Math.round(exponential.base.atk),
    'CONFIG.stage.hpScaleRatio':Math.round(exponential.ratio*1e6)/1e6,
    'CONFIG.enemy.defenseGrowth.base':Math.round(defenseExponential.base),
    'CONFIG.enemy.defenseGrowth.scaleRatio':Math.round(defenseExponential.ratio*1e9)/1e9,
  };

  const comparison=growth.map(result=>{
    const stage=result.stage;
    const intro=stage<=MODEL.CONFIG.stage.introHpMul.length
      ?Number(MODEL.CONFIG.stage.introHpMul[stage-1])||1
      :1;
    return {
      stage,
      target:result.stats.target,
      fitted:{
        hp:values['CONFIG.enemy.base.hp']*Math.pow(values['CONFIG.stage.hpScaleRatio'],stage-1)*intro,
        atk:values['CONFIG.enemy.base.atk']*Math.pow(values['CONFIG.stage.hpScaleRatio'],stage-1),
        def:stage<=freeStages?0:Math.round(
          values['CONFIG.enemy.defenseGrowth.base']*
          Math.pow(values['CONFIG.enemy.defenseGrowth.scaleRatio'],stage-freeStages-1)),
      },
    };
  });

  return {maxStage:end,mode,focusModule:mode==='focused'?focusModule:null,targetMultiplier,values,comparison};
}

export function currentBalanceConstants(){
  return {
    stage:structuredClone(MODEL.CONFIG.stage),
    enemy:structuredClone(MODEL.CONFIG.enemy),
    boss:structuredClone(MODEL.CONFIG.boss),
    growth:structuredClone(MODEL.CONFIG.meta.growth),
    rarity:structuredClone(MODEL.CONFIG.meta.rarity),
    milestones:structuredClone(MODEL.CONFIG.meta.milestones),
  };
}
