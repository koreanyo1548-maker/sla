/* 개발 진입점 생성 — dev.html 과 js/assets-dev.js 를 만든다.
   [2026-09-18 세션 2]

   왜 생성하는가: 진입점이 두 개면 <body> 마크업이 두 벌이 되고 한쪽만 고치는
   사고가 난다. 마크업의 원본은 index.html 하나로 두고, dev.html은 거기서
   기계적으로 만든다. 빌드 도구가 아니라 개발 편의 스크립트다 — 생성물은
   저장소에 커밋되므로 게임을 열 때 node가 필요하지 않다.

   index.html 에서 달라지는 것은 네 군데다:
     1. <title>에 표시를 붙인다
     2. window.SLAGMA_DEV = true  (platform.js 보다 먼저 실행돼야 한다)
     3. js/assets-dev.js  — fighters 3장을 인라인 data URL로 덮어쓴다
     4. js/dev.js         — 개발 전용 UI

   js/assets-dev.js 가 필요한 이유: fighters_01~03 은 prepareFighterAtlas가
   getImageData로 색키를 지우는 대상이고, file:// 로 열면 파일에서 온 이미지가
   캔버스를 오염시켜 픽셀을 읽을 수 없다. 원본은 assets/*.webp 하나이고 이
   파일은 거기서 생성된다 — 같은 이미지의 사본을 손으로 관리하지 않는다.

   실행:  node tools/build-dev.mjs
   검사:  node tools/build-dev.mjs --check   (생성물이 최신인지만 확인, 쓰지 않음)
          tools/smoke.mjs 가 이 검사를 먼저 돌린다.
*/
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CHECK = process.argv.includes('--check');
const INLINE_ASSETS = ['fighters_01', 'fighters_02', 'fighters_03'];

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* ---------- js/assets-dev.js ---------- */
function buildAssetsDev() {
  const entries = INLINE_ASSETS.map(key => {
    const buf = fs.readFileSync(path.join(ROOT, 'assets', `${key}.webp`));
    return `  "${key}":"data:image/webp;base64,${buf.toString('base64')}",`;
  });
  return `/* ===== assets-dev.js ===== */
/* 생성 파일 — 직접 고치지 말 것. 원본은 assets/*.webp 이고
   \`node tools/build-dev.mjs\` 가 이 파일을 만든다.

   개발 진입점(dev.html)만 로드한다. fighters 아틀라스를 인라인 data URL로
   덮어써서 file:// 더블클릭으로 열어도 GameArt.prepareFighterAtlas가
   getImageData로 색키를 지울 수 있게 한다(파일에서 온 이미지는 캔버스를
   오염시켜 픽셀을 읽을 수 없다). 출시 진입점은 assets/*.webp 를 그대로 쓴다. */
Object.assign(ASSET_URLS,{
${entries.join('\n')}
});
`;
}

/* ---------- dev.html ---------- */
function buildDevHtml() {
  let html = read('index.html');
  const sub = (pattern, replacement) => {
    const before = html;
    html = html.replace(pattern, replacement);
    if (html === before) throw new Error(`index.html 에서 찾지 못했다: ${pattern}`);
  };

  sub('<title>슬래그마 · 용광로의 수호자</title>',
      '<title>슬래그마 · 용광로의 수호자 (개발)</title>');

  // platform.js 가 파싱될 때 이미 세워져 있어야 한다.
  sub('\n<link rel="stylesheet" href="css/base.css">',
      '\n<!-- 생성 파일 — 고치지 말 것. index.html 을 고친 뒤 node tools/build-dev.mjs 를 다시 돌린다. -->\n'
      + '<script>window.SLAGMA_DEV = true;</script>\n'
      + '<link rel="stylesheet" href="css/base.css">');

  sub('<script src="js/assets.js"></script>',
      '<script src="js/assets.js"></script>\n<script src="js/assets-dev.js"></script>');

  sub('<script src="js/campaign.js"></script>',
      '<script src="js/campaign.js"></script>\n<script src="js/dev.js"></script>');

  return html;
}

/* ---------- write / check ---------- */
const outputs = [
  ['js/assets-dev.js', buildAssetsDev()],
  ['dev.html', buildDevHtml()],
];

let stale = 0;
for (const [rel, content] of outputs) {
  const abs = path.join(ROOT, rel);
  const current = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  const same = current === content;
  if (CHECK) {
    console.log(`${same ? 'OK   ' : 'STALE'} ${rel}`);
    if (!same) stale++;
    continue;
  }
  if (same) { console.log(`unchanged ${rel}`); continue; }
  fs.writeFileSync(abs, content);
  console.log(`wrote     ${rel}  (${(content.length / 1024).toFixed(1)} KB)`);
}

if (CHECK && stale) {
  console.error(`\n생성물 ${stale}개가 낡았다. node tools/build-dev.mjs 를 돌려라.`);
  process.exit(1);
}
