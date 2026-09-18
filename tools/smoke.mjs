/* 스모크 검사 — 한 판을 끝까지 돌려 콘솔 에러·페이지 에러·4xx가 없는지 본다.
   [2026-09-18 세션 2]

   이후 세션의 회귀를 잡는 자동 검사다. 게임 자체에는 npm 의존성이 없다 —
   Playwright는 이 스크립트만 쓴다.

   실행:
     node tools/smoke.mjs                 index.html, 세로·가로 두 뷰포트
     node tools/smoke.mjs --headed        브라우저를 띄워서 본다

   Playwright가 없으면 `npx playwright install chromium` 한 번.
   CLAUDE 환경에서는 /opt/pw-browsers 에 이미 있다.

   [2026-09-18] 개발 진입점(dev.html)을 없애면서 --entry 선택지와 생성물 최신 여부
   검사를 걷어냈다. 진입점은 index.html 하나뿐이다.
*/
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/* Playwright 찾기 — 저장소에 설치했으면(npm install) 그걸 쓰고, 없으면 전역
   설치를 본다. ESM은 NODE_PATH를 보지 않으므로 전역 경로는 직접 만든다. */
async function loadChromium() {
  const specs = ['playwright', 'playwright-core'];
  const root = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout?.trim();
  if (root) for (const pkg of ['playwright', 'playwright-core'])
    specs.push(pathToFileURL(path.join(root, pkg, 'index.mjs')).href);
  for (const spec of specs) {
    try { return (await import(spec)).chromium; } catch { /* 다음 후보 */ }
  }
  throw new Error('Playwright를 찾지 못했다. `npm install` (저장소) 또는 `npm i -g playwright` 후 다시 돌려라.');
}

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const HEADED = args.includes('--headed');
const ENTRIES = ['index.html'];

const VIEWPORTS = [
  { name: '세로', width: 430, height: 900 },
  { name: '가로', width: 1280, height: 720 },
  // [2026-09-18 세션 4] 폰 가로. 이 조합에서는 회전 안내가 떠 있는 것이 정상이므로
  // 플레이스루 대신 안내가 보이는지만 본다(rotateOnly).
  // touch가 있어야 pointer:coarse가 맞는다 — 기본 컨텍스트는 pointer:fine이라 안내가
  // 뜨지 않는다. isMobile은 쓰지 않는다: meta viewport가 적용돼 크기가 900×430이
  // 아니라 980×469로 바뀐다(실측).
  { name: '폰 가로', width: 900, height: 430, touch: true, rotateOnly: true },
];

/* ---------------------------------------------------------------- 정적 서버
   file:// 로도 게임은 돌지만, 검사는 http로 돈다 — 출시 환경이 https이고
   4xx를 보려면 응답 코드가 필요하다. file:// 는 응답 코드가 없다. */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp' };
function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const abs = path.join(ROOT, rel);
    if (!abs.startsWith(ROOT) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(abs)] || 'application/octet-stream' });
    fs.createReadStream(abs).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/* ------------------------------------------------------------------- 한 바퀴 */
async function playthrough(browser, entry, viewport) {
  const label = `${entry} · ${viewport.name} ${viewport.width}×${viewport.height}`;
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    hasTouch: !!viewport.touch,
  });
  const problems = [];
  const events = [];
  const notes = [];   // 실패는 아니지만 기록해 둘 것

  page.on('dialog', d => d.accept());                       // 중도 종료 confirm
  page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', r => problems.push(`requestfailed: ${r.url()} — ${r.failure()?.errorText}`));
  page.on('response', r => { if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`); });
  page.on('console', m => {
    const text = m.text();
    if (m.type() === 'error') problems.push(`console.error: ${text}`);
    if (m.type() === 'warning') problems.push(`console.warn: ${text}`);
    if (text.startsWith('[analytics]')) events.push(text.replace('[analytics] ', ''));
  });

  const step = async (what, fn) => {
    try { await fn(); }
    catch (e) { problems.push(`"${what}" 실패: ${e.message.split('\n')[0]}`); throw e; }
  };
  const screen = () => page.evaluate(
    () => [...document.querySelectorAll('[id^=screen-]')].find(e => e.classList.contains('active'))?.id || 'none');
  const clickIfVisible = async sel => {
    const el = page.locator(sel);
    if (await el.isVisible().catch(() => false)) { await el.click(); return true; }
    return false;
  };
  // 정상 종료·중단·회전 안내 세 경로가 같은 꼬리(이벤트·note·problem 출력, 페이지 닫기)를 쓴다.
  const report = async headline => {
    console.log(headline);
    if (events.length) console.log(`        분석 이벤트 ${events.length}건: ${events.slice(0, 6).join(' / ')}${events.length > 6 ? ' …' : ''}`);
    for (const n of notes) console.log(`        note: ${n}`);
    for (const p of problems) console.log(`        ${p}`);
    await page.close();
    return problems.length;
  };

  try {
    await step('로드', async () => {
      await page.goto(`${BASE}/${entry}`, { waitUntil: 'load' });
      await page.waitForFunction(() => typeof GameArt !== 'undefined' && typeof Campaign !== 'undefined', { timeout: 15000 });
    });

    await step('자산 9장 로드', () => page.waitForFunction(
      () => Object.keys(ASSET_URLS).every(k => (GameArt.images[k]?.naturalWidth || 0) > 0), { timeout: 20000 }));

    // [2026-09-18 세션 4] 폰 가로는 회전 안내가 화면을 덮는 것이 정상 동작이다.
    // 플레이스루를 돌리지 않고 안내가 실제로 보이는지만 확인한다.
    if (viewport.rotateOnly) {
      await step('회전 안내 표시', async () => {
        const notice = page.locator('#rotate-notice');
        if (!await notice.isVisible()) throw new Error('#rotate-notice 가 보이지 않는다');
      });
      return report(`  ${problems.length ? 'FAIL' : 'PASS'}  ${label}   회전 안내 표시됨`);
    }

    await step('튜토리얼 건너뛰기', async () => { await clickIfVisible('#tutorial-skip'); await page.waitForTimeout(300); });

    await step('출전 준비', async () => {
      await page.locator('#prepare-btn').click();
      await page.waitForFunction(() => document.getElementById('screen-start')?.classList.contains('active'), { timeout: 5000 });
    });

    await step('전투 시작', async () => {
      await page.locator('#start-btn').click();
      await page.waitForFunction(() => document.getElementById('screen-game')?.classList.contains('active'), { timeout: 5000 });
    });

    // WAVE 를 실제로 넘긴다 — 생성기를 눌러 피스를 만들고 주문서를 돌린다.
    await step('WAVE 진행', async () => {
      await clickIfVisible('#tutorial-skip');
      for (let i = 0; i < 26; i++) {
        const gen = page.locator('#generator-btn');
        if (await gen.isEnabled().catch(() => false)) await gen.click({ timeout: 900 }).catch(() => {});
        await page.waitForTimeout(750);
        if (await page.evaluate(() => document.getElementById('screen-result')?.classList.contains('active'))) break;
      }
    });

    const wave = await page.evaluate(() => document.getElementById('wave-label')?.textContent?.trim() || '?');

    await step('중도 종료 → 결과', async () => {
      if (!await page.evaluate(() => document.getElementById('screen-result')?.classList.contains('active'))) {
        // 정상 경로는 ⚙ 메뉴다. 아래 else는 안전망으로 남긴다 — 넓은 화면에서 ⚙가
        // display:none이라 메뉴가 통째로 막혀 있던 버그를 이 검사가 잡았고
        // (기획서 v0918_3), 고친 뒤로는 네 조합 모두 UI 경로를 탄다. 다시 막히면
        // note가 찍히므로 조용히 지나가지 않는다.
        if (await page.locator('#tools-toggle').isVisible().catch(() => false)) {
          await page.locator('#tools-toggle').click();
          await page.waitForTimeout(250);
          await page.locator('#quit-run').click();
        } else {
          notes.push('⚙ 도구 메뉴가 이 폭에서 보이지 않아 RunHost.defeat()로 종료했다 — 회귀 의심');
          await page.evaluate(() => RunHost.defeat());
        }
      }
      await page.waitForFunction(() => document.getElementById('screen-result')?.classList.contains('active'), { timeout: 8000 });
    });

    await step('로비 복귀', async () => {
      await page.locator('#retry-btn').click();
      await page.waitForFunction(() => document.getElementById('screen-lobby')?.classList.contains('active'), { timeout: 5000 });
    });

    const save = await page.evaluate(() => { try { return !!localStorage.getItem('slagma.campaign.v4'); } catch { return false; } });
    if (!save) problems.push('저장 데이터(slagma.campaign.v4)가 쓰이지 않았다');

    return report(`  ${problems.length ? 'FAIL' : 'PASS'}  ${label}   ${wave} · 화면 ${await screen()}`);
  } catch {
    return report(`  FAIL  ${label}   (진행 중단)`);
  }
}

/* ------------------------------------------------------------------- 실행 */
const server = await serve();
const BASE = `http://127.0.0.1:${server.address().port}`;
const chromium = await loadChromium();
const browser = await chromium.launch({ headless: !HEADED });

let failed = 0;
for (const entry of ENTRIES) {
  console.log(`\n${entry}`);
  for (const viewport of VIEWPORTS) failed += await playthrough(browser, entry, viewport) ? 1 : 0;
}

await browser.close();
server.close();
console.log(failed ? `\nFAIL  ${failed}개 조합에서 문제가 나왔다.` : '\nPASS  모든 조합 통과.');
process.exit(failed ? 1 : 0);
