/* ===== characters.js ===== */
/* 캠페인 경제 가안 수치. 전투 CONFIG와 분리한다. */
const CAMPAIGN_CONFIG = {
  saveKey:'slagma.campaign.v5', staminaMax:30, entryCost:5, recoveryMs:300000,
  // 표시 이름은 문자열 테이블에 있다. 여기에는 키만 둔다(세션 3B).
  stageNameKeys:['stage.1','stage.2','stage.3','stage.4','stage.5'],
};
function enemyGrowthLevel(stageId,stageConfig=CONFIG.stage){
  const id=Math.max(1,Math.floor(Number(stageId)||1));
  if(id<=3)return id;
  const step=Math.max(1,Math.floor(Number(stageConfig.enemyGrowthLevelStep)||2));
  return 4+(id-4)*step;
}
function enemyCharacterGrowthScale(stat,stageId,stageConfig=CONFIG.stage){
  const base=CHARACTER_BASE_STATS[stat],growth=GrowthProfileTable.standard[stat];
  if(!(base>0))return 1;
  const factor=LevelGrowthFactor.at(enemyGrowthLevel(stageId,stageConfig),{clamp:false});
  return (base+factor*growth)/base;
}
function enemyDifficultyMul(enemyConfig=DEFAULT_CONFIG.enemy){
  return Math.max(0,Number(enemyConfig.growthDifficultyMul)||1);
}
function stageEnemyDefense(stageId,enemyConfig=DEFAULT_CONFIG.enemy,stageConfig=CONFIG.stage){
  const id=Math.max(1,Math.floor(Number(stageId)||1));
  const freeStages=Math.max(0,Math.floor(Number(enemyConfig.defenseGrowth?.freeStages)||0));
  if(id<=freeStages)return 0;
  const base=Math.max(0,Number(enemyConfig.defenseGrowth?.base)||0);
  return Math.round(base*enemyCharacterGrowthScale('def',id,stageConfig)*enemyDifficultyMul(enemyConfig));
}
// [2026-09-19] 확정(인철): 적 체력과 보상을 둘 다 등비로 바꾼다.
//   - 등차(hpScalePerStage 0.26)는 스테이지 60에서 체력 16.3배인데 플레이어 파워는 750배라, 전투가
//     한계선이 아니었다 — 실제로 막는 것은 스태미나뿐이라 "공략"할 벽이 없었다.
//   - 보상도 등차라 후반 한 칸의 증가율이 +1.6%뿐이어서(초반은 +95%) 반복할 이유가 없었다.
//   - 등비는 성질상 초반이 완만하다 — 체력 공비 1.130은 스테이지 12까지 등차 0.26보다 오히려 쉽고
//     (5스테이지에서 1.47 대 2.04) 13스테이지부터 역전한다. 초반 완충은 introHpMul이 따로 맡는다.
// 초반 완충. 1~3스테이지에만 체력 할인을 주고 4스테이지부터 1.0이다 — 곡선은 등비 그대로 두고
// 튜토리얼 구간의 앞머리만 눌러 둔다(0.70 → 0.75 → 0.80 → 1.00).
function introHpMul(stageId){
  const ramp=CONFIG.stage.introHpMul||[];
  return stageId<=ramp.length ? Number(ramp[stageId-1])||1 : 1;
}
function campaignStage(id){
  const stageId=Math.max(1,Math.floor(Number(id)||1));
  const introMul=introHpMul(stageId);
  const difficultyMul=enemyDifficultyMul(CONFIG.enemy);
  return {
    id:stageId,
    nameKey:CAMPAIGN_CONFIG.stageNameKeys[stageId-1]||'stage.endless',
    waves:Math.min(stageId,3)*10,
    hpScale:enemyCharacterGrowthScale('hp',stageId)*difficultyMul*introMul,
    // [2026-09-23] 확정(인철): HP·공격력·방어력은 캐릭터와 같은 복합 성장식을 공유한다.
    // 1.15 난도 보정은 공통 적용하고 introHpMul은 체력 전용 튜토리얼 완충으로 남긴다.
    atkScale:enemyCharacterGrowthScale('atk',stageId)*difficultyMul,
    // 공비 1.085 — 모든 칸이 +8.5%로 같다. 60스테이지 한 판이 25,000골드로 후반 1레벨(19,377골드)과
    // 맞물려 "한 판 = 한 레벨"이 되고, 등반이 막히면 같은 스테이지 반복이 그대로 성장이 된다.
    waveGold:Math.round(10*Math.pow(CONFIG.stage.goldRatio,stageId-1)),
    clearGold:Math.round(100*Math.pow(CONFIG.stage.goldRatio,stageId-1)),
  };
}
/* Character party meta v3: definition tables → 4-slot formation → growth/wallet → combat.
   Prototype defaults: all owned, 1★ Lv1, max 6★ Lv60. One innate passive can own
   multiple effect rows. Future tier/awakening rows remain locked until explicitly unlocked. */
// 아래 표는 전부 표시 문구가 아니라 문자열 키를 담는다(세션 3B).
const IdentityTable={knight:'identity.knight',noble:'identity.noble',engineer:'identity.engineer',mercenary:'identity.mercenary',exile:'identity.exile'};
const RaceTable={human:'race.human',elf:'race.elf',dwarf:'race.dwarf',beast:'race.beast',demon:'race.demon'};
const CurrencyTable={gold:{nameKey:'currency.gold',storageKey:'gold'},starfire:{nameKey:'currency.starfire',storageKey:null}};
// [2026-09-14] 희귀도 5단계. 이름·색·정렬만 여기서 정하고, 조절 대상 수치는 전부
// CONFIG.meta.rarity에서 읽는다(밸런스 에디터에서 바로 만질 수 있게 하기 위함).
const RarityTable={
  normal:{rarityId:'normal',nameKey:'rarity.normal.name',shortKey:'rarity.normal.short',color:'#B7B7AC',order:1},
  magic: {rarityId:'magic', nameKey:'rarity.magic.name', shortKey:'rarity.magic.short', color:'#5EDBF4',order:2},
  rare:  {rarityId:'rare',  nameKey:'rarity.rare.name',  shortKey:'rarity.rare.short',  color:'#5CCB8A',order:3},
  epic:  {rarityId:'epic',  nameKey:'rarity.epic.name',  shortKey:'rarity.epic.short',  color:'#A876E8',order:4},
  legend:{rarityId:'legend',nameKey:'rarity.legend.name',shortKey:'rarity.legend.short',color:'#DDB86A',order:5},
};
const RARITY_KEYS=Object.keys(RarityTable).sort((a,b)=>RarityTable[a].order-RarityTable[b].order);
function rarityConf(rarityId){ return CONFIG.meta.rarity[rarityId]||CONFIG.meta.rarity.normal; }
const CHARACTER_BASE_STATS={atk:1000,def:5,hp:300};
// 기본 성장 폭. 캐릭터의 실제 값은 여기에 희귀도 배율을 곱한 것이다.
const GrowthProfileTable={standard:{atk:100,def:1,hp:30}};
// [2026-09-17] 레벨 L까지의 누적 성장 배수. blend=0이면 (L-1)이 되어 기존 선형과 완전히 같다.
// 한 레벨 증가폭 = 프로필값 × ((1-blend) + blend × shape(x)/shape(1)), shape(x)=(100+10x+100×floor(x/20))×expBase^x.
// [2026-09-19] 확정(인철): 레벨 상한이 120으로 늘면서 계단 주기를 20으로 맞췄고, blend를 0.35 → 0.60으로
// 올렸다. 비용(levelUpGold)이 Lv.119에서 606배 오르는데 증가폭은 187배만 올라 골드당 능력치가 후반에
// 3.2배 무너졌기 때문이다. blend 0.60 · expBase 1.035면 증가폭이 566배가 되어 비용 곡선과 거의 평탄해진다.
// 레벨은 1~120으로 고정이라 매번 합산하지 않고 최초 1회만 만들어 둔다(CONFIG 변경 시 재생성).
const LevelGrowthFactor={
  cache:null, key:null,
  shape(x,expBase){ return (100+10*x+100*Math.floor(x/20))*Math.pow(expBase,x); },
  table(maxLevel=CharacterGrowthRules.maxLevel){
    const c=CONFIG.meta.character.growthCurve||{blend:0,expBase:1},
          blend=Number(c.blend)||0, expBase=Number(c.expBase)||1, key=`${blend}|${expBase}`;
    if(this.key!==key||!this.cache){this.key=key;this.cache=[0,0];}
    const unit=this.shape(1,expBase),out=this.cache;
    let sum=out[out.length-1]||0;
    for(let x=out.length-1;x<maxLevel;x++){sum+=(1-blend)+blend*this.shape(x,expBase)/unit;out[x+1]=sum;}
    return out;
  },
  at(level,{clamp=true}={}){
    const requested=Math.max(1,Math.floor(level)||1);
    const target=clamp?Math.min(CharacterGrowthRules.maxLevel,requested):requested;
    return this.table(target)[target]||0;
  },
};
// [2026-09-18] 확정(인철): 뽑기를 없앤다. 수호자는 해당 미사일의 공용 레벨이 임계에 닿을 때
// 등급 오름차순으로 열리고, 노말 4명(미사일 1명씩)만 처음부터 지급한다 — 미사일 4슬롯을
// 채우지 못하면 전투 자체가 불가능하기 때문이다.
// [2026-09-19] 확정(인철): 레벨 상한을 60 → 120으로 올린다. 해금 사다리를 등간격(10·20·30·40·50)에서
// 가속 간격(10·25·45·75·120)으로 벌리려면 60레벨 안에 공간이 없었다. 앞부분은 빠르게 열려 성장 맛을 주고,
// 뒷부분은 목표가 멀어져 같은 스테이지를 반복해 공략하는 구간이 된다.
const CharacterGrowthRules={maxStars:6,levelsPerStar:20,freeRarityId:'normal'};
// [2026-09-18] 확정(인철): 레벨과 성급의 소유자를 서로 다르게 둔다 — 레벨은 공용 트랙(LEVEL_TRACKS)이,
// 성급은 캐릭터·스킬 개인이 갖는다. 그래서 둘은 완전히 독립이며 서로의 선행 조건이 아니다.
// 예전에는 성급별 상한(1성=Lv.10, 2성=Lv.20 …)에 도달해야 다음 레벨업·승급이 열렸다(StarTable).
CharacterGrowthRules.maxLevel=CharacterGrowthRules.maxStars*CharacterGrowthRules.levelsPerStar;
/* =====================================================================
   [LEVEL_TRACKS] 공용 레벨 6종 — 미사일 4 + 스킬 슬롯 2
   ---------------------------------------------------------------------
   [2026-09-18] 확정(인철): 레벨을 캐릭터·스킬 개인에게서 떼어 슬롯이 갖게 한다. 연쇄 슬롯에
   누구를 꽂든 연쇄 트랙 레벨을 그대로 쓰므로 수호자를 바꿔도 다시 키울 필요가 없다.
   trackId는 저장 키이자 UI 식별자다 — 미사일은 미사일 키를 그대로 쓰고, 스킬은 슬롯 번호를 붙인다.
   ===================================================================== */
const LEVEL_TRACKS=[
  ...MISSILE_KEYS.map(id=>({trackId:id,kind:'module',moduleId:id,slot:null})),
  ...Array.from({length:DEFAULT_CONFIG.skillPickCount},(_,i)=>({trackId:`skill${i+1}`,kind:'skill',moduleId:null,slot:i})),
];
const TRACK_KEYS=LEVEL_TRACKS.map(track=>track.trackId);
const DEFAULT_EQUIPPED_SKILLS=['strong_single','defense'];
// [2026-09-16] 확정(인철): 스킬 레벨업은 캐릭터와 같은 골드 비용표를 쓴다.
// [2026-09-18] 그 비용표는 이제 스킬 슬롯 트랙이 쓴다 — 스킬마다 따로 청구하지 않는다.
const SKILL_COST_GROUP_ID='standard';
const SkillInventorySystem={
  // [2026-09-18] 레벨은 슬롯 트랙이, 조각은 사라졌다 — 스킬이 개인으로 갖는 건 보유 여부와 성급뿐이다.
  blank(key){return {owned:DEFAULT_EQUIPPED_SKILLS.includes(key),star:1};},
  fresh(){return {equipped:[...DEFAULT_EQUIPPED_SKILLS],skills:Object.fromEntries(SKILL_KEYS.map(key=>[key,this.blank(key)]))};},
  migrate(data){
    if(!data||typeof data!=='object')data=this.fresh();
    data.skills??={};SKILL_KEYS.forEach(key=>{data.skills[key]??=this.blank(key);delete data.skills[key].level;delete data.skills[key].shards;});
    data.equipped=Array.isArray(data.equipped)?data.equipped.filter((key,i,a)=>SKILL_KEYS.includes(key)&&data.skills[key]?.owned&&a.indexOf(key)===i).slice(0,CONFIG.skillPickCount):[];
    DEFAULT_EQUIPPED_SKILLS.forEach(key=>{data.skills[key].owned=true;if(data.equipped.length<CONFIG.skillPickCount&&!data.equipped.includes(key))data.equipped.push(key);});
    return data;
  },
  validate(data){return !!data&&Array.isArray(data.equipped)&&data.equipped.length===CONFIG.skillPickCount&&new Set(data.equipped).size===data.equipped.length&&data.equipped.every(key=>data.skills?.[key]?.owned)&&SKILL_KEYS.every(key=>{const x=data.skills?.[key];return x&&typeof x.owned==='boolean'&&Number.isInteger(x.star)&&x.star>=1&&x.star<=CharacterGrowthRules.maxStars;});},
};
// [2026-09-18] 확정(인철): 성급 상승은 조각이 아니라 별불로 한다(rarity.starfireSteps).
// 그래서 이 표에는 레벨업 행만 남는다. 레벨은 공용 트랙 6종이 가지므로 등급 배율도 붙지 않고,
// 여섯 트랙이 모두 이 표를 그대로 쓴다(LevelTrackSystem.costs).
// [2026-09-17] 확정(인철): 레벨업 골드 = (28 + 3x + 38×floor(x/20)) × 1.030^x  (x = 올리기 전 레벨)
// 선형(3x) + 계단(20레벨마다 +38) + 지수(1.030^x)를 겹친 3단 복합 곡선이다.
//   - 초반을 싸게 둬 새 트랙을 바로 굴려볼 수 있게 한다(Lv.1 = 32골드).
//   - 후반 지수가 한 트랙 몰빵을 손해로 만들어, 규칙 없이도 4미사일 균등 육성이 유리해진다.
// 기존 50+(x-1)×25(선형)는 초반이 비싸 4일차 등반이 11스테이지에서 멈췄다.
// [2026-09-19] 확정(인철): 레벨 상한 60 → 120에 맞춰 expBase 1.046 → 1.030, 계단 주기 10 → 20.
//   - 1.046을 그대로 두면 트랙당 총액이 232만·최종 1레벨이 12만 골드로 터진다(1.030에서 50만·19,377).
//   - 해금 주기가 가속 간격(10·25·45·75·120)이 되어 "계단 주기를 해금 주기와 맞춘다"는 근거는 사라졌다.
//     계단은 이제 리듬용 20레벨 고정이다.
function levelUpGold(x){ return Math.max(1,Math.round((28+3*x+38*Math.floor(x/20))*Math.pow(1.030,x))); }
const GrowthCostTable=[
  ...Array.from({length:CharacterGrowthRules.maxLevel-1},(_,i)=>(
    {costGroupId:'standard',action:'levelUp',step:i+1,currencyId:'gold',amount:levelUpGold(i+1)})),
];
// [2026-09-14] 캐릭터 패시브가 켤 수 있는 미사일 고유 규칙 목록. 규칙마다 어느 미사일에
// 속하는지와 필요한 항목을 못 박아, 캐릭터 데이터의 오타가 조용히 무시되지 않게 한다.
const MODULE_RULE_SPEC={
  unusedTargetBonus:{module:'chain',    fields:['value']},
  secondary:        {module:'explosion',fields:['damagePct','radiusPct']},
  centerDamageBonus:{module:'scatter',  fields:['value']},
  empowered:        {module:'laser',    fields:['chance','damagePct','widthPct']},
  focused:          {module:'laser',    fields:['damagePct']},
};
// 같은 상태가 다시 걸리면 중첩하지 않고 지속시간만 갱신한다(StatusEffectSystem.apply).
const StatusEffectTable={
  shocked:{nameKey:'status.shocked',short:'⚡',color:'#5EDBF4',duration:3},
  melted:{nameKey:'status.melted',short:'♨',color:'#F77A3D',duration:3},
};
const CharacterSeedTable=[
 // [2026-09-21] 확정(인철): 노말~영웅은 자기 강화·타 계열 지원·고유 옵션 1단계 선적용을
 // 두 행으로 조합하며 모든 등급의 2번 행(starEffects)은 3성에 열린다. 퍼센트는 20 이상, 5단위다.
 // 전설은 아스텔·볼칸·키라·오르넬의 4종족/감전 조합과 루헨·모르가·샨·세라프의
 // 마족/융해 조합으로 나눈다. 방어 무시·관통 패시브는 사용하지 않는다.
 {nameKey:'guardian.adel.name',rarityId:'normal',identityId:'knight',raceId:'human',module:'chain',passiveKey:'passive.adel.name',effects:[
  {kind:'factor',scope:'module',factorKey:'attackPct',value:.20}],
  starPassiveKey:'passive.adelStar.name',starEffects:[
  {kind:'module_special',scope:'module',level:1}]},
 {nameKey:'guardian.ricia.name',rarityId:'normal',identityId:'noble',raceId:'elf',module:'explosion',passiveKey:'passive.ricia.name',effects:[
  {kind:'factor',scope:'module',factorKey:'attackSpeedPct',value:.20}],
  starPassiveKey:'passive.riciaStar.name',starEffects:[
  {kind:'factor',scope:'module',targetId:'laser',factorKey:'attackPct',value:.20}]},
 {nameKey:'guardian.bron.name',rarityId:'normal',identityId:'engineer',raceId:'dwarf',module:'scatter',passiveKey:'passive.bron.name',effects:[
  {kind:'module_special',scope:'module',level:1}],
  starPassiveKey:'passive.bronStar.name',starEffects:[
  {kind:'factor',scope:'module',factorKey:'attackSpeedPct',value:.20}]},
 {nameKey:'guardian.tarq.name',rarityId:'normal',identityId:'mercenary',raceId:'beast',module:'laser',passiveKey:'passive.tarq.name',effects:[
  {kind:'factor',scope:'module',targetId:'chain',factorKey:'attackPct',value:.20}],
  starPassiveKey:'passive.tarqStar.name',starEffects:[
  {kind:'factor',scope:'module',factorKey:'attackPct',value:.20}]},
 {nameKey:'guardian.belka.name',rarityId:'magic',identityId:'exile',raceId:'demon',module:'chain',passiveKey:'passive.belka.name',effects:[
  {kind:'factor',scope:'module',factorKey:'attackSpeedPct',value:.25}],
  starPassiveKey:'passive.belkaStar.name',starEffects:[
  {kind:'factor',scope:'module',targetId:'explosion',factorKey:'attackPct',value:.25}]},
 {nameKey:'guardian.kyle.name',rarityId:'magic',identityId:'mercenary',raceId:'human',module:'explosion',passiveKey:'passive.kyle.name',effects:[
  {kind:'module_special',scope:'module',level:1}],
  starPassiveKey:'passive.kyleStar.name',starEffects:[
  {kind:'factor',scope:'module',factorKey:'attackPct',value:.25}]},
 {nameKey:'guardian.seria.name',rarityId:'magic',identityId:'knight',raceId:'elf',module:'scatter',passiveKey:'passive.seria.name',effects:[
  {kind:'factor',scope:'module',targetId:'laser',factorKey:'attackPct',value:.25}],
  starPassiveKey:'passive.seriaStar.name',starEffects:[
  {kind:'module_special',scope:'module',level:1}]},
 {nameKey:'guardian.dorman.name',rarityId:'magic',identityId:'noble',raceId:'dwarf',module:'laser',passiveKey:'passive.dorman.name',effects:[
  {kind:'factor',scope:'module',factorKey:'attackPct',value:.25}],
  starPassiveKey:'passive.dormanStar.name',starEffects:[
  {kind:'module_special',scope:'module',level:1}]},
 {nameKey:'guardian.rokan.name',rarityId:'rare',identityId:'exile',raceId:'beast',module:'chain',passiveKey:'passive.rokan.name',effects:[
  {kind:'module_special',scope:'module',level:1}],
  starPassiveKey:'passive.rokanStar.name',starEffects:[
  {kind:'factor',scope:'module',factorKey:'attackPct',value:.25}]},
 {nameKey:'guardian.azra.name',rarityId:'rare',identityId:'engineer',raceId:'demon',module:'explosion',passiveKey:'passive.azra.name',effects:[
  {kind:'factor',scope:'module',targetId:'scatter',factorKey:'attackPct',value:.25}],
  starPassiveKey:'passive.azraStar.name',starEffects:[
  {kind:'module_special',scope:'module',level:1}]},
 {nameKey:'guardian.yuna.name',rarityId:'rare',identityId:'noble',raceId:'human',module:'scatter',passiveKey:'passive.yuna.name',effects:[
  {kind:'factor',scope:'module',factorKey:'attackPct',value:.25}],
  starPassiveKey:'passive.yunaStar.name',starEffects:[
  {kind:'factor',scope:'module',targetId:'laser',factorKey:'attackPct',value:.25}]},
 {nameKey:'guardian.elion.name',rarityId:'rare',identityId:'exile',raceId:'elf',module:'laser',passiveKey:'passive.elion.name',effects:[
  {kind:'factor',scope:'module',factorKey:'attackSpeedPct',value:.25}],
  starPassiveKey:'passive.elionStar.name',starEffects:[
  {kind:'factor',scope:'module',targetId:'explosion',factorKey:'attackPct',value:.25}]},
 {nameKey:'guardian.grim.name',rarityId:'epic',identityId:'mercenary',raceId:'dwarf',module:'chain',passiveKey:'passive.grim.name',effects:[
  {kind:'factor',scope:'module',targetId:'explosion',factorKey:'attackPct',value:.30}],
  starPassiveKey:'passive.grimStar.name',starEffects:[
  {kind:'factor',scope:'module',factorKey:'attackPct',value:.30}]},
 {nameKey:'guardian.teon.name',rarityId:'epic',identityId:'engineer',raceId:'beast',module:'explosion',passiveKey:'passive.teon.name',effects:[
  {kind:'factor',scope:'module',factorKey:'attackPct',value:.30}],
  starPassiveKey:'passive.teonStar.name',starEffects:[
  {kind:'module_special',scope:'module',level:1}]},
 {nameKey:'guardian.nia.name',rarityId:'epic',identityId:'knight',raceId:'demon',module:'scatter',passiveKey:'passive.nia.name',effects:[
  {kind:'factor',scope:'module',factorKey:'attackSpeedPct',value:.30}],
  starPassiveKey:'passive.niaStar.name',starEffects:[
  {kind:'module_special',scope:'module',level:1}]},
 {nameKey:'guardian.miren.name',rarityId:'epic',identityId:'engineer',raceId:'human',module:'laser',passiveKey:'passive.miren.name',effects:[
  {kind:'module_special',scope:'module',level:1}],
  starPassiveKey:'passive.mirenStar.name',starEffects:[
  {kind:'factor',scope:'module',factorKey:'attackPct',value:.30}]},
 {nameKey:'guardian.astel.name',rarityId:'legend',identityId:'mercenary',raceId:'elf',module:'chain',passiveKey:'passive.astel.name',effects:[
  {kind:'factor',scope:'module',factorKey:'attackPct',value:.30}],
  starPassiveKey:'passive.astelStar.name',starEffects:[
  {kind:'conditional_factor',scope:'global',factorKey:'critChance',value:.20,condition:{type:'all_unique_races'}}]},
 {nameKey:'guardian.volkan.name',rarityId:'legend',identityId:'knight',raceId:'dwarf',module:'explosion',passiveKey:'passive.volkan.name',effects:[
  {kind:'factor',scope:'module',factorKey:'critDamagePct',value:.50}],
  starPassiveKey:'passive.volkanStar.name',starEffects:[
  {kind:'factor',scope:'module',factorKey:'attackPct',value:.30}]},
 {nameKey:'guardian.kira.name',rarityId:'legend',identityId:'noble',raceId:'beast',module:'scatter',passiveKey:'passive.kira.name',effects:[
  {kind:'factor',scope:'module',factorKey:'bossDamagePct',value:.30}],
  starPassiveKey:'passive.kiraStar.name',starEffects:[
  {kind:'damage_vs_status',statusId:'shocked',value:.50}]},
 {nameKey:'guardian.seraph.name',rarityId:'legend',identityId:'exile',raceId:'demon',module:'laser',passiveKey:'passive.seraph.name',effects:[
  {kind:'module_rule',scope:'module',ruleId:'focused',params:{damagePct:.50}}],
  starPassiveKey:'passive.seraphStar.name',starEffects:[
  {kind:'factor',scope:'module',factorKey:'attackSpeedPct',value:.25}]},
 {nameKey:'guardian.ruhen.name',rarityId:'legend',identityId:'engineer',raceId:'elf',module:'chain',passiveKey:'passive.ruhen.name',effects:[
  {kind:'module_rule',scope:'module',ruleId:'unusedTargetBonus',params:{value:.50}}],
  starPassiveKey:'passive.ruhenStar.name',starEffects:[
  {kind:'damage_vs_status',statusId:'melted',value:.50}]},
 {nameKey:'guardian.morga.name',rarityId:'legend',identityId:'mercenary',raceId:'beast',module:'explosion',passiveKey:'passive.morga.name',effects:[
  {kind:'module_rule',scope:'module',ruleId:'secondary',params:{damagePct:.50,radiusPct:.80}}],
  starPassiveKey:'passive.morgaStar.name',starEffects:[
  {kind:'status_on_hit',statusId:'melted',chance:.40}]},
 {nameKey:'guardian.shan.name',rarityId:'legend',identityId:'noble',raceId:'demon',module:'scatter',passiveKey:'passive.shan.name',effects:[
  {kind:'module_rule',scope:'module',ruleId:'centerDamageBonus',params:{value:1.00}}],
  starPassiveKey:'passive.shanStar.name',starEffects:[
  {kind:'conditional_factor',scope:'global',factorKey:'damagePct',value:.30,condition:{type:'race_count',raceId:'demon',count:2}}]},
 {nameKey:'guardian.ornel.name',rarityId:'legend',identityId:'exile',raceId:'human',module:'laser',passiveKey:'passive.ornel.name',effects:[
  {kind:'module_rule',scope:'module',ruleId:'empowered',params:{chance:.40,damagePct:.70,widthPct:1.00}}],
  starPassiveKey:'passive.ornelStar.name',starEffects:[
  {kind:'status_on_hit',statusId:'shocked',chance:.40}]},
];
const CharacterTable={},PassiveTable={},PassiveEffectTable=[],PassiveUnlockTable=[];
// [2026-09-15] 해금은 패시브 단위(PassiveUnlockTable)라 2번 행을 3성에 열려면 패시브를
// 하나 더 만들어야 한다. seed.starEffects가 있으면 CP_xxxS를 star 3 해금으로 추가한다.
const STAR_PASSIVE_UNLOCK = 3;
CharacterSeedTable.forEach((seed,i)=>{
  const suffix=String(i+1).padStart(3,'0'),characterId=`CHR_${suffix}`,passiveId=`CP_${suffix}`;
  const starPassiveId=seed.starEffects?`${passiveId}S`:null;
  CharacterTable[characterId]={characterId,nameKey:seed.nameKey,rarityId:seed.rarityId,identityId:seed.identityId,raceId:seed.raceId,specialtyMissileId:seed.module,innatePassiveId:passiveId,starPassiveId,passiveSlots:{innate:passiveId,star:starPassiveId?[starPassiveId]:[],tier:[],awakening:[]},baseStats:{...CHARACTER_BASE_STATS},growthProfileId:'standard',costGroupId:'standard',sortOrder:i};
  const addRows=(pid,rows,unlockType)=>rows.forEach((effect,effectIndex)=>PassiveEffectTable.push({effectId:`${pid}_E${effectIndex+1}`,passiveId:pid,sourceId:seed.module,operation:'add',stackMode:'add',unlockType,...effect,duration:effect.statusId?(effect.duration??StatusEffectTable[effect.statusId].duration):effect.duration,targetId:effect.scope==='module'?(effect.targetId??seed.module):(effect.targetId??null)}));
  PassiveTable[passiveId]={passiveId,nameKey:seed.passiveKey,category:'innate'};
  PassiveUnlockTable.push({characterId,passiveId,unlockType:'base',unlockValue:1});
  addRows(passiveId,seed.effects,'base');
  if(starPassiveId){
    PassiveTable[starPassiveId]={passiveId:starPassiveId,nameKey:seed.starPassiveKey,category:'star'};
    PassiveUnlockTable.push({characterId,passiveId:starPassiveId,unlockType:'star',unlockValue:STAR_PASSIVE_UNLOCK});
    addRows(starPassiveId,seed.starEffects,'star');
  }
});
const CharacterRepository={
  list(){return Object.values(CharacterTable).sort((a,b)=>a.sortOrder-b.sortOrder);},
  validate(){
    for(const c of this.list())if(!IdentityTable[c.identityId]||!RaceTable[c.raceId]||!MISSILE_DEFS[c.specialtyMissileId]||!PassiveTable[c.innatePassiveId]||!GrowthProfileTable[c.growthProfileId]||!PassiveEffectTable.some(e=>e.passiveId===c.innatePassiveId))throw Error('캐릭터 참조 오류');
    for(const e of PassiveEffectTable){
      if(!PassiveTable[e.passiveId]||!['factor','conditional_factor','module_special','status_on_hit','damage_vs_status','module_rule'].includes(e.kind)||!['add','max'].includes(e.stackMode))throw Error('패시브 효과 오류');
      if(!['module_rule','module_special'].includes(e.kind)&&!Number.isFinite(e.value??e.chance))throw Error('패시브 효과 오류');
      // module_rule은 미사일 고유 규칙을 직접 켠다. 규칙 이름과 항목은 MODULE_RULE_SPEC이 정의하고,
      // CONFIG에 같은 이름의 자리가 실제로 있는지까지 확인해 오타가 조용히 무시되지 않게 한다.
      if(e.kind==='module_rule'){
        const spec=MODULE_RULE_SPEC[e.ruleId];
        if(!spec||!MISSILE_DEFS[e.targetId]||spec.module!==e.targetId)throw Error('미사일 규칙 오류');
        if(!e.params||!spec.fields.every(f=>Number.isFinite(Number(e.params[f]))))throw Error('미사일 규칙 값 오류');
        const slot=DEFAULT_CONFIG.attackModules[e.targetId]?.[e.ruleId];
        if(slot===undefined)throw Error('미사일 규칙 설정 없음');
      }
      if(['factor','conditional_factor'].includes(e.kind)&&(!COMBAT_FACTOR_KEYS.includes(e.factorKey)||!['global','module'].includes(e.scope)||(e.scope==='module'&&!MISSILE_DEFS[e.targetId])))throw Error('패시브 팩터 오류');
      if(e.kind==='conditional_factor'){
        const c=e.condition;
        if(!c||!['all_unique_races','race_count'].includes(c.type)||(c.type==='race_count'&&(!RaceTable[c.raceId]||!Number.isSafeInteger(c.count)||c.count<2)))throw Error('편성 조건 오류');
      }
      if(e.kind==='module_special'&&(!MISSILE_DEFS[e.targetId]||!Number.isSafeInteger(e.level)||e.level<1))throw Error('고유 옵션 패시브 오류');
      if(['status_on_hit','damage_vs_status'].includes(e.kind)&&(!MISSILE_DEFS[e.sourceId]||!StatusEffectTable[e.statusId]))throw Error('상태 시너지 오류');
    }
    for(const u of PassiveUnlockTable)if(!CharacterTable[u.characterId]||!PassiveTable[u.passiveId]||!['base','tier','star','awakening'].includes(u.unlockType))throw Error('패시브 해금 오류');
    for(const c of GrowthCostTable)if(!CurrencyTable[c.currencyId]||!Number.isSafeInteger(c.amount)||c.amount<0)throw Error('성장 비용 오류');
  },
};
const DEFAULT_FORMATION={chain:'CHR_001',explosion:'CHR_002',scatter:'CHR_003',laser:'CHR_004'};
const CharacterInventorySystem={
  // [2026-09-14] 캐릭터가 늘어나면 기존 저장에는 그 항목이 없어 validate가 통째로 실패한다.
  // 저장을 버리는 대신 빠진 캐릭터만 신규 기본값으로 채운다(보유 진행은 그대로 유지).
  // [2026-09-18] 레벨은 공용 트랙이, 조각은 사라졌다 — 캐릭터가 개인으로 갖는 건 보유·성급·단계뿐이다.
  blank(c){return {owned:c.rarityId===CharacterGrowthRules.freeRarityId,star:1,tier:0,awakening:0};},
  migrate(data){
    if(!data||typeof data!=='object'||!data.characters) return data;
    CharacterRepository.list().forEach(c=>{
      const x=data.characters[c.characterId];
      if(!x){ data.characters[c.characterId]=this.blank(c); return; }
      delete x.level; delete x.shards;   // 공용 레벨 전환·조각 폐지 보정
    });
    // 미사일 4슬롯을 채울 수 없는 저장은 기본 지급 캐릭터로 되돌린다(전투 불가 방지).
    CONFIG.moduleKeys.forEach(module=>{
      const cur=data.formation?.[module];
      if(cur&&CharacterTable[cur]?.specialtyMissileId===module&&data.characters[cur]?.owned) return;
      const fallback=CharacterRepository.list().find(c=>c.specialtyMissileId===module&&data.characters[c.characterId]?.owned)
        ||CharacterRepository.list().find(c=>c.specialtyMissileId===module&&c.rarityId===CharacterGrowthRules.freeRarityId);
      if(fallback){ data.formation??={}; data.formation[module]=fallback.characterId; data.characters[fallback.characterId].owned=true; }
    });
    return data;
  },
  fresh(){return {formation:{...DEFAULT_FORMATION},characters:Object.fromEntries(CharacterRepository.list().map(c=>[c.characterId,this.blank(c)]))};},
  validateFormation(data){
    if(!data?.formation||!CONFIG.moduleKeys.every(module=>{
      const id=data.formation[module],c=CharacterTable[id];return !!c&&c.specialtyMissileId===module&&data.characters?.[id]?.owned===true;
    }))return false;
    return new Set(CONFIG.moduleKeys.map(module=>data.formation[module])).size===CONFIG.moduleKeys.length;
  },
  validate(data){return !!data&&this.validateFormation(data)&&CharacterRepository.list().every(c=>{
    const x=data.characters[c.characterId];return x&&typeof x.owned==='boolean'&&Number.isInteger(x.star)&&x.star>=1&&x.star<=CharacterGrowthRules.maxStars&&Number.isInteger(x.tier)&&x.tier>=0&&Number.isInteger(x.awakening)&&x.awakening>=0;
  });},
};
// Gold remains in the existing campaign field for reward compatibility; new currencies
// live in balances. All spending uses this adapter, never a currency-specific growth branch.
const WalletSystem={
  balance(s,id){const d=CurrencyTable[id];return d?Number(d.storageKey?s[d.storageKey]:(s.balances||{})[id]||0):NaN;},
  totals(costs){const totals={};for(const c of costs){if(!CurrencyTable[c.currencyId]||!Number.isSafeInteger(c.amount)||c.amount<0)throw Error('비용 오류');totals[c.currencyId]=(totals[c.currencyId]||0)+c.amount;}return totals;},
  canPay(s,costs){return Object.entries(this.totals(costs)).every(([id,n])=>Number.isSafeInteger(n)&&this.balance(s,id)>=n);},
  earn(s,id,n){const d=CurrencyTable[id];if(!d||!Number.isSafeInteger(n)||n<0)return false;if(d.storageKey)s[d.storageKey]=(Number(s[d.storageKey])||0)+n;else{s.balances??={};s.balances[id]=(Number(s.balances[id])||0)+n;}return true;},
  spend(s,costs){if(!this.canPay(s,costs))return false;for(const [id,n] of Object.entries(this.totals(costs))){const d=CurrencyTable[id];if(d.storageKey)s[d.storageKey]-=n;else{ s.balances??={};s.balances[id]=(s.balances[id]||0)-n;}}return true;},
};
/* =====================================================================
   [GrowthRules] 캐릭터·스킬 공통 성급 규칙
   ---------------------------------------------------------------------
   [2026-09-16 v0916_7] 두 시스템에 같은 코드로 복제돼 있던 허용 판정·거래 절차·성급 배율을 모았다.
   [2026-09-18 개편] 레벨업이 공용 트랙(LevelTrackSystem)으로 빠져나가면서 여기에는 승급만 남았다.
   승급 재료는 조각이 아니라 별불이며, 레벨 조건 없이 다음 성급이 남아 있고 별불이 있으면 바로 연다.
   ===================================================================== */
const GrowthRules={
  allowed(x){return !!x?.owned&&x.star<CharacterGrowthRules.maxStars;},
  // 누적 성급 배율. 부동소수 누적 오차가 반올림 경계를 흔들지 않도록 소수 9자리에서 정리한다.
  starMultiplier(steps,star){
    const n=Math.max(1,Number(star)||1);
    let mul=1;
    for(let i=1;i<n;i++) mul*=(1+(Number(steps?.[i])||0));
    return Math.round(mul*1e9)/1e9;
  },
  // select(next)는 저장 사본에서 승급 대상 항목을 고른다(없으면 거래하지 않는다).
  // kind·id는 분석 이벤트용이다. 캐릭터·스킬 두 경로가 모두 이 한 곳을 지나므로 star_up을 여기서 한 번만 부른다.
  rankUp(campaign,select,{cost,kind,id}){
    if(GameState.current!=='lobby'||!campaign.read()||campaign.state.active)return false;
    const next=cloneConfig(campaign.state),x=select(next);
    if(!this.allowed(x))return false;
    const need=cost(x);
    if(!(need>0)||!WalletSystem.spend(next,[{currencyId:CONFIG.meta.growth.starfireCurrencyId,amount:need}]))return false;
    x.star++;
    if(!campaign.commit(next))return false;
    Analytics.track('star_up',{kind,id,star:x.star});
    campaign.render();return true;
  },
};
/* =====================================================================
   [LevelTrackSystem] 공용 레벨 6종의 저장·비용·레벨업
   ---------------------------------------------------------------------
   [2026-09-18] 확정(인철): 예전 뽑기 창이 이 여섯 트랙을 올리는 창이 됐다. 트랙 하나를 올리면
   골드를 쓰고, 그 결과로 수호자·스킬이 열릴 수 있다(UnlockSystem). 해금까지 한 거래로 묶어
   저장이 레벨만 오르고 해금은 빠지는 어긋난 상태가 생기지 않게 한다.
   ===================================================================== */
const LevelTrackSystem={
  track(trackId){return LEVEL_TRACKS.find(x=>x.trackId===trackId)||null;},
  fresh(){return Object.fromEntries(TRACK_KEYS.map(key=>[key,1]));},
  migrate(data){
    const out=(data&&typeof data==='object'&&!Array.isArray(data))?data:{};
    TRACK_KEYS.forEach(key=>{
      const n=Number(out[key]);
      out[key]=Number.isSafeInteger(n)?Math.max(1,Math.min(CharacterGrowthRules.maxLevel,n)):1;
    });
    Object.keys(out).forEach(key=>{if(!TRACK_KEYS.includes(key))delete out[key];});
    return out;
  },
  validate(data){return !!data&&typeof data==='object'&&!Array.isArray(data)&&TRACK_KEYS.every(key=>Number.isInteger(data[key])&&data[key]>=1&&data[key]<=CharacterGrowthRules.maxLevel);},
  level(state,trackId){const n=Number(state?.trackLevels?.[trackId]);return Number.isSafeInteger(n)&&n>=1?n:1;},
  moduleLevel(state,moduleId){return this.level(state,moduleId);},
  slotLevel(state,slot){return this.level(state,`skill${(Number(slot)||0)+1}`);},
  // 장착하지 않은 스킬에는 트랙이 없다 — 상세 화면은 1번 슬롯에 넣었을 때를 미리 보여준다.
  skillLevel(state,key){const slot=state?.skillInventory?.equipped?.indexOf(key);return slot>=0?this.slotLevel(state,slot):this.slotLevel(state,0);},
  // 스킬 해금 판정에 쓰는 두 슬롯 레벨 합계.
  skillLevelTotal(state){return LEVEL_TRACKS.filter(x=>x.kind==='skill').reduce((sum,x)=>sum+this.level(state,x.trackId),0);},
  moduleLevelTotal(state){return MISSILE_KEYS.reduce((sum,id)=>sum+this.level(state,id),0);},
  allowed(level){return level<CharacterGrowthRules.maxLevel;},
  costs(level){return GrowthCostTable.filter(r=>r.costGroupId===SKILL_COST_GROUP_ID&&r.action==='levelUp'&&r.step===level).map(r=>({...r}));},
  cost(level){return this.costs(level)[0]?.amount||0;},
  payable(state,level){const c=this.costs(level);return !!c.length&&WalletSystem.canPay(state,c);},
  // 성공하면 이번 레벨업으로 열린 대상 목록을 돌려준다(없으면 빈 배열). 실패는 null이다.
  levelUp(campaign,trackId){
    const track=this.track(trackId);
    if(!track||GameState.current!=='lobby'||!campaign.read()||campaign.state.active)return null;
    const next=cloneConfig(campaign.state),level=this.level(next,trackId);
    if(!this.allowed(level))return null;
    const costs=this.costs(level);
    if(!costs.length||!WalletSystem.spend(next,costs))return null;
    next.trackLevels[trackId]=level+1;
    const unlocked=UnlockSystem.apply(next);
    if(!campaign.commit(next))return null;
    Analytics.track('level_up',{kind:track.kind,id:trackId,level:level+1});
    campaign.render();
    return unlocked;
  },
};
/* =====================================================================
   [UnlockSystem] 트랙 레벨이 여는 수호자·스킬
   ---------------------------------------------------------------------
   [2026-09-18] 확정(인철): 수호자는 자기 미사일 트랙 레벨이 임계에 닿으면 등급 오름차순으로
   순서대로 열린다(무작위 없음). 스킬은 두 슬롯 레벨의 합계가 임계를 넘을 때마다 미보유 스킬
   중 하나를 무작위로 열며, 이미 가진 스킬은 다시 나오지 않는다.

   해금 상태는 저장(owned)에 남기지만, 몇 명이 열려 있어야 하는지는 언제나 레벨에서 다시
   계산할 수 있다. 그래서 apply()는 레벨을 기준으로 빠진 것만 채우는 방식이며, 해금을 놓친
   저장이나 임계값을 바꾼 뒤의 저장도 다음 호출에서 저절로 맞춰진다.
   스킬만은 무작위라 되돌릴 수 없으므로, 열린 개수(quota)만 맞추고 무엇이 열렸는지는 저장을 따른다.
   ===================================================================== */
const UnlockSystem={
  roster(moduleId){return CharacterRepository.list().filter(c=>c.specialtyMissileId===moduleId);},
  // 레벨 L에서 열려 있어야 하는 인원 = 무료 1명 + 임계를 넘긴 수.
  moduleQuota(level){return 1+(CONFIG.meta.growth.moduleUnlockLevels||[]).filter(n=>level>=n).length;},
  // 그 미사일에서 index번째(0부터) 수호자가 열리는 레벨. 0번은 처음부터 지급이라 1이다.
  moduleUnlockLevel(index){return index<=0?1:Number((CONFIG.meta.growth.moduleUnlockLevels||[])[index-1])||0;},
  // 아직 안 열린 수호자가 열리는 레벨(전부 열렸으면 0).
  nextUnlockLevel(state,moduleId){
    const roster=this.roster(moduleId),owned=state?.characterInventory?.characters||{};
    const index=roster.findIndex(c=>!owned[c.characterId]?.owned);
    return index<0?0:this.moduleUnlockLevel(index);
  },
  // [2026-09-19] 해금 임계가 등차(start+step×n)에서 가속 배열로 바뀌었다 — 넘긴 칸 수를 그대로 센다.
  skillUnlockLevels(){return (CONFIG.meta.growth.skillUnlockLevels||[]).map(Number).filter(n=>n>0);},
  skillQuota(total){return this.skillUnlockLevels().filter(n=>total>=n).length;},
  nextSkillTotal(state){
    const levels=this.skillUnlockLevels();
    const opened=SKILL_KEYS.filter(key=>state?.skillInventory?.skills?.[key]?.owned).length-DEFAULT_EQUIPPED_SKILLS.length;
    return opened>=SKILL_KEYS.length-DEFAULT_EQUIPPED_SKILLS.length?0:(levels[Math.max(0,opened)]||0);
  },
  // next(저장 사본)에 레벨이 여는 것들을 채우고, 이번에 새로 열린 목록을 돌려준다.
  // 결과 항목은 공개 연출(RevealUI)이 그대로 쓰는 형식이다.
  apply(next){
    const opened=[];
    MISSILE_KEYS.forEach(moduleId=>{
      const roster=this.roster(moduleId),quota=Math.min(roster.length,this.moduleQuota(LevelTrackSystem.moduleLevel(next,moduleId)));
      roster.slice(0,quota).forEach(c=>{
        const x=next.characterInventory.characters[c.characterId];
        if(!x||x.owned)return;
        x.owned=true;
        opened.push({type:'character',characterId:c.characterId,nameKey:c.nameKey,rarityId:c.rarityId,moduleId});
      });
    });
    const quota=Math.min(SKILL_KEYS.length-DEFAULT_EQUIPPED_SKILLS.length,this.skillQuota(LevelTrackSystem.skillLevelTotal(next)));
    for(let i=SKILL_KEYS.filter(key=>next.skillInventory.skills[key]?.owned).length-DEFAULT_EQUIPPED_SKILLS.length;i<quota;i++){
      const pool=SKILL_KEYS.filter(key=>!next.skillInventory.skills[key]?.owned);
      if(!pool.length)break;
      const key=choice(pool);
      next.skillInventory.skills[key].owned=true;
      opened.push({type:'skill',skillKey:key,nameKey:CONFIG.skills[key].nameKey});
    }
    return opened;
  },
};
const SkillGrowthSystem={
  effectMultiplier(star){return GrowthRules.starMultiplier(CONFIG.meta.skill.starStepPct,star);},
  // growth='duration' 스킬은 수치가 고정이고 성급마다 지속시간이 늘어난다. 그 외는 성급 배율이 수치를 올린다.
  effect(key,x){const d=CONFIG.skills[key];return d.growth==='duration'?d.baseEffect:d.baseEffect*this.effectMultiplier(x?.star||1);},
  duration(key,x){const d=CONFIG.skills[key];if(!(Number(d.durationSec)>0))return 0;return d.durationSec+(d.growth==='duration'?(Math.max(1,x?.star||1)-1)*(Number(d.durationPerStar)||0):0);},
  cooldown(key){
    const d=CONFIG.skills[key];
    // [2026-09-17] 지속형 쿨타임 자동 계산은 폐지돼 현재 이 플래그를 쓰는 스킬이 없다(전부 첫 줄에서 반환).
    // 되돌릴 여지를 남겨 계산 경로는 유지한다.
    if(!d.cooldownFromMaxDuration)return d.cooldownSec;
    const max=d.durationSec+(CharacterGrowthRules.maxStars-1)*(Number(d.durationPerStar)||0);
    return Math.round(max/(1-clamp(Number(CONFIG.meta.skill.durationUptimeGap)||0,0,0.9))*10)/10;
  },
  // [2026-09-18] 표시·계산에 쓰는 스킬 한 벌. 저장에 없는 레벨을 슬롯 트랙에서 붙여 준다 —
  // 이 한 곳만 지나면 stats()·effectText() 같은 기존 호출부를 고치지 않아도 된다.
  view(state,key){return {...state.skillInventory.skills[key],level:LevelTrackSystem.skillLevel(state,key)};},
  stats(key,x){
    const d=CONFIG.skills[key],level=Math.max(1,x?.level||1);
    return Object.fromEntries(['atk','def','hp'].map(stat=>{const value=(Number(d.stats.base[stat])||0)+(level-1)*(Number(d.stats.perLevel[stat])||0);return [stat,stat==='def'?Math.round(value*10)/10:Math.round(value)];}));
  },
  starfireCost(x){return Number(CONFIG.meta.skill.starfireSteps[x.star-1])||0;},
  allowed(x){return GrowthRules.allowed(x);},
  payable(state,x){const need=this.starfireCost(x);return need>0&&WalletSystem.balance(state,CONFIG.meta.growth.starfireCurrencyId)>=need;},
  rankUp(campaign,key){
    return GrowthRules.rankUp(campaign,next=>SKILL_KEYS.includes(key)?next.skillInventory.skills[key]:null,{kind:'skill',id:key,cost:x=>this.starfireCost(x)});
  },
  equip(campaign,key,slot){
    if(GameState.current!=='lobby'||!campaign.read()||campaign.state.active||!campaign.state.skillInventory.skills[key]?.owned||!Number.isInteger(slot)||slot<0||slot>=CONFIG.skillPickCount)return false;
    const next=cloneConfig(campaign.state),other=next.skillInventory.equipped.indexOf(key);
    if(other>=0){const displaced=next.skillInventory.equipped[slot];next.skillInventory.equipped[other]=displaced;}
    next.skillInventory.equipped[slot]=key;
    if(new Set(next.skillInventory.equipped).size!==CONFIG.skillPickCount)return false;
    if(!campaign.commit(next))return false;campaign.render();return true;
  },
};
const SkillCombatAdapter={
  snapshot(state){
    const inv=state.skillInventory;
    // 장착 슬롯의 공용 레벨이 곧 그 스킬의 레벨이다 — 어떤 스킬을 꽂아도 슬롯 레벨을 그대로 쓴다.
    const equipped=inv.equipped.map((key,slot)=>{const owned={...inv.skills[key],level:LevelTrackSystem.slotLevel(state,slot)};return {key,nameKey:CONFIG.skills[key].nameKey,level:owned.level,star:owned.star,effect:SkillGrowthSystem.effect(key,owned),duration:SkillGrowthSystem.duration(key,owned),cooldownSec:SkillGrowthSystem.cooldown(key),stats:SkillGrowthSystem.stats(key,owned)};});
    const stats=equipped.reduce((sum,item)=>{for(const key of ['atk','def','hp'])sum[key]+=item.stats[key];return sum;},{atk:0,def:0,hp:0});
    return {equipped,stats};
  },
};
const CharacterGrowthSystem={
  // 기본 능력치와 레벨당 성장 모두에 희귀도 배율을 곱한다. 노말이 1.00이라
  // 기존 전투 밸런스(기본 공격력 1,000)는 그대로 남는다.
  // [2026-09-15] 성급 누적 배율. 계산은 스킬과 같은 GrowthRules.starMultiplier를 쓴다.
  starMul(star){ return GrowthRules.starMultiplier(CONFIG.meta.character.starStepPct,star); },
  // [2026-09-18] 전속 미사일 배율. CONFIG.attackModules[key].baseDamageMul에 있던 값을 옮긴 것이라
  // 공격력에만 곱한다(방어력·체력은 종전대로 건드리지 않는다).
  moduleMul(id){ return Number(CONFIG.meta.character.moduleAtkMul?.[CharacterTable[id]?.specialtyMissileId])||1; },
  // [2026-09-18] 표시·계산에 쓰는 수호자 한 벌. 레벨은 전속 미사일 트랙에서 온다 —
  // 같은 슬롯의 수호자끼리는 등급·성급만 다르고 레벨은 언제나 같다.
  view(state,id){return {...state.characterInventory.characters[id],level:LevelTrackSystem.moduleLevel(state,CharacterTable[id]?.specialtyMissileId)};},
  stats(id,owned){
    const c=CharacterTable[id],g=GrowthProfileTable[c.growthProfileId],mul=rarityConf(c.rarityId).statMul;
    const star=this.starMul(owned?.star);
    const grown=LevelGrowthFactor.at(owned?.level||1);
    const module=this.moduleMul(id);
    return Object.fromEntries(['atk','def','hp'].map(k=>[k,Math.round((c.baseStats[k]+grown*g[k])*mul*star*(k==='atk'?module:1))]));
  },
  // 승급은 별불이다. 등급이 높을수록 비싸다(레벨은 공용 트랙이라 여기서 관여하지 않는다).
  starfireCost(id,x){
    const steps=rarityConf(CharacterTable[id].rarityId).starfireSteps||[];
    return Number(steps[x.star-1])||0;
  },
  allowed(x){return GrowthRules.allowed(x);},
  payable(state,id,x){const need=this.starfireCost(id,x);return need>0&&WalletSystem.balance(state,CONFIG.meta.growth.starfireCurrencyId)>=need;},
  rankUp(campaign,id){
    return GrowthRules.rankUp(campaign,next=>CharacterTable[id]?next.characterInventory.characters[id]:null,{kind:'character',id,cost:x=>this.starfireCost(id,x)});
  },
  assign(campaign,id){
    if(GameState.current!=='lobby'||!campaign.read()||campaign.state.active||!campaign.state.characterInventory.characters[id]?.owned)return false;
    const character=CharacterTable[id];if(!character)return false;
    const next=cloneConfig(campaign.state);next.characterInventory.formation[character.specialtyMissileId]=id;
    if(!CharacterInventorySystem.validateFormation(next.characterInventory))return false;
    if(!campaign.commit(next))return false;campaign.render();return true;
  },
};
const PartyCombatAdapter={
  unlockedPassiveIds(c,owned){
    return PassiveUnlockTable.filter(u=>u.characterId===c.characterId&&(
      u.unlockType==='base'||(u.unlockType==='tier'&&owned.tier>=u.unlockValue)||(u.unlockType==='star'&&owned.star>=u.unlockValue)||(u.unlockType==='awakening'&&owned.awakening>=u.unlockValue)
    )).map(u=>u.passiveId);
  },
  conditionMet(condition,members){
    if(condition?.type==='all_unique_races')return new Set(members.map(m=>m.raceId)).size===members.length;
    if(condition?.type==='race_count')return members.filter(m=>m.raceId===condition.raceId).length>=condition.count;
    return false;
  },
  snapshot(state){
    const inv=state.characterInventory,factors={global:{},modules:{}},members=[],effects=[],moduleRules={},specialBonuses={};
    CONFIG.moduleKeys.forEach(module=>{
      // 레벨은 편성한 수호자가 아니라 그 미사일 트랙이 갖는다(CharacterGrowthSystem.view).
      const id=inv.formation[module],c=CharacterTable[id],owned=CharacterGrowthSystem.view(state,id),stats=CharacterGrowthSystem.stats(id,owned);
      members.push({characterId:id,nameKey:c.nameKey,raceId:c.raceId,specialtyMissileId:module,level:owned.level,star:owned.star,stats,passiveIds:this.unlockedPassiveIds(c,owned)});
    });
    const passiveIds=new Set(members.flatMap(m=>m.passiveIds));
    PassiveEffectTable.filter(e=>passiveIds.has(e.passiveId)).forEach(e=>{
      if(e.kind==='factor'||(e.kind==='conditional_factor'&&this.conditionMet(e.condition,members))){
        const bucket=e.scope==='global'?factors.global:(factors.modules[e.targetId]??={});
        bucket[e.factorKey]=e.stackMode==='add'?(bucket[e.factorKey]||0)+e.value:Math.max(bucket[e.factorKey]||0,e.value);
      }
      if(e.kind==='module_special'){
        const def=CONFIG.attackModules[e.targetId],spec=MISSILE_DEFS[e.targetId]?.special;
        const table=spec&&def?.[spec.table],index=Array.isArray(table)?Math.min(table.length-1,e.level-1):-1;
        if(index>=0)specialBonuses[e.targetId]=(specialBonuses[e.targetId]||0)+(Number(table[index])||0);
      }
      if(['status_on_hit','damage_vs_status'].includes(e.kind))effects.push({...e});
      if(e.kind==='module_rule'){
        const bucket=(moduleRules[e.targetId]??={});
        const rule=(bucket[e.ruleId]??={});
        Object.entries(e.params||{}).forEach(([k,v])=>{ rule[k]=(rule[k]||0)+(Number(v)||0); });
      }
    });
    const skillSnapshot=SkillCombatAdapter.snapshot(state),bonus=skillSnapshot.stats;
    const attackByModule=Object.fromEntries(members.map(m=>[m.specialtyMissileId,m.stats.atk+bonus.atk]));
    const stats={atk:members.reduce((sum,m)=>sum+m.stats.atk,0)/members.length+bonus.atk,def:members.reduce((sum,m)=>sum+m.stats.def,0)+bonus.def,hp:members.reduce((sum,m)=>sum+m.stats.hp,0)+bonus.hp};
    return {formation:{...inv.formation},members,stats,attackByModule,factors,effects,moduleRules,specialBonuses,skills:skillSnapshot};
  },
};
CharacterRepository.validate();

