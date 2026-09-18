/* ===== platform.js ===== */
/* =====================================================================
   [플랫폼 경계] 저장 · 분석 · 플랫폼 세 어댑터
   ---------------------------------------------------------------------
   [2026-09-18 세션 2] 게임 코드가 localStorage·분석 라이브러리·플랫폼 SDK를
   직접 부르지 않게 하는 것이 목적이다. 게임 코드는 아래 세 전역만 본다:

     SaveStorage   저장  load / save / remove
     Analytics     분석  track / progression / setUser
     Platform      플랫폼 init / loadingStart / loadingStop /
                        gameplayStart / gameplayStop / languageHint

   지금은 인터페이스만 정하고 가장 단순한 구현체를 꽂는다. 세션 7에서
   ByteBrew(Analytics)와 CrazyGames(Platform) 구현체로 갈아끼운다. 그때
   고치는 파일은 이 파일과 진입점(index.html)뿐이어야 한다.

   구현체 선택은 진입점이 정한다 — 진입점이 스크립트 로딩 전에 세우는
   window.SLAGMA_DEV로 기본값이 갈리고, 세션 7에서 실제 SDK를 꽂을 때는
   진입점에서 installPlatform()을 부른다.

   [이름] 계획서는 저장 어댑터를 Storage로 적었지만 SaveStorage로 둔다.
   Storage는 브라우저 내장 인터페이스 이름이다(localStorage의 프로토타입).
   최상위 const Storage는 그 전역을 가려 버리므로 나중에 instanceof Storage
   같은 코드나 라이브러리가 들어오면 조용히 깨진다.
   ===================================================================== */

const SLAGMA_DEV = globalThis.SLAGMA_DEV === true;

/* --- 저장 -------------------------------------------------------------
   지금 구현체는 localStorage 그대로다. 예외를 삼키지 않고 그대로 올린다 —
   CampaignStore.read/commit이 try/catch로 저장 실패를 사용자 문구로
   바꾸고 있어서, 여기서 null을 돌려주면 저장이 막힌 브라우저가 오류 대신
   새 게임으로 조용히 시작해 버린다. 어댑터의 일은 의존을 옮기는 것이지
   실패 처리를 바꾸는 것이 아니다.
   세션 7에서 CrazyGames 저장으로 바꾼다면 이 구현체만 교체한다. */
const StorageLocal = {
  load(key){ return localStorage.getItem(key); },
  save(key,value){ localStorage.setItem(key,value); },
  remove(key){ localStorage.removeItem(key); },
};

/* --- 분석 -------------------------------------------------------------
   progression의 status는 start · complete · fail 셋으로 고정한다
   (ByteBrew의 progression 이벤트가 이 형태다). 파라미터 값은 숫자와 짧은
   문자열만 쓴다. */
const PROGRESSION_STATUSES = ['start','complete','fail'];

const AnalyticsConsole = {
  track(name,params){ console.info('[analytics]',name,params||{}); },
  progression(status,stage,params){
    if(!PROGRESSION_STATUSES.includes(status)) console.warn('[analytics] 알 수 없는 progression status:',status);
    console.info('[analytics] progression',status,'stage',stage,params||{});
  },
  setUser(key,value){ console.info('[analytics] user',key,value); },
};

const AnalyticsNoop = { track(){}, progression(){}, setUser(){} };

/* --- 플랫폼 -----------------------------------------------------------
   세션 7에서 CrazyGames 구현체로 바꾼다. languageHint는 SDK가 주는 사용자
   언어이며, 없으면 null이다(세션 3의 언어 결정 순서가 null을 넘긴다). */
const PlatformNoop = {
  init(){},
  loadingStart(){}, loadingStop(){},
  gameplayStart(){}, gameplayStop(){},
  languageHint(){ return null; },
};

/* --- 구현체 선택 -----------------------------------------------------
   let이라 installPlatform()이 다시 묶을 수 있다. 게임 코드는 호출 시점에
   현재 묶인 구현체를 본다. */
let SaveStorage = StorageLocal;
let Analytics   = SLAGMA_DEV ? AnalyticsConsole : AnalyticsNoop;
let Platform    = PlatformNoop;

function installPlatform({storage,analytics,platform}={}){
  if(storage)   SaveStorage = storage;
  if(analytics) Analytics   = analytics;
  if(platform)  Platform    = platform;
}
