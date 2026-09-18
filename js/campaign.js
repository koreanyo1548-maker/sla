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
  // 판정은 멈추고 인스턴스는 남긴다(결과 화면이 통계를 읽는다).
  halt(){
    const game=this.current;
    if(!game) return;
    game.running=false;
    game.generator.stopHold();
  },
  // 다른 창에서 진행이 바뀐 경우 — 연출까지 되돌린 뒤 멈춘다.
  abort(){
    this.current?.resetCinematic();
    this.halt();
  },
  defeat(){ this.current?.onDefeat(true); },
  relayout(){ this.current?.layoutField(); },
  holdStart(){ this.current?.generator.startHold(); },
  holdStop(){ this.current?.generator.stopHold(); },
};

/* =====================================================================
   [CampaignStore] 진행 저장 — 저장 어댑터 입출력과 형식 검증만
   ---------------------------------------------------------------------
   [2026-09-14] 이전에는 Campaign 한 객체가 저장·경제 규칙·로비 UI·런 생명주기를
   모두 겸했다(258줄, DOM 셀렉터 54회). 저장 형식 하나를 고치려면 렌더 코드를
   같이 읽어야 했고, 실패 처리와 문구 표시가 한 함수에 섞여 있었다.
   Store는 DOM을 모른다 — 실패를 {ok,error}로 돌려주고 표시는 View가 맡는다.
   ===================================================================== */
const CampaignStore = {
  READ_ERROR:'진행 데이터를 읽지 못했습니다. 브라우저 저장 설정을 확인한 뒤 새로고침해 주세요.',
  WRITE_ERROR:'저장하지 못했습니다. 브라우저 저장 공간을 확인한 뒤 다시 시도해 주세요.',
  fresh(){return {version:4,gold:0,balances:{starfire:CONFIG.meta.gacha.startStarfire},characterInventory:CharacterInventorySystem.fresh(),skillInventory:SkillInventorySystem.fresh(),gachaCount:0,stamina:CAMPAIGN_CONFIG.staminaMax,recoveredAt:Date.now(),staminaChargeClicks:0,tutorialCompleted:false,unlocked:1,cleared:[],milestoneClaims:{},lifetime:{waves:0,clears:0,bosses:0,orders:0,merges:0,skillsUsed:0,shardsGained:0},active:null,lastResult:null};},
  validate(s){
    const integer=(n,min,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
    if(s.version!==4||!integer(s.gold,0)||!integer(s.stamina,0,CAMPAIGN_CONFIG.staminaMax)||!integer(s.staminaChargeClicks,0)||typeof s.tutorialCompleted!=='boolean'||!integer(s.unlocked,1,9999)||!Number.isFinite(s.recoveredAt)||s.recoveredAt<0||
      !Array.isArray(s.cleared)||!s.cleared.every(n=>integer(n,1,9999))||
      !s.milestoneClaims||typeof s.milestoneClaims!=='object'||Array.isArray(s.milestoneClaims)||!Object.values(s.milestoneClaims).every(n=>integer(n,0))||!s.lifetime||!Object.values(s.lifetime).every(n=>integer(n,0))||
      (s.active&&(!integer(s.active.stageId,1,9999)||!integer(s.active.completed,0,DEFAULT_STAGE_COUNT)||s.active.completed>campaignStage(s.active.stageId).waves||typeof s.active.id!=='string'))) return false;
    if(!integer(s.gachaCount,0)) return false;
    if(!CharacterInventorySystem.validate(s.characterInventory)||!SkillInventorySystem.validate(s.skillInventory)||!s.balances||!Object.values(s.balances).every(n=>integer(n,0))) return false;
    return true;
  },
  // [2026-09-16 v0916_3] 저장 항목이 늘어도 기존 진행을 버리지 않는다. 빠진 최상위 항목만 기본값으로 채운다.
  // v0916_2는 인벤토리 두 개만 보정했고 SkillInventorySystem.migrate의 반환값도 버려,
  // 이전 저장(skillInventory·balances·claimedMilestones·lifetime 없음)이 validate에서 통째로 실패했다.
  migrate(s){
    if(!s||typeof s!=='object')return s;
    const base=this.fresh(),int0=n=>Number.isSafeInteger(n)&&n>=0;
    if(!int0(s.gachaCount))s.gachaCount=0;
    if(!s.balances||typeof s.balances!=='object'||Array.isArray(s.balances))s.balances={...base.balances};
    if(!int0(s.balances.starfire))s.balances.starfire=0;
    if(!s.lifetime||typeof s.lifetime!=='object')s.lifetime={};
    Object.keys(base.lifetime).forEach(k=>{if(!int0(s.lifetime[k]))s.lifetime[k]=0;});
    if(!s.milestoneClaims||typeof s.milestoneClaims!=='object'||Array.isArray(s.milestoneClaims))s.milestoneClaims={};
    delete s.claimedMilestones;   // 1회성 수령 기록은 반복형 단계와 호환되지 않아 버린다.
    s.characterInventory=CharacterInventorySystem.migrate(s.characterInventory);
    s.skillInventory=SkillInventorySystem.migrate(s.skillInventory);
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
  chargeAmount:5,
  // 행동력이 가득 찬 상태는 남는 회복 시간을 적립하지 않는다.
  recover(s,now=Date.now()){
    if(s.stamina>=CAMPAIGN_CONFIG.staminaMax){s.stamina=CAMPAIGN_CONFIG.staminaMax;s.recoveredAt=now;return;}
    if(s.recoveredAt>now)s.recoveredAt=now;
    const ticks=Math.floor((now-s.recoveredAt)/CAMPAIGN_CONFIG.recoveryMs);
    if(ticks>0){s.stamina=Math.min(CAMPAIGN_CONFIG.staminaMax,s.stamina+ticks);s.recoveredAt=s.stamina===CAMPAIGN_CONFIG.staminaMax?now:s.recoveredAt+ticks*CAMPAIGN_CONFIG.recoveryMs;}
  },
  // 충전 버튼 — 실제로 오른 양을 돌려준다(0이면 이미 가득).
  charge(s,now=Date.now()){
    const before=s.stamina;
    s.stamina=Math.min(CAMPAIGN_CONFIG.staminaMax,s.stamina+this.chargeAmount);
    if(s.stamina>before)s.staminaChargeClicks++;
    if(s.stamina>=CAMPAIGN_CONFIG.staminaMax)s.recoveredAt=now;
    return s.stamina-before;
  },
  secondsToNextTick(s,now=Date.now()){
    return Math.max(1,Math.ceil((CAMPAIGN_CONFIG.recoveryMs-(now-s.recoveredAt))/1000));
  },
  // 런 종료 정산 — s를 제자리에서 갱신하고 결과 명세를 돌려준다.
  settle(s,run,stage,clear,metrics={}){
    clear=!!clear&&run.completed===stage.waves;
    const waveGold=run.completed*stage.waveGold,bonus=clear?stage.clearGold:0;
    const result={id:run.id,stageId:stage.id,completed:run.completed,waveGold,bonus,total:waveGold+bonus,clear};
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
  state:null,selectedStage:1,broken:false,currentLobbyPage:'home',
  fresh(){ return CampaignStore.fresh(); },
  warn(message){ CampaignView.warn(message); },
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
      if(this.settle(id,false))CampaignView.notice(`이전 전투가 종료되어 통과 보상 ${this.state.lastResult.total} 골드를 받았습니다.`);
      else this.warn('이전 전투 보상을 저장하지 못했습니다. 저장 공간을 확인한 뒤 새로고침해 주세요.');
    }
    $$('[data-lobby-nav]').forEach(button=>button.onclick=()=>this.navigate(button.dataset.lobbyNav));
    CharacterLobbyUI.init(this);
    SkillLobbyUI.init(this);
    MilestoneUI.init(this);
    GachaLobbyUI.init(this);
    $('#prepare-btn').onclick=()=>this.prepare();
    // 데이터 초기화 버튼은 개발 진입점에만 있다(js/dev.js). 출시 진입점에는 없다.
    const resetBtn=$('#reset-data-btn'); if(resetBtn) resetBtn.onclick=()=>this.resetData();
    $('#stamina-charge-btn').onclick=()=>this.chargeStamina();
    $('#back-lobby').onclick=()=>this.showLobby();
    $('#quit-run').onclick=()=>{
      $('#app').classList.remove('tools-open'); $('#tools-toggle').textContent='⚙';
      if(!RunHost.running)return;
      RunHost.holdStop();
      if(confirm('전투를 종료할까요? 통과한 WAVE의 골드는 지급되며 행동력은 환급되지 않습니다.'))RunHost.defeat();
    };
    this.showLobby();
    setInterval(()=>{if(GameState.current==='lobby')this.renderWallet();},1000);
    window.addEventListener('storage',e=>{
      if(!CampaignStore.isOwnKey(e.key))return;
      if(!this.read())return;
      if(RunHost.running&&this.state.active?.id!==RunHost.runId){
        RunHost.abort();
        this.showLobby();CampaignView.notice('다른 창에서 진행이 변경되어 이 전투를 종료했습니다.');
      }else if(GameState.current==='lobby')this.render();
    });
  },
  navigate(name){
    if(!['home','characters','skills','gacha'].includes(name))name='home';
    this.currentLobbyPage=name;
    $('#app').dataset.lobbyPage=name;
    if(name!=='characters')CharacterLobbyUI.close();
    if(name!=='skills')SkillLobbyUI.close();
    this.render();
    CampaignView.scrollLobbyTop();
  },
  resetData(){
    if(GameState.current!=='lobby'||this.state?.active) return false;
    if(!confirm('현재 진행을 초기화할까요? 골드·별불·캐릭터·스킬·마일스톤·전투 기록이 초기화됩니다.')) return false;
    replaceObjectContents(DEFAULT_CONFIG,FACTORY_DEFAULT_CONFIG);
    CONFIG=cloneConfig(DEFAULT_CONFIG);
    RunConfig.clear();CharacterLobbyUI.filter='all';CharacterLobbyUI.close();SkillLobbyUI.close();
    if(!this.commit(this.fresh())) return false;
    this.selectedStage=1;GachaLobbyUI.lastResult=null;
    this.render();
    CampaignView.notice('데이터를 초기화했습니다. 스테이지 1 입장 시 튜토리얼이 다시 표시됩니다.');
    return true;
  },
  showLobby(){
    RunHost.halt();
    this.read();this.selectedStage=this.state.unlocked;this.currentLobbyPage='home';RunConfig.clear();CharacterLobbyUI.close();SkillLobbyUI.close();MilestoneUI.close();GachaLobbyUI.lastResult=null;GameState.set('lobby');this.render();
  },
  chargeStamina(){
    if(GameState.current!=='lobby'||!this.read()||this.state.active)return false;
    const s=this.recovered();
    const gained=CampaignEconomy.charge(s);
    if(gained<=0){this.renderWallet();return false;}
    if(!this.commit(s))return false;
    this.renderWallet();
    CampaignView.notice(`행동력 +${gained} 충전 · 누적 ${s.staminaChargeClicks}회`);
    return true;
  },
  renderWallet(){
    CampaignView.wallet({
      recovered:this.recovered(),
      gold:this.state.gold,
      starfire:WalletSystem.balance(this.state,'starfire'),
      chargeClicks:this.state.staminaChargeClicks,
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
    SkillLobbyUI.render(this);
    MilestoneUI.render(this);
    GachaLobbyUI.render(this);
    CampaignView.lobbyPage(['characters','skills','gacha'].includes(this.currentLobbyPage)?this.currentLobbyPage:'home');
  },
  prepare(){
    if(!this.read()||this.state.active||this.selectedStage!==this.state.unlocked)return;
    const s=this.recovered();
    if(s.stamina<CAMPAIGN_CONFIG.entryCost){this.render();return;}
    CONFIG=cloneConfig(DEFAULT_CONFIG);buildStartScreen(this.state);
    CampaignView.brief(this.stage(),PartyCombatAdapter.snapshot(this.state));
    CharacterLobbyUI.close();
    GameState.set('start');
  },
  enter(){
    if(GameState.current!=='start'||!this.read()||this.state.active||this.selectedStage!==this.state.unlocked||!SkillInventorySystem.validate(this.state.skillInventory))return false;
    const s=this.recovered();
    if(s.stamina<CAMPAIGN_CONFIG.entryCost){this.showLobby();return false;}
    const st=this.stage();
    s.stamina-=CAMPAIGN_CONFIG.entryCost;
    s.active={id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,stageId:st.id,completed:0};
    if(!this.commit(s))return false;
    CONFIG=cloneConfig(DEFAULT_CONFIG);
    const partySnapshot=PartyCombatAdapter.snapshot(s);
    const skillSnapshot=SkillCombatAdapter.snapshot(s);
    RunConfig.selectedSkills=skillSnapshot.equipped.map(item=>item.key);
    RunConfig.skillSnapshot=skillSnapshot;
    RunConfig.partySnapshot=partySnapshot;
    RunConfig.battle=this.battleContext(st,partySnapshot);
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
        def:stageEnemyDefense(st.id,CONFIG.enemy),
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
      warn:message=>this.warn(message),
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
    // 저장이 된 뒤에 보고한다 — 커밋이 실패하면 남지 않은 클리어를 보고하게 된다.
    if(result.clear&&firstClear) Analytics.track('stage_clear_first',{stage:st.id});
    CampaignView.reward(result);return true;
  },
};



/* =====================================================================
   Global event wiring
   ===================================================================== */
window.addEventListener('DOMContentLoaded', ()=>{
  Platform.init();
  // 저장이 있는지는 Campaign.init()이 새 진행을 만들기 전에 봐야 한다.
  // orientation은 세션 4·5의 레이아웃 판정 함수가 생기면 그 값으로 바꾼다.
  let isNew=1; try{ isNew=SaveStorage.load(CAMPAIGN_CONFIG.saveKey)?0:1; }catch(_){}
  Analytics.track('session_start',{
    lang:document.documentElement.lang||'ko',
    orientation:window.innerWidth>window.innerHeight?'landscape':'portrait',
    isNew,
  });
  GameArt.init();GameAudio.init();Campaign.init();
  $('#sound-toggle').onclick=()=>GameAudio.toggle();
  $$('[data-open-characters]').forEach(b=>b.onclick=()=>Campaign.navigate('characters'));
  $$('[data-lobby-nav]').forEach(b=>b.addEventListener('click',()=>GameAudio.play()));

  $('#tools-toggle').addEventListener('click', ()=>{
    const app=$('#app');
    const open=app.classList.toggle('tools-open');
    $('#tools-toggle').textContent=open?'×':'⚙';
    $('#tools-toggle').setAttribute('aria-label',open?'도구 메뉴 닫기':'도구 메뉴 열기');
    // 전투 중에는 종료만, 로비에서는 데이터 초기화만 낸다 — 전투 중 초기화는 사고다.
    $('#quit-run').hidden = !RunHost.running;
    const reset=$('#reset-data-btn'); if(reset) reset.hidden = RunHost.running;
  });

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

  $('#generator-btn').addEventListener('pointerdown', ()=>RunHost.holdStart());
  ['pointerup','pointerleave','pointercancel','lostpointercapture'].forEach(evt=>{
    $('#generator-btn').addEventListener(evt, ()=>RunHost.holdStop());
  });

  window.addEventListener('blur',()=>RunHost.holdStop());
  $('#retry-btn').addEventListener('click', ()=>Campaign.showLobby());

  $('#manual-toggle').addEventListener('click', ()=>{
    $('#app').classList.remove('tools-open'); $('#tools-toggle').textContent='⚙';
    ManualPanel.build();
    $('#manual-panel').classList.add('open');
  });
});

