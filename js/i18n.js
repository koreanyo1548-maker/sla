/* ===== i18n.js ===== */
/* =====================================================================
   [문자열 테이블] 언어 레지스트리와 t()
   ---------------------------------------------------------------------
   [2026-09-18 세션 3] 사용자에게 보이는 문자열을 코드에서 빼내 언어 파일
   하나로 모은다. 게임 코드는 t('key') 또는 t('key',{n:5})만 부르고, 어떤
   언어가 켜져 있는지는 신경 쓰지 않는다.

   새 언어를 넣는 방법은 i18n/README.md에 있다. 요약하면 파일 하나를 만들고
   (node tools/i18n.mjs new <코드> <이름>) 값을 채우는 것이 전부다 — 이 파일도
   게임 코드도 고치지 않는다.

   [로드 순서] platform.js(SaveStorage·Platform) → i18n.js → i18n/<코드>.js →
   나머지 게임 코드. 언어 파일은 자기 자신을 register()로 등록만 하고, 실제
   언어 결정은 부팅 시점의 I18N.boot()가 한다(campaign.js DOMContentLoaded).

   [자리표시자] {name} 형식이다. 값이 유한한 숫자면 현재 언어의 자릿수 구분에
   맞춰 자동으로 형식을 입힌다 — 호출부에서 toLocaleString을 부르지 않는다.
   ===================================================================== */
const I18N = {
  // 등록된 언어가 없거나 저장값·브라우저 언어가 모두 빗나갔을 때 여는 언어.
  // [세션 6] 영어 테이블이 생기면 'en'으로 바꾼다.
  DEFAULT_LANGUAGE: 'ko',
  // 키가 빠진 언어는 이 언어의 값으로 메운다. 그것도 없으면 키 자체를 돌려준다.
  FALLBACK_LANGUAGE: 'en',
  // 진행 데이터(slagma.campaign.v4)와 별도 키다 — 데이터 초기화에 영향받지 않는다.
  STORAGE_KEY: 'slagma.lang',

  tables: Object.create(null),   // code → { key: string }
  labels: Object.create(null),   // code → 그 언어로 쓴 자기 이름
  order: [],                     // 등록 순서 = 언어 선택 목록 순서
  current: null,
  formatters: Object.create(null),
  warned: new Set(),
  listeners: [],

  /* --- 등록 --------------------------------------------------------- */
  // 언어 파일이 부르는 유일한 함수다. label은 그 언어로 쓴 자기 이름(한국어·English).
  register(code, label, table){
    if(!code || !table) return;
    if(!this.tables[code]) this.order.push(code);
    this.tables[code] = table;
    this.labels[code] = label || code;
  },
  languages(){ return this.order.map(code=>({code, label:this.labels[code]})); },
  has(code){ return !!this.tables[code]; },

  /* --- 언어 결정 ---------------------------------------------------- */
  // 저장된 값 → Platform.languageHint() → navigator.language → 기본값 순서다.
  // 등록되지 않은 언어는 건너뛴다.
  resolve(){
    const candidates = [];
    try{ candidates.push(SaveStorage.load(this.STORAGE_KEY)); }catch(_){}
    try{ candidates.push(Platform.languageHint()); }catch(_){}
    try{ candidates.push(navigator.language); }catch(_){}
    for(const raw of candidates){
      if(typeof raw !== 'string' || !raw) continue;
      const code = raw.slice(0,2).toLowerCase();
      if(this.has(code)) return code;
    }
    return this.has(this.DEFAULT_LANGUAGE) ? this.DEFAULT_LANGUAGE : (this.order[0] || this.DEFAULT_LANGUAGE);
  },
  // 부팅 시 한 번. 저장하지 않는다 — 고르지 않은 언어를 저장하면 브라우저 언어가
  // 바뀌어도 첫 판정 결과에 묶여 버린다.
  boot(){ this.use(this.resolve()); },
  // 사용자가 옵션에서 고른 경우. 저장하고 화면을 다시 그린다.
  setLanguage(code){
    if(!this.has(code) || code===this.current) return false;
    try{ SaveStorage.save(this.STORAGE_KEY, code); }catch(_){}
    this.use(code);
    Analytics.track('language_change',{lang:code});
    this.listeners.forEach(fn=>{ try{ fn(code); }catch(e){ console.error('[i18n] 언어 변경 처리기 오류',e); } });
    return true;
  },
  // 실제 적용. <html lang>과 마크업 문자열까지 여기서 맞춘다.
  use(code){
    this.current = code;
    this.formatters = Object.create(null);
    document.documentElement.lang = code;
    this.applyDom();
  },
  onChange(fn){ this.listeners.push(fn); },

  /* --- 조회 --------------------------------------------------------- */
  /* 빈 문자열은 "아직 번역하지 않음"이다 — 없는 키와 똑같이 다음 언어로 넘긴다.
     번역을 반쯤 채운 파일로도 화면이 비지 않는다.
     폴백 순서: 현재 언어 → FALLBACK_LANGUAGE → DEFAULT_LANGUAGE → 키 자체. */
  t(key, params){
    let value;
    for(const code of [this.current, this.FALLBACK_LANGUAGE, this.DEFAULT_LANGUAGE]){
      const candidate = this.tables[code]?.[key];
      if(candidate !== undefined && candidate !== ''){ value = candidate; break; }
    }
    if(value===undefined){ this.warnMissing(key); return key; }
    return params ? this.fill(value, params) : value;
  },
  fill(text, params){
    return String(text).replace(/\{(\w+)\}/g, (whole,name)=>{
      if(!(name in params)) return whole;
      const value = params[name];
      return typeof value==='number' && Number.isFinite(value) ? this.num(value) : String(value);
    });
  },
  // 빠진 키는 개발 진입점에서만, 키마다 한 번씩 경고한다.
  warnMissing(key){
    if(!SLAGMA_DEV || this.warned.has(key)) return;
    this.warned.add(key);
    console.warn(`[i18n] 빠진 키: ${key} (${this.current})`);
  },

  /* --- 숫자 --------------------------------------------------------- */
  // 언어별 자릿수 구분. 전투 중 매 프레임 불릴 수 있어 포맷터를 캐시한다.
  num(value, {min=0, max=3}={}){
    const n = Number(value);
    if(!Number.isFinite(n)) return String(value);
    const cacheKey = `${min}:${max}`;
    let formatter = this.formatters[cacheKey];
    if(!formatter){
      try{ formatter = new Intl.NumberFormat(this.current||'en',{minimumFractionDigits:min,maximumFractionDigits:max}); }
      catch(_){ formatter = { format:v=>String(v) }; }
      this.formatters[cacheKey] = formatter;
    }
    return formatter.format(n);
  },

  /* --- 마크업 ------------------------------------------------------- */
  /* index.html의 고정 문구는 아래 속성으로 키만 적어 둔다. 언어가 바뀌면
     applyDom()이 다시 채운다.
       data-i18n        → textContent
       data-i18n-html   → innerHTML   (태그가 들어가는 문구)
       data-i18n-aria   → aria-label
       data-i18n-title  → title       */
  applyDom(root=document){
    root.querySelectorAll('[data-i18n]').forEach(el=>{ el.textContent = this.t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-html]').forEach(el=>{ el.innerHTML = this.t(el.dataset.i18nHtml); });
    root.querySelectorAll('[data-i18n-aria]').forEach(el=>{ el.setAttribute('aria-label', this.t(el.dataset.i18nAria)); });
    root.querySelectorAll('[data-i18n-title]').forEach(el=>{ el.title = this.t(el.dataset.i18nTitle); });
  },
};

// 게임 코드가 부르는 짧은 이름. I18N.t를 그대로 감싼다.
function t(key, params){ return I18N.t(key, params); }
