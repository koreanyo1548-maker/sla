/* 개발 진입점 생성 — dev.html 을 만든다.
   [2026-09-18 세션 2 · 2026-09-18 갱신]

   왜 생성하는가: 진입점이 두 개면 <body> 마크업이 두 벌이 되고 한쪽만 고치는
   사고가 난다. 마크업의 원본은 index.html 하나로 두고, dev.html은 거기서
   기계적으로 만든다. 빌드 도구가 아니라 개발 편의 스크립트다 — 생성물은
   저장소에 커밋되므로 게임을 열 때 node가 필요하지 않다.

   index.html 에서 달라지는 것은 세 군데다:
     1. <title>에 표시를 붙인다
     2. window.SLAGMA_DEV = true  (platform.js 보다 먼저 실행돼야 한다)
     3. js/dev.js  — 개발 전용 UI

   [2026-09-18] js/assets-dev.js 를 없앴다. fighters 아틀라스가 알파를 갖게 되면서
   런타임 색키(prepareFighterAtlas)가 사라졌고, 그러면 getImageData가 필요 없으니
   file:// 에서도 파일을 그대로 쓸 수 있다. 인라인 오버라이드의 존재 이유가
   없어졌고 1.35MB도 함께 사라졌다. (그 파일이 assets/*.webp 교체 뒤 재생성되지
   않아 dev.html만 옛 초록 배경을 쓰던 사고가 있었다 — 이제 구조적으로 불가능하다.)

   실행:  node tools/build-dev.mjs
   검사:  node tools/build-dev.mjs --check   (생성물이 최신인지만 확인, 쓰지 않음)
          tools/smoke.mjs 가 이 검사를 먼저 돌린다.
*/
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CHECK = process.argv.includes('--check');

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

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

  sub('<script src="js/campaign.js"></script>',
      '<script src="js/campaign.js"></script>\n<script src="js/dev.js"></script>');

  return html;
}

/* ---------- write / check ---------- */
const outputs = [
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
