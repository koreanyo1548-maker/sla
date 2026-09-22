/* ===== tools/balance-ledger.mjs ===== */
/* =====================================================================
   [세션 1] 스테이지별 자원 원장 — 스테이지성장밸런스재설계계획.md 단계 A

     node tools/balance-ledger.mjs                     표를 화면에 출력
     node tools/balance-ledger.mjs --stages=60         분석 범위 지정(기본 60)
     node tools/balance-ledger.mjs --write             tools/out/ 에 CSV·JSON 기록
     node tools/balance-ledger.mjs --skills-used=8 --orders=5 --merges=40
                                                       플레이 의존 횟수를 넣고 재계산

   [무엇을 하는가] 현행 코드(js/*.js)를 그대로 읽어, 스테이지 1..N을 각각 한 번씩
   클리어했을 때의 골드·별불 공급량을 계산한다. 수치를 여기에 다시 적지 않는다 —
   campaignStage·CampaignStore·MilestoneSystem·buildStageWaves를 게임과 같은 코드로
   호출하므로, CONFIG를 고치면 이 원장도 따라 바뀐다.

   [결정적 계산] 같은 입력에서 항상 같은 결과가 나온다. 난수·시간·저장·DOM·전투 객체를
   쓰지 않는다. 게임 파일을 node:vm 컨텍스트에 올려 읽기만 하며, 아래 DOM_SHIM은 파일이
   로드되게 하는 최소 껍데기다(원장 계산에는 한 번도 쓰이지 않는다).

   [경계 — 이 스크립트가 계산하지 않는 것]
   마일스톤 12줄 중 5줄(module_levels·skill_levels·stars·guardians·owned_skills)은
   "무엇을 얼마나 샀는가"가 정해져야 값이 나온다. 그건 단계 B(세션 2, 성장 최적화
   계산기)의 결과이므로 여기서는 0으로 두고 미산입으로 표시한다. 자원 원장이 성장
   계산의 입력이고 그 5줄은 성장 계산의 출력이라, 두 단계는 한 번 왕복해야 닫힌다.
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');

/* --- 인자 ------------------------------------------------------------- */
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`));
  return hit === undefined ? fallback : Number(hit.split('=')[1]);
};
const STAGES = Math.max(1, Math.floor(flag('stages', 60)));
const WRITE = argv.includes('--write');
/* 전투당 플레이 의존 횟수. 기본 0 — 확정 보상만 담은 원장이 나온다.
   [2026-09-22 확정(인철)] 성장 기대값의 전투 스펙은 공격력 강화 레벨 6(+58%) × 5(나머지
   전투 중 요소 일괄) × 4(편성 4인) = 31.6배로 잡는다. 그 스펙은 단계 B·C가 쓰는 값이고,
   아래 세 횟수는 그와 별개인 골드 마일스톤의 입력이라 실측치로 교체할 때까지 0이다. */
const PLAY_INPUT = {
  skillsUsed: Math.max(0, flag('skills-used', 0)),
  orders:     Math.max(0, flag('orders', 0)),
  merges:     Math.max(0, flag('merges', 0)),
};

/* --- 게임 코드 로드 ----------------------------------------------------
   index.html의 <script> 순서를 그대로 따른다. i18n·연출 파일은 원장에 쓰이지 않아 뺐다. */
const GAME_FILES = [
  'js/config.js', 'js/core.js', 'js/heroes.js', 'js/combat.js', 'js/board.js',
  'js/characters.js', 'js/codex-data.js', 'js/codex.js', 'js/character-ui.js', 'js/campaign.js',
];
const DOM_SHIM = {
  document: {
    documentElement: {},
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }),
    addEventListener() {},
  },
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  window: { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  requestAnimationFrame: () => 0,
  performance: { now: () => 0 },
};
const ctx = vm.createContext({ console, structuredClone, ...DOM_SHIM });
for (const file of GAME_FILES) {
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file }); }
  catch (e) { throw new Error(`${file} 로드 실패: ${e.message}`); }
}
/* const·let은 vm 컨텍스트의 전역 프로퍼티가 아니라 렉시컬 바인딩이라 ctx.X로 못 읽는다.
   같은 컨텍스트에서 식을 한 번 더 평가해야 꺼낼 수 있다. */
const read = expr => vm.runInContext(expr, ctx);
const CONFIG = read('CONFIG');
const campaignStage = read('campaignStage');
const buildStageWaves = read('buildStageWaves');
const MilestoneSystem = read('MilestoneSystem');
const MILESTONE_TABLE = read('MILESTONE_TABLE');
const CampaignEconomy = read('CampaignEconomy');
const stageTotalGold = stage => CampaignEconomy.stageTotalGold(stage);

/* --- 마일스톤 -----------------------------------------------------------
   n번째 단계의 간격 = target × targetMul^n, 보상 = reward × rewardMul^n (등비).
   누적 지표 value가 간격 합계를 넘길 때마다 한 단계씩 수령된다 — MilestoneSystem.status와
   같은 누적 방식이되, 저장 상태 대신 값 하나만 받는다. */
const milestoneRow = id => MILESTONE_TABLE.find(row => row.id === id);
function milestoneYield(id, value) {
  const row = milestoneRow(id);
  let tiers = 0, total = 0, edge = 0;
  while (tiers < 10000) {
    const step = MilestoneSystem.interval(row, tiers);
    if (value < edge + step) break;
    edge += step;
    total += MilestoneSystem.reward(row, tiers);
    tiers++;
  }
  return { tiers, total, currencyId: row.currencyId };
}
/* 단계 B(세션 2)가 정해야 값이 나오는 줄. 원장에서는 0으로 두고 목록만 남긴다. */
const GROWTH_DRIVEN = ['module_levels', 'skill_levels', 'stars', 'guardians', 'owned_skills'];
/* 전투당 횟수가 입력인 줄. PLAY_INPUT이 0이면 기여도 0이다. */
const PLAY_DRIVEN = { skills_used: 'skillsUsed', orders: 'orders', merges: 'merges' };

/* --- 스테이지 원장 ------------------------------------------------------ */
function bossCount(stage) {
  return buildStageWaves(stage.waves, CONFIG.stage, stage.id).filter(w => w.type !== 'normal').length;
}
function buildLedger(stages) {
  const rows = [];
  let cumDirectGold = 0, cumWaves = 0, cumBosses = 0;
  for (let id = 1; id <= stages; id++) {
    const stage = campaignStage(id);
    const directGold = stageTotalGold(stage);
    const bosses = bossCount(stage);
    cumDirectGold += directGold;
    cumWaves += stage.waves;
    cumBosses += bosses;

    /* 최초 도달 기준의 누적 지표 — 스테이지 1..id를 각각 한 번씩 클리어한 상태.
       stagesCleared는 서로 다른 클리어 스테이지 수, bestWave는 한 런에서 도달한 최고 WAVE라
       스테이지의 WAVE 수와 같다(1·2스테이지는 10·20, 3스테이지부터 30으로 고정). */
    const metrics = {
      stage_clear: id,
      best_wave: stage.waves,
      waves: cumWaves,
      bosses: cumBosses,
      skills_used: PLAY_INPUT.skillsUsed * id,
      orders: PLAY_INPUT.orders * id,
      merges: PLAY_INPUT.merges * id,
    };
    const yields = Object.fromEntries(Object.entries(metrics).map(([mid, v]) => [mid, milestoneYield(mid, v)]));
    const sumBy = cur => Object.values(yields).filter(y => y.currencyId === cur).reduce((n, y) => n + y.total, 0);
    const milestoneGold = sumBy('gold');
    const milestoneStarfire = sumBy('starfire');

    /* 반복 보상 — 이 스테이지를 한 번 더 깼을 때. 직접 골드는 그대로 다시 들어오고,
       stagesCleared는 "서로 다른 스테이지 수"라 오르지 않는다. 마일스톤은 waves·bosses와
       플레이 의존 3줄만 밀려, 그 증분만 센다. */
    const repeat = {
      directGold,
      milestoneGold:
        milestoneYield('waves', cumWaves + stage.waves).total - yields.waves.total +
        milestoneYield('bosses', cumBosses + bosses).total - yields.bosses.total +
        Object.entries(PLAY_DRIVEN).reduce((n, [mid, key]) =>
          n + milestoneYield(mid, metrics[mid] + PLAY_INPUT[key]).total - yields[mid].total, 0),
      milestoneStarfire: 0,
    };

    rows.push({
      stage: id,
      waves: stage.waves,
      bosses,
      waveGold: stage.waveGold,
      clearGold: stage.clearGold,
      directGold,
      cumDirectGold,
      milestoneGold,
      cumGold: cumDirectGold + milestoneGold,
      milestoneStarfire,
      cumStarfire: milestoneStarfire,
      repeatGold: repeat.directGold + repeat.milestoneGold,
      repeatStarfire: repeat.milestoneStarfire,
      hpScale: stage.hpScale,
      atkScale: stage.atkScale,
      tiers: Object.fromEntries(Object.entries(yields).map(([mid, y]) => [mid, y.tiers])),
      yields,
    });
  }
  return rows;
}

/* --- 출력 -------------------------------------------------------------- */
const num = n => Number(n).toLocaleString('en-US');
function printTable(rows) {
  const head = ['ST', 'WAVE', '보스', '직접골드', '누적직접', '마일골드', '누적골드', '마일별불', '누적별불', '반복골드', 'hpScale'];
  const body = rows.map(r => [
    r.stage, r.waves, r.bosses, num(r.directGold), num(r.cumDirectGold), num(r.milestoneGold),
    num(r.cumGold), num(r.milestoneStarfire), num(r.cumStarfire), num(r.repeatGold), r.hpScale.toFixed(3),
  ]);
  const width = head.map((h, i) => Math.max(h.length, ...body.map(b => String(b[i]).length)));
  const line = cells => cells.map((c, i) => String(c).padStart(width[i])).join('  ');
  console.log(line(head));
  console.log(width.map(w => '-'.repeat(w)).join('  '));
  body.forEach(b => console.log(line(b)));
}
function toCsv(rows) {
  const cols = ['stage', 'waves', 'bosses', 'waveGold', 'clearGold', 'directGold', 'cumDirectGold',
    'milestoneGold', 'cumGold', 'milestoneStarfire', 'cumStarfire', 'repeatGold', 'repeatStarfire', 'hpScale', 'atkScale'];
  const tierCols = [...Object.keys(PLAY_DRIVEN), 'stage_clear', 'best_wave', 'waves', 'bosses']
    .filter((v, i, a) => a.indexOf(v) === i);
  return [
    [...cols, ...tierCols.map(t => `tier_${t}`)].join(','),
    ...rows.map(r => [...cols.map(c => r[c]), ...tierCols.map(t => r.tiers[t] ?? 0)].join(',')),
  ].join('\n') + '\n';
}

const rows = buildLedger(STAGES);
const meta = {
  generatedFrom: GAME_FILES,
  stages: STAGES,
  basis: '최초 도달 기준 — 스테이지 1..N을 각각 1회 클리어, 패배·반복 없음',
  playInput: PLAY_INPUT,
  excluded: {
    growthDriven: GROWTH_DRIVEN,
    why: '구매 내역이 정해져야 값이 나오는 줄 — 단계 B(세션 2)의 출력이다',
  },
  combatSpec: { attackUpgradeLevel: 6, damageBonus: CONFIG.attackModules.damageBonusByLevel[5], otherFactors: 5, partySize: 4 },
};

printTable(rows);
const last = rows[rows.length - 1];
console.log('');
console.log(`기준: ${meta.basis}`);
console.log(`스테이지 ${STAGES}까지 누적 — 골드 ${num(last.cumGold)} · 별불 ${num(last.cumStarfire)}`);
console.log(`미산입 마일스톤 5줄: ${GROWTH_DRIVEN.join(', ')} (세션 2 의존)`);
console.log(`플레이 의존 입력: 스킬 ${PLAY_INPUT.skillsUsed} · 주문서 ${PLAY_INPUT.orders} · 머지 ${PLAY_INPUT.merges} (전투당)`);

if (WRITE) {
  const out = path.join(ROOT, 'tools', 'out');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'stage-ledger.csv'), toCsv(rows));
  fs.writeFileSync(path.join(out, 'stage-ledger.json'), JSON.stringify({ meta, rows }, null, 2) + '\n');
  console.log(`\n기록: tools/out/stage-ledger.csv · tools/out/stage-ledger.json`);
}
