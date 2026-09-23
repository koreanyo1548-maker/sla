/* ===== tools/build.mjs ===== */
/* =====================================================================
   [출시 빌드] CrazyGames 업로드용 zip을 만든다

     node tools/build.mjs            dist/slagma_<버전>.zip 생성
     node tools/build.mjs --keep     검사만 하고 zip은 만들지 않는다(스테이징만 남김)

   [2026-09-19 세션 7-3] 개발계획서의 "포함/제외 목록"을 사람이 보고 고르던 것을
   이 스크립트로 옮겼다. 계획서가 경고한 그대로다 — 출시 빌드에 개발 전용 파일이
   섞여도 게임은 정상 동작하므로 증상이 없다. 그래서 목록(INCLUDE)만 믿지 않고
   만들어진 zip을 다시 열어 검사한다.

   [경로 규칙] CrazyGames는 zip 루트에 index.html이 있어야 하고 번들 안의 참조는
   상대 경로여야 한다(절대 경로는 로드에 실패한다). 둘 다 아래에서 검사한다.
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const KEEP_ONLY = process.argv.includes('--keep');

/* --- 포함 목록 --------------------------------------------------------
   확장자를 함께 적는 이유: i18n/ 에는 배포 대상인 언어 파일(.js)과 개발 전용인
   README.md·csv/ 가 섞여 있다. 디렉터리를 통째로 담으면 후자가 딸려 들어간다. */
const INCLUDE = [
  { path:'index.html' },
  { path:'css',    ext:['.css'] },
  { path:'js',     ext:['.js'] },
  { path:'i18n',   ext:['.js'] },
  { path:'assets', ext:['.webp'] },
  { path:'fonts',  ext:['.woff2'], recurse:true },
];

/* --- 들어가면 안 되는 것 ----------------------------------------------
   INCLUDE가 화이트리스트라 원칙적으로는 걸릴 일이 없다. 목록을 고치다 실수했을
   때 잡으라고 두는 두 번째 그물이다. */
const DENY = [
  { re:/(^|\/)tools\//,        why:'개발 도구' },
  { re:/(^|\/)node_modules\//, why:'설치본' },
  { re:/(^|\/)csv\//,          why:'번역 작업 파일' },
  { re:/\.md$/i,               why:'문서' },
  { re:/^package(-lock)?\.json$/, why:'개발 매니페스트' },
  { re:/(^|\/)\./,             why:'점 파일' },
  { re:/dev\./i,               why:'개발 진입점' },
  { re:/balance-editor/i,      why:'밸런스 에디터' },
];

const problems = [];
const fail = m => problems.push(m);

/* --- 버전 -------------------------------------------------------------
   <meta name="slagma-build"> 가 기준이다. ByteBrew의 appVersion도 이 값을 읽으므로
   zip 이름 · 대시보드 버전 · 로비 표기가 한 문자열에서 나온다. 로비 푸터는 아직
   손으로 적은 값이라 여기서 두 값이 같은지 본다. */
const indexHtml = fs.readFileSync(path.join(ROOT,'index.html'), 'utf8');
// 개발 중에는 원본 index.html에서만 쓰고, 출시물에서는 UI와 실행 코드를 블록째 뺀다.
const releaseIndexHtml = indexHtml.replace(/<!-- DEV_ONLY_START -->[\s\S]*?<!-- DEV_ONLY_END -->/g, '');
if(releaseIndexHtml.includes('DEV_ONLY_')) fail('출시 index.html에 DEV_ONLY 표시가 남았다.');
if(releaseIndexHtml.includes('reset-data-btn')) fail('출시 index.html에 데이터 초기화 UI가 남았다.');
const version = indexHtml.match(/<meta name="slagma-build" content="([^"]+)">/)?.[1];
if(!version) throw new Error('index.html 에서 <meta name="slagma-build"> 를 찾지 못했다.');
const footnote = indexHtml.match(/<div class="home-footnote">.*?<span>([^<]*)<\/span>\s*<\/div>/s)?.[1];
if(footnote !== version) fail(`로비 푸터 버전이 meta와 다르다: 푸터 '${footnote}' vs meta '${version}'`);

const NAME = `slagma_${version}`;
const STAGE = path.join(DIST, NAME);
const ZIP = path.join(DIST, `${NAME}.zip`);

/* --- 수집 -------------------------------------------------------------- */
function collect(entry){
  const abs = path.join(ROOT, entry.path);
  if(!fs.existsSync(abs)) { fail(`포함 목록의 ${entry.path} 가 없다.`); return []; }
  if(fs.statSync(abs).isFile()) return [entry.path];
  const out = [];
  const walk = dir => {
    for(const name of fs.readdirSync(dir).sort()){
      const full = path.join(dir, name);
      if(fs.statSync(full).isDirectory()){ if(entry.recurse) walk(full); continue; }
      if(entry.ext && !entry.ext.includes(path.extname(name).toLowerCase())) continue;
      out.push(path.relative(ROOT, full).split(path.sep).join('/'));
    }
  };
  walk(abs);
  return out;
}
const files = INCLUDE.flatMap(collect);

for(const rel of files){
  const hit = DENY.find(d => d.re.test(rel));
  if(hit) fail(`${hit.why}가 포함 목록에 걸렸다: ${rel}`);
}

/* --- 참조 검사 ---------------------------------------------------------
   index.html 의 src/href, css 의 url(), assets.js 의 ASSET_URLS 가 가리키는 파일이
   실제로 번들에 들어가는지 본다. 빠져도 증상이 조용한 것들이다 — 폰트가 없으면
   시스템 폰트로 폴백돼 폭만 달라진다(계획서 7-3의 경고). */
const inBundle = new Set(files);
function checkRef(fromRel, raw){
  if(!raw || /^(https?:|data:|#|mailto:)/i.test(raw)) return;
  if(raw.startsWith('/')){ fail(`절대 경로 참조 — CrazyGames에서 로드에 실패한다: ${fromRel} → ${raw}`); return; }
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), raw.split(/[?#]/)[0]));
  if(!inBundle.has(target)) fail(`참조 대상이 번들에 없다: ${fromRel} → ${raw}`);
}
for(const m of releaseIndexHtml.matchAll(/\s(?:src|href)="([^"]*)"/g)) checkRef('index.html', m[1]);
for(const rel of files.filter(f=>f.endsWith('.css'))){
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  for(const m of src.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) checkRef(rel, m[1]);
}
const assetsJs = fs.readFileSync(path.join(ROOT,'js/assets.js'), 'utf8');
for(const m of assetsJs.matchAll(/"([^"]+\.webp)"/g)) checkRef('index.html', m[1]);

if(problems.length){
  console.error('빌드 중단 — 아래를 고쳐야 한다:');
  problems.forEach(p=>console.error(`  ✗ ${p}`));
  process.exit(1);
}

/* --- 스테이징 ---------------------------------------------------------- */
fs.rmSync(STAGE, {recursive:true, force:true});
let bytes = 0;
const sizeByTop = {};
for(const rel of files){
  const src = path.join(ROOT, rel), dst = path.join(STAGE, rel);
  fs.mkdirSync(path.dirname(dst), {recursive:true});
  if(rel==='index.html') fs.writeFileSync(dst, releaseIndexHtml, 'utf8');
  else fs.copyFileSync(src, dst);
  const size = rel==='index.html' ? Buffer.byteLength(releaseIndexHtml) : fs.statSync(src).size;
  bytes += size;
  const top = rel.includes('/') ? rel.split('/')[0] + '/' : rel;
  sizeByTop[top] = (sizeByTop[top]||0) + size;
}

const kb = n => `${(n/1024).toFixed(1)} KB`;
console.log(`슬라그마 출시 빌드 — ${version}`);
console.log('');
for(const [name, size] of Object.entries(sizeByTop).sort((a,b)=>b[1]-a[1])){
  const count = files.filter(f=>f.startsWith(name)).length;
  console.log(`  ${name.padEnd(12)} ${String(count).padStart(4)}개  ${kb(size).padStart(11)}`);
}
console.log(`  ${'합계'.padEnd(11)} ${String(files.length).padStart(4)}개  ${kb(bytes).padStart(11)}`);
console.log('');
// CrazyGames 상한: 파일 1,500개 · 전체 250MB · 초기 다운로드 50MB(모바일 홈 노출은 20MB).
if(files.length >= 1500) fail(`파일 수 상한(1,500)을 넘었다: ${files.length}개`);
if(bytes >= 50*1024*1024) fail(`초기 다운로드 상한(50MB)을 넘었다: ${kb(bytes)}`);

if(KEEP_ONLY){
  console.log(`검사 통과. 스테이징만 남겼다: ${path.relative(ROOT, STAGE)}`);
  process.exit(0);
}

/* --- 압축 -------------------------------------------------------------
   항목 이름을 하나씩 직접 적어 넣는다. CreateFromDirectory와 Compress-Archive는
   Windows PowerShell(5.1)에서 항목 경로에 역슬래시를 쓰는데, ZIP 규격은 '/'만
   허용한다 — 푸는 쪽에 따라 폴더 구조가 통째로 깨진다. 바깥 폴더를 넣지 않으므로
   zip을 열면 index.html이 바로 루트에 있다(CrazyGames 규칙).
   목록은 파일로 넘긴다. 160줄을 명령줄에 붙이면 길이 상한에 걸린다. */
fs.rmSync(ZIP, {force:true});
const ps = script => execFileSync('powershell', ['-NoProfile','-NonInteractive','-Command', script], {encoding:'utf8'});
const listFile = path.join(DIST, `${NAME}.filelist`);
fs.writeFileSync(listFile, files.join('\n'), 'utf8');
ps([
  `Add-Type -AssemblyName System.IO.Compression.FileSystem`,
  `$zip=[System.IO.Compression.ZipFile]::Open('${ZIP}','Create')`,
  // Windows의 .NET은 경로에 '/'를 그대로 받는다 — 구분자를 바꿀 필요가 없다.
  `foreach($rel in [System.IO.File]::ReadAllLines('${listFile}')){`,
  `  $abs=Join-Path '${STAGE}' $rel`,
  `  [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,$abs,$rel,[System.IO.Compression.CompressionLevel]::Optimal)`,
  `}`,
  `$zip.Dispose()`,
].join('; '));
fs.rmSync(listFile, {force:true});

/* --- 만들어진 zip을 다시 열어 검사 ------------------------------------- */
const entries = ps(`Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[System.IO.Compression.ZipFile]::OpenRead('${ZIP}'); $z.Entries | ForEach-Object { $_.FullName }; $z.Dispose()`)
  .split(/\r?\n/).map(s=>s.trim()).filter(Boolean);

if(!entries.includes('index.html')) fail('zip 루트에 index.html이 없다.');
if(entries.some(e=>e.includes('\\'))) fail('zip 항목 경로에 역슬래시가 섞였다 — 압축 방식을 확인할 것.');
if(entries.length !== files.length) fail(`zip 항목 수가 다르다: zip ${entries.length}개 vs 목록 ${files.length}개`);
for(const e of entries){
  const hit = DENY.find(d => d.re.test(e));
  if(hit) fail(`${hit.why}가 zip에 들어갔다: ${e}`);
}

if(problems.length){
  console.error('zip 검사 실패:');
  problems.forEach(p=>console.error(`  ✗ ${p}`));
  process.exit(1);
}

fs.rmSync(STAGE, {recursive:true, force:true});
console.log(`검사 통과 — ${path.relative(ROOT, ZIP)}  (${kb(fs.statSync(ZIP).size)}, ${entries.length}개)`);
