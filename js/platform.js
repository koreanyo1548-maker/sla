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

   [2026-09-19 세션 7-1] Analytics에 ByteBrew 구현체가 들어왔다(아래
   createByteBrewAnalytics). Platform은 아직 무동작이며 세션 7-2에서
   CrazyGames 구현체로 갈아끼운다. 그때 고치는 파일도 이 파일과
   진입점(index.html)뿐이어야 한다.

   [2026-09-18] 개발 진입점(dev.html)을 없애면서 window.SLAGMA_DEV 분기도 걷어냈다.
   기본 구현체는 무조건 무동작(Noop)이며, 다른 구현체는 진입점이 installPlatform()으로
   꽂는다 — 세션 7에서 실제 SDK를 넣을 때도 같은 경로를 쓴다.

   [이름] 계획서는 저장 어댑터를 Storage로 적었지만 SaveStorage로 둔다.
   Storage는 브라우저 내장 인터페이스 이름이다(localStorage의 프로토타입).
   최상위 const Storage는 그 전역을 가려 버리므로 나중에 instanceof Storage
   같은 코드나 라이브러리가 들어오면 조용히 깨진다.
   ===================================================================== */

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

// 콘솔 출력 구현체. 기본값이 아니며 installPlatform({analytics:AnalyticsConsole})로만 꽂힌다.
const AnalyticsConsole = {
  track(name,params){ console.info('[analytics]',name,params||{}); },
  progression(status,stage,params){
    if(!PROGRESSION_STATUSES.includes(status)) console.warn('[analytics] 알 수 없는 progression status:',status);
    console.info('[analytics] progression',status,'stage',stage,params||{});
  },
  setUser(key,value){ console.info('[analytics] user',key,value); },
};

const AnalyticsNoop = { track(){}, progression(){}, setUser(){} };

/* ByteBrew 구현체. 진입점이 키를 넘겨 부르고 결과를 installPlatform에 꽂는다.
   SDK가 없거나(파일 누락·차단기) 초기화가 막히면 null을 돌려주므로, 그때는
   installPlatform이 무시해 기본 무동작 구현체가 그대로 남는다.

   [웹 SDK에 없는 것] progression 이벤트도 사용자 속성도 없다. 커스텀 이벤트
   하나가 전부다(bytebrew-web-sdk 1.0.1에서 확인). 그래서 어댑터 안에서 접는다:
     progression(status,stage,params) → progression_<status> 커스텀 이벤트
                                        (stage를 파라미터로 실어 보낸다)
     setUser(key,value)               → 보낼 곳이 없다. 아무것도 하지 않는다.
   게임 코드가 보는 인터페이스는 그대로다.

   [큐가 필요한 이유] initializeByteBrew()는 세션 키를 받아오는 네트워크 왕복이라
   즉시 끝나지 않고, 그 전에 부른 이벤트를 SDK가 조용히 버린다(1.0.1에서 확인).
   첫 이벤트인 session_start가 바로 여기 걸리므로 준비될 때까지 쌓았다가 흘린다.
   준비가 끝내 안 되면(오프라인·차단) 큐를 버리고 감시를 끈다 — 메모리가 무한히
   늘지 않게 상한도 둔다. */
const BYTEBREW_QUEUE_MAX = 64;      // 이보다 많이 쌓이면 새 이벤트를 버린다
const BYTEBREW_POLL_MS   = 250;     // 초기화 완료 감시 간격
const BYTEBREW_WAIT_MS   = 20000;   // 이 시간까지 초기화가 안 되면 포기한다

function createByteBrewAnalytics(appId, appKey, appVersion){
  const sdk = window.ByteBrewSDK?.ByteBrew;
  if(!sdk || !appId || !appKey) return null;
  try{ sdk.initializeByteBrew(appId, appKey, appVersion); }
  catch(_){ return null; }

  let ready = false, gaveUp = false;
  const queue = [];
  const emit = (name, params) => {
    try{
      if(params && Object.keys(params).length) sdk.newCustomEvent(name, params);
      else sdk.newCustomEvent(name);
    }catch(_){}
  };
  const send = (name, params) => {
    if(ready) emit(name, params);
    else if(!gaveUp && queue.length < BYTEBREW_QUEUE_MAX) queue.push([name, params]);
  };
  const deadline = Date.now() + BYTEBREW_WAIT_MS;
  const timer = setInterval(()=>{
    let initialized = false;
    try{ initialized = sdk.isByteBrewInitialized(); }catch(_){}
    if(initialized){
      ready = true;
      clearInterval(timer);
      while(queue.length) emit(...queue.shift());
    }else if(Date.now() > deadline){
      gaveUp = true;
      clearInterval(timer);
      queue.length = 0;
    }
  }, BYTEBREW_POLL_MS);

  return {
    track(name, params){ send(name, params); },
    progression(status, stage, params){ send('progression_' + status, {stage, ...(params||{})}); },
    setUser(){},
  };
}

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
let Analytics   = AnalyticsNoop;
let Platform    = PlatformNoop;

function installPlatform({storage,analytics,platform}={}){
  if(storage)   SaveStorage = storage;
  if(analytics) Analytics   = analytics;
  if(platform)  Platform    = platform;
}
