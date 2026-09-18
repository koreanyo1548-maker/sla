/* ===== dev.js ===== */
/* =====================================================================
   [개발 진입점 전용] dev.html만 이 파일을 로드한다
   ---------------------------------------------------------------------
   [2026-09-18 세션 2] 출시 빌드에서 개발 기능을 빼기 위한 파일이다. 개발
   기능을 index.html 마크업에 두고 숨기는 방식이 아니라, 아예 없는 것을
   여기서 만든다 — 출시 진입점에는 존재하지 않는다.

   마크업을 여기서 만드는 이유: 개발 전용 요소를 index.html에 두면 dev.html이
   마크업을 한 벌 더 갖게 되고 두 파일이 갈라진다. dev.html은
   tools/build-dev.mjs가 index.html에서 생성하므로 마크업의 원본은 항상
   index.html 하나다.

   이 파일은 campaign.js 뒤, DOMContentLoaded 전에 실행된다. classic
   <script src>는 파서를 막으므로 여기서 만든 요소는 campaign.js의
   DOMContentLoaded 처리기가 볼 수 있다.

   [원칙] 개발 진입점은 출시 진입점과 **같은 화면**을 보여야 한다. 여기서
   레이아웃에 참여하는 요소를 넣으면 dev.html로 한 플레이테스트가 출시
   빌드를 대변하지 못한다. 그래서 전장 하단 로그 줄(#action-log)은 되살리지
   않았다 — #screen-game은 3행 그리드이고 자식을 하나 더 붙이면 행이 늘어
   전투 화면 배치가 달라진다. 마지막 로그 문구는 core.js의 logAction이
   logAction.last에 남기므로 콘솔에서 바로 읽을 수 있다.
   ===================================================================== */
(()=>{
  const app=document.getElementById('app');
  if(!app) return;

  // --- 데이터 초기화 (도구 메뉴) ---------------------------------------
  // 기획서의 "데이터 초기화" 기능 자체는 유지하고 노출만 개발 진입점으로 옮겼다.
  // campaign.js가 #reset-data-btn을 찾아 붙이고 전투 중에는 숨긴다.
  // 다른 도구 버튼들과 같은 자리(#app 직계, .tool-button)여야 CSS가 맞는다.
  if(!document.getElementById('reset-data-btn')){
    const reset=document.createElement('button');
    reset.id='reset-data-btn';
    reset.className='tool-button';
    reset.title='데이터 초기화';
    reset.textContent='↻';
    const anchor=document.getElementById('manual-toggle');
    if(anchor) anchor.after(reset); else app.appendChild(reset);
  }

  console.info('[dev] 개발 진입점 — 데이터 초기화와 분석 콘솔 출력이 켜져 있다. 마지막 로그: logAction.last');
})();
