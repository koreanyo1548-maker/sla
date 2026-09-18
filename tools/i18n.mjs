/* 언어 파일 도구 — 새 언어 만들기 · 빠진 키 채우기 · CSV 내보내기/읽어오기
   [2026-09-18 세션 3]

   목적: 번역을 늘리는 일에 개발자가 끼어들지 않아도 되게 한다. 기준 언어(ko)의
   키 목록이 늘거나 줄면 이 도구가 나머지 언어 파일을 맞춰 주고, 실제 번역은
   CSV로 빼서 채운 뒤 다시 읽어들인다. 사용법은 i18n/README.md에 있다.

   명령:
     node tools/i18n.mjs check              모든 언어 검사 (기본)
     node tools/i18n.mjs list               등록된 언어 목록
     node tools/i18n.mjs new <코드> <이름>   새 언어 파일 + index.html 등록
     node tools/i18n.mjs sync [코드...]      빠진 키 추가 · 남은 키 제거 · 순서 정렬
     node tools/i18n.mjs export [코드...]    i18n/csv/<코드>.csv 로 내보내기
     node tools/i18n.mjs import <코드>       i18n/csv/<코드>.csv 를 읽어 언어 파일 갱신

   언어 파일을 읽는 방법: 파일이 JS이므로 JS로 실행한다(new Function). 주석·따옴표·
   줄바꿈을 직접 파싱하지 않으므로 사람이 손으로 고친 파일도 그대로 읽힌다.
*/
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = path.join(ROOT, 'i18n');
const CSV_DIR = path.join(DIR, 'csv');
// 키 목록의 기준이 되는 언어. [세션 6] 영어가 기준이 되면 'en'으로 바꾼다.
const SOURCE = 'ko';
// index.html 안에서 언어 <script> 줄을 이 도구가 관리하는 구간.
const MARK_OPEN = '<!-- i18n:languages -->';
const MARK_CLOSE = '<!-- /i18n:languages -->';

/* ---------- 언어 파일 읽기/쓰기 ---------- */
function filePath(code){ return path.join(DIR, `${code}.js`); }

function readLanguage(code){
  const abs = filePath(code);
  if(!fs.existsSync(abs)) return null;
  const src = fs.readFileSync(abs, 'utf8');
  let captured = null;
  const registry = { register(c, label, table){ captured = {code:c, label, table}; } };
  try{ new Function('I18N', src)(registry); }
  catch(e){ throw new Error(`i18n/${code}.js 를 읽지 못했다: ${e.message}`); }
  if(!captured) throw new Error(`i18n/${code}.js 가 I18N.register(...) 를 부르지 않는다.`);
  if(captured.code !== code) throw new Error(`i18n/${code}.js 가 '${captured.code}' 로 등록한다 — 파일 이름과 코드가 달라야 할 이유는 없다.`);
  return captured;
}

function listLanguages(){
  if(!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter(f=>f.endsWith('.js')).map(f=>f.slice(0,-3)).sort();
}

const jsonString = value => JSON.stringify(String(value));

/* 언어 파일을 표준 모양으로 쓴다. 키의 첫 마디마다 구분 주석을 넣고, 기준 언어가
   아니면 각 줄 위에 원문을 주석으로 붙인다 — 번역할 때 원문을 찾아다니지 않게. */
function writeLanguage(code, label, table, source){
  const keys = Object.keys(source ? source.table : table);
  const lines = [];
  let group = null;
  for(const key of keys){
    const head = key.split('.')[0];
    if(head !== group){ lines.push(`${group===null?'':'\n'}  /* ── ${head} ── */`); group = head; }
    if(source){
      const origin = source.table[key];
      if(origin !== undefined) lines.push(`  // ${String(origin).replace(/\n/g,'\\n')}`);
    }
    lines.push(`  ${jsonString(key)}: ${jsonString(table[key] ?? '')},`);
  }
  const header = source
    ? `/* ===== i18n/${code}.js — ${label} =====\n`
      + `   번역 파일. 각 줄 위 주석이 ${SOURCE} 원문이다.\n`
      + `   값만 채우면 된다. 키(따옴표 왼쪽)와 {중괄호} 자리표시자는 그대로 둔다.\n`
      + `   빈 값은 ${SOURCE} 로 대신 나온다 — 번역이 끝날 때까지 화면이 비지 않는다.\n`
      + `   키가 늘거나 줄면  node tools/i18n.mjs sync ${code}  로 맞춘다. */\n`
    : `/* ===== i18n/${code}.js — ${label} (기준 언어) ===== */\n`;
  fs.writeFileSync(filePath(code), `${header}I18N.register(${jsonString(code)}, ${jsonString(label)}, {\n${lines.join('\n')}\n});\n`);
}

/* ---------- index.html 의 <script> 줄 ---------- */
// 기준 언어를 맨 앞에 두고 나머지는 알파벳순. 언어 선택 목록 순서가 이 순서다.
function orderedCodes(){
  const all = listLanguages();
  return [...all.filter(c=>c===SOURCE), ...all.filter(c=>c!==SOURCE)];
}

function syncHtml(codes){
  const abs = path.join(ROOT, 'index.html');
  const html = fs.readFileSync(abs, 'utf8');
  const open = html.indexOf(MARK_OPEN), close = html.indexOf(MARK_CLOSE);
  if(open < 0 || close < 0) throw new Error(`index.html 에서 ${MARK_OPEN} 구간을 찾지 못했다.`);
  const block = [MARK_OPEN, ...codes.map(c=>`<script src="i18n/${c}.js"></script>`), MARK_CLOSE].join('\n');
  const next = html.slice(0, open) + block + html.slice(close + MARK_CLOSE.length);
  if(next === html) return false;
  fs.writeFileSync(abs, next);
  return true;
}

// dev.html 은 index.html 의 생성물이라 함께 다시 만든다.
function buildDev(){
  try{ execFileSync(process.execPath, [path.join(ROOT,'tools','build-dev.mjs')], {stdio:'inherit'}); }
  catch(_){ console.error('dev.html 생성에 실패했다. node tools/build-dev.mjs 를 직접 돌려라.'); }
}

/* ---------- CSV ---------- */
// 셀 안의 줄바꿈은 \n 으로 적는다 — 스프레드시트를 오갈 때 줄이 깨지지 않게.
const csvEncode = v => String(v ?? '').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n');
const csvDecode = v => String(v ?? '').replace(/\\(.)/g, (whole,ch)=> ch==='n' ? '\n' : ch);
// 앞뒤 공백이 있는 값도 감싼다. "CRIT " 처럼 공백이 의미를 갖는 값이 있고,
// 감싸지 않으면 엑셀·구글 시트가 열 때 다듬어 버린다.
const csvCell = v => /[",\n]/.test(v) || /^\s|\s$/.test(v) ? `"${v.replace(/"/g,'""')}"` : v;

function csvParse(text){
  const rows = [];
  let row = [], cell = '', quoted = false;
  for(let i=0;i<text.length;i++){
    const ch = text[i];
    if(quoted){
      if(ch !== '"'){ cell += ch; continue; }
      if(text[i+1] === '"'){ cell += '"'; i++; continue; }
      quoted = false; continue;
    }
    if(ch === '"'){ quoted = true; continue; }
    if(ch === ','){ row.push(cell); cell = ''; continue; }
    if(ch === '\r') continue;
    if(ch === '\n'){ row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += ch;
  }
  if(cell !== '' || row.length){ row.push(cell); rows.push(row); }
  return rows;
}

/* ---------- 검사 ---------- */
const placeholders = s => (String(s).match(/\{\w+\}/g) || []).sort().join(',');
const htmlTags = s => (String(s).match(/<\/?\w+>/g) || []).sort().join(',');

// 앞뒤 공백이 의미를 갖는 값("CRIT " 등)이 번역에서 공백을 잃었는지 본다.
const edgeSpace = text => `${/^\s/.test(text)?'앞':''}${/\s$/.test(text)?'뒤':''}`;

function checkLanguage(source, target){
  const problems = [];
  const sourceKeys = Object.keys(source.table);
  const targetKeys = Object.keys(target.table);
  const missing = sourceKeys.filter(k=>!(k in target.table));
  const orphan = targetKeys.filter(k=>!(k in source.table));
  const empty = sourceKeys.filter(k=>k in target.table && String(target.table[k]).trim()==='');
  missing.forEach(k=>problems.push(['빠진 키', k, '']));
  orphan.forEach(k=>problems.push(['없어진 키', k, '기준 언어에 없다 — sync 하면 지워진다']));
  empty.forEach(k=>problems.push(['번역 안 됨', k, source.table[k]]));
  sourceKeys.forEach(k=>{
    const value = target.table[k];
    if(value===undefined || String(value).trim()==='') return;
    if(placeholders(source.table[k]) !== placeholders(value))
      problems.push(['자리표시자 불일치', k, `${placeholders(source.table[k])||'없음'} ↔ ${placeholders(value)||'없음'}`]);
    if(htmlTags(source.table[k]) !== htmlTags(value))
      problems.push(['태그 불일치', k, `${htmlTags(source.table[k])||'없음'} ↔ ${htmlTags(value)||'없음'}`]);
    if(edgeSpace(source.table[k]) !== edgeSpace(value))
      problems.push(['앞뒤 공백 불일치', k, `원문 ${edgeSpace(source.table[k])||'없음'} ↔ 번역 ${edgeSpace(value)||'없음'}`]);
  });
  return problems;
}

/* 코드가 부르는 키와 언어 파일을 맞춰 본다.

   t('키') 리터럴만 찾으면 t(clear?'a':'b') · t(labelKey) · 배열에 키를 담아
   도는 형태가 전부 빠져나간다(295키 중 39개가 그랬다). 그래서 소스 안의
   "점이 들어간 문자열 리터럴"을 전부 후보로 모은 뒤, 기준 언어에 있는
   접두어(battle. order. lobby. …)로 시작하는 것만 키로 본다.
   'slagma.lang' 같은 저장 키는 접두어가 달라 자동으로 걸러진다. */
function collectKeyLiterals(){
  const literals = new Set();
  const files = fs.readdirSync(path.join(ROOT,'js'))
    // i18n.js 는 t() 자체를 정의하는 파일이라 주석의 예시(t('key'))가 키로 잡힌다.
    .filter(name=>name.endsWith('.js') && name!=='i18n.js')
    .map(name=>path.join(ROOT,'js',name));
  files.push(path.join(ROOT,'index.html'));
  for(const abs of files){
    const src = fs.readFileSync(abs, 'utf8');
    for(const m of src.matchAll(/['"`]([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+)['"`]/g)) literals.add(m[1]);
    for(const m of src.matchAll(/data-i18n(?:-html|-aria|-title)?="([\w.]+)"/g)) literals.add(m[1]);
  }
  return literals;
}

function checkCodeKeys(source){
  const prefixes = new Set(Object.keys(source.table).map(key=>key.split('.')[0]));
  const literals = collectKeyLiterals();
  const referenced = [...literals].filter(key=>prefixes.has(key.split('.')[0]));
  return {
    missing: referenced.filter(key=>!(key in source.table)).sort(),
    unused: Object.keys(source.table).filter(key=>!literals.has(key)).sort(),
  };
}

/* ---------- 명령 ---------- */
const [command = 'check', ...args] = process.argv.slice(2);

function loadSource(){
  const source = readLanguage(SOURCE);
  if(!source) throw new Error(`기준 언어 파일 i18n/${SOURCE}.js 이 없다.`);
  return source;
}

function targetCodes(given){
  const all = listLanguages().filter(c=>c!==SOURCE);
  if(!given.length) return all;
  given.forEach(c=>{ if(!all.includes(c)) throw new Error(`언어 '${c}' 의 파일이 없다. node tools/i18n.mjs new ${c} <이름> 으로 먼저 만들어라.`); });
  return given;
}

if(command === 'list'){
  const source = loadSource();
  for(const code of listLanguages()){
    const lang = readLanguage(code);
    const keys = Object.keys(source.table).length;
    const done = code===SOURCE ? keys : Object.keys(source.table).filter(k=>String(lang.table[k]??'').trim()!=='').length;
    console.log(`${code.padEnd(6)} ${String(lang.label).padEnd(12)} ${done} / ${keys}${code===SOURCE?'  (기준 언어)':''}`);
  }
}

else if(command === 'new'){
  const [code, ...rest] = args;
  const label = rest.join(' ');
  if(!code || !label){ console.error('사용법: node tools/i18n.mjs new <코드> <그 언어로 쓴 이름>   예) node tools/i18n.mjs new ja 日本語'); process.exit(1); }
  if(!/^[a-z]{2}$/.test(code)){ console.error('코드는 두 글자 소문자다(en·ja·zh 처럼).'); process.exit(1); }
  if(fs.existsSync(filePath(code))){ console.error(`i18n/${code}.js 가 이미 있다.`); process.exit(1); }
  const source = loadSource();
  writeLanguage(code, label, {}, source);
  syncHtml(orderedCodes());
  buildDev();
  console.log(`i18n/${code}.js 를 만들고 index.html 에 등록했다. 키 ${Object.keys(source.table).length}개가 비어 있다.`);
  console.log(`다음: node tools/i18n.mjs export ${code}  →  i18n/csv/${code}.csv 를 채운다  →  node tools/i18n.mjs import ${code}`);
}

else if(command === 'sync'){
  const source = loadSource();
  for(const code of targetCodes(args)){
    const lang = readLanguage(code);
    const before = Object.keys(lang.table).length;
    writeLanguage(code, lang.label, lang.table, source);
    const after = Object.keys(readLanguage(code).table).length;
    console.log(`${code}: 키 ${before} → ${after}`);
  }
  if(syncHtml(orderedCodes())){ console.log('index.html 의 언어 목록을 갱신했다.'); buildDev(); }
}

else if(command === 'export'){
  const source = loadSource();
  fs.mkdirSync(CSV_DIR, {recursive:true});
  for(const code of targetCodes(args)){
    const lang = readLanguage(code);
    const rows = [[ 'key', SOURCE, code ]];
    for(const key of Object.keys(source.table)) rows.push([key, csvEncode(source.table[key]), csvEncode(lang.table[key] ?? '')]);
    // 앞의 BOM 은 엑셀이 UTF-8 로 열게 한다 — 없으면 한글이 깨져 보인다.
    fs.writeFileSync(path.join(CSV_DIR, `${code}.csv`), '﻿' + rows.map(r=>r.map(csvCell).join(',')).join('\r\n') + '\r\n');
    console.log(`i18n/csv/${code}.csv  (${rows.length-1}줄)`);
  }
}

else if(command === 'import'){
  const [code] = args;
  if(!code){ console.error('사용법: node tools/i18n.mjs import <코드>'); process.exit(1); }
  const source = loadSource();
  const lang = readLanguage(code);
  if(!lang){ console.error(`i18n/${code}.js 가 없다.`); process.exit(1); }
  const csvPath = path.join(CSV_DIR, `${code}.csv`);
  if(!fs.existsSync(csvPath)){ console.error(`${csvPath} 가 없다. 먼저 export 로 내보내라.`); process.exit(1); }
  const rows = csvParse(fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, ''));
  const header = rows.shift() || [];
  const column = header.indexOf(code);
  if(column < 0){ console.error(`CSV 머리줄에 '${code}' 칸이 없다. 머리줄(key,${SOURCE},${code})은 지우지 말 것.`); process.exit(1); }
  const table = {};
  let filled = 0, unknown = 0;
  for(const row of rows){
    const key = (row[0] || '').trim();
    if(!key) continue;
    if(!(key in source.table)){ unknown++; continue; }
    const value = csvDecode(row[column]);
    table[key] = value;
    if(value.trim() !== '') filled++;
  }
  // CSV 에 없던 키는 기존 번역을 잃지 않게 그대로 둔다.
  for(const key of Object.keys(lang.table)) if(!(key in table)) table[key] = lang.table[key];
  writeLanguage(code, lang.label, table, source);
  console.log(`i18n/${code}.js 갱신 — 채워진 키 ${filled} / ${Object.keys(source.table).length}${unknown?`, 기준에 없는 키 ${unknown}줄 건너뜀`:''}`);
}

else if(command === 'check'){
  const source = loadSource();
  let bad = 0;
  const {missing, unused} = checkCodeKeys(source);
  if(missing.length){
    bad++;
    console.log(`코드가 부르지만 i18n/${SOURCE}.js 에 없는 키 ${missing.length}개:`);
    missing.forEach(k=>console.log(`  ${k}`));
    console.log('');
  }
  // 쓰지 않는 키는 번역 부담만 늘린다. 오타로 이름이 어긋났을 때도 여기 뜬다.
  // 검사를 실패로 만들지는 않는다 — 앞으로 쓸 자리를 미리 넣어 둘 수도 있다.
  if(unused.length){
    console.log(`어디서도 쓰지 않는 키 ${unused.length}개:`);
    unused.forEach(k=>console.log(`  ${k}`));
    console.log('');
  }
  for(const code of listLanguages()){
    if(code===SOURCE) continue;
    const problems = checkLanguage(source, readLanguage(code));
    if(!problems.length){ console.log(`${code}: 문제 없음`); continue; }
    bad++;
    const counts = {};
    problems.forEach(([kind])=>{ counts[kind] = (counts[kind]||0)+1; });
    console.log(`${code}: ${Object.entries(counts).map(([k,n])=>`${k} ${n}`).join(' · ')}`);
    problems.slice(0,40).forEach(([kind,key,detail])=>console.log(`  [${kind}] ${key}${detail?`  ${detail}`:''}`));
    if(problems.length>40) console.log(`  … 그 밖에 ${problems.length-40}건`);
  }
  if(!listLanguages().some(c=>c!==SOURCE)) console.log(`기준 언어 ${SOURCE} 하나뿐이다. 키 ${Object.keys(source.table).length}개.`);
  process.exit(bad ? 1 : 0);
}

else {
  console.error(`알 수 없는 명령: ${command}`);
  console.error('check · list · new · sync · export · import');
  process.exit(1);
}
