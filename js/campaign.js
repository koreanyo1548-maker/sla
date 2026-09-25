/* ===== campaign.js ===== */
const RunHost = {
  current:null,
  get running(){ return !!this.current?.running; },
  get runId(){ return this.current?.runId ?? null; },
  // 런을 시작한다. meta는 Game이 스스로 알 수 없는 캠페인 쪽 식별자, host는 저장·정산 창구다.
  start(meta,host=NULL_RUN_HOST){
    const game=new Game();
    Object.assign(game,meta);
    game.host=host;
    this.current=game;
    window.game=game;                  // 디버깅용 별칭
    game.start();
    return game;
  },
  // 판정은 멈추고 인스턴스는 남긴다(결과 화면이 통계를 읽는다). 보드의 문서 리스너는 해제한다.
  halt(){
    const game=this.current;
    if(!game) return;
    game.running=false;
    game.generator.stopHold();game.mergeBoard.dispose();game.tutorial.stop();game.pauseReasons.clear();GamePresentation.resetPause();
  },
  // 다른 창에서 진행이 바뀐 경우 — 연출까지 되돌린 뒤 멈춘다.
  abort(){
    this.current?.resetCinematic();
    this.halt();
  },
  defeat(){ OptionsUI.close();this.current?.onDefeat(true); },
  relayout(){ this.current?.layoutField(); },
  holdStart(){ this.current?.generator.startHold(); },
  holdStop(){ this.current?.generator.stopHold(); },
  batchMerge(){ return !!this.current?.batchMergeSystem.activate(); },
};

/* =====================================================================
   [옵션 내 전투 항목 가시성] 전투 종료 항목은 실제 전투 중에만 낸다
   ---------------------------------------------------------------------
   톱니 버튼은 옵션 팝업을 바로 열고, 전투 종료도 그 안에 들어간다. 화면 상태만
   보면 승패 연출 중에도 playing이므로 RunHost.running을 기준으로 별도 구역을
   숨긴다. Game.start()와 awaitResult()처럼 running이 바뀌는 지점에서도 호출한다.
   ===================================================================== */
function syncToolButtons(){
  const section=$('#run-options-section'); if(section) section.hidden=!RunHost.running;
}

/* =====================================================================
   [CampaignStore] 진행 저장 — 저장 어댑터 입출력과 형식 검증만
   ---------------------------------------------------------------------
   [2026-09-14] 이전에는 Campaign 한 객체가 저장·경제 규칙·로비 UI·런 생명주기를
   모두 겸했다(258줄, DOM 셀렉터 54회). 저장 형식 하나를 고치려면 렌더 코드를
   같이 읽어야 했고, 실패 처리와 문구 표시가 한 함수에 섞여 있었다.
   Store는 DOM을 모른다 — 실패를 {ok,error}로 돌려주고 표시는 View가 맡는다.
   ===================================================================== */
const CampaignStore = {
  // 문구가 아니라 키를 돌려준다 — 표시 시점(Campaign.warn)에 현재 언어로 바꾼다.
  READ_ERROR:'notice.read.error',
  WRITE_ERROR:'notice.write.error',
  // [2026-09-18] 성장 개편으로 저장 형식이 v5가 됐다 — 캐릭터·스킬에서 레벨과 조각이 빠지고
  // 공용 레벨 6종(trackLevels)이 들어왔다. 뽑기 폐지로 gachaCount·lifetime.shardsGained도 없앴다.
  fresh(){return {version:5,gold:0,balances:{starfire:CONFIG.meta.growth.startStarfire},characterInventory:CharacterInventorySystem.fresh(),skillInventory:SkillInventorySystem.fresh(),trackLevels:LevelTrackSystem.fresh(),stamina:CAMPAIGN_CONFIG.staminaMax,recoveredAt:Date.now(),staminaChargeClicks:0,tutorialCompleted:false,unlocked:1,cleared:[],milestoneClaims:{},codexClaims:{},best:{wave:0,score:0},lifetime:{waves:0,clears:0,bosses:0,orders:0,merges:0,skillsUsed:0},active:null,lastResult:null};},
  validate(s){
    const integer=(n,min,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
    if(s.version!==5||!integer(s.gold,0)||!integer(s.stamina,0,CAMPAIGN_CONFIG.staminaMax)||!integer(s.staminaChargeClicks,0)||typeof s.tutorialCompleted!=='boolean'||!integer(s.unlocked,1,9999)||!Number.isFinite(s.recoveredAt)||s.recoveredAt<0||
      !Array.isArray(s.cleared)||!s.cleared.every(n=>integer(n,1,9999))||
      !s.milestoneClaims||typeof s.milestoneClaims!=='object'||Array.isArray(s.milestoneClaims)||!Object.values(s.milestoneClaims).every(n=>integer(n,0))||
      !s.codexClaims||typeof s.codexClaims!=='object'||Array.isArray(s.codexClaims)||!Object.values(s.codexClaims).every(n=>integer(n,0))||!s.lifetime||!Object.values(s.lifetime).every(n=>integer(n,0))||
      (s.active&&(!integer(s.active.stageId,1,9999)||!integer(s.active.completed,0,DEFAULT_STAGE_COUNT)||s.active.completed>campaignStage(s.active.stageId).waves||typeof s.active.id!=='string'))) return false;
    if(!LevelTrackSystem.validate(s.trackLevels)) return false;
    if(!CharacterInventorySystem.validate(s.characterInventory)||!SkillInventorySystem.validate(s.skillInventory)||!s.balances||!Object.values(s.balances).every(n=>integer(n,0))) return false;
    return true;
  },
  // [2026-09-16 v0916_3] 저장 항목이 늘어도 기존 진행을 버리지 않는다. 빠진 최상위 항목만 기본값으로 채운다.
  // v0916_2는 인벤토리 두 개만 보정했고 SkillInventorySystem.migrate의 반환값도 버려,
  // 이전 저장(skillInventory·balances·claimedMilestones·lifetime 없음)이 validate에서 통째로 실패했다.
  migrate(s){
    if(!s||typeof s!=='object')return s;
    const base=this.fresh(),int0=n=>Number.isSafeInteger(n)&&n>=0;
    if(!s.balances||typeof s.balances!=='object'||Array.isArray(s.balances))s.balances={...base.balances};
    if(!int0(s.balances.starfire))s.balances.starfire=0;
    if(!s.lifetime||typeof s.lifetime!=='object')s.lifetime={};
    Object.keys(base.lifetime).forEach(k=>{if(!int0(s.lifetime[k]))s.lifetime[k]=0;});
    Object.keys(s.lifetime).forEach(k=>{if(!(k in base.lifetime))delete s.lifetime[k];});   // 조각 누적(shardsGained) 같은 폐지 항목을 걷어낸다
    if(!s.milestoneClaims||typeof s.milestoneClaims!=='object'||Array.isArray(s.milestoneClaims))s.milestoneClaims={};
    // [2026-09-21] 도감 보상이 즉시 적용에서 수령 방식으로 바뀌며 생긴 항목이다. 이전 저장은
    // 빈 객체로 채운다 — 이미 조건을 채운 단계가 전부 "받을 수 있는" 상태로 나타난다.
    if(!s.codexClaims||typeof s.codexClaims!=='object'||Array.isArray(s.codexClaims))s.codexClaims={};
    // [2026-09-18 연출 세션 B] 결과 화면 NEW BEST 판정용 최고 기록. 이전 저장에는
    // 없으므로 0으로 채운다 — 첫 판이 곧 최고 기록이 된다.
    if(!s.best||typeof s.best!=='object'||Array.isArray(s.best))s.best={wave:0,score:0};
    if(!int0(s.best.wave))s.best.wave=0;
    if(!int0(s.best.score))s.best.score=0;
    delete s.claimedMilestones;   // 1회성 수령 기록은 반복형 단계와 호환되지 않아 버린다.
    delete s.gachaCount;          // 뽑기 폐지로 사라진 누적 집계
    s.trackLevels=LevelTrackSystem.migrate(s.trackLevels);
    s.characterInventory=CharacterInventorySystem.migrate(s.characterInventory);
    s.skillInventory=SkillInventorySystem.migrate(s.skillInventory);
    // 임계값을 바꿨거나 해금을 놓친 저장도 여기서 레벨 기준으로 다시 맞춘다.
    if(s.characterInventory?.characters&&s.skillInventory?.skills)UnlockSystem.apply(s);
    return s;
  },
  read(){
    try{
      const raw=SaveStorage.load(CAMPAIGN_CONFIG.saveKey);
      const s=this.migrate(raw?JSON.parse(raw):this.fresh());
      if(!this.validate(s)) throw Error('저장 형식 오류');
      return {ok:true,state:s};
    }catch(e){ return {ok:false,error:this.READ_ERROR}; }
  },
  commit(next){
    try{ SaveStorage.save(CAMPAIGN_CONFIG.saveKey,JSON.stringify(next)); return {ok:true}; }
    catch(e){ return {ok:false,error:this.WRITE_ERROR}; }
  },
  // 개발 옵션의 초기화 버튼도 저장 어댑터만 통한다. 다른 localStorage 값은 건드리지 않는다.
  remove(){
    try{ SaveStorage.remove(CAMPAIGN_CONFIG.saveKey); return {ok:true}; }
    catch(e){ return {ok:false,error:this.WRITE_ERROR}; }
  },
  isOwnKey(key){ return key===CAMPAIGN_CONFIG.saveKey; },
};

/* =====================================================================
   [CampaignEconomy] 행동력 회복·충전과 보상 정산 — 순수 규칙
   ---------------------------------------------------------------------
   저장도 DOM도 건드리지 않는다. 상태를 받아 계산한 결과만 돌려주므로
   수치 검증을 Node에서 그대로 돌릴 수 있고, Unity 이관 시에도 이 객체만
   옮기면 된다.
   ===================================================================== */
const CampaignEconomy = {
  // 행동력이 가득 찬 상태는 남는 회복 시간을 적립하지 않는다.
  recover(s,now=Date.now()){
    if(s.stamina>=CAMPAIGN_CONFIG.staminaMax){s.stamina=CAMPAIGN_CONFIG.staminaMax;s.recoveredAt=now;return;}
    if(s.recoveredAt>now)s.recoveredAt=now;
    const ticks=Math.floor((now-s.recoveredAt)/CAMPAIGN_CONFIG.recoveryMs);
    if(ticks>0){s.stamina=Math.min(CAMPAIGN_CONFIG.staminaMax,s.stamina+ticks);s.recoveredAt=s.stamina===CAMPAIGN_CONFIG.staminaMax?now:s.recoveredAt+ticks*CAMPAIGN_CONFIG.recoveryMs;}
  },
  secondsToNextTick(s,now=Date.now()){
    return Math.max(1,Math.ceil((CAMPAIGN_CONFIG.recoveryMs-(now-s.recoveredAt))/1000));
  },
  // 런 종료 정산 — s를 제자리에서 갱신하고 결과 명세를 돌려준다.
  settle(s,run,stage,clear,metrics={}){
    clear=!!clear&&run.completed===stage.waves;
    const waveGold=run.completed*stage.waveGold,bonus=clear?stage.clearGold:0;
    const result={id:run.id,stageId:stage.id,completed:run.completed,waveGold,bonus,total:waveGold+bonus,clear};
    // [연출 세션 B] 최고 기록 갱신 여부. 결과 화면의 NEW BEST 스탬프가 이 값을 본다.
    s.best??={wave:0,score:0};
    const wave=Math.max(0,Math.floor(Number(metrics.wave)||0)),score=Math.max(0,Math.floor(Number(metrics.score)||0));
    result.newBestWave=wave>s.best.wave; result.newBestScore=score>s.best.score;
    s.best.wave=Math.max(s.best.wave,wave); s.best.score=Math.max(s.best.score,score);
    result.firstClear=clear&&!s.cleared.includes(stage.id);
    s.gold+=result.total;s.active=null;s.lastResult=result;
    s.lifetime.waves+=run.completed;s.lifetime.clears+=clear?1:0;s.lifetime.bosses+=Number(metrics.bosses)||0;s.lifetime.orders+=Number(metrics.orders)||0;s.lifetime.merges+=Number(metrics.merges)||0;s.lifetime.skillsUsed+=Number(metrics.skillsUsed)||0;
    if(clear){s.unlocked=Math.max(s.unlocked,stage.id+1);if(!s.cleared.includes(stage.id))s.cleared.push(stage.id);}
    return result;
  },
  stageTotalGold(stage){ return stage.waves*stage.waveGold+stage.clearGold; },
};

/* =====================================================================
   [Campaign] 캠페인 진행 조정자
   ---------------------------------------------------------------------
   저장(CampaignStore)·경제 규칙(CampaignEconomy)·화면(CampaignView)을 묶고,
   런 입장(RunConfig.battle 구성)·진행 저장·정산을 담당한다. 전투는 runHost()로만 요청한다.
   ===================================================================== */
const Campaign = {
  state:null,selectedStage:1,broken:false,currentLobbyPage:'home',pendingUnlockFx:false,
  // 지금 경고 줄에 떠 있는 문자열 키. 언어가 바뀌면 이 키로 다시 그린다.
  warnKey:'',
  fresh(){ return CampaignStore.fresh(); },
  // 빈 문자열은 경고 줄을 지우라는 뜻이라 그대로 넘긴다. 그 밖에는 문자열 키다.
  warn(key){ this.warnKey=key||''; CampaignView.warn(key?t(key):''); },
  read(){
    const r=CampaignStore.read();
    if(!r.ok){ this.broken=true; this.warn(r.error); return false; }
    this.state=r.state; this.broken=false; return true;
  },
  commit(next){
    const r=CampaignStore.commit(next);
    if(!r.ok){ this.warn(r.error); return false; }
    this.state=next; this.warn(''); return true;
  },
  // 행동력을 회복 적용한 사본 — 표시와 판정이 같은 값을 보게 한다.
  recovered(state=this.state){
    const s=cloneConfig(state);
    CampaignEconomy.recover(s);
    return s;
  },
  completeTutorial(){
    if(!this.read()||this.state.tutorialCompleted) return !!this.state?.tutorialCompleted;
    const s=cloneConfig(this.state);s.tutorialCompleted=true;return this.commit(s);
  },
  stage(id=this.selectedStage){return campaignStage(id);},
  init(){
    this.state=this.fresh();this.read();
    this.selectedStage=this.state.unlocked;
    if(this.state.active&&!this.broken){
      const id=this.state.active.id;
      if(this.settle(id,false))CampaignView.notice(t('notice.settle.previous',{gold:this.state.lastResult.total}));
      else this.warn('notice.settle.previousFailed');
    }
    $$('[data-lobby-nav]').forEach(button=>button.onclick=()=>this.navigate(button.dataset.lobbyNav));
    CharacterLobbyUI.init(this);
    SkillLobbyUI.init(this);
    MilestoneUI.init(this);
    CodexLobbyUI.init(this);
    UpgradeLobbyUI.init(this);
    $('#prepare-btn').onclick=()=>this.enter();
    const quit=$('#options-quit-run');
    if(quit)quit.onclick=()=>{
      if(!RunHost.running)return;
      OptionsUI.close();
      RunHost.holdStop();
      if(confirm(t('notice.quit.confirm')))RunHost.defeat();
    };
    this.showLobby();
    setInterval(()=>{if(GameState.current==='lobby')this.renderWallet();},1000);
    window.addEventListener('storage',e=>{
      if(!CampaignStore.isOwnKey(e.key))return;
      if(!this.read())return;
      if(RunHost.running&&this.state.active?.id!==RunHost.runId){
        RunHost.abort();
        this.showLobby();CampaignView.notice(t('notice.storage.changed'));
      }else if(GameState.current==='lobby')this.render();
    });
  },
  navigate(name){
    if(!['home','characters','skills','upgrade'].includes(name))name='home';
    this.currentLobbyPage=name;
    $('#app').dataset.lobbyPage=name;
    if(name!=='characters')CharacterLobbyUI.close();
    if(name!=='skills')SkillLobbyUI.close();
    this.render();
    CampaignView.scrollLobbyTop();
  },
  showLobby(){
    RunHost.halt();
    this.read();this.selectedStage=this.state.unlocked;this.currentLobbyPage='home';RunConfig.clear();CharacterLobbyUI.close();SkillLobbyUI.close();MilestoneUI.close();CodexLobbyUI.close();RevealUI.close();GameState.set('lobby');this.render();
    if(this.pendingUnlockFx){ this.pendingUnlockFx=false; restartCssAnimation($('.journey-scene'),'fx-unlock'); GameAudio.play('stage_unlock'); }
  },
  renderWallet(){
    CampaignView.wallet({
      recovered:this.recovered(),
      gold:this.state.gold,
      starfire:WalletSystem.balance(this.state,'starfire'),
      locked:this.broken||!!this.state.active,
      selectedStage:this.selectedStage,
    });
  },
  render(){
    this.renderWallet();
    this.selectedStage=this.state.unlocked;
    CampaignView.stageHeader(this.stage());
    CampaignView.partySummary(PartyCombatAdapter.snapshot(this.state));
    CharacterLobbyUI.render(this);
    CodexLobbyUI.render(this);
    SkillLobbyUI.render(this);
    MilestoneUI.render(this);
    UpgradeLobbyUI.render(this);
    CampaignView.lobbyPage(['characters','skills','upgrade','relics'].includes(this.currentLobbyPage)?this.currentLobbyPage:'home');
  },
  // [2026-09-19 세션 7] 출전 준비 화면을 없애면서 prepare()가 하던 검사를 여기로
  // 합쳤다. 로비의 출전 버튼이 부르는 유일한 입장 경로다.
  enter(){
    if(GameState.current!=='lobby'||!this.read()||this.state.active||this.selectedStage!==this.state.unlocked||!SkillInventorySystem.validate(this.state.skillInventory))return false;
    const s=this.recovered();
    // 행동력이 모자라면 로비에 머문다 — 버튼 문구가 남은 양을 다시 보여 준다.
    if(s.stamina<CAMPAIGN_CONFIG.entryCost){this.render();return false;}
    const st=this.stage();
    s.stamina-=CAMPAIGN_CONFIG.entryCost;
    s.active={id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,stageId:st.id,completed:0};
    if(!this.commit(s))return false;
    CONFIG=cloneConfig(DEFAULT_CONFIG);
    const partySnapshot=PartyCombatAdapter.snapshot(s);
    const skillSnapshot=SkillCombatAdapter.snapshot(s);
    const codexSnapshot=CodexSystem.snapshot(s);
    RunConfig.selectedSkills=skillSnapshot.equipped.map(item=>item.key);
    RunConfig.skillSnapshot=skillSnapshot;
    RunConfig.partySnapshot=partySnapshot;
    RunConfig.codexSnapshot=codexSnapshot;
    RunConfig.battle=this.battleContext(st,partySnapshot);
    CharacterLobbyUI.close();
    Analytics.progression('start',st.id);
    Platform.gameplayStart();
    RunHost.start({runId:s.active.id,stageId:st.id,completedWaves:0},this.runHost());
    return true;
  },
  // 스테이지와 편성으로 이번 런의 전투 수치를 확정한다. CONFIG는 건드리지 않는다.
  battleContext(st,partySnapshot){
    return {
      stageId:st.id,
      player:{atk:partySnapshot.stats.atk,def:partySnapshot.stats.def,hp:partySnapshot.stats.hp},
      enemyBase:{
        hp:Math.round(CONFIG.enemy.base.hp*st.hpScale),
        atk:Math.round(CONFIG.enemy.base.atk*st.atkScale),
        def:stageEnemyDefense(st.id,CONFIG.enemy,CONFIG.stage),
      },
      waves:buildStageWaves(st.waves,CONFIG.stage,st.id),
      bossCompositions:buildBossCompositions(st.waves,CONFIG.stage,st.id),
    };
  },
  // 전투가 캠페인에 요청할 수 있는 창구. Game은 이 객체만 알고 Campaign을 직접 부르지 않는다.
  runHost(){
    return {
      progress:(id,count)=>this.progress(id,count),
      settle:(id,clear,metrics)=>this.settle(id,clear,metrics),
      warn:key=>this.warn(key),
      tutorialDone:()=>!!this.state?.tutorialCompleted,
      completeTutorial:()=>this.completeTutorial(),
    };
  },
  progress(id,count){
    if(!this.read()||this.state.active?.id!==id)return false;
    const s=cloneConfig(this.state),st=this.stage(s.active.stageId);s.active.completed=Math.max(s.active.completed,Math.min(st.waves,count));return this.commit(s);
  },
  settle(id,clear,metrics={}){
    if(!this.read())return false;
    if(this.state.lastResult?.id===id){CampaignView.reward(this.state.lastResult);return true;}
    if(this.state.active?.id!==id)return false;
    const s=cloneConfig(this.state),run=s.active,st=this.stage(run.stageId);
    // 새 최고 스테이지인지는 정산 전 상태로 판단한다 — settle이 unlocked·cleared를 올린다.
    const firstClear=!this.state.cleared?.includes(st.id);
    const result=CampaignEconomy.settle(s,run,st,clear,metrics);
    if(!this.commit(s)){
      CampaignView.rewardFailure(()=>this.settle(id,clear,metrics));
      return false;
    }
    // [연출 세션 B · B-6] 새 지역이 열렸으면 로비로 돌아갈 때 배너를 한 번 연다.
    if(result.clear&&firstClear) this.pendingUnlockFx=true;
    // 저장이 된 뒤에 보고한다 — 커밋이 실패하면 남지 않은 클리어를 보고하게 된다.
    if(result.clear&&firstClear) Analytics.track('stage_clear_first',{stage:st.id});
    CampaignView.reward(result);
    CampaignView.resultHint(this.state,result);
    return true;
  },
};



/* =====================================================================
   [OptionsUI] 옵션 팝업 — 언어 · 효과음 · 전투 종료 · 개발용 데이터 초기화
   ---------------------------------------------------------------------
   [2026-09-23] 톱니 버튼이 이 팝업을 바로 연다. 별도 햄버거 메뉴는 제거했고,
   전투 종료는 전투 중에만 팝업 항목으로 표시한다. 데이터 초기화 마크업과
   처리기는 index.html의 DEV_ONLY 구간이라 출시 빌드에서 함께 제거된다.

   언어 목록은 I18N.languages()에서 만든다. i18n/ 에 언어 파일이 하나 늘면
   버튼도 하나 늘고, 이 코드는 손대지 않는다. 각 언어는 자기 이름을 자기
   언어로 표시한다(한국어 · English).

   언어는 전투 화면에서 막는다. 전투 화면은 Screens.rerender()가 다시 그리는
   대상이 아니라 바꿔도 이전 언어가 남는다.

   ===================================================================== */
const OptionsUI = {
  lastFocus:null,
  languageAvailable(){ return GameState.current!=='playing'; },
  init(){
    const toggle=$('#tools-toggle'); if(!toggle) return;
    toggle.onclick=()=>this.open();
    $('#options-close').onclick=()=>this.close();
    // [연출 세션 B] 패시브 해금 카드는 옵션과 무관하지만 여기서 한 번만 묶는다.
    $('#passive-reveal-close').onclick=()=>GameFeedback.closePassiveReveal();
    $('#passive-reveal').onclick=event=>{ if(event.target===$('#passive-reveal')) GameFeedback.closePassiveReveal(); };
    $('#options-panel').onclick=event=>{ if(event.target===$('#options-panel')) this.close(); };
    document.addEventListener('keydown',event=>{
      const panel=$('#options-panel');
      if(panel.hidden) return;
      if(event.key==='Escape'){ event.preventDefault(); this.close(); }
      // 다른 모달(캐릭터·주문서·소환)과 같이 Tab을 팝업 안에 가둔다.
      if(event.key==='Tab'){
        const focusable=[...panel.querySelectorAll('button:not(:disabled),input:not(:disabled)')];
        if(!focusable.length) return;
        event.preventDefault();
        const index=focusable.indexOf(document.activeElement);
        const next=event.shiftKey
          ? (index<=0 ? focusable.at(-1) : focusable[index-1])
          : (index<0||index===focusable.length-1 ? focusable[0] : focusable[index+1]);
        next.focus();
      }
    });
    // 언어가 바뀌면 지금 보고 있는 화면을 다시 그린다. 효과음 버튼 툴팁은
    // GameAudio가 직접 세우므로(마크업 키가 아니라) 여기서 같이 불러 준다.
    I18N.onChange(()=>{ this.render(); GameAudio.render(); Screens.rerender(); });
  },
  render(){
    const list=$('#lang-list'); if(!list) return;
    const languageBlocked=!this.languageAvailable();
    list.innerHTML=I18N.languages().map(({code,label})=>
      `<button data-lang="${code}" aria-current="${code===I18N.current}"${languageBlocked?' disabled':''}>${label}</button>`).join('');
    $$('[data-lang]',list).forEach(button=>button.onclick=()=>{
      if(!this.languageAvailable()) return;
      I18N.setLanguage(button.dataset.lang);
      this.close();
    });
    $('#options-language-note').hidden=!languageBlocked;
    const reset=$('#reset-data-btn');
    if(reset)reset.disabled=GameState.current!=='lobby';
    const resetNote=$('#reset-data-note');
    if(resetNote)resetNote.hidden=GameState.current==='lobby';
    syncToolButtons();
  },
  open(){
    this.lastFocus=document.activeElement;
    this.render();
    $('#options-panel').hidden=false;
    RunHost.current?.setPause('options',true);
    $('#options-close').focus();
  },
  close(){
    $('#options-panel').hidden=true;
    RunHost.current?.setPause('options',false);
    if(this.lastFocus?.isConnected) this.lastFocus.focus();
    this.lastFocus=null;
  },
};

/* =====================================================================
   [Screens] 언어가 바뀐 뒤 현재 화면을 다시 그린다
   ---------------------------------------------------------------------
   I18N.applyDom()은 마크업에 키로 적힌 고정 문구만 되돌린다. 수치가 섞인
   문구는 렌더 함수가 만들므로 화면마다 그 함수를 다시 부른다.
   ===================================================================== */
const Screens = {
  rerender(){
    // 경고 줄은 화면과 무관하게 떠 있을 수 있다.
    Campaign.warn(Campaign.warnKey);
    switch(GameState.current){
      case 'lobby':
        Campaign.render();
        break;
      case 'clear': case 'defeat':
        RunHost.current?.renderResultScreen();
        // 보상 저장에 실패해 재시도 버튼이 떠 있을 수 있다 — 마지막으로 그린
        // 쪽을 그대로 다시 그린다. lastResult로 새로 그리면 재시도 버튼이 사라진다.
        CampaignView.rerenderReward();
        break;
    }
  },
};

/* =====================================================================
   Global event wiring
   ===================================================================== */
window.addEventListener('DOMContentLoaded', ()=>{
  Platform.init();
  // 언어를 먼저 정한다 — 아래 analytics의 lang 값과 첫 렌더가 같은 언어를 봐야 한다.
  // Platform.languageHint()를 읽으므로 Platform.init() 뒤여야 한다.
  I18N.boot();
  // 저장이 있는지는 Campaign.init()이 새 진행을 만들기 전에 봐야 한다.
  // orientation은 이 판정이 최종이다 — 레이아웃이 세로 하나뿐이라(개발계획서 세션 4) 별도
  // 판정 함수를 두지 않는다. 지표용 값이라 뷰포트 비율만 보면 충분하다.
  let isNew=1; try{ isNew=SaveStorage.load(CAMPAIGN_CONFIG.saveKey)?0:1; }catch(_){}
  Analytics.track('session_start',{
    lang:I18N.current,
    orientation:window.innerWidth>window.innerHeight?'landscape':'portrait',
    isNew,
  });
  GameArt.init();GameAudio.init();Campaign.init();GamePresentation.init();
  $('#sound-toggle').onclick=()=>GameAudio.toggle();
  $$('[data-open-characters]').forEach(b=>b.onclick=()=>Campaign.navigate('characters'));
  $$('[data-lobby-nav]').forEach(b=>b.addEventListener('click',()=>GameAudio.play()));

  // [2026-09-07] 화면 크기가 바뀌면 표시 배율만 다시 계산한다. 판정 좌표(CONFIG.field)는
  // 고정이라 적·투사체 위치를 재스케일하던 기존 보정은 필요 없다.
  // ResizeObserver를 쓰는 이유: 기존 resizeCanvas는 start() 안에서 주문서 카드가 렌더되기 전에
  // 한 번만 호출돼 컨테이너를 실제보다 높게 측정하고 이후 갱신되지 않았다. 옵저버는 등록 직후와
  // 레이아웃이 실제로 바뀔 때마다 불리므로 그 타이밍 문제가 구조적으로 사라진다.
  const relayoutField=()=>RunHost.relayout();
  if(window.ResizeObserver){
    new ResizeObserver(relayoutField).observe($('#combat-wrap'));
  } else {
    window.addEventListener('resize', relayoutField);
    if(window.visualViewport) window.visualViewport.addEventListener('resize', relayoutField);
  }

  // [2026-09-18] #app 높이(--app-100dvh)를 실측 뷰포트 높이로 직접 맞춘다. 모바일
  // 브라우저 주소창이 접혔다 펴지면 보이는 높이가 바뀌는데, 위 ResizeObserver는
  // #combat-wrap 박스 크기 변화에만 반응하고 dvh 재계산 시점은 브라우저마다
  // 어긋난다(특히 설명서 패널처럼 전체 화면 오버레이를 닫는 순간) — #lobby-nav 등
  // 화면 맨 아래 요소가 주소창 밑에 가려 잘려 보이는 사고로 이어졌다. syncViewportHeight를
  // resize·visualViewport resize마다 불러 --app-100dvh를 실측 px로 덮어쓴다.
  const syncViewportHeight=()=>{
    const h=window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty('--app-100dvh', h+'px');
  };
  syncViewportHeight();
  window.addEventListener('resize', syncViewportHeight);
  if(window.visualViewport) window.visualViewport.addEventListener('resize', syncViewportHeight);

  $('#batch-merge-btn').addEventListener('click', ()=>RunHost.batchMerge());
  $('#generator-btn').addEventListener('pointerdown', ()=>RunHost.holdStart());
  ['pointerup','pointerleave','pointercancel','lostpointercapture'].forEach(evt=>{
    $('#generator-btn').addEventListener(evt, ()=>RunHost.holdStop());
  });

  window.addEventListener('blur',()=>RunHost.holdStop());
  $('#retry-btn').addEventListener('click', ()=>Campaign.showLobby());

  OptionsUI.init();
});
