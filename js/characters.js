/* ===== characters.js ===== */
/* 캠페인 경제 가안 수치. 전투 CONFIG와 분리한다. */
const CAMPAIGN_CONFIG = {
  saveKey:'slagma.campaign.v4', staminaMax:30, entryCost:5, recoveryMs:300000,
  // 표시 이름은 문자열 테이블에 있다. 여기에는 키만 둔다(세션 3B).
  stageNameKeys:['stage.1','stage.2','stage.3','stage.4','stage.5'],
};
function stageEnemyDefense(stageId,enemyConfig=DEFAULT_CONFIG.enemy){
  const id=Math.max(1,Math.floor(Number(stageId)||1));
  const freeStages=Math.max(0,Math.floor(Number(enemyConfig.defenseGrowth?.freeStages)||0));
  const perStage=Math.max(0,Number(enemyConfig.defenseGrowth?.perStage)||0);
  return Math.max(0,id-freeStages)*perStage;
}
function campaignStage(id){
  const stageId=Math.max(1,Math.floor(Number(id)||1));
  const stageOneHpMul=stageId===1 ? DEFAULT_CONFIG.stage.stageOneHpMul : 1;
  return {
    id:stageId,
    nameKey:CAMPAIGN_CONFIG.stageNameKeys[stageId-1]||'stage.endless',
    waves:Math.min(stageId,3)*10,
    hpScale:(1+(stageId-1)*CONFIG.stage.hpScalePerStage)*stageOneHpMul,
    atkScale:1+(stageId-1)*.15,
    waveGold:10+(stageId-1)*2,
    clearGold:100+(stageId-1)*50,
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
// 기본 성장 폭. 캐릭터의 실제 값은 여기에 희귀도 배율을 곱한 것이다.
const GrowthProfileTable={standard:{atk:100,def:1,hp:30}};
// [2026-09-17] 레벨 L까지의 누적 성장 배수. blend=0이면 (L-1)이 되어 기존 선형과 완전히 같다.
// 한 레벨 증가폭 = 프로필값 × ((1-blend) + blend × shape(x)/shape(1)), shape(x)=(100+10x+100×floor(x/10))×expBase^x.
// 레벨은 1~60으로 고정이라 매번 합산하지 않고 최초 1회만 만들어 둔다(CONFIG 변경 시 재생성).
const LevelGrowthFactor={
  cache:null, key:null,
  shape(x,expBase){ return (100+10*x+100*Math.floor(x/10))*Math.pow(expBase,x); },
  table(){
    const c=CONFIG.meta.character.growthCurve||{blend:0,expBase:1},
          blend=Number(c.blend)||0, expBase=Number(c.expBase)||1, key=`${blend}|${expBase}`;
    if(this.key===key&&this.cache) return this.cache;
    const unit=this.shape(1,expBase), out=[0,0];
    let sum=0;
    for(let x=1;x<CharacterGrowthRules.maxLevel;x++){ sum+=(1-blend)+blend*this.shape(x,expBase)/unit; out[x+1]=sum; }
    this.key=key; this.cache=out; return out;
  },
  at(level){ const table=this.table(); return table[Math.max(1,Math.min(table.length-1,Math.floor(level)||1))]||0; },
};
// [2026-09-14] 확정(인철): 캐릭터는 뽑기로 연다. 다만 미사일 4슬롯을 채우지 못하면 전투
// 자체가 불가능하므로, 노말 4명(미사일 1명씩)만 처음부터 지급한다.
const CharacterGrowthRules={maxStars:6,levelsPerStar:10,freeRarityId:'normal'};
// [2026-09-18] 확정(인철): 레벨업과 성급 돌파를 서로 독립으로 뗀다 — 레벨은 성급과 무관하게
// 전역 상한(maxLevel)까지 바로 올릴 수 있고, 성급도 레벨 상한 도달 없이 조각만 있으면 올린다.
// 예전에는 성급별 상한(1성=Lv.10, 2성=Lv.20 …)에 도달해야 다음 레벨업·승급이 열렸다(StarTable).
CharacterGrowthRules.maxLevel=CharacterGrowthRules.maxStars*CharacterGrowthRules.levelsPerStar;
const DEFAULT_EQUIPPED_SKILLS=['strong_single','defense'];
// [2026-09-16] 확정(인철): 스킬 레벨업은 캐릭터와 같은 골드 비용표를 쓴다.
const SKILL_COST_GROUP_ID='standard';
const SkillInventorySystem={
  blank(key){return {owned:DEFAULT_EQUIPPED_SKILLS.includes(key),level:1,star:1,shards:0};},
  fresh(){return {equipped:[...DEFAULT_EQUIPPED_SKILLS],skills:Object.fromEntries(SKILL_KEYS.map(key=>[key,this.blank(key)]))};},
  migrate(data){
    if(!data||typeof data!=='object')data=this.fresh();
    data.skills??={};SKILL_KEYS.forEach(key=>{data.skills[key]??=this.blank(key);if(!Number.isInteger(data.skills[key].shards)||data.skills[key].shards<0)data.skills[key].shards=0;});
    data.equipped=Array.isArray(data.equipped)?data.equipped.filter((key,i,a)=>SKILL_KEYS.includes(key)&&data.skills[key]?.owned&&a.indexOf(key)===i).slice(0,CONFIG.skillPickCount):[];
    DEFAULT_EQUIPPED_SKILLS.forEach(key=>{data.skills[key].owned=true;if(data.equipped.length<CONFIG.skillPickCount&&!data.equipped.includes(key))data.equipped.push(key);});
    return data;
  },
  validate(data){return !!data&&Array.isArray(data.equipped)&&data.equipped.length===CONFIG.skillPickCount&&new Set(data.equipped).size===data.equipped.length&&data.equipped.every(key=>data.skills?.[key]?.owned)&&SKILL_KEYS.every(key=>{const x=data.skills?.[key];return x&&typeof x.owned==='boolean'&&Number.isInteger(x.level)&&x.level>=1&&x.level<=CharacterGrowthRules.maxLevel&&Number.isInteger(x.star)&&x.star>=1&&x.star<=CharacterGrowthRules.maxStars&&Number.isInteger(x.shards)&&x.shards>=0;});},
};
// [2026-09-14] 확정(인철): 성급 상승은 골드가 아니라 동일 캐릭터 조각으로 한다.
// 그래서 rankUp 골드 행을 없앴다. 아래는 레벨업 기준 비용이며, 실제 청구액은
// 희귀도별 levelCostMul을 곱한 값이다(CharacterGrowthSystem.costs 참고).
// [2026-09-17] 확정(인철): 레벨업 골드 = (28 + 3x + 38×floor(x/10)) × 1.046^x  (x = 올리기 전 레벨)
// 선형(3x) + 성급 경계 계단(10레벨마다 +38) + 지수(1.046^x)를 겹친 3단 복합 곡선이다.
//   - 초반을 싸게 둬 새로 얻은 수호자를 바로 굴려볼 수 있게 한다(Lv.1 = 32골드).
//   - 계단 주기를 승급 주기(10레벨)와 맞춰 돌파 지점이 리듬으로 느껴지게 한다.
//   - 후반 지수가 한 명 몰빵을 손해로 만들어, 규칙 없이도 4인 균등 육성이 유리해진다.
// 기존 50+(x-1)×25(선형)는 초반이 비싸 4일차 등반이 11스테이지에서 멈췄다.
function levelUpGold(x){ return Math.max(1,Math.round((28+3*x+38*Math.floor(x/10))*Math.pow(1.046,x))); }
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
 // [2026-09-15] 확정(인철): 능력(factor) 구조는 남기되 배치 비중을 줄이고, 분류는
 // 훅 / 부여 / 참조 / 시너지 네 가지를 주로 쓴다. 상태는 감전·융해 2종.
 // 1번 행은 즉시, 2번 행(starEffects)은 3성 해금. 노말·매직은 1행뿐이며 수치 배율만 받는 거쳐가는 등급이다.
 // 슬롯마다 부여감전·부여융해·참조감전·참조융해 네 조합이 모두 있고, 등급마다 부여·참조가 같은 상태로 짝이 맞는다.
 {nameKey:'guardian.adel.name',rarityId:'normal',identityId:'knight',raceId:'human',module:'chain',passiveKey:'passive.adel.name',effects:[
  {kind:'status_on_hit',statusId:'shocked',chance:.30}]},
 {nameKey:'guardian.ricia.name',rarityId:'normal',identityId:'noble',raceId:'elf',module:'explosion',passiveKey:'passive.ricia.name',effects:[
  {kind:'damage_vs_status',statusId:'shocked',value:.40}]},
 {nameKey:'guardian.bron.name',rarityId:'normal',identityId:'engineer',raceId:'dwarf',module:'scatter',passiveKey:'passive.bron.name',effects:[
  {kind:'formation_factor',scope:'module',factorKey:'attackSpeedPct',value:.06,condition:{tagType:'identity',tagId:'engineer',count:2}}]},
 {nameKey:'guardian.tarq.name',rarityId:'normal',identityId:'mercenary',raceId:'beast',module:'laser',passiveKey:'passive.tarq.name',effects:[
  {kind:'formation_factor',scope:'module',factorKey:'damagePct',value:.08,condition:{tagType:'race',tagId:'beast',count:2}}]},
 {nameKey:'guardian.belka.name',rarityId:'magic',identityId:'exile',raceId:'demon',module:'chain',passiveKey:'passive.belka.name',effects:[
  {kind:'formation_factor',scope:'global',factorKey:'attackPct',value:.05,condition:{tagType:'identity',tagId:'exile',count:2}}]},
 {nameKey:'guardian.kyle.name',rarityId:'magic',identityId:'mercenary',raceId:'human',module:'explosion',passiveKey:'passive.kyle.name',effects:[
  {kind:'formation_factor',scope:'module',factorKey:'attackSpeedPct',value:.07,condition:{tagType:'race',tagId:'human',count:2}}]},
 {nameKey:'guardian.seria.name',rarityId:'magic',identityId:'knight',raceId:'elf',module:'scatter',passiveKey:'passive.seria.name',effects:[
  {kind:'status_on_hit',statusId:'melted',chance:.30}]},
 {nameKey:'guardian.dorman.name',rarityId:'magic',identityId:'noble',raceId:'dwarf',module:'laser',passiveKey:'passive.dorman.name',effects:[
  {kind:'damage_vs_status',statusId:'melted',value:.40}]},
 {nameKey:'guardian.rokan.name',rarityId:'rare',identityId:'exile',raceId:'beast',module:'chain',passiveKey:'passive.rokan.name',effects:[
  {kind:'damage_vs_status',statusId:'shocked',value:.50}],
  starPassiveKey:'passive.rokanStar.name',starEffects:[
  {kind:'formation_factor',scope:'global',factorKey:'damagePct',value:.06,condition:{tagType:'identity',tagId:'exile',count:2}}]},
 {nameKey:'guardian.azra.name',rarityId:'rare',identityId:'engineer',raceId:'demon',module:'explosion',passiveKey:'passive.azra.name',effects:[
  {kind:'status_on_hit',statusId:'shocked',chance:.35}],
  starPassiveKey:'passive.azraStar.name',starEffects:[
  {kind:'formation_factor',scope:'module',factorKey:'pierceRate',value:.08,condition:{tagType:'race',tagId:'demon',count:2}}]},
 {nameKey:'guardian.yuna.name',rarityId:'rare',identityId:'noble',raceId:'human',module:'scatter',passiveKey:'passive.yuna.name',effects:[
  {kind:'damage_vs_status',statusId:'melted',value:.50}],
  starPassiveKey:'passive.yunaStar.name',starEffects:[
  {kind:'formation_factor',scope:'global',factorKey:'damagePct',value:.06,condition:{tagType:'identity',tagId:'noble',count:2}}]},
 {nameKey:'guardian.elion.name',rarityId:'rare',identityId:'exile',raceId:'elf',module:'laser',passiveKey:'passive.elion.name',effects:[
  {kind:'status_on_hit',statusId:'melted',chance:.35}],
  starPassiveKey:'passive.elionStar.name',starEffects:[
  {kind:'formation_factor',scope:'module',factorKey:'critChance',value:.07,condition:{tagType:'race',tagId:'elf',count:2}}]},
 {nameKey:'guardian.grim.name',rarityId:'epic',identityId:'mercenary',raceId:'dwarf',module:'chain',passiveKey:'passive.grim.name',effects:[
  {kind:'status_on_hit',statusId:'melted',chance:.35}],
  starPassiveKey:'passive.grimStar.name',starEffects:[
  {kind:'formation_factor',scope:'global',factorKey:'critDamagePct',value:.15,condition:{tagType:'identity',tagId:'mercenary',count:2}}]},
 {nameKey:'guardian.teon.name',rarityId:'epic',identityId:'engineer',raceId:'beast',module:'explosion',passiveKey:'passive.teon.name',effects:[
  {kind:'damage_vs_status',statusId:'melted',value:.50}],
  starPassiveKey:'passive.teonStar.name',starEffects:[
  {kind:'formation_factor',scope:'global',factorKey:'attackSpeedPct',value:.08,condition:{tagType:'identity',tagId:'engineer',count:3}}]},
 {nameKey:'guardian.nia.name',rarityId:'epic',identityId:'knight',raceId:'demon',module:'scatter',passiveKey:'passive.nia.name',effects:[
  {kind:'status_on_hit',statusId:'shocked',chance:.35}],
  starPassiveKey:'passive.niaStar.name',starEffects:[
  {kind:'formation_factor',scope:'global',factorKey:'bossDamagePct',value:.10,condition:{tagType:'identity',tagId:'knight',count:2}}]},
 {nameKey:'guardian.miren.name',rarityId:'epic',identityId:'engineer',raceId:'human',module:'laser',passiveKey:'passive.miren.name',effects:[
  {kind:'damage_vs_status',statusId:'shocked',value:.50}],
  starPassiveKey:'passive.mirenStar.name',starEffects:[
  {kind:'formation_factor',scope:'global',factorKey:'attackPct',value:.09,condition:{tagType:'race',tagId:'human',count:3}}]},
 // [2026-09-15] 연쇄·폭발·산탄의 신규 훅은 아직 설계 전이다. 그 자리를 능력 패시브로
 // 임시로 채운다(인철 지시). 훅이 확정되면 이 세 행을 module_rule로 교체한다.
 {nameKey:'guardian.astel.name',rarityId:'legend',identityId:'mercenary',raceId:'elf',module:'chain',passiveKey:'passive.astel.name',effects:[
  {kind:'factor',scope:'module',factorKey:'damagePct',value:.18}],
  starPassiveKey:'passive.astelStar.name',starEffects:[
  {kind:'formation_factor',scope:'global',factorKey:'critChance',value:.06,condition:{tagType:'race',tagId:'elf',count:2}}]},
 {nameKey:'guardian.volkan.name',rarityId:'legend',identityId:'knight',raceId:'dwarf',module:'explosion',passiveKey:'passive.volkan.name',effects:[
  {kind:'factor',scope:'module',factorKey:'critDamagePct',value:.30}],
  starPassiveKey:'passive.volkanStar.name',starEffects:[
  {kind:'formation_factor',scope:'global',factorKey:'defenseIgnore',value:.10,condition:{tagType:'race',tagId:'dwarf',count:2}}]},
 {nameKey:'guardian.kira.name',rarityId:'legend',identityId:'noble',raceId:'beast',module:'scatter',passiveKey:'passive.kira.name',effects:[
  {kind:'factor',scope:'module',factorKey:'defenseIgnore',value:.14}],
  starPassiveKey:'passive.kiraStar.name',starEffects:[
  {kind:'formation_factor',scope:'global',factorKey:'damagePct',value:.10,condition:{tagType:'identity',tagId:'noble',count:3}}]},
 {nameKey:'guardian.seraph.name',rarityId:'legend',identityId:'exile',raceId:'demon',module:'laser',passiveKey:'passive.seraph.name',effects:[
  {kind:'module_rule',scope:'module',ruleId:'focused',params:{damagePct:.50}}],
  starPassiveKey:'passive.seraphStar.name',starEffects:[
  {kind:'formation_factor',scope:'global',factorKey:'pierceRate',value:.10,condition:{tagType:'race',tagId:'demon',count:3}}]},
 {nameKey:'guardian.ruhen.name',rarityId:'legend',identityId:'engineer',raceId:'elf',module:'chain',passiveKey:'passive.ruhen.name',effects:[
  {kind:'module_rule',scope:'module',ruleId:'unusedTargetBonus',params:{value:.50}}],
  starPassiveKey:'passive.ruhenStar.name',starEffects:[
  {kind:'damage_vs_status',statusId:'melted',value:.65}]},
 {nameKey:'guardian.morga.name',rarityId:'legend',identityId:'mercenary',raceId:'beast',module:'explosion',passiveKey:'passive.morga.name',effects:[
  {kind:'module_rule',scope:'module',ruleId:'secondary',params:{damagePct:.50,radiusPct:.80}}],
  starPassiveKey:'passive.morgaStar.name',starEffects:[
  {kind:'status_on_hit',statusId:'melted',chance:.45}]},
 {nameKey:'guardian.shan.name',rarityId:'legend',identityId:'noble',raceId:'demon',module:'scatter',passiveKey:'passive.shan.name',effects:[
  {kind:'module_rule',scope:'module',ruleId:'centerDamageBonus',params:{value:1.00}}],
  starPassiveKey:'passive.shanStar.name',starEffects:[
  {kind:'damage_vs_status',statusId:'shocked',value:.65}]},
 {nameKey:'guardian.ornel.name',rarityId:'legend',identityId:'exile',raceId:'human',module:'laser',passiveKey:'passive.ornel.name',effects:[
  {kind:'module_rule',scope:'module',ruleId:'empowered',params:{chance:.35,damagePct:.70,widthPct:1.00}}],
  starPassiveKey:'passive.ornelStar.name',starEffects:[
  {kind:'status_on_hit',statusId:'shocked',chance:.45}]},
];
const CharacterTable={},PassiveTable={},PassiveEffectTable=[],PassiveUnlockTable=[];
// [2026-09-15] 해금은 패시브 단위(PassiveUnlockTable)라 2번 행을 3성에 열려면 패시브를
// 하나 더 만들어야 한다. seed.starEffects가 있으면 CP_xxxS를 star 3 해금으로 추가한다.
const STAR_PASSIVE_UNLOCK = 3;
CharacterSeedTable.forEach((seed,i)=>{
  const suffix=String(i+1).padStart(3,'0'),characterId=`CHR_${suffix}`,passiveId=`CP_${suffix}`;
  const starPassiveId=seed.starEffects?`${passiveId}S`:null;
  CharacterTable[characterId]={characterId,nameKey:seed.nameKey,rarityId:seed.rarityId,identityId:seed.identityId,raceId:seed.raceId,specialtyMissileId:seed.module,innatePassiveId:passiveId,starPassiveId,passiveSlots:{innate:passiveId,star:starPassiveId?[starPassiveId]:[],tier:[],awakening:[]},baseStats:{atk:1000,def:5,hp:300},growthProfileId:'standard',costGroupId:'standard',sortOrder:i};
  const addRows=(pid,rows,unlockType)=>rows.forEach((effect,effectIndex)=>PassiveEffectTable.push({effectId:`${pid}_E${effectIndex+1}`,passiveId:pid,sourceId:seed.module,operation:'add',stackMode:'add',unlockType,...effect,duration:effect.statusId?(effect.duration??StatusEffectTable[effect.statusId].duration):effect.duration,targetId:effect.scope==='module'?seed.module:(effect.targetId??null)}));
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
      if(!PassiveTable[e.passiveId]||!['factor','status_on_hit','damage_vs_status','formation_factor','module_rule'].includes(e.kind)||!['add','max'].includes(e.stackMode))throw Error('패시브 효과 오류');
      if(e.kind!=='module_rule'&&!Number.isFinite(e.value??e.chance))throw Error('패시브 효과 오류');
      // module_rule은 미사일 고유 규칙을 직접 켠다. 규칙 이름과 항목은 MODULE_RULE_SPEC이 정의하고,
      // CONFIG에 같은 이름의 자리가 실제로 있는지까지 확인해 오타가 조용히 무시되지 않게 한다.
      if(e.kind==='module_rule'){
        const spec=MODULE_RULE_SPEC[e.ruleId];
        if(!spec||!MISSILE_DEFS[e.targetId]||spec.module!==e.targetId)throw Error('미사일 규칙 오류');
        if(!e.params||!spec.fields.every(f=>Number.isFinite(Number(e.params[f]))))throw Error('미사일 규칙 값 오류');
        const slot=DEFAULT_CONFIG.attackModules[e.targetId]?.[e.ruleId];
        if(slot===undefined)throw Error('미사일 규칙 설정 없음');
      }
      if(['factor','formation_factor'].includes(e.kind)&&(!COMBAT_FACTOR_KEYS.includes(e.factorKey)||!['global','module'].includes(e.scope)||(e.scope==='module'&&!MISSILE_DEFS[e.targetId])))throw Error('패시브 팩터 오류');
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
  blank(c){return {owned:c.rarityId===CharacterGrowthRules.freeRarityId,level:1,star:1,tier:0,awakening:0,shards:0};},
  migrate(data){
    if(!data||typeof data!=='object'||!data.characters) return data;
    CharacterRepository.list().forEach(c=>{
      const x=data.characters[c.characterId];
      if(!x){ data.characters[c.characterId]=this.blank(c); return; }
      if(!Number.isInteger(x.shards)||x.shards<0) x.shards=0;   // 조각 필드 신설 보정
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
    const x=data.characters[c.characterId];return x&&typeof x.owned==='boolean'&&Number.isInteger(x.star)&&x.star>=1&&x.star<=CharacterGrowthRules.maxStars&&Number.isInteger(x.level)&&x.level>=1&&x.level<=CharacterGrowthRules.maxLevel&&Number.isInteger(x.tier)&&x.tier>=0&&Number.isInteger(x.awakening)&&x.awakening>=0&&Number.isInteger(x.shards)&&x.shards>=0;
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
   [GrowthRules] 캐릭터·스킬 공통 성장 규칙
   ---------------------------------------------------------------------
   [2026-09-16 v0916_7] 두 시스템에 같은 코드로 복제돼 있던 허용 판정·거래 절차·성급 배율을 모았다.
   레벨업은 골드 비용표, 승급은 조각으로 한다. 대상별 차이(비용·조각 수)만 인자로 받는다.
   [2026-09-18] 확정(인철): 레벨업과 성급 돌파를 서로 독립으로 뗀다. 레벨업은 성급과 무관하게
   전역 상한(CharacterGrowthRules.maxLevel)까지, 승급은 레벨 조건 없이 다음 성급이 남아있고
   조각이 있으면 바로 연다 — 조각 보유 여부는 transact()가 별도로 확인한다.
   ===================================================================== */
const GrowthRules={
  allowed(x,action){return x?.owned&&(action==='levelUp'?x.level<CharacterGrowthRules.maxLevel:action==='rankUp'&&x.star<CharacterGrowthRules.maxStars);},
  // 누적 성급 배율. 부동소수 누적 오차가 반올림 경계를 흔들지 않도록 소수 9자리에서 정리한다.
  starMultiplier(steps,star){
    const n=Math.max(1,Number(star)||1);
    let mul=1;
    for(let i=1;i<n;i++) mul*=(1+(Number(steps?.[i])||0));
    return Math.round(mul*1e9)/1e9;
  },
  // select(next)는 저장 사본에서 성장 대상 항목을 고른다(없으면 거래하지 않는다).
  // kind·id는 분석 이벤트용이다. 캐릭터·스킬 × 레벨업·승급 네 조합이 모두 이 한 곳을 지나므로
  // level_up·star_up을 여기서 한 번만 부른다.
  transact(campaign,select,action,{costs,shardCost,kind,id}){
    if(GameState.current!=='lobby'||!campaign.read()||campaign.state.active)return false;
    const next=cloneConfig(campaign.state),x=select(next);
    if(!this.allowed(x,action))return false;
    if(action==='levelUp'){
      const c=costs(x);if(!c.length||!WalletSystem.spend(next,c))return false;
      x.level++;
    } else {
      const need=shardCost(x);if(!(need>0)||(Number(x.shards)||0)<need)return false;
      x.shards-=need;x.star++;
    }
    if(!campaign.commit(next))return false;
    if(action==='levelUp') Analytics.track('level_up',{kind,id,level:x.level});
    else Analytics.track('star_up',{kind,id,star:x.star});
    campaign.render();return true;
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
  stats(key,x){
    const d=CONFIG.skills[key],level=Math.max(1,x?.level||1);
    return Object.fromEntries(['atk','def','hp'].map(stat=>{const value=(Number(d.stats.base[stat])||0)+(level-1)*(Number(d.stats.perLevel[stat])||0);return [stat,stat==='def'?Math.round(value*10)/10:Math.round(value)];}));
  },
  costs(x){return GrowthCostTable.filter(r=>r.costGroupId===SKILL_COST_GROUP_ID&&r.action==='levelUp'&&r.step===x.level).map(r=>({...r}));},
  levelCost(x){return this.costs(x)[0]?.amount||0;},
  shardCost(x){return Number(CONFIG.meta.skill.shardSteps[x.star-1])||0;},
  allowed(x,action){return GrowthRules.allowed(x,action);},
  transact(campaign,key,action){
    return GrowthRules.transact(campaign,next=>SKILL_KEYS.includes(key)?next.skillInventory.skills[key]:null,action,{kind:'skill',id:key,costs:x=>this.costs(x),shardCost:x=>this.shardCost(x)});
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
    const equipped=inv.equipped.map(key=>{const owned=inv.skills[key];return {key,nameKey:CONFIG.skills[key].nameKey,level:owned.level,star:owned.star,effect:SkillGrowthSystem.effect(key,owned),duration:SkillGrowthSystem.duration(key,owned),cooldownSec:SkillGrowthSystem.cooldown(key),stats:SkillGrowthSystem.stats(key,owned)};});
    const stats=equipped.reduce((sum,item)=>{for(const key of ['atk','def','hp'])sum[key]+=item.stats[key];return sum;},{atk:0,def:0,hp:0});
    return {equipped,stats};
  },
};
const CharacterGrowthSystem={
  // 기본 능력치와 레벨당 성장 모두에 희귀도 배율을 곱한다. 노말이 1.00이라
  // 1레벨 기준 전투 밸런스(기본 공격력 1,000)는 그대로 남는다.
  // [2026-09-15] 성급 누적 배율. 계산은 스킬과 같은 GrowthRules.starMultiplier를 쓴다.
  starMul(star){ return GrowthRules.starMultiplier(CONFIG.meta.character.starStepPct,star); },
  // [2026-09-18] 전속 미사일 배율. CONFIG.attackModules[key].baseDamageMul에 있던 값을 옮긴 것이라
  // 공격력에만 곱한다(방어력·체력은 종전대로 건드리지 않는다).
  moduleMul(id){ return Number(CONFIG.meta.character.moduleAtkMul?.[CharacterTable[id]?.specialtyMissileId])||1; },
  stats(id,owned){
    const c=CharacterTable[id],g=GrowthProfileTable[c.growthProfileId],mul=rarityConf(c.rarityId).statMul;
    const star=this.starMul(owned?.star);
    const grown=LevelGrowthFactor.at(owned?.level||1);
    const module=this.moduleMul(id);
    return Object.fromEntries(['atk','def','hp'].map(k=>[k,Math.round((c.baseStats[k]+grown*g[k])*mul*star*(k==='atk'?module:1))]));
  },
  // 레벨업은 골드, 승급은 조각이다.
  costs(id,x,action){
    if(action!=='levelUp')return [];
    const mul=rarityConf(CharacterTable[id].rarityId).levelCostMul;
    return GrowthCostTable.filter(r=>r.costGroupId===CharacterTable[id].costGroupId&&r.action==='levelUp'&&r.step===x.level)
      .map(r=>({...r,amount:Math.max(1,Math.round(r.amount*mul))}));
  },
  shardCost(id,x){
    const steps=rarityConf(CharacterTable[id].rarityId).shardSteps||[];
    return Number(steps[x.star-1])||0;
  },
  allowed(x,action){return GrowthRules.allowed(x,action);},
  payable(campaign,id,x,action){
    if(action==='levelUp'){const c=this.costs(id,x,action);return !!c.length&&WalletSystem.canPay(campaign.state,c);}
    const need=this.shardCost(id,x);return need>0&&(Number(x.shards)||0)>=need;
  },
  transact(campaign,id,action){
    return GrowthRules.transact(campaign,next=>CharacterTable[id]?next.characterInventory.characters[id]:null,action,{kind:'character',id,costs:x=>this.costs(id,x,'levelUp'),shardCost:x=>this.shardCost(id,x)});
  },
  assign(campaign,id){
    if(GameState.current!=='lobby'||!campaign.read()||campaign.state.active||!campaign.state.characterInventory.characters[id]?.owned)return false;
    const character=CharacterTable[id];if(!character)return false;
    const next=cloneConfig(campaign.state);next.characterInventory.formation[character.specialtyMissileId]=id;
    if(!CharacterInventorySystem.validateFormation(next.characterInventory))return false;
    if(!campaign.commit(next))return false;campaign.render();return true;
  },
};
/* =====================================================================
   [GachaSystem] 별불 소환 — 1회 가격은 고정이고, 중복은 조각이 된다
   ---------------------------------------------------------------------
   [2026-09-14] 확정(인철): 캐릭터를 모두 열어 두지 않고 뽑기로 연다.
   [2026-09-16] 확정(인철): 소환 재화를 별불로 바꾸고 가격을 200개로 고정했다(누적 증가 제거). 등급 가중치로 희귀도를 먼저 뽑고, 그 등급 안에서 캐릭터를 균등 추첨한다.
   이미 가진 캐릭터가 나오면 승급 재료인 조각으로 바뀐다.
   ===================================================================== */
/* =====================================================================
   [ShardLedger] 조각 장부 — 예약분과 과잉분을 가른다
   ---------------------------------------------------------------------
   [2026-09-17] 확정(인철): 중복 조각을 전 등급 1개로 고정하고, 과잉은 그대로 둔다.
   대신 어느 대상에 조각이 얼마나 남는지를 저장에 남겨 나중에 다른 재화로 쓸 수 있게 한다.

   보유량(x.shards)과 성급(x.star)은 이미 저장되므로 과잉분은 언제나 여기서 다시 계산할 수
   있다. 별도 필드로 복제해 두면 승급·초기화 경로마다 같이 고쳐야 하고 어긋나면 재화가
   틀어지므로, 장부는 저장값에서 파생시키고 저장에는 누적 집계(lifetime.shardsGained)만 둔다.
   ===================================================================== */
const ShardLedger={
  // 남은 승급에 필요한 조각 합계. 이미 최고 성급이면 0이다.
  required(steps,star){
    const from=Math.max(1,Math.floor(Number(star)||1));
    return (Array.isArray(steps)?steps:[]).slice(from-1).reduce((a,v)=>a+(Number(v)||0),0);
  },
  // 한 대상의 장부. surplus는 모든 승급을 마치고도 남는, 즉 성급으로는 쓸 수 없는 몫이다.
  entry(steps,x){
    const held=Math.max(0,Number(x?.shards)||0),need=this.required(steps,x?.star);
    return {held,required:need,earmarked:Math.min(held,need),surplus:Math.max(0,held-need)};
  },
  character(id,x){ return this.entry(rarityConf(CharacterTable[id]?.rarityId).shardSteps,x); },
  skill(x){ return this.entry(CONFIG.meta.skill.shardSteps,x); },
  // 저장 상태 전체의 과잉분. 대상별 내역과 합계를 함께 돌려준다.
  summary(state){
    const characters=[],skills=[];
    let total=0;
    Object.entries(state?.characterInventory?.characters||{}).forEach(([id,x])=>{
      if(!CharacterTable[id]||!x?.owned)return;
      const e=this.character(id,x);
      if(e.surplus>0){characters.push({id,nameKey:CharacterTable[id].nameKey,rarityId:CharacterTable[id].rarityId,...e});total+=e.surplus;}
    });
    Object.entries(state?.skillInventory?.skills||{}).forEach(([key,x])=>{
      if(!CONFIG.skills[key]||!x?.owned)return;
      const e=this.skill(x);
      if(e.surplus>0){skills.push({key,nameKey:CONFIG.skills[key].nameKey,...e});total+=e.surplus;}
    });
    return {characters,skills,total};
  },
};
const GachaSystem={
  // gachaCount는 가격에 쓰지 않고 통계로만 남긴다.
  cost(){
    return Math.max(0,Math.round(Number(CONFIG.meta.gacha.cost)||0));
  },
  // 등급 가중치 → 등급 안 균등. 가중치가 전부 0이면 뽑지 않는다.
  rollRarity(){
    const weights=RARITY_KEYS.map(k=>Math.max(0,Number(rarityConf(k).gachaWeight)||0));
    const total=weights.reduce((a,b)=>a+b,0);
    if(total<=0) return null;
    let r=Math.random()*total;
    for(let i=0;i<RARITY_KEYS.length;i++){ r-=weights[i]; if(r<0) return RARITY_KEYS[i]; }
    return RARITY_KEYS[RARITY_KEYS.length-1];
  },
  odds(){
    const weights=RARITY_KEYS.map(k=>Math.max(0,Number(rarityConf(k).gachaWeight)||0));
    const total=weights.reduce((a,b)=>a+b,0)||1,category=Math.max(0,Number(CONFIG.meta.gacha.characterWeight)||0),skill=Math.max(0,Number(CONFIG.meta.gacha.skillWeight)||0),categoryTotal=category+skill||1;
    return RARITY_KEYS.map((k,i)=>({rarityId:k,pct:weights[i]/total*category/categoryTotal*100,conditionalPct:weights[i]/total*100}));
  },
  rollCategory(){
    const character=Math.max(0,Number(CONFIG.meta.gacha.characterWeight)||0),skill=Math.max(0,Number(CONFIG.meta.gacha.skillWeight)||0),total=character+skill;
    if(total<=0)return null;return Math.random()*total<character?'character':'skill';
  },
  // 결과 1개를 next에 반영한다. 같은 묶음에서 두 번째로 나온 대상은 이미 보유 상태이므로 조각이 된다.
  rollOne(next){
    // error는 문구가 아니라 문자열 키다 — 표시하는 쪽(campaign-ui.js)이 t()로 바꾼다.
    const type=this.rollCategory();if(!type)return {error:'gacha.error.noCategory'};
    if(type==='skill'){
      const skillKey=choice(SKILL_KEYS),def=CONFIG.skills[skillKey],x=next.skillInventory.skills[skillKey],duplicate=!!x.owned,gained=duplicate?Math.max(0,Number(CONFIG.meta.skill.duplicateShards)||0):0;
      if(duplicate){x.shards+=gained;next.lifetime.shardsGained=(Number(next.lifetime.shardsGained)||0)+gained;}else x.owned=true;
      return {type,skillKey,nameKey:def.nameKey,duplicate,gained,shards:x.shards,need:SkillGrowthSystem.shardCost(x),surplus:ShardLedger.skill(x).surplus};
    }
    const rarityId=this.rollRarity();if(!rarityId)return {error:'gacha.error.noRarity'};
    const pool=CharacterRepository.list().filter(c=>c.rarityId===rarityId);if(!pool.length)return {error:'gacha.error.emptyPool'};
    const c=choice(pool),x=next.characterInventory.characters[c.characterId],duplicate=!!x.owned,gained=duplicate?Math.max(0,Number(rarityConf(rarityId).duplicateShards)||0):0;
    if(duplicate){x.shards+=gained;next.lifetime.shardsGained=(Number(next.lifetime.shardsGained)||0)+gained;}else x.owned=true;
    return {type,characterId:c.characterId,nameKey:c.nameKey,rarityId,duplicate,gained,shards:x.shards,need:CharacterGrowthSystem.shardCost(c.characterId,x),surplus:ShardLedger.character(c.characterId,x).surplus};
  },
  // [2026-09-16] 확정(인철): 별불 200개에 결과 10개. 결과 전체를 한 번에 저장한 뒤 공개 연출을 시작한다.
  pull(campaign){
    if(GameState.current!=='lobby'||!campaign.read()||campaign.state.active) return null;
    const next=cloneConfig(campaign.state);
    const price=this.cost(),count=Math.max(1,Math.round(Number(CONFIG.meta.gacha.resultsPerPull)||1));
    if(!WalletSystem.spend(next,[{currencyId:CONFIG.meta.gacha.currencyId,amount:price}])) return {error:'gacha.error.poor'};
    const results=[];
    for(let i=0;i<count;i++){const r=this.rollOne(next);if(r.error)return r;results.push(r);}
    next.gachaCount=(Number(next.gachaCount)||0)+results.length;
    if(!campaign.commit(next)) return {error:'gacha.error.saveFailed'};
    Analytics.track('gacha',{count:next.gachaCount});
    return {results,price};
  },
};
const PartyCombatAdapter={
  unlockedPassiveIds(c,owned){
    return PassiveUnlockTable.filter(u=>u.characterId===c.characterId&&(
      u.unlockType==='base'||(u.unlockType==='tier'&&owned.tier>=u.unlockValue)||(u.unlockType==='star'&&owned.star>=u.unlockValue)||(u.unlockType==='awakening'&&owned.awakening>=u.unlockValue)
    )).map(u=>u.passiveId);
  },
  formationConditionMet(condition,members){
    if(!condition)return true;
    const field=condition.tagType==='race'?'raceId':condition.tagType==='identity'?'identityId':'specialtyMissileId';
    return members.filter(m=>m[field]===condition.tagId).length>=condition.count;
  },
  snapshot(state){
    const inv=state.characterInventory,factors={global:{},modules:{}},members=[],effects=[],moduleRules={};
    CONFIG.moduleKeys.forEach(module=>{
      const id=inv.formation[module],c=CharacterTable[id],owned=inv.characters[id],stats=CharacterGrowthSystem.stats(id,owned);
      members.push({characterId:id,nameKey:c.nameKey,identityId:c.identityId,raceId:c.raceId,specialtyMissileId:module,level:owned.level,star:owned.star,stats,passiveIds:this.unlockedPassiveIds(c,owned)});
    });
    const passiveIds=new Set(members.flatMap(m=>m.passiveIds));
    PassiveEffectTable.filter(e=>passiveIds.has(e.passiveId)).forEach(e=>{
      if(e.kind==='factor'||(e.kind==='formation_factor'&&this.formationConditionMet(e.condition,members))){
        const bucket=e.scope==='global'?factors.global:(factors.modules[e.targetId]??={});
        bucket[e.factorKey]=e.stackMode==='add'?(bucket[e.factorKey]||0)+e.value:Math.max(bucket[e.factorKey]||0,e.value);
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
    return {formation:{...inv.formation},members,stats,attackByModule,factors,effects,moduleRules,skills:skillSnapshot};
  },
};
CharacterRepository.validate();

