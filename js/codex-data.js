/* ===== codex-data.js =====
   도감 콘텐츠의 정적 원본 데이터다. 진행도 계산·저장·전투 적용·화면 표시는 이 파일에 두지 않는다.

   기본 도감 점수는 "보유 중인 대상의 성급 합계"를 전제로 한다. 미보유 대상은 0점이다.
   현재 24명 기준 최대 점수는 4명 카테고리 24, 5명 카테고리 30, 전설 48이다.
   임계값을 고정값으로 둬 이후 캐릭터가 추가되어도 이미 달성한 도감 레벨이 내려가지 않게 한다.

   [2026-09-21] 확정(인철): 보상 총량을 크게 올리고 단계 보상을 지수형으로 바꾼다.
   이전 설계는 90단계를 전부 채워도 상시 DPS +16%뿐이었는데, 그 비용이 24명 전원 6성
   (별불 263,200)이었다. 같은 별불을 편성 4인 전설 6성(84,000)에 쓰면 공격력이 +84% 오르므로
   도감 쪽 효율이 17배 낮았다 — 도감을 위한 승급이 순손해였다.

   [축 통일] 팩터가 15개 도감에 9종으로 흩어져 있어 팩터당 총량을 키울 수 없었고 무엇이
   오르는지도 읽히지 않았다. 이제 분류 축마다 팩터 하나를 쓴다.
     등급 도감 → attackPct     (도감당 13%p · 5개 합 +65%)
     종족 도감 → damagePct     (도감당 13%p · 5개 합 +65%)
     신분 도감 → attackSpeedPct(도감당 10%p · 5개 합 +50%)
   관계 도감은 기본 도감이 주지 않는 나머지 팩터를 맡는다.
   세 축을 모두 채우면 1.65 × 1.65 × 1.50 = 4.08배이고, 관계 도감의 치명타까지 더하면
   상시 DPS가 약 4.9배(+386%)가 된다. 보스전은 bossDamagePct로 추가 +120%다.

   [지수형] 단계 보상 비중을 별불 승급 비용 비중(rarity.starfireSteps)과 같은 6/10/14/22/48%로
   둔다. 비용이 5→6성에 48% 몰려 있으므로 보상도 같은 모양이어야 별불 1당 가치가 모든 단계에서
   같아진다. 공비는 약 1.8이다.

   관계 도감은 좌우 진영의 요구 성급을 각각 검사한다. 한쪽만 집중 성장시켜 관계를 완성할 수 없다.
   [2026-09-21] 요구치를 "멤버 수 × 1 / 3 / 5"로 낮췄다. 이전에는 1인 진영이 레벨1에 2성,
   레벨3에 6성을 요구해 편성 4인을 전부 6성으로 올려도 관계 5개가 전부 0레벨이었다 —
   관계의 양측이 대부분 편성 밖 캐릭터이기 때문이다. 이제 레벨1은 양측 보유만으로 열린다.
   멤버 수가 늘어도 이미 달성한 레벨이 내려가지 않도록 계산식이 아니라 고정값으로 적는다. */

const CODEX_REWARD_FACTOR_KEYS=[
  'attackPct','damagePct','critChance','critDamagePct',
  'defensePct','defenseIgnore','pierceRate','attackSpeedPct','bossDamagePct',
];

// 화면은 groupOrder → sortOrder 순으로 정렬하면 등급·종족·신분이 섞이지 않는다.
const CODEX_BASE_GROUPS=[
  {groupId:'rarity', nameKey:'codex.group.rarity', groupOrder:1},
  {groupId:'race',   nameKey:'codex.group.race',   groupOrder:2},
  {groupId:'identity',nameKey:'codex.group.identity',groupOrder:3},
];

const CODEX_SCORE_THRESHOLDS={
  members4:[5,10,15,20,24],
  members5:[6,12,18,24,30],
  members8:[10,20,29,39,48],
};

// 단계별 보상 비중. 별불 승급 비용 비중과 같은 값이다(CONFIG.meta.rarity.starfireSteps).
const CODEX_LEVEL_SHARES=[0.06,0.10,0.14,0.22,0.48];
const CODEX_RELATION_LEVEL_SHARES=[0.15,0.30,0.55];

// total은 5단계를 모두 채웠을 때의 합계다. 각 단계는 그 합계를 비중대로 나눠 갖는다.
function codexBaseLevels(thresholds,factorKey,total){
  return thresholds.map((requiredScore,index)=>({
    level:index+1,
    requiredScore,
    rewards:[{scope:'global',factorKey,value:Math.round(total*CODEX_LEVEL_SHARES[index]*1e5)/1e5}],
  }));
}

// 관계는 단계마다 제목이 따로 있어 기본 도감과 생성 방식을 공유하지 않는다.
// steps는 [{titleKey,requiredSideScores}]이고, totals는 [{factorKey,total}]이다 —
// 세 단계가 같은 팩터를 비중대로 나눠 갖는다. titleKey를 조립하지 않고 그대로 받는 이유는
// tools/i18n.mjs 의 "어디서도 쓰지 않는 키" 검사가 소스를 문자열로 훑기 때문이다.
function codexRelationLevels(steps,totals){
  return steps.map(({titleKey,requiredSideScores},index)=>({
    level:index+1,titleKey,requiredSideScores,
    rewards:totals.map(({factorKey,total})=>(
      {scope:'global',factorKey,value:Math.round(total*CODEX_RELATION_LEVEL_SHARES[index]*1e5)/1e5})),
  }));
}

const CODEX_BASE_ENTRIES=[
  // 등급 — 낮은 등급부터 읽히도록 실제 희귀도 순서를 그대로 쓴다. 전부 공격력이다.
  {codexId:'rarity_normal',groupId:'rarity',sortOrder:1,nameKey:'rarity.normal.name',accent:'#B7B7AC',memberFilter:{rarityId:'normal'},levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members4,'attackPct',.13)},
  {codexId:'rarity_magic', groupId:'rarity',sortOrder:2,nameKey:'rarity.magic.name', accent:'#5EDBF4',memberFilter:{rarityId:'magic'}, levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members4,'attackPct',.13)},
  {codexId:'rarity_rare',  groupId:'rarity',sortOrder:3,nameKey:'rarity.rare.name',  accent:'#5CCB8A',memberFilter:{rarityId:'rare'},  levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members4,'attackPct',.13)},
  {codexId:'rarity_epic',  groupId:'rarity',sortOrder:4,nameKey:'rarity.epic.name',  accent:'#A876E8',memberFilter:{rarityId:'epic'},  levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members4,'attackPct',.13)},
  {codexId:'rarity_legend',groupId:'rarity',sortOrder:5,nameKey:'rarity.legend.name',accent:'#DDB86A',memberFilter:{rarityId:'legend'},levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members8,'attackPct',.13)},

  // 종족 — 세계관의 중심 종족부터 인간·엘프·드워프·수인·마족 순으로 고정한다. 전부 피해량이다.
  {codexId:'race_human',groupId:'race',sortOrder:1,nameKey:'race.human',accent:'#DDB86A',memberFilter:{raceId:'human'},levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members5,'damagePct',.13)},
  {codexId:'race_elf',  groupId:'race',sortOrder:2,nameKey:'race.elf',  accent:'#5CCB8A',memberFilter:{raceId:'elf'},  levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members5,'damagePct',.13)},
  {codexId:'race_dwarf',groupId:'race',sortOrder:3,nameKey:'race.dwarf',accent:'#F77A3D',memberFilter:{raceId:'dwarf'},levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members4,'damagePct',.13)},
  {codexId:'race_beast',groupId:'race',sortOrder:4,nameKey:'race.beast',accent:'#F2A45C',memberFilter:{raceId:'beast'},levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members5,'damagePct',.13)},
  {codexId:'race_demon',groupId:'race',sortOrder:5,nameKey:'race.demon',accent:'#A876E8',memberFilter:{raceId:'demon'},levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members5,'damagePct',.13)},

  // 신분 — 전투 전열에서 사회 바깥으로 이동하는 흐름으로 정렬한다. 전부 공격속도다.
  {codexId:'identity_knight',   groupId:'identity',sortOrder:1,nameKey:'identity.knight',   accent:'#5EDBF4',memberFilter:{identityId:'knight'},   levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members4,'attackSpeedPct',.10)},
  {codexId:'identity_noble',    groupId:'identity',sortOrder:2,nameKey:'identity.noble',    accent:'#DDB86A',memberFilter:{identityId:'noble'},    levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members5,'attackSpeedPct',.10)},
  {codexId:'identity_engineer', groupId:'identity',sortOrder:3,nameKey:'identity.engineer', accent:'#F77A3D',memberFilter:{identityId:'engineer'}, levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members5,'attackSpeedPct',.10)},
  {codexId:'identity_mercenary',groupId:'identity',sortOrder:4,nameKey:'identity.mercenary',accent:'#F2A45C',memberFilter:{identityId:'mercenary'},levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members5,'attackSpeedPct',.10)},
  {codexId:'identity_exile',    groupId:'identity',sortOrder:5,nameKey:'identity.exile',    accent:'#A876E8',memberFilter:{identityId:'exile'},    levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members5,'attackSpeedPct',.10)},
];

// 관계는 현재 플레이에서 양측 핵심 인물을 처음 만날 수 있는 시점이 빠른 순서로 표시한다.
// 요구 성급은 "멤버 수 × 1 / 3 / 5"다 — 1인 진영은 1·3·5, 2인 진영은 2·6·10이다.
const CODEX_RELATION_ENTRIES=[
  {
    codexId:'ancientRivals',sortOrder:1,
    nameKey:'codex.relation.ancientRivals.name',descKey:'codex.relation.ancientRivals.desc',accent:'#DDB86A',
    sides:[
      {sideId:'elf_noble',memberFilter:{raceId:'elf',identityId:'noble'}},
      {sideId:'dwarf_engineer',memberFilter:{raceId:'dwarf',identityId:'engineer'}},
    ],
    levels:codexRelationLevels([
      {titleKey:'codex.relation.ancientRivals.level1',requiredSideScores:[1,1]},
      {titleKey:'codex.relation.ancientRivals.level2',requiredSideScores:[3,3]},
      {titleKey:'codex.relation.ancientRivals.level3',requiredSideScores:[5,5]},
    ],[
      {factorKey:'critChance',total:.12},{factorKey:'critDamagePct',total:1.00},
    ]),
  },
  {
    codexId:'enemyCompanions',sortOrder:2,
    nameKey:'codex.relation.enemyCompanions.name',descKey:'codex.relation.enemyCompanions.desc',accent:'#F2645A',
    sides:[
      {sideId:'human_knight',memberFilter:{raceId:'human',identityId:'knight'}},
      {sideId:'demon_exile',memberFilter:{raceId:'demon',identityId:'exile'}},
    ],
    levels:codexRelationLevels([
      {titleKey:'codex.relation.enemyCompanions.level1',requiredSideScores:[1,2]},
      {titleKey:'codex.relation.enemyCompanions.level2',requiredSideScores:[3,6]},
      {titleKey:'codex.relation.enemyCompanions.level3',requiredSideScores:[5,10]},
    ],[
      {factorKey:'defenseIgnore',total:.30},
    ]),
  },
  {
    codexId:'goldenAlliance',sortOrder:3,
    nameKey:'codex.relation.goldenAlliance.name',descKey:'codex.relation.goldenAlliance.desc',accent:'#F2A45C',
    sides:[
      {sideId:'human_noble',memberFilter:{raceId:'human',identityId:'noble'}},
      {sideId:'beast_mercenary',memberFilter:{raceId:'beast',identityId:'mercenary'}},
    ],
    levels:codexRelationLevels([
      {titleKey:'codex.relation.goldenAlliance.level1',requiredSideScores:[1,2]},
      {titleKey:'codex.relation.goldenAlliance.level2',requiredSideScores:[3,6]},
      {titleKey:'codex.relation.goldenAlliance.level3',requiredSideScores:[5,10]},
    ],[
      {factorKey:'bossDamagePct',total:1.20},
    ]),
  },
  {
    codexId:'ashOath',sortOrder:4,
    nameKey:'codex.relation.ashOath.name',descKey:'codex.relation.ashOath.desc',accent:'#A876E8',
    sides:[
      {sideId:'demon_knight',memberFilter:{raceId:'demon',identityId:'knight'}},
      {sideId:'demon_exile',memberFilter:{raceId:'demon',identityId:'exile'}},
    ],
    levels:codexRelationLevels([
      {titleKey:'codex.relation.ashOath.level1',requiredSideScores:[1,2]},
      {titleKey:'codex.relation.ashOath.level2',requiredSideScores:[3,6]},
      {titleKey:'codex.relation.ashOath.level3',requiredSideScores:[5,10]},
    ],[
      {factorKey:'defensePct',total:.60},
    ]),
  },
  {
    codexId:'invertedLegacy',sortOrder:5,
    nameKey:'codex.relation.invertedLegacy.name',descKey:'codex.relation.invertedLegacy.desc',accent:'#5CCB8A',
    sides:[
      {sideId:'dwarf_noble',memberFilter:{raceId:'dwarf',identityId:'noble'}},
      {sideId:'elf_engineer',memberFilter:{raceId:'elf',identityId:'engineer'}},
    ],
    levels:codexRelationLevels([
      {titleKey:'codex.relation.invertedLegacy.level1',requiredSideScores:[1,1]},
      {titleKey:'codex.relation.invertedLegacy.level2',requiredSideScores:[3,3]},
      {titleKey:'codex.relation.invertedLegacy.level3',requiredSideScores:[5,5]},
    ],[
      {factorKey:'pierceRate',total:.30},
    ]),
  },
];

// UI는 이 객체 하나만 읽으면 탭과 카드 정렬을 모두 재현할 수 있다.
const CodexDatabase={
  baseGroups:CODEX_BASE_GROUPS,
  baseEntries:CODEX_BASE_ENTRIES,
  relationEntries:CODEX_RELATION_ENTRIES,
  rewardFactorKeys:CODEX_REWARD_FACTOR_KEYS,
};
