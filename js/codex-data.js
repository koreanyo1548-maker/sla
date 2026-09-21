/* ===== codex-data.js =====
   도감 콘텐츠의 정적 원본 데이터다. 진행도 계산·저장·전투 적용·화면 표시는 이 파일에 두지 않는다.

   기본 도감 점수는 "보유 중인 대상의 성급 합계"를 전제로 한다. 미보유 대상은 0점이다.
   현재 24명 기준 최대 점수는 4명 카테고리 24, 5명 카테고리 30, 전설 48이다.
   임계값을 고정값으로 둬 이후 캐릭터가 추가되어도 이미 달성한 도감 레벨이 내려가지 않게 한다.

   관계 도감은 좌우 진영의 요구 성급을 각각 검사한다. 한쪽만 집중 성장시켜 관계를 완성할 수 없다.
   rewards는 기존 전투 팩터 형식과 맞춘다. defensePct는 도감 전투 연동 단계에서 추가할 방어력 증가율이다. */

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

function codexBaseLevels(thresholds,factorKey,value){
  return thresholds.map((requiredScore,index)=>({
    level:index+1,
    requiredScore,
    rewards:[{scope:'global',factorKey,value}],
  }));
}

const CODEX_BASE_ENTRIES=[
  // 등급 — 낮은 등급부터 읽히도록 실제 희귀도 순서를 그대로 쓴다.
  {codexId:'rarity_normal',groupId:'rarity',sortOrder:1,nameKey:'rarity.normal.name',accent:'#B7B7AC',memberFilter:{rarityId:'normal'},levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members4,'defensePct',.005)},
  {codexId:'rarity_magic', groupId:'rarity',sortOrder:2,nameKey:'rarity.magic.name', accent:'#5EDBF4',memberFilter:{rarityId:'magic'}, levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members4,'attackSpeedPct',.003)},
  {codexId:'rarity_rare',  groupId:'rarity',sortOrder:3,nameKey:'rarity.rare.name',  accent:'#5CCB8A',memberFilter:{rarityId:'rare'},  levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members4,'critChance',.002)},
  {codexId:'rarity_epic',  groupId:'rarity',sortOrder:4,nameKey:'rarity.epic.name',  accent:'#A876E8',memberFilter:{rarityId:'epic'},  levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members4,'critDamagePct',.01)},
  {codexId:'rarity_legend',groupId:'rarity',sortOrder:5,nameKey:'rarity.legend.name',accent:'#DDB86A',memberFilter:{rarityId:'legend'},levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members8,'bossDamagePct',.005)},

  // 종족 — 세계관의 중심 종족부터 인간·엘프·드워프·수인·마족 순으로 고정한다.
  {codexId:'race_human',groupId:'race',sortOrder:1,nameKey:'race.human',accent:'#DDB86A',memberFilter:{raceId:'human'},levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members5,'attackPct',.005)},
  {codexId:'race_elf',  groupId:'race',sortOrder:2,nameKey:'race.elf',  accent:'#5CCB8A',memberFilter:{raceId:'elf'},  levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members5,'attackSpeedPct',.003)},
  {codexId:'race_dwarf',groupId:'race',sortOrder:3,nameKey:'race.dwarf',accent:'#F77A3D',memberFilter:{raceId:'dwarf'},levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members4,'defensePct',.005)},
  {codexId:'race_beast',groupId:'race',sortOrder:4,nameKey:'race.beast',accent:'#F2A45C',memberFilter:{raceId:'beast'},levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members5,'critChance',.002)},
  {codexId:'race_demon',groupId:'race',sortOrder:5,nameKey:'race.demon',accent:'#A876E8',memberFilter:{raceId:'demon'},levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members5,'defenseIgnore',.002)},

  // 신분 — 전투 전열에서 사회 바깥으로 이동하는 흐름으로 정렬한다.
  {codexId:'identity_knight',   groupId:'identity',sortOrder:1,nameKey:'identity.knight',   accent:'#5EDBF4',memberFilter:{identityId:'knight'},   levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members4,'defensePct',.005)},
  {codexId:'identity_noble',    groupId:'identity',sortOrder:2,nameKey:'identity.noble',    accent:'#DDB86A',memberFilter:{identityId:'noble'},    levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members5,'critDamagePct',.01)},
  {codexId:'identity_engineer', groupId:'identity',sortOrder:3,nameKey:'identity.engineer', accent:'#F77A3D',memberFilter:{identityId:'engineer'}, levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members5,'pierceRate',.002)},
  {codexId:'identity_mercenary',groupId:'identity',sortOrder:4,nameKey:'identity.mercenary',accent:'#F2A45C',memberFilter:{identityId:'mercenary'},levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members5,'bossDamagePct',.005)},
  {codexId:'identity_exile',    groupId:'identity',sortOrder:5,nameKey:'identity.exile',    accent:'#A876E8',memberFilter:{identityId:'exile'},    levels:codexBaseLevels(CODEX_SCORE_THRESHOLDS.members5,'damagePct',.005)},
];

// 관계는 현재 플레이에서 양측 핵심 인물을 처음 만날 수 있는 시점이 빠른 순서로 표시한다.
const CODEX_RELATION_ENTRIES=[
  {
    codexId:'relation_ancient_rivals',sortOrder:1,
    nameKey:'codex.relation.ancientRivals.name',descKey:'codex.relation.ancientRivals.desc',accent:'#DDB86A',
    sides:[
      {sideId:'elf_noble',memberFilter:{raceId:'elf',identityId:'noble'}},
      {sideId:'dwarf_engineer',memberFilter:{raceId:'dwarf',identityId:'engineer'}},
    ],
    levels:[
      {level:1,titleKey:'codex.relation.ancientRivals.level1',requiredSideScores:[2,2],rewards:[{scope:'global',factorKey:'attackPct',value:.01}]},
      {level:2,titleKey:'codex.relation.ancientRivals.level2',requiredSideScores:[4,4],rewards:[{scope:'global',factorKey:'defenseIgnore',value:.003}]},
      {level:3,titleKey:'codex.relation.ancientRivals.level3',requiredSideScores:[6,6],rewards:[{scope:'global',factorKey:'damagePct',value:.01}]},
    ],
  },
  {
    codexId:'relation_enemy_companions',sortOrder:2,
    nameKey:'codex.relation.enemyCompanions.name',descKey:'codex.relation.enemyCompanions.desc',accent:'#F2645A',
    sides:[
      {sideId:'human_knight',memberFilter:{raceId:'human',identityId:'knight'}},
      {sideId:'demon_exile',memberFilter:{raceId:'demon',identityId:'exile'}},
    ],
    levels:[
      {level:1,titleKey:'codex.relation.enemyCompanions.level1',requiredSideScores:[2,3],rewards:[{scope:'global',factorKey:'pierceRate',value:.003}]},
      {level:2,titleKey:'codex.relation.enemyCompanions.level2',requiredSideScores:[4,7],rewards:[{scope:'global',factorKey:'defensePct',value:.01}]},
      {level:3,titleKey:'codex.relation.enemyCompanions.level3',requiredSideScores:[6,12],rewards:[{scope:'global',factorKey:'damagePct',value:.01}]},
    ],
  },
  {
    codexId:'relation_golden_alliance',sortOrder:3,
    nameKey:'codex.relation.goldenAlliance.name',descKey:'codex.relation.goldenAlliance.desc',accent:'#F2A45C',
    sides:[
      {sideId:'human_noble',memberFilter:{raceId:'human',identityId:'noble'}},
      {sideId:'beast_mercenary',memberFilter:{raceId:'beast',identityId:'mercenary'}},
    ],
    levels:[
      {level:1,titleKey:'codex.relation.goldenAlliance.level1',requiredSideScores:[2,3],rewards:[{scope:'global',factorKey:'bossDamagePct',value:.01}]},
      {level:2,titleKey:'codex.relation.goldenAlliance.level2',requiredSideScores:[4,7],rewards:[{scope:'global',factorKey:'critDamagePct',value:.02}]},
      {level:3,titleKey:'codex.relation.goldenAlliance.level3',requiredSideScores:[6,12],rewards:[{scope:'global',factorKey:'attackPct',value:.01}]},
    ],
  },
  {
    codexId:'relation_ash_oath',sortOrder:4,
    nameKey:'codex.relation.ashOath.name',descKey:'codex.relation.ashOath.desc',accent:'#A876E8',
    sides:[
      {sideId:'demon_knight',memberFilter:{raceId:'demon',identityId:'knight'}},
      {sideId:'demon_exile',memberFilter:{raceId:'demon',identityId:'exile'}},
    ],
    levels:[
      {level:1,titleKey:'codex.relation.ashOath.level1',requiredSideScores:[2,3],rewards:[{scope:'global',factorKey:'defensePct',value:.01}]},
      {level:2,titleKey:'codex.relation.ashOath.level2',requiredSideScores:[4,7],rewards:[{scope:'global',factorKey:'damagePct',value:.01}]},
      {level:3,titleKey:'codex.relation.ashOath.level3',requiredSideScores:[6,12],rewards:[{scope:'global',factorKey:'defenseIgnore',value:.003}]},
    ],
  },
  {
    codexId:'relation_inverted_legacy',sortOrder:5,
    nameKey:'codex.relation.invertedLegacy.name',descKey:'codex.relation.invertedLegacy.desc',accent:'#5CCB8A',
    sides:[
      {sideId:'dwarf_noble',memberFilter:{raceId:'dwarf',identityId:'noble'}},
      {sideId:'elf_engineer',memberFilter:{raceId:'elf',identityId:'engineer'}},
    ],
    levels:[
      {level:1,titleKey:'codex.relation.invertedLegacy.level1',requiredSideScores:[2,2],rewards:[{scope:'global',factorKey:'defensePct',value:.01}]},
      {level:2,titleKey:'codex.relation.invertedLegacy.level2',requiredSideScores:[4,4],rewards:[{scope:'global',factorKey:'pierceRate',value:.003}]},
      {level:3,titleKey:'codex.relation.invertedLegacy.level3',requiredSideScores:[6,6],rewards:[{scope:'global',factorKey:'attackSpeedPct',value:.007}]},
    ],
  },
];

// UI는 이 객체 하나만 읽으면 탭과 카드 정렬을 모두 재현할 수 있다.
const CodexDatabase={
  baseGroups:CODEX_BASE_GROUPS,
  baseEntries:CODEX_BASE_ENTRIES,
  relationEntries:CODEX_RELATION_ENTRIES,
  rewardFactorKeys:CODEX_REWARD_FACTOR_KEYS,
};
