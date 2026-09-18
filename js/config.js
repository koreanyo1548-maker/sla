/* ===== config.js ===== */
const DEFAULT_STAGE_COUNT = 30;
// [2026-09-06] 초반 일반 적 8/12/16기. 보상·적 개체별 능력치·분산 스폰 규칙은 공통 유지.
// 보스 가상 구성과 4스테이지 이후의 물량 공식에는 적용하지 않는다.
const EARLY_STAGE_COMPOSITIONS = {
  1: { melee:8, ranged:0, tank:0 },
  2: { melee:11, ranged:1, tank:0 },
  3: { melee:14, ranged:1, tank:1 },
};
// [2026-09-08] 일반 WAVE 총개체 수 선형 곡선. 1~3WAVE의 확정 구성은 그대로 두고,
// WAVE 5부터 29까지의 일반 WAVE 19개를 8기→40기로 선형 증가시킨다.
// 먼저 총개체 수를 정한 뒤 아래 기본 구성의 타입 비율로 나눠, 기본 구성 증가와 물량 배율이
// 서로 곱해져 후반 개체 수가 가속되던 기존 구조를 제거한다.
const NORMAL_COUNT_CURVE = { startWave: 5, endWave: 29, startCount: 8, endCount: 40 };
// 적 타입 목록의 단일 소스. WAVE 구성·위협 예산·스폰·보스 HP가 모두 이 순서를 공유한다.
// CONFIG.enemy.types의 키와 같아야 하며, 타입을 늘릴 때 여기와 CONFIG 양쪽을 함께 고친다.
const ENEMY_TYPE_KEYS = ['melee','ranged','tank'];
const ENEMY_TYPE_LABELS = { melee:'근접', ranged:'원거리', tank:'탱커' };

// [2026-09-09 주석 정정] 기존 12웨이브 표의 증가 패턴을 그 스테이지의 총 WAVE 수까지 확장한다.
// 총 WAVE 수는 buildStageWaves의 total 인자로 들어오며, 현재 상한은 DEFAULT_STAGE_COUNT(30)다.
// - 4개 단위 구간마다 난이도 시작값 +2
// - 일반 WAVE는 구간이 바뀔 때 원거리/탱커 수가 각각 +1
// - 4의 배수는 중간보스, 그 스테이지의 마지막 WAVE는 최종보스
function baseCompositionForStage(stage){
  const group = Math.floor((stage-1)/4);
  const pos = (stage-1)%4;
  return group===0
    ? { melee:4, ranged:pos>=1?1:0, tank:pos>=2?1:0 }
    : { melee:pos===0?3:4, ranged:group+1, tank:group+(pos>=2?1:0) };
}
function linearNormalTotal(stage, curve=NORMAL_COUNT_CURVE){
  const groupIndex=Math.floor((stage-curve.startWave)/4);
  const position=(stage-curve.startWave)%4;
  const normalIndex=Math.max(0,groupIndex*3+position);
  const lastGroupIndex=Math.floor((curve.endWave-curve.startWave)/4);
  const lastPosition=(curve.endWave-curve.startWave)%4;
  const lastNormalIndex=Math.max(1,lastGroupIndex*3+lastPosition);
  const t=Math.max(0,Math.min(1,normalIndex/lastNormalIndex));
  return Math.round(curve.startCount+(curve.endCount-curve.startCount)*t);
}
function allocateTypeCounts(base,total){
  const keys=ENEMY_TYPE_KEYS;
  const weightTotal=keys.reduce((sum,key)=>sum+base[key],0);
  const exact=keys.map(key=>total*base[key]/weightTotal);
  const counts=exact.map(Math.floor);
  let remainder=total-counts.reduce((sum,value)=>sum+value,0);
  const order=exact.map((value,index)=>({index,fraction:value-counts[index]}))
    .sort((a,b)=>b.fraction-a.fraction||a.index-b.index);
  for(let i=0;i<remainder;i++) counts[order[i%order.length].index]++;
  return Object.fromEntries(keys.map((key,index)=>[key,counts[index]]));
}
function normalCompositionForStage(stage,curve=NORMAL_COUNT_CURVE){
  return allocateTypeCounts(baseCompositionForStage(stage),linearNormalTotal(stage,curve));
}
/* =====================================================================
   [WAVE_ARCHETYPES] WAVE 성격 정의
   ---------------------------------------------------------------------
   [2026-09-17] 확정(인철): 30 WAVE를 같은 형태로 반복하지 않고 성격이 순서대로 돌게 한다.
   순환은 아래 ARCHETYPE_LOOP(탱커 → 돌격 → 원거리 → 물량 → 혼성 → 보스)이며,
   30 WAVE 구성인 스테이지 3 이상에만 적용한다(스테이지 1~2는 아키타입 도입 전 원안).

   난이도 곡선은 건드리지 않는다. 각 WAVE의 "위협 예산"(Σ 마리수 × hpMul)을
   불변량으로 두고, 아키타입은 같은 예산을 다른 형태로 지출할 뿐이다. 탱커는
   hpMul이 2.0이라 수가 절반이 되고 근접은 0.8이라 수가 늘어난다.

   short      — 전장 좌상단 배지에 쓰는 짧은 표기
   label      — 행동 로그 등에 쓰는 긴 이름
   mix        — 타입 구성비(null이면 기존 비율을 그대로 쓴다)
   budgetMul  — 위협 예산 배율. 돌격전만 0.7로 덜 쓰는 대신 빠르게 한꺼번에 온다
   speedMul   — 이동 속도 배율(도달 시간을 이 값으로 나눈다)
   timing     — 스폰 시각·비율·WAVE 길이. null이면 CONFIG.waveTiming을 쓴다
                (혼성을 null로 둬야 밸런스 에디터의 WAVE 타이밍 입력이 계속 살아 있다)

   ASSUMPTION: 아래 수치는 전부 Claude 가안이다. 아키타입은 난이도가 아니라 형태만
   바꾸는 것이 목적이므로, 30 WAVE 전체의 피격 상한이 혼성과 비슷해지도록 WAVE 길이를
   맞췄다 — 최종 실측값은 돌격전 -14% · 탱커전 -1% · 원거리 압박 +40% · 물량전 +56%다.
   마리 수가 많은 두 아키타입이 높게 남는 것은 "전원이 도달해 때린다"와 "마리 수가 최다"를
   동시에 만족시킬 수 없어서이며, 물량전이 가장 위험한 WAVE가 되는 것은 의도한 결과다.
   ===================================================================== */
const WAVE_ARCHETYPES = {
  fortress:{ short:'탱커',   label:'탱커전',      mix:{tank:1},          budgetMul:1.00, speedMul:1.0,
    timing:{ spawnTimesSec:[0], spawnRatios:[1], durationSec:14 } },
  rush:    { short:'돌격',   label:'돌격전',      mix:{melee:1},         budgetMul:0.70, speedMul:1.4,
    timing:{ spawnTimesSec:[0], spawnRatios:[1], durationSec:7 } },
  siege:   { short:'원거리', label:'원거리 압박', mix:{melee:1,ranged:3}, budgetMul:1.00, speedMul:1.0,
    timing:{ spawnTimesSec:[0,2], spawnRatios:[0.40,0.60], durationSec:11 } },
  // 4배치로 끊임없이 밀려온다. 간격 1초·길이 11초는 마지막 배치(7초 도달)까지 전원이
  // 공격 기회를 얻는 가장 긴 조합이다 — 간격을 더 벌리면 뒷배치가 도달 전에 WAVE가 끝난다.
  horde:   { short:'물량',   label:'물량전',      mix:{melee:1},         budgetMul:1.00, speedMul:1.0,
    timing:{ spawnTimesSec:[0,1,2,3], spawnRatios:[0.25,0.25,0.25,0.25], durationSec:11 } },
  standard:{ short:'혼성',   label:'혼성',        mix:null,              budgetMul:1.00, speedMul:1.0, timing:null },
};
// [2026-09-17 2차] 확정(인철): 탱커 → 돌격 → 원거리 → 물량 → 혼성 → 보스 6슬롯 루프.
// 보스가 루프 안에 들어가므로 보스 주기가 4WAVE에서 6WAVE로 바뀐다. 30 WAVE는 6의 배수라
// 마지막 슬롯이 정확히 WAVE 30에 떨어져 최종보스 자리가 맞는다.
// 이 루프는 30 WAVE 구성(스테이지 3 이상)에만 적용하고, 스테이지 1~2는 원안을 그대로 둔다.
// BOSS_SLOT은 WAVE_ARCHETYPES의 키가 아니다 — 루프 안에서 "이 자리는 보스 WAVE"만 뜻한다.
const BOSS_SLOT = 'boss';
const ARCHETYPE_LOOP = ['fortress','rush','siege','horde','standard',BOSS_SLOT];
const ARCHETYPE_LOOP_MIN_STAGE = 3;
function usesArchetypeLoop(stageId){ return Math.max(1,Math.floor(Number(stageId)||1)) >= ARCHETYPE_LOOP_MIN_STAGE; }

// ── B3: CONFIG를 직접 읽는다(이 파일의 다른 곳과 같은 방식). 이 함수들은 전부 런타임에만 불린다.
// WAVE의 위협 예산 — 아키타입이 형태를 바꿔도 이 값은 보존된다.
function waveThreatBudget(comp, types=CONFIG.enemy.types){
  return ENEMY_TYPE_KEYS.reduce((sum,key)=>sum+(comp[key]||0)*(Number(types[key]?.hpMul)||0),0);
}
// 예산을 아키타입의 구성비로 다시 나눠 실제 마리 수를 만든다.
function archetypeComposition(baseComp, archetypeKey, types=CONFIG.enemy.types){
  const archetype=WAVE_ARCHETYPES[archetypeKey];
  if(!archetype?.mix) return Object.fromEntries(ENEMY_TYPE_KEYS.map(key=>[key,baseComp[key]||0]));
  const keys=Object.keys(archetype.mix).filter(key=>ENEMY_TYPE_KEYS.includes(key));
  const weightTotal=keys.reduce((sum,key)=>sum+archetype.mix[key],0);
  const averageHp=keys.reduce((sum,key)=>sum+archetype.mix[key]/weightTotal*(Number(types[key]?.hpMul)||1),0);
  if(!(weightTotal>0)||!(averageHp>0)) return Object.fromEntries(ENEMY_TYPE_KEYS.map(key=>[key,baseComp[key]||0]));
  const total=Math.max(1,Math.round(waveThreatBudget(baseComp,types)*archetype.budgetMul/averageHp));
  const out=Object.fromEntries(ENEMY_TYPE_KEYS.map(key=>[key,0]));
  let left=total;
  keys.forEach((key,index)=>{
    const count=index===keys.length-1 ? left : Math.round(total*archetype.mix[key]/weightTotal);
    out[key]=count; left-=count;
  });
  return out;
}
// 아키타입이 적용된 WAVE의 스폰 타이밍·길이. timing이 null인 혼성은 설정값을 그대로 읽는다.
function waveTimingFor(waveCfg){
  const timing=WAVE_ARCHETYPES[waveCfg?.archetype]?.timing;
  return {
    spawnTimesSec: timing?.spawnTimesSec ?? CONFIG.waveTiming.spawnTimesSec,
    spawnRatios:   timing?.spawnRatios   ?? CONFIG.waveTiming.spawnRatios,
    durationSec:   timing?.durationSec   ?? CONFIG.waveTiming.durationSec,
  };
}
function waveSpeedMul(waveCfg){ return Number(WAVE_ARCHETYPES[waveCfg?.archetype]?.speedMul)||1; }
// WAVE 종류 표기. 보스 WAVE는 아키타입이 없으므로 여기서 함께 처리한다.
// form='short'는 전장 좌상단 배지용(폭이 좁다), 'label'은 행동 로그용이다.
const BOSS_WAVE_NAMES = { midboss:{short:'보스', label:'보스전'}, finalboss:{short:'최종보스', label:'최종보스전'} };
function waveTypeName(waveCfg, form='short'){
  if(!waveCfg) return '';
  const boss=BOSS_WAVE_NAMES[waveCfg.type];
  if(boss) return boss[form];
  return (WAVE_ARCHETYPES[waveCfg.archetype] ?? WAVE_ARCHETYPES.standard)[form];
}

// [2026-09-04] bossEnergy 제거 — 에너지는 처치 점수(ScoreSystem)로만 지급한다.
// [2026-09-17] stageId는 아키타입 순환의 시작점만 바꾼다 — 같은 스테이지는 항상 같은 순서라
// 공략이 가능하고, 스테이지가 바뀌면 순서가 한 칸씩 돌아 30 WAVE가 매번 같게 느껴지지 않는다.
function buildStageWaves(total=DEFAULT_STAGE_COUNT, curve=NORMAL_COUNT_CURVE, stageId=1){
  // 난이도(difficulty)와 기본 구성은 기존 4WAVE 그룹 기준을 그대로 쓴다 — 루프는 보스 위치와
  // 아키타입만 바꾸고 난이도 곡선은 건드리지 않는다.
  const loop=usesArchetypeLoop(stageId);
  return Array.from({length:total},(_,index)=>{
    const stage=index+1;
    const group=Math.floor((stage-1)/4);
    const pos=(stage-1)%4;
    const isFinal=stage===total;
    const slot=loop ? ARCHETYPE_LOOP[(stage-1)%ARCHETYPE_LOOP.length] : null;
    const isMidBoss=!isFinal && (loop ? slot===BOSS_SLOT : stage%4===0);
    const difficulty=1+group*2+pos+(isFinal?1:0);
    if(isFinal) return { wave:stage, difficulty, type:'finalboss' };
    if(isMidBoss) return { wave:stage, difficulty, type:'midboss' };
    // 스테이지 1~2(10·20 WAVE)는 아키타입 도입 전 원안 그대로다.
    if(!loop){
      const composition=EARLY_STAGE_COMPOSITIONS[stage] ?? normalCompositionForStage(stage,curve);
      return { wave:stage, difficulty, type:'normal', archetype:'standard', ...composition };
    }
    // 루프 스테이지는 WAVE 1부터 아키타입이 시작하므로 1~3WAVE 고정 구성을 쓰지 않는다(확정).
    const base=normalCompositionForStage(stage,curve);
    return { wave:stage, difficulty, type:'normal', archetype:slot, ...archetypeComposition(base,slot) };
  });
}
// [2026-09-04] 보스 HP는 "그 스테이지가 일반이었다면의 총 HP"인데, 여기에 물량 배수까지 곱하면
// 보스 HP도 3배가 되어 보스전이 22초를 넘긴다(계산 확인). 물량 증가는 일반 스테이지만의 변경이므로
// 보스 구성은 배수를 적용하지 않은 원래 값을 쓴다.
// 보스 HP는 baseCompositionForStage(WAVE 번호)에서만 나오므로 아키타입과 무관하다(의도).
// stageId를 반드시 같이 넘겨야 한다 — 루프 스테이지는 보스가 6WAVE마다라 4WAVE 기준으로 만들면
// 실제 보스 WAVE의 구성이 없어 보스 HP가 0이 된다.
function buildBossCompositions(total=DEFAULT_STAGE_COUNT, curve=NORMAL_COUNT_CURVE, stageId=1){
  const result={};
  buildStageWaves(total,curve,stageId).filter(w=>w.type!=='normal').forEach(w=>{
    const base=baseCompositionForStage(w.wave);
    result[w.wave]=w.type==='finalboss'
      ? {melee:base.melee+1,ranged:base.ranged+1,tank:base.tank+1}
      : base;
  });
  return result;
}

/* =====================================================================
   [MISSILE_DEFS] 미사일 정적 메타 정의
   ---------------------------------------------------------------------
   조정 가능한 수치(CONFIG.attackModules)와 분리된 단일 메타 소스다.
   아이콘·표시색·고유 스탯·주문서 지정색·발사 방식은 여기에서 파생한다.
   ===================================================================== */
const MISSILE_DEFS = {
  chain:{
    label:'연쇄', icon:'ϟ', color:'#5EDBF4',
    special:{stat:'targets',label:'추가 타깃',icon:'ϟ',table:'targetBonusByLevel',base:'baseTargets'},
    designatedColors:{damage:'blue',speed:'red',targets:'yellow'},
    fire:{mode:'projectile',option:'chainTargets',motion:'homing'},
    hit:'chain',
    render:{shape:'bolt'},
  },
  explosion:{
    label:'폭발', icon:'●', color:'#F77A3D',
    special:{stat:'radius',label:'폭발 범위',icon:'◎',table:'radiusBonusByLevel',base:'baseRadius'},
    designatedColors:{damage:'red',speed:'green',radius:'yellow'},
    fire:{mode:'projectile',option:'radius',motion:'homing'},
    hit:'splash',
    render:{shape:'orb',radius:6},
  },
  scatter:{
    label:'산탄', icon:'✣', color:'#48C986',
    special:{stat:'projectiles',label:'발사 수',icon:'✣',table:'projectileBonusByLevel',base:'baseProjectiles'},
    designatedColors:{damage:'green',speed:'blue',projectiles:'purple'},
    fire:{mode:'method',method:'fireScatter',motion:'linear'},
    hit:'single',
    render:{shape:'orb',radius:4},
  },
  laser:{
    label:'레이저', icon:'━', color:'#A876E8',
    special:{stat:'width',label:'광선 폭',icon:'▬',table:'widthBonusByLevel',base:'baseWidth'},
    designatedColors:{damage:'blue',speed:'purple',width:'green'},
    fire:{mode:'method',method:'fireLaser',motion:'instant'},
    hit:null,          // 즉시 판정 — 비행하는 투사체가 없다
    render:null,
  },
};
const MISSILE_KEYS = Object.keys(MISSILE_DEFS);
function missileDesignatedColors(){
  return Object.fromEntries(MISSILE_KEYS.map(key=>[key,{...MISSILE_DEFS[key].designatedColors}]));
}

/* =====================================================================
   [SKILL_DEFS] 스킬 정적 메타 정의
   ---------------------------------------------------------------------
   [2026-09-16 v0916_7] 조정 수치(CONFIG.skills)와 분리된 단일 메타 소스다. MISSILE_DEFS와 같은 구조.
   이전에는 스킬 키가 발동·차단 판정·연출·문구·아이콘·피해 색·정렬·적 상태 아이콘 8곳에 나열돼 있었다.
   effect   — 발동 처리 방식(SkillSystem.EFFECTS 키)
   requires — 발동 조건(SkillSystem.REQUIRES 키, null이면 조건 없음)
   control  — 피해 뒤 살아남은 적에게 거는 제어(SkillSystem.CONTROLS 키)
   fx       — 연출 방식(VisualEffects.SKILL_FX 키)
   color    — 버튼·카드 강조색, damageColor — 피해 숫자 색(없으면 color)
   새 스킬은 여기와 CONFIG.skills에만 추가한다. 새 처리 방식일 때만 EFFECTS/SKILL_FX에 항목을 더한다.
   ===================================================================== */
const SKILL_DEFS = {
  strong_single:{ name:'분쇄창', description:'가장 강한 적에게 고화력 투사체를 발사합니다.', icon:'➤', color:'#F77A3D', damageColor:'#A876E8', effect:'projectile', requires:'enemy', fx:'lance' },
  aoe:          { name:'낙뢰 폭격', description:'현재 전장의 모든 적을 동시에 공격합니다.', icon:'✦', color:'#DDB86A', effect:'damageAll', requires:'enemy', fx:'bombard' },
  defense:      { name:'용광 방벽', description:'일정 시간 용광로 핵이 받는 피해를 줄입니다.', icon:'◆', color:'#5EDBF4', effect:'damageReduction', requires:null, fx:'shield' },
  heal:         { name:'재생 불씨', description:'용광로 핵의 최대 체력 일부를 회복합니다.', icon:'✚', color:'#5CCB8A', effect:'heal', requires:'missingHp', fx:'heal' },
  energy_surge: { name:'불씨 충전', description:'에너지를 즉시 얻습니다.', icon:'⚡', color:'#5EDBF4', effect:'energy', requires:null, fx:'energy' },
  attack_buff:  { name:'달군 칼날', description:'일정 시간 일반 공격력(기본 공격·미사일)을 높입니다. 스킬 피해에는 적용되지 않습니다.', icon:'⚔', color:'#F77A3D', effect:'attackBuff', requires:null, fx:'aura' },
  defense_buff: { name:'강철 외피', description:'일정 시간 수호자들의 방어력을 높입니다.', icon:'⛨', color:'#B7B7AC', effect:'defenseBuff', requires:null, fx:'aura' },
  stun:         { name:'굉음 충격', description:'모든 적에게 피해를 주고 잠시 기절시킵니다.', icon:'✺', color:'#DDB86A', effect:'damageAll', control:'stun', requires:'enemy', fx:'control' },
  slow:         { name:'슬래그 늪', description:'모든 적에게 피해를 주고 이동속도와 공격속도를 낮춥니다.', icon:'≋', color:'#5EDBF4', effect:'damageAll', control:'slow', requires:'enemy', fx:'control' },
  knockback:    { name:'열풍 분출', description:'모든 적에게 피해를 주고 용광로 핵에서 멀리 밀어냅니다.', icon:'➹', color:'#F2645A', damageColor:'#F77A3D', effect:'damageAll', control:'knockback', requires:'enemy', fx:'control' },
  regen:        { name:'치유 잔불', description:'일정 시간 매초 용광로 핵의 최대 체력 일부를 회복합니다.', icon:'❋', color:'#5CCB8A', effect:'regen', requires:'missingHp', fx:'aura' },
};
const SKILL_KEYS = Object.keys(SKILL_DEFS);
const SKILL_DAMAGE_EFFECTS = ['projectile','damageAll'];
function skillDealsDamage(key){ return SKILL_DAMAGE_EFFECTS.includes(SKILL_DEFS[key]?.effect); }

const DEFAULT_CONFIG = {
  player: {
    // hp·atk·def는 편성 스냅샷이 없을 때만 쓰는 기본값이다. 전투에서는 RunConfig.battle.player
    // (4인 체력·방어 합산, 공격 평균 + 장착 스킬 능력치)를 읽는다.
    // [2026-09-14] 4인 합산 기준. 기존 60 체감은 방어 수치 영역을 20배 정수화해 1,200으로 보존한다.
    hp: 1200,
    atk: 1000, // [2026-09-06] 공격력·적 HP 단위 ×100, 배율 계산 후 반올림
    def: 20,
    atkSpeed: 1,        // 회/초
    defIncreaseRate: 0, // §5 방어력 증가율 슬롯(현재 공급원 없음). 강철 외피는 SkillSystem.defenseBuffPct로 따로 더한다
    damageReductionBase: 0, // §5 기본 피해 감소율. 용광 방벽 감소율(SkillSystem)과 곱연산한다
    projectileSpeed: 620,   // px/sec, ASSUMPTION: §4 "0.5~0.8초 도달"을 속도값으로 환산
  },
  // [2026-09-13] 1차(공통)·2차(미사일별) 전투 팩터.
  // 모든 성장 콘텐츠는 이 스키마와 같은 값을 공급하고 DamageResolver만 최종 피해를 계산한다.
  // 기존 밸런스를 유지하기 위해 신규 공격 팩터는 0, 치명타 피해 기본 보너스만 50%로 둔다.
  combatFactors: {
    global: {
      attackPct:0, damagePct:0, critChance:0, critDamagePct:0.50,
      defenseIgnore:0, pierceRate:0, attackSpeedPct:0, bossDamagePct:0,
    },
    modules: Object.fromEntries(MISSILE_KEYS.map(key=>[key,{
      attackPct:0, damagePct:0, critChance:0, critDamagePct:0,
      defenseIgnore:0, pierceRate:0, attackSpeedPct:0, bossDamagePct:0,
    }])),
  },
  // 수치 상한과 방어 공식은 아직 밸런스 미확정이므로 에디터에서 조정 가능한 구현 기본값이다.
  combatRules: {
    critChanceCap:0.95,
    defenseIgnoreCap:0.90,
    pierceRateCap:0.80,
    defenseConstant:1000,
    minimumDamage:1,
    minimumIncomingDamage:20,
  },
  // [2026-09-07] 전장 논리 해상도 — 모든 판정 좌표·거리·속도의 기준 좌표계다.
  // 확정(인철): 해상도마다 다르게 보일 수는 있어도 게임 경험은 어느 해상도에서나 같아야 한다.
  // 이 값을 고정하면 폭발 반경·광선 폭·히트박스·투사체 속도·근접 정지 거리 같은 px 수치가
  // 기기와 무관하게 같은 의미를 갖는다. 화면에는 CSS가 이 좌표계를 컨테이너에 맞춰 늘려 보여준다.
  // height 480은 canvas 태그의 원래 기본값이자 아래 px 수치들이 처음 튜닝된 기준값이다.
  // maxAnisotropy: 세로 배율 / 가로 배율 차이의 허용 상한. 컨테이너 비율이 논리 비율과
  // 달라도 이 범위 안에서는 캔버스를 늘려 화면을 꽉 채우고, 넘어서면 캔버스를 줄여
  // 여백(레터박스)을 만든다. 1.18이면 최신 폰은 여백 없이 꽉 차고 짧은 화면만 여백이 생긴다.
  field: {
    // playerOffsetY: 영웅 편성 줄이 전장 바닥에서 떨어진 거리. 42는 우하단 가로 스킬바
    // (44px + 여백)와 겹쳐 4번 슬롯 영웅이 버튼에 깔렸다. 68이면 짧은 화면에서도
    // 스프라이트 하단이 스킬바 위에서 끝난다. 핵(coreY 315)과는 95px 떨어져 구도는 그대로다.
    width:440, height:480, playerOffsetY:72, maxAnisotropy:1.18,
    // 핵은 영웅 앞 중앙 (220,315), 지름 48px. 영웅은 기존 후방 편성 위치를 쓴다.
    coreY:315, coreRadius:24, enemyContactGap:4, spawnMargin:64,
  },
  // [2026-09-09] 히트박스·명중 판정 px 값. 단위는 위 field와 같은 논리 좌표계다.
  // 문서 '전장 논리 해상도' 항목이 폭발 반경·광선 폭과 나란히 "히트박스"도 소스 설정에서
  // 조정한다고 적어 뒀는데 이 값들만 코드 리터럴로 네 곳에 흩어져 있었다. 여기로 모은다.
  // enemyRadius/bossRadius는 판정과 렌더가 같은 값을 써야 원과 맞는 판정이 되므로
  // enemyHitRadius() 하나를 통해 양쪽이 함께 읽는다.
  hitbox: {
    enemyRadius: 9,
    // [2026-09-17] 확정(인철): 16 → 40. 보스 스프라이트는 반지름 39~46px인데 판정이 16px이라
    // 스프라이트 위를 지나는 탄이 판정에 걸리지 않았다. 특히 산탄 옆탄이 중간보스 기준
    // 중심까지 21.0px vs 판정 20px으로 1px 차이로 빗나가, 보스 상대로 중앙탄만 들어갔다.
    // 이 값은 레이저 폭·폭발 반경·직선탄 명중 판정에도 함께 쓰이므로 보스전 전반이 후해진다.
    bossRadius: 40,
    laserEdgePad: 4,          // 직선탄이 적 반경 바깥을 스칠 때 허용하는 여유
    homingHitDist: 10,        // 목표 지정 탄환이 목표에 이만큼 붙으면 명중 처리
    projectileRangeMul: 1.2,  // 직선탄 최대 비행거리 = 전장 대각선 × 이 값
  },
  board: { rows: 2, cols: 8 },
  // [2026-09-04 신규] 에너지는 처치 점수로만 지급한다. 확정(인철): "몬스터 처치 점수 기반으로
  // 100점당 일정량의 에너지를 획득, 생성기 버튼에 게이지 표기".
  // [2026-09-08 1안] 일반 적은 3점, 중간보스는 200점으로 조정했다.
  // [2026-09-18] 중간보스 200점은 한 번에 에너지 10을 꽂아 넣는 목돈이라 보드(16칸)가
  // 못 받아내고 남는 문제가 있었다 — 확정(인철): 중간보스를 100점으로 낮추고
  // (지급 환산 에너지 10 → 5), 그만큼 줄어든 초반 수급을 시작 에너지 10 → 20으로 보정했다.
  // 지급 단위 20점당 1, 생성 비용 1은 유지한다.
  // [2026-09-17 정정] 스킬은 다시 에너지를 소모한다(skillEnergy 참고) — 이 에너지는
  // 피스 생성과 스킬 사용 양쪽에 쓰인다.
  scoring: {
    normalKill: 3,
    midBoss: 100,
    finalBoss: 0,
    pointsPerGrant: 20,
    energyPerGrant: 1,
    startEnergy: 20,
  },
  // 일반 WAVE 총개체 수 선형 커브. 타입별 수는 기존 구성 비율에 맞춰 합계 안에서 배분한다.
  stage: {
    startWave: NORMAL_COUNT_CURVE.startWave,
    endWave: NORMAL_COUNT_CURVE.endWave,
    startCount: NORMAL_COUNT_CURVE.startCount,
    endCount: NORMAL_COUNT_CURVE.endCount,
    stageOneHpMul: 0.90,
    // [2026-09-17] 확정(인철): 스테이지당 적 HP 증가율 0.35 → 0.20 → 0.26.
    // 0.35는 화력 상한(6성 Lv.60) 대비 스테이지 44에서 벽을 만들어 등반이 멈췄고,
    // 등반이 멈추면 별불(새 스테이지 돌파 전용)도 같이 끊겨 성장 순환 자체가 닫혔다.
    // 0.20은 실기기에서 너무 쉬웠다 — 다만 주된 원인은 이 값이 아니라 같이 들어간
    // 능력치 곡선(meta.character.growthCurve)이 Lv.60 공격력을 6.6배로 올린 쪽이다.
    // 능력치 곡선은 그대로 두고 이 값만 0.26으로 되올려 중간에서 맞춘다.
    hpScalePerStage: 0.26,
  },
  // 개발 옵션은 프로토타입에서 시스템 자체를 켜고 끄는 용도만 담당한다.
  // 런 중 획득하는 패시브 및 성장 효과와는 별개의 레이어다.
  featureFlags: {
    criticalMerge: true,
    goldenPiece: true,
  },
  generator: {
    costPerPiece: 1,
    holdIntervalSec: 0.3,
  },
  // §21 리디자인: 파워업/스킬 전용 피스를 없애고 "색깔 피스"만 보드에 생성한다.
  // 색깔 피스를 모아 주문서(파워업 주문서/스킬 주문서)를 완성해야 효과가 발동된다.
  // 확정: "파워업피스, 스킬피스가 아니라 색깔 피스를 4~5종을 만들고 주문서를
  // 파워업 주문서와 스킬 주문서로 나눠야해" (인철). 색깔 개수는 에디터에서 조정.
  colors: {
    names:  ['red','blue','green','yellow','purple'],
    labels: { red:'빨강', blue:'파랑', green:'초록', yellow:'노랑', purple:'보라' },
    count: 5,      // 활성 색깔 수(3~5) — 3색 주문서를 위해 최소 3종 필요
    maxTier: 4,    // 피스 최대 티어(T1~T4) — 기존 파워업 4티어 체계를 그대로 승계
  },
  // 공격 모듈은 서로 독립된 주기로 동시에 발사된다. 아래 값은 기획 미확정 초기값이며
  // 에디터에서 조정한다. 각 주문서 완료 시 소모 피스의 티어 합계를 레벨로 사용한다.
  attackModules: {
    damageBonusByLevel: [0.10,0.18,0.25,0.35,0.45,0.58,0.72,0.88,1.06,1.26,1.48,1.72],
    speedBonusByLevel:  [0.08,0.13,0.18,0.24,0.30,0.37,0.44,0.52,0.60,0.69,0.78,0.88],
    chain: {
      label:MISSILE_DEFS.chain.label, color:MISSILE_DEFS.chain.color, baseDamageMul:1.00, baseAttacksPerSec:1.00,
      baseTargets:2, targetBonusByLevel:[1,2,3,4,5,6,7,8,9,10,11,12],
      // [2026-09-14] 확정(인철): 미사일 고유 규칙은 기본 동작이 아니라 캐릭터 고정 패시브로만
      // 켜진다 — "이 훅들이 기본값이면 안되 이건 패시브 스킬로 쓸 훅들이야". 그래서 아래 전역
      // 기본값은 0이고, 편성한 캐릭터의 패시브 값이 여기에 더해진다(moduleRuleValue 참고).
      // 0이 아닌 값을 넣으면 편성과 무관하게 전원에게 적용되므로 검증용으로만 쓴다.
      unusedTargetBonus:0,
    },
    explosion: {
      label:MISSILE_DEFS.explosion.label, color:MISSILE_DEFS.explosion.color, baseDamageMul:1.20, baseAttacksPerSec:1.00,
      baseRadius:42, radiusBonusByLevel:[4,8,12,16,20,24,28,32,36,40,44,48],
      // [2026-09-14] 2차 폭발. 전역 기본값 0 — 캐릭터 패시브로만 켜진다.
      secondary:{ damagePct:0, radiusPct:0 },
    },
    scatter: {
      label:MISSILE_DEFS.scatter.label, color:MISSILE_DEFS.scatter.color, baseDamageMul:0.85, baseAttacksPerSec:1.00,
      // [2026-09-07] 확정(인철): 산탄은 활성화 즉시 중앙·좌·우 3발로 시작한다. 중앙 1발만 나가면
      // 산탄이라는 이름의 의미가 없다. 발사 수 옵션 최초 적용에 1발을 보정하던 처리는 제거하고,
      // 강화는 아래 증가량을 그대로 누적한다 — Lv.1 반복 기준 3→4→5…
      baseProjectiles:3, projectileBonusByLevel:[1,2,3,4,5,6,7,8,9,10,11,12], spreadAngleDeg:14,
      // [2026-09-14] 중앙탄 추가 피해. 전역 기본값 0 — 캐릭터 패시브로만 켜진다.
      // 볼리 중복 적중 보너스는 확정(인철)으로 채택하지 않는다.
      centerDamageBonus:0,
    },
    // [2026-09-04] 확정(인철): 연쇄·폭발·산탄에 직선 관통과 레이저를 더해 5종으로 늘렸다.
    // [2026-09-07] 확정(인철): 관통을 제거해 4종으로 되돌린다. 관통과 레이저가 "직선상의 적"이라는
    // 같은 다중처리 형태를 공유해, 수치를 어떻게 조정해도 한쪽이 다른 쪽의 열등한 버전이 됐다.
    // 레이저는 이동시간 없이 직선상의 적을 즉시 타격하며 단일 대상에도 온전히 유효해서,
    // 연쇄·폭발·산탄의 전용 옵션이 보스전에서 무효인 문제를 미사일 구성 단계에서 보완한다.
    laser: {
      label:MISSILE_DEFS.laser.label, color:MISSILE_DEFS.laser.color, baseDamageMul:0.85, baseAttacksPerSec:1.00,
      baseWidth:10, widthBonusByLevel:[2,4,6,8,10,12,14,16,18,20,22,24],
      // [2026-09-14] 강화 발동. 전역 기본값 0 — 캐릭터 패시브로만 켜진다.
      empowered:{ chance:0, damagePct:0, widthPct:0 },
      // [2026-09-15] 확정(인철): 직선에 걸린 적이 1기뿐일 때만 피해를 올린다.
      // 단일 대상 특화를 수치로 표현하는 훅이며 다중 대상 성능은 건드리지 않는다.
      focused:{ damagePct:0 },
    },
  },
  // 미사일 키 목록 — 새 미사일을 추가하면 여기에 넣는다.
  moduleKeys: [...MISSILE_KEYS],
  // §21 주문서는 보드를 실시간 검사하고, 버튼을 누를 때 조건에 맞는 최고 티어 피스를
  // 자동 소모한다. 티어는 요구 조건이 아니라 적용 레벨 계산에만 사용한다.
  orderSheet: {
    // [2026-09-04] 확정(인철): 스킬을 주문서에서 뺐다. 슬롯은 전부 강화 전용이다.
    slotCount: 3,
    // 지정색: 미사일 4종 × 스탯 3종 = 12조합에 5색을 파랑 3 / 초록 3 / 빨강 2 / 노랑 2 / 보라 2로 배분한다
    // (12를 5색에 나눌 때 가능한 가장 고른 분포). 원본은 MISSILE_DEFS.designatedColors.
    // 재료 2·3개 주문서의 추가 색은 지정색을 뺀 활성 색 중에서 서로 다르게 무작위로 고른다.
    designatedColors: missileDesignatedColors(),
    // [2026-09-04] 주문서 난이도(grade 1-3)가 요구 재료 수를 정한다. 색상만 맞으면 완성 가능하고
    // 소모 피스의 티어 합계가 적용 레벨이 된다. 0번 슬롯은 항상 재료 1개라 최소 한 가지 행동은 계속 가능하다.
    qualityWeights: [0.50, 0.35, 0.15], // 일반 슬롯의 1성/2성/3성 확률
    qualityPityMisses: 12,              // 일반 슬롯에서 3성이 이 횟수만큼 안 나오면 다음은 3성
    guaranteedEasySlot: 0,
    // 별은 요구 재료 수와 별개인 보상 달성도다. 세부 경계는 구현 기본값.
    starSecondThreshold: 0.5, // (현재 레벨−최소)/(최대−최소)가 이 값 이상이면 2개, 최대는 3개
  },
  // [2026-09-02 도파민 옵션] 확정(인철): "1,2,3을 모두 적용해봐야겠다" — 머지는 빠르지만
  // 확정적(랜덤 없음)이라 여기에 소확률 랜덤을 얹어 가장 빈번한 행동에도 서프라이즈를 준다.
  // "어렵게 생각하지 말고 기능으로 떼서 옵션으로" (인철) — 독립 on/off + 확률 + 보너스 티어만.
  criticalMerge: {
    // [2026-09-17] 확정(인철): 기본값을 0으로 내린다. featureFlags는 켜 둔 채 확률만 0이라
    // 에디터에서 숫자만 올리면 그대로 되살아난다.
    chance: 0,        // ASSUMPTION: 구체 수치 미확정, Claude 기본값. 에디터에서 조정
    bonusTiers: 1,    // 성공 시 원래 상승분(+1티어) 위에 몇 티어를 더 올릴지
  },
  // [2026-09-02 도파민 옵션] 확정(인철): 생성기 클릭도 이미 확률 행동이라 여기에 소확률로
  // 상위 티어가 바로 나오는 "골든 피스"를 얹는다. 수치는 Claude 기본값, 에디터에서 조정.
  goldenPiece: {
    // [2026-09-17] 확정(인철): 기본값을 0으로 내린다(위 크리티컬 머지와 같은 이유).
    chance: 0,        // ASSUMPTION: 구체 수치 미확정, Claude 기본값. 에디터에서 조정
    bonusTiers: 1,    // 성공 시 1티어(T1) 대신 몇 티어 위로 생성할지
  },
  // [2026-09-15] 확정(인철): 30점당 3장을 10점당 1장으로 쪼갠다. 점당 공급량(0.1장)은
  // 완전히 같아 후반 총량은 변하지 않고, 초반에 첫 3장을 소진한 시점(게이지 11~12점)에서
  // 30점까지 18점을 더 벌어야 하던 절벽만 사라진다. 몰아주는 쾌감은 중간보스로 남긴다.
  orderGauge: {
    maxCharge: 12,
    ordersPerGrant: 1,
    midBossOrders: 2,
    pointPerEnergy: 1,
    pointPerMerge: 1,
  },
  // [2026-09-17] 확정(인철): 스킬을 다시 에너지 소비로 되돌린다(2026-09-04 "에너지를 소모하지
  // 않는다" 확정의 정정). 비용은 스킬마다 따로 누적하며 첫 사용 firstCost, 이후 사용마다 costStep씩
  // 오른다(1 → 3 → 5 …). 런 내내 누적되고 WAVE가 넘어가도 초기화되지 않는다.
  // 주문서 게이지에는 연동하지 않는다 — 게이지는 피스 생성으로 쓴 에너지와 머지만 센다.
  skillEnergy: { firstCost: 1, costStep: 2 },
  // [2026-09-16] 로비에서 2개를 장착하고 전투에서는 쿨타임으로 사용한다.
  // 레벨은 장착 능력치, 성급은 액티브 효과만 성장시킨다.
  // 이름·설명·분류·아이콘은 SKILL_DEFS에 있고 여기는 조정 수치만 둔다(미사일의 MISSILE_DEFS/attackModules와 같은 구조).
  skillPickCount: 2,
  skills: {
    strong_single: { name:SKILL_DEFS.strong_single.name, baseEffect:4.00, cooldownSec:24,
      stats:{base:{atk:60,def:0,hp:0},perLevel:{atk:8,def:0,hp:0}} },
    aoe:           { name:SKILL_DEFS.aoe.name, baseEffect:2.00, cooldownSec:30,
      stats:{base:{atk:45,def:0,hp:15},perLevel:{atk:6,def:0,hp:3}} },
    defense:       { name:SKILL_DEFS.defense.name, baseEffect:0.1017, durationSec:5, cooldownSec:40,
      stats:{base:{atk:0,def:1,hp:30},perLevel:{atk:0,def:0.25,hp:5}} },
    heal:          { name:SKILL_DEFS.heal.name, baseEffect:0.1083, cooldownSec:36,
      stats:{base:{atk:0,def:0,hp:45},perLevel:{atk:0,def:0.15,hp:7}} },
    // [2026-09-16] 신규 7종. 확정(인철): 제어(스턴·감속·넉백)는 성급이 피해를 올리고, 버프·지속 회복은 성급마다
    // 지속 +1초. 피해 계수 스턴 < 넉백 < 감속, 지속 회복 1회 총량 > 재생 불씨. 제어는 보스에게도 그대로 적용.
    // [2026-09-17] 확정(인철): 지속형 쿨타임의 "6성 최대 지속 대비 15% 여유" 자동 계산 규칙을 폐지하고
    // 개별 cooldownSec 값으로 바꿨다. 아래 23.6·23.6·25.8은 폐지 직전 파생값(11.8·11.8·12.9)의 2배다.
    // ASSUMPTION: 아래 수치는 전부 Claude 가안(인철 위임). 근거는 implNotes v0916_4.
    // [2026-09-17] 확정(인철): 에너지를 얻는 스킬이 에너지를 소모하는 것은 이해가 충돌한다.
    // energyFree로 비용을 면제하고, 대신 쿨타임을 2배(40→80)로 늘려 가치를 되받는다.
    energy_surge:  { name:SKILL_DEFS.energy_surge.name, baseEffect:5, growth:'effect', cooldownSec:80, energyFree:true,
      stats:{base:{atk:30,def:0,hp:20},perLevel:{atk:4,def:0,hp:3}} },
    attack_buff:   { name:SKILL_DEFS.attack_buff.name, baseEffect:0.25, growth:'duration', durationSec:5, durationPerStar:1, cooldownSec:23.6,
      stats:{base:{atk:55,def:0,hp:0},perLevel:{atk:7,def:0,hp:0}} },
    defense_buff:  { name:SKILL_DEFS.defense_buff.name, baseEffect:1.00, growth:'duration', durationSec:5, durationPerStar:1, cooldownSec:23.6,
      stats:{base:{atk:0,def:1,hp:25},perLevel:{atk:0,def:0.25,hp:4}} },
    stun:          { name:SKILL_DEFS.stun.name, baseEffect:0.80, growth:'effect', stunSec:2, cooldownSec:36,
      stats:{base:{atk:40,def:0,hp:10},perLevel:{atk:5,def:0,hp:2}} },
    slow:          { name:SKILL_DEFS.slow.name, baseEffect:1.20, growth:'effect', slowPct:0.40, slowSec:4, cooldownSec:32,
      stats:{base:{atk:40,def:0,hp:10},perLevel:{atk:5,def:0,hp:2}} },
    knockback:     { name:SKILL_DEFS.knockback.name, baseEffect:1.00, growth:'effect', knockbackPx:45, cooldownSec:32,
      stats:{base:{atk:40,def:0,hp:10},perLevel:{atk:5,def:0,hp:2}} },
    regen:         { name:SKILL_DEFS.regen.name, baseEffect:0.02, growth:'duration', durationSec:6, durationPerStar:1, cooldownSec:25.8,
      stats:{base:{atk:0,def:0,hp:45},perLevel:{atk:0,def:0.15,hp:7}} },
  },
  enemy: {
    // 스테이지 1~3은 방어력 0, 스테이지 4부터 10으로 시작해 스테이지마다 +10 선형 증가한다.
    // 산출된 기본 방어력에 아래 타입별 defMul을 곱해 개별 적의 최종 방어력을 만든다.
    // hp·atk는 스테이지 배율을 곱하기 전 기본값, 방어력은 입장 시 defenseGrowth로 계산해 RunConfig.battle에 넣는다.
    // [2026-09-17] 확정(인철): 기본 공격력 20 → 80. 스테이지 배율이 선형(+15%p)이라
    // 곱연산으로 크는 편성을 따라가지 못했고, 받는 피해가 max(20, 공격력−방어력)의
    // 최소값 20에 오래 묶여 "맞아도 안 아픈" 구간이 길었다. 초기값을 올려 중반 편성 기준
    // 아프기 시작하는 지점을 스테이지 20에서 5로 당긴다(계산 확인).
    // 초보 편성 기준 스테이지 5 W29에서 5대면 핵 HP 1,200이 소진된다 — 도달 전에 처치하라는
    // 압박을 만드는 것이 의도다. HP 계수(stage.hpScale)는 건드리지 않는다.
    base: { hp: 1100, atk: 70, atkSpeed: 1, travelTimeSec: 10 },
    defenseGrowth:{freeStages:3,perStage:10},
    // [2026-09-04] HP 계수와 ATK 계수를 분리했다. 확정(인철): "적의 HP 성장 계수를 늘리면
    // 스킬 원샷·보스 미접근·피격 부족 세 문제가 같이 풀린다".
    // HP 0.20이면 최종보스전이 12.8초가 되어 보스 도달시간(10초)을 넘기고, 강화 합산을 적용한
    // 스킬 피해도 보스 HP의 69% 수준으로 들어온다(계산 확인). ATK는 기존 0.10 유지.
    hpStepPct: 0.20,
    atkStepPct: 0.10,
    // [2026-09-17] 확정(인철): 타입을 늘리지 않고 도달 시간만 분화한다. 기존에는 세 타입이 모두 10초라
    // WAVE 12초 안에서 2초 스폰 배치(물량의 50%)가 구조적으로 핵을 한 번도 때리지 못했다.
    // 근접 7초·원거리 8초로 당겨 후발 배치까지 도달시키고, 그 대신 체력을 내려 처치 난이도를 보정한다.
    // 속도 상승분이 체력 하락분보다 커서 필요 DPS는 근접 +14.4%, 원거리 +9.4%로 순증한다(의도된 상향).
    // 탱커는 10초 유지 — 더 늦추면 WAVE 12초 안에 도달 자체가 불가능해진다(WAVE별 길이 변주 이후 재검토).
    types: {
      melee:  { hpMul: 0.8, atkMul: 1.0, defMul:1.0, travelTimeSec: 7 },
      ranged: { hpMul: 0.7, atkMul: 1.0, defMul:0.8, travelTimeSec:8, rangePct: 0.35, projectileSpeed: 480 },
      tank:   { hpMul: 2.0, atkMul: 1.3, defMul:1.5, travelTimeSec: 10 },
    },
  },
  waveTiming: {
    durationSec: 12,
    spawnRatios: [0.20, 0.30, 0.50],
    spawnTimesSec: [0, 1, 2],
    earlyTransitionAlivePct: 0.10, // ceil(총 개체수 * 10%) 이하면 조기 전환
  },
  // [2026-09-08] 전투 연출 전용 값. 판정 시점과 전투 밸런스는 바꾸지 않는다.
  presentation: {
    midBossAlertSec: 0.9,
    finalBossAlertSec: 1.1,
    clearSlowSec: 0.7,
    defeatSlowSec: 0.6,
    clearTimeScale: 0.18,
    defeatTimeScale: 0.24,
    // [2026-09-15] 타격감 수치. 전부 표시 계층 전용이라 판정·밸런스에는 영향이 없다.
    hitStopSec: 0.045,          // 치명타 적중 시 멈춤 길이
    killStopSec: 0.07,          // 일반 처치 시 멈춤 길이
    bossKillStopSec: 0.16,      // 보스 처치 시 멈춤 길이(상한 무시하고 항상 발동)
    hitStopTimeScale: 0.08,     // 멈춤 동안의 배속
    hitStopCooldownSec: 0.22,   // 연속 발동 최소 간격 — 물량전에서 게임이 계속 느려지는 것을 막는다
    hitPushPx: 10,              // 피격 시 표시상 밀리는 거리(열풍 분출의 실제 넉백 skills.knockback.knockbackPx와 별개)
    hitPushRecoverSec: 0.18,    // 밀린 위치가 제자리로 돌아오는 시간
    squashSec: 0.12,            // 피격 압축 지속
    squashAmount: 0.16,         // 가로 +비율 / 세로 -비율
    killAfterimageSec: 0.22,    // 처치 잔상 지속(보스는 1.8배)
    // [2026-09-18 연출 세션 A] 적 공격 텔레그래프와 핵 반응. 전부 표시 계층 전용이다 —
    // 적 좌표·공격 주기·피해량은 건드리지 않는다.
    windupSec: 0.25,            // 근접 예비동작 길이. 공격 쿨다운이 이 구간에 들어오면 기울기·확대가 시작된다
    windupScale: 0.12,          // 예비동작 끝에서의 확대량(1.0 → 1+이 값)
    windupLeanPx: 5,            // 예비동작 중 핵 쪽으로 기우는 거리
    coreImpactRadius: 18,       // 핵 피격 링 반경
    coreImpactParticles: 5,     // 핵 피격 파편 수(4~6)
    coreFlashSec: 0.08,         // 핵 흰 플래시 지속
    coreStages: [0.7,0.4,0.15], // 핵 외형이 바뀌는 공용 HP 비율 경계
    coreLowPct: 0.15,           // 저HP 경고가 켜지는 비율(coreStages의 마지막과 같게 둔다)
    projectileTrailLen: 4,      // 투사체 잔상 프레임 수(0이면 끔)
    muzzleFlashSec: 0.12,       // 적 원거리 발사 머즐 플래시 지속
  },
  boss: {
    midHpExtraMul: 1.0,
    finalHpExtraMul: 1.0,
    midAtkMul: 1.25,
    finalAtkMul: 1.5,
    // §16 "보스 타입은 근접/원거리/탱커 중 에디터에서 선택" — 랜덤이 아니라 고정 선택값.
    midType: 'melee',
    finalType: 'tank',
  },
  // WAVE 구성과 보스 체력용 가상 구성은 설정값이 아니라 입장한 스테이지의 WAVE 수로 매번 생성한다(RunConfig.battle).
  // [2026-09-14] 메타 성장 — 희귀도 5단계, 골드 뽑기, 동일 캐릭터 조각 승급.
  // ASSUMPTION: 아래 수치는 전부 Claude 초기값이다(인철 확정 전). 근거는 시뮬레이션이며
  // implNotes의 "메타 성장 v3" 항목에 목표별 예상 뽑기 횟수·골드·판수를 적어 두었다.
  // statMul  — 노말을 1.00으로 두어 기존 전투 밸런스(기본 공격력 1,000)를 그대로 보존한다.
  // levelCostMul — 레벨업 골드 배율. 뽑기 총액과 레벨업 총액이 비슷해지도록 맞췄다.
  //                (2026-09-16 소환이 별불로 바뀌어 이 근거는 더 이상 성립하지 않는다 — openItems 메타 경제)
  // gachaWeight  — 등급 가중치(합 100). 등급 안에서는 캐릭터를 균등 추첨한다.
  // duplicateShards — 이미 가진 캐릭터가 또 나왔을 때 주는 조각 수.
  // shardSteps      — 1→2·2→3·3→4·4→5·5→6성에 필요한 조각 수.
  // [2026-09-16 v0916_7] 캐릭터와 스킬이 같은 성장 형식을 쓴다 — starStepPct(성급 상승률)·shardSteps·duplicateShards.
  // starStepPct[i] = i성에서 (i+1)성으로 올릴 때의 상승률이며 0번은 쓰지 않는다. 누적 배율은 GrowthRules.starMultiplier.
  meta: {
    // [2026-09-16] 확정(인철): 별불은 소환 전용 재화다. 소환 가격은 별불 200개로 고정하고 초기 별불은 0이다.
    // [2026-09-16] 확정(인철): 소환 1회(별불 200)에 결과 10개가 나온다.
    gacha: { cost:200, currencyId:'starfire', startStarfire:0, resultsPerPull:10, characterWeight:70, skillWeight:30 },
    // [2026-09-16] 확정(인철): 스킬 레벨업은 캐릭터와 같은 골드 비용표(GrowthCostTable standard)를 쓴다.
    // 스킬은 희귀도가 없어 배율 없이 그대로 청구한다. 성급은 조각으로 올린다.
    skill: {
      duplicateShards:1,
      shardSteps:[2,3,5,7,10],
      // 액티브 효과 성급 상승률. 기존 누적 배율 1.00/1.15/1.30/1.45/1.60/1.80(Claude 가안)을 캐릭터와 같은
      // 단계 상승률로 환산한 값이라 누적 배율은 그대로다(openItems: 값 정리 여부).
      starStepPct:[0,0.15,0.130434783,0.115384615,0.103448276,0.125],
      // [2026-09-17] 이 규칙은 폐지됐다(스킬 쿨타임 개별값 전환). cooldownFromMaxDuration를 쓰는 스킬이
      // 없어 현재 참조자가 없으며, 계산 경로(SkillGrowthSystem.cooldown)와 함께 되돌릴 수 있도록 남겨 둔다.
      durationUptimeGap:0.15,
    },
    // [2026-09-16] 반복형 마일스톤. 확정(인철): 별불은 스테이지 돌파에만 250개, 나머지는 골드.
    // n번째 단계(0부터)의 간격 = target + targetStep×n, 보상 = reward + rewardStep×n (rewardCap>0이면 상한).
    // targetStep·rewardStep이 0이면 같은 간격을 반복하는 B형, 0보다 크면 목표가 커지는 A형이다.
    // ASSUMPTION: A/B 배치와 골드 수치는 Claude 가안(인철 위임). 근거는 implNotes v0916_3 자동 플레이 실측.
    milestones: {
      stage_clear:{ target:1,  targetStep:0,  reward:250, rewardStep:0,  rewardCap:0 },
      waves:      { target:20, targetStep:0,  reward:50,  rewardStep:0,  rewardCap:0 },
      bosses:     { target:5,  targetStep:0,  reward:50,  rewardStep:0,  rewardCap:0 },
      skills_used:{ target:25, targetStep:0,  reward:40,  rewardStep:0,  rewardCap:0 },
      orders:     { target:25, targetStep:10, reward:40,  rewardStep:10, rewardCap:200 },
      merges:     { target:50, targetStep:25, reward:40,  rewardStep:10, rewardCap:200 },
    },
    // [2026-09-15] 확정(인철): 성급 상승 때 능력치 배율을 준다(이전에는 레벨 상한만 열었다).
    // 승급 상승률을 15/10/10/10/20%로 고정해 레벨과 무관하게 같은 체감을 준다.
    // 승급은 상한 레벨에서만 가능하므로 시점이 고정돼 예측 가능하다.
    character: {
      starStepPct:[0,0.15,0.10,0.10,0.10,0.20],
      // [2026-09-17] 확정(인철): 레벨당 능력치 증가폭에 비용 곡선과 같은 형태를 섞는다.
      // 비용은 지수인데 증가폭이 +100 고정이라 후반 레벨의 골드당 가치가 무너졌다.
      // blend 만큼만 섞어(나머지는 기존 선형) 초반 체감은 유지하고 후반만 무겁게 한다.
      // blend를 1에 가깝게 올리면 몰빵이 유리해져 4인 균등 육성 유인이 사라진다.
      growthCurve:{ blend:0.35, expBase:1.030 },
    },
    rarity: {
      normal:{ statMul:1.00, levelCostMul:1.00, gachaWeight:35, duplicateShards:1, shardSteps:[2,3,4,6,8] },
      magic: { statMul:1.15, levelCostMul:1.05, gachaWeight:27, duplicateShards:1, shardSteps:[2,3,4,5,7] },
      rare:  { statMul:1.32, levelCostMul:1.10, gachaWeight:21, duplicateShards:1, shardSteps:[1,2,3,5,6] },
      epic:  { statMul:1.52, levelCostMul:1.15, gachaWeight:11, duplicateShards:1, shardSteps:[1,2,3,4,5] },
      legend:{ statMul:1.75, levelCostMul:1.20, gachaWeight:6,  duplicateShards:1, shardSteps:[1,1,2,2,3] },
    },
  },
};

// 실행 중 조작되는 live config (Reset 시 DEFAULT_CONFIG에서 다시 복제).
// JSON 호환 설정 객체만 담으므로, 앱 내 브라우저에서 structuredClone이 없어도 동작하게 한다.
function cloneConfig(source){
  return typeof structuredClone === 'function'
    ? structuredClone(source)
    : JSON.parse(JSON.stringify(source));
}
const FACTORY_DEFAULT_CONFIG = cloneConfig(DEFAULT_CONFIG);
let CONFIG = cloneConfig(DEFAULT_CONFIG);

// 연출 전용 값. 게임 판정·밸런스와 분리해 효과를 바꿔도 플레이 결과에 영향이 없게 한다.
const VISUAL_CONFIG = {
  maxParticles: 180,
  hitParticles: 5,
  killParticles: 14,
  skillParticles: 28,
  shakeOnPlayerHit: true,
};

