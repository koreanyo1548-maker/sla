/* 자산 추출 — js/assets.js의 base64 항목을 assets/*.webp 파일로 뺀다.
   [2026-09-18 세션 2] fighters_01~03을 파일로 옮길 때 한 번 쓴 스크립트다.
   앞으로 ASSET_URLS에 base64가 다시 들어오는 일이 없다면 다시 쓰지 않는다. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'js/assets.js'), 'utf8');
const re = /"([a-z0-9_]+)":"data:image\/([a-z]+);base64,([^"]+)"/g;
let n = 0;
for (const [, key, ext, b64] of src.matchAll(re)) {
  const buf = Buffer.from(b64, 'base64');
  fs.writeFileSync(path.join(ROOT, 'assets', `${key}.${ext}`), buf);
  console.log(`${key}.${ext}`.padEnd(22), (buf.length / 1024).toFixed(1).padStart(8), 'KB');
  n++;
}
console.log(n ? `\n${n}장 추출` : 'base64 항목이 없다 — 이미 전부 파일이다.');
