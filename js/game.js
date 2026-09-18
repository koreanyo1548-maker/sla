/* ===== game.js ===== */
/* =====================================================================
   [Game] 전체 조립 / 루프 / 렌더
   ===================================================================== */
// 전투가 캠페인에 요청하는 것들의 인터페이스. 캠페인 없이 Game을 띄울 때의 안전한 기본값이다.
const NULL_RUN_HOST = {
  progress:()=>true, settle:()=>false, warn:()=>{}, tutorialDone:()=>true, completeTutorial:()=>true,
};
class Game {
  constructor(){
    this.canvas = $('#combat-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.floatLayer = $('#combat-wrap');
    this.playerPos = { x: 0, y: 0 };
    this.applyFieldResolution();
    this.playerHpCurrent = RunConfig.playerStat('hp');
    this.coreHitUntil = 0;
    this.energy = 0;
    this.lastTime = 0;
    this.running = false;
    this.ending = null;
    this.timeScale = 1;
    this.hitStopUntil = 0;
    this.hitStopCooldownUntil = 0;
    this.cinematicTimer = null;
    this.endSequenceTimer = null;
    this.cinematicToken = 0;
    this.outcomeSettled = false;
    this.elapsedTime = 0;
    this.stats = {generated:0,merges:0,ordersCompleted:0,skillsUsed:0,energySpent:0,enemiesKilled:0,bossesKilled:0,damageDealt:0,criticalHits:0,pierceDamage:0};
    this.skillReadyState = {};

    // [2026-09-14] 생성 순서를 의존 방향대로 명시한다. 이전에는 순서가 섞여 있어
    // 뒤에 만들어지는 시스템을 참조하는 쪽이 `if(this.game.xxxSystem)` 널 가드를 달고
    // 있었고, 이 줄들의 순서를 바꾸면 가드 유무에 따라 조용히 동작이 달라졌다.
    // 아래 순서면 어떤 시스템도 자기보다 뒤에 만들어지는 형제를 생성 시점에 읽지 않으므로
    // 가드 없이 안전하다. 런타임 상호 호출(예: MergeBoard ↔ OrderSheetSystem)은 여전히
    // game을 통해 지연 해소되며, 그 순환은 별개 과제다.
    // 1) 연출 — 형제 시스템에 의존하지 않는다
    this.effects = new VisualEffects(this);
    // 2) 전투 판정 기반 — 팩터 집계가 AttackModuleSystem의 강화 상태를 공급원으로 읽는다
    this.attackModuleSystem = new AttackModuleSystem(this);
    this.heroField = new HeroFieldSystem(this);
    this.combatFactorSystem = new CombatFactorSystem(this);
    this.damageResolver = new DamageResolver(this);
    this.statusEffectSystem = new StatusEffectSystem(this);
    this.combatEffectSystem = new CombatEffectSystem(this);
    // 3) 전투 실행 — 위 판정 계층 위에서 돈다
    this.enemySystem = new EnemySystem(this);
    this.combatSystem = new CombatSystem(this);
    this.skillSystem = new SkillSystem(this);
    this.waveSystem = new WaveSystem(this);
    // 4) 보드·주문서 — 생성기의 생성 정책이 주문서 요구색을 읽으므로 주문서가 먼저다
    this.mergeBoard = new MergeBoard(this);
    this.orderSheetSystem = new OrderSheetSystem(this);
    this.orderGaugeSystem = new OrderGaugeSystem(this);
    this.generator = new Generator(this);
    // 5) 집계·안내
    this.scoreSystem = new ScoreSystem(this);
    this.tutorial = new TutorialSystem(this);
    this.currentWaveCfg = null;
    // 캠페인 저장·정산 창구. RunHost.start가 실제 구현을 넣는다(전투 코드는 Campaign을 직접 모른다).
    this.host = NULL_RUN_HOST;
  }
  // [2026-09-07] 기존 resizeCanvas는 컨테이너 비율에 맞춰 캔버스 내부 높이를 150~520 사이로
  // 바꿨다. 그래서 기기마다 논리 높이가 362~520(1.44배)으로 달라지고, px로 정의된 폭발 반경·
  // 광선 폭·히트박스·투사체 속도의 실효값이 함께 흔들렸다(폭발 실효 범위 8.4~12.4%,
  // 투사체 전장 통과 0.55~0.80초). 게다가 start()에서 주문서 카드가 렌더되기 전에 호출돼
  // 컨테이너를 실제보다 높게 측정하고, 이후 resize 이벤트가 없어 재계산되지 않았다 —
  // 결과적으로 내부 버퍼와 CSS 박스의 종횡비가 어긋나 세로로 12%가량 눌려 그려지고 있었다.
  // 이제 논리 해상도를 CONFIG.field로 고정하고, 표시 크기는 layoutField()가 따로 계산한다.
  // 판정은 어느 기기에서나 완전히 동일하고, 화면 비율 차이는 표시 배율 차이로만 남는다.
  // 게임 중 화면 회전·키보드 등장 시 적·투사체 y를 재스케일하던 보정도 함께 사라졌다.
  applyFieldResolution(){
    const f=CONFIG.field;
    if(this.canvas.width!==f.width) this.canvas.width=f.width;
    if(this.canvas.height!==f.height) this.canvas.height=f.height;
    // playerPos는 공용 방어 대상인 핵의 좌표다. 영웅 편성 좌표는 HeroFieldSystem이 관리한다.
    this.playerPos=CoreField.position();
    this.layoutField();
  }
  // [2026-09-07] 표시 전용 계산 — 판정 좌표는 절대 건드리지 않는다.
  // 컨테이너를 그대로 꽉 채우면 짧은 화면에서 세로 배율이 가로의 절반까지 내려가 원이
  // 납작한 타원이 된다(실측: 짧은 화면 0.52, 데스크톱 0.65, iPhone SE 0.71).
  // 반대로 종횡비를 완전히 고정하면 짧은 화면의 좌우 여백이 지나치게 커진다.
  // 그래서 왜곡을 maxAnisotropy까지만 허용하고, 그 이상이면 큰 쪽 배율을 깎아 여백을 만든다.
  layoutField(){
    const wrap=this.floatLayer?.getBoundingClientRect?.();
    if(!wrap || wrap.width<1 || wrap.height<1) return;   // 화면이 숨겨져 있으면 직전 값 유지
    const f=CONFIG.field;
    const maxA=Math.max(1,Number(f.maxAnisotropy)||1);
    let sx=wrap.width/f.width, sy=wrap.height/f.height;
    if(sy/sx>maxA) sy=sx*maxA;
    else if(sx/sy>maxA) sx=sy*maxA;
    this.canvas.style.width=(f.width*sx).toFixed(1)+'px';
    this.canvas.style.height=(f.height*sy).toFixed(1)+'px';
  }
  prefersReducedMotion(){
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }
  hideCinematic(force=false){
    if(this.ending && !force) return;
    if(this.cinematicTimer){ clearTimeout(this.cinematicTimer); this.cinematicTimer=null; }
    const layer=$('#cinematic-layer');
    if(!layer) return;
    layer.hidden=true;
    layer.className='';
    layer.style.removeProperty('--cinematic-duration');
  }
  resetCinematic(){
    this.cinematicToken++;
    if(this.cinematicTimer){ clearTimeout(this.cinematicTimer); this.cinematicTimer=null; }
    if(this.endSequenceTimer){ clearTimeout(this.endSequenceTimer); this.endSequenceTimer=null; }
    this.ending=null;
    this.timeScale=1;
    this.outcomeSettled=false;
    $('#screen-game')?.classList.remove('cinematic-ending');
    this.hideCinematic(true);
    const layer=$('#cinematic-layer');layer.onclick=null;layer.onkeydown=null;layer.removeAttribute('tabindex');layer.setAttribute('role','status');
  }
  showCinematic({classes='',kicker='',title='',sub='',durationSec=0.9}){
    const layer=$('#cinematic-layer');
    if(!layer) return;
    if(this.cinematicTimer){ clearTimeout(this.cinematicTimer); this.cinematicTimer=null; }
    $('#cinematic-kicker').textContent=kicker;
    $('#cinematic-title').textContent=title;
    $('#cinematic-sub').textContent=sub;
    layer.hidden=false;
    layer.className='';
    layer.style.setProperty('--cinematic-duration',`${durationSec}s`);
    void layer.offsetWidth;
    layer.className=`active ${classes}`.trim();
  }
  showBossAlert(kind){
    if(this.ending || GameState.current!=='playing') return;
    const final=kind==='final';
    const configured=final?CONFIG.presentation.finalBossAlertSec:CONFIG.presentation.midBossAlertSec;
    const duration=this.prefersReducedMotion()?0.05:configured;
    this.showCinematic({
      classes:`boss-alert${final?' final-boss':''}`,
      kicker:final?'FINAL WAVE':'WARNING',
      title:final?'최종보스 출현':'중간보스 출현',
      sub:final?'마지막 전투를 준비하세요':'강적이 전장에 진입합니다',
      durationSec:duration,
    });
    const token=++this.cinematicToken;
    this.cinematicTimer=setTimeout(()=>{
      if(token===this.cinematicToken && !this.ending) this.hideCinematic();
    },duration*1000);
  }
  beginEndSequence(outcome){
    if(!this.running || this.ending) return;
    this.ending=outcome;
    this.generator.stopHold();
    this.orderSheetSystem.closeDetail();
    const clear=outcome==='clear';
    // 결과 화면은 연출 뒤에 열지만, 승패 데이터는 판정 순간 먼저 저장해 연출 중 창이 닫혀도 결과를 보존한다.
    this.outcomeSettled=this.host.settle(this.runId,clear,this.milestoneMetrics());
    const configuredDuration=clear?CONFIG.presentation.clearSlowSec:CONFIG.presentation.defeatSlowSec;
    const reduced=this.prefersReducedMotion();
    const duration=reduced?0.05:configuredDuration;
    this.timeScale=reduced?1:(clear?CONFIG.presentation.clearTimeScale:CONFIG.presentation.defeatTimeScale);
    $('#screen-game')?.classList.add('cinematic-ending');
    this.updateEnergyUi();
    this.showCinematic({
      classes:`end-sequence ${clear?'end-clear':'end-defeat'}`,
      kicker:clear?'FINAL STRIKE':'SYSTEM DOWN',
      title:clear?'승리':'패배',
      sub:clear?'최종보스를 처치했습니다':'방어선이 붕괴되었습니다',
      durationSec:duration,
    });
    const token=++this.cinematicToken;
    this.endSequenceTimer=setTimeout(()=>{
      if(token===this.cinematicToken && this.ending===outcome) this.awaitResult(outcome);
    },duration*1000);
  }
  awaitResult(outcome){
    this.running=false;this.generator.stopHold();this.timeScale=1;
    syncToolButtons();          // 연출 중 종료를 막는다 — 클리어가 패배로 정산될 수 있다.
    const layer=$('#cinematic-layer');layer.classList.add('awaiting-result');layer.tabIndex=0;layer.setAttribute('role','button');layer.setAttribute('aria-label','터치해서 결과 보기');
    $('#cinematic-sub').textContent='터치해서 결과 보기';
    layer.onclick=()=>this.finishRun(outcome);
    layer.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.finishRun(outcome);}};
    layer.focus();GameAudio.play(outcome==='clear'?'clear':'defeat');
  }
  finishRun(outcome){
    if(!this.running && !this.ending) return;
    if(this.endSequenceTimer){ clearTimeout(this.endSequenceTimer); this.endSequenceTimer=null; }
    this.running=false;
    this.generator.stopHold();
    this.timeScale=1;
    this.ending=null;
    this.cinematicToken++;
    this.hideCinematic(true);
    $('#screen-game')?.classList.remove('cinematic-ending');
    this.orderSheetSystem.closeDetail();
    const clear=outcome==='clear';
    GameState.set(clear?'clear':'defeat');
    $('#result-title').textContent=clear?'클리어!':'패배';
    $('#result-title').className=clear?'clear':'defeat';
    $('#result-sub').textContent=clear
      ? `스테이지 ${this.stageId} · ${RunConfig.waves().length} WAVE 클리어`
      : `스테이지 ${this.stageId} · WAVE ${this.currentWaveCfg?.wave||'?'}에서 종료`;
    if(!this.outcomeSettled) this.outcomeSettled=this.host.settle(this.runId,clear,this.milestoneMetrics());
    this.renderResultStats();
    // 결과 화면 진입 = 게임플레이 구간 종료. 실제 전송·SDK 연결은 세션 7.
    const durationSec=Math.max(0,Math.round(this.elapsedTime));
    const wave=this.currentWaveCfg?.wave||0;
    if(clear) Analytics.progression('complete',this.stageId,{wave,durationSec});
    else Analytics.progression('fail',this.stageId,{wave,durationSec,reason:this.endReason==='quit'?'quit':'defeat'});
    Platform.gameplayStop();
  }
  milestoneMetrics(){return {bosses:this.stats.bossesKilled,orders:this.stats.ordersCompleted,merges:this.stats.merges,skillsUsed:this.stats.skillsUsed};}
  addEnergy(n){ this.energy += n; this.updateEnergyUi(); }
  showEnergyGain(n){
    const display=$('#energy-display');
    if(display) restartCssAnimation(display,'fx-gain');
    const statusRow=$('#energy-status-row');
    if(statusRow){
      restartCssAnimation(statusRow,'fx-gain');
      const pop=document.createElement('span');
      pop.className='energy-gain-pop'; pop.textContent=`+${n}`;
      statusRow.appendChild(pop); setTimeout(()=>pop.remove(),900);
    }
    restartCssAnimation($('#generator-btn'),'fx-energy-grant');
  }
  updateEnergyUi(){
    $('#energy-display').textContent = String(this.energy);
    // 에너지가 없으면 생성기를 비활성화한다(다음 지급 점수를 채우면 다시 켜진다).
    const btn = $('#generator-btn');
    // [2026-09-17] 툴팁도 CONFIG에서 만든다 — 마크업에 수치를 박아 두면 밸런스 변경 때 낡는다.
    if(btn)btn.title=`처치 점수가 ${CONFIG.scoring.pointsPerGrant}점 쌓일 때마다 에너지 ${CONFIG.scoring.energyPerGrant}을 지급합니다`;
    if(btn){btn.disabled=!!this.ending||this.energy<CONFIG.generator.costPerPiece||this.mergeBoard.emptyIndices().length===0;const label=btn.querySelector('.gen-label b');if(label)label.innerHTML=this.mergeBoard.emptyIndices().length===0?'공간 부족':`생성 <small>−${CONFIG.generator.costPerPiece}</small>`;}
    this.renderSkillBar();
  }
  // 로비에서 장착한 스킬 2개를 그린다. 에너지 비용은 없고 개별 쿨타임만 표시한다.
  buildSkillBar(){
    const row = $('#skill-row');
    if(!row) return;
    row.innerHTML = RunConfig.selectedSkills.map(key=>{
      const def = CONFIG.skills[key];
      const meta=SKILL_DEFS[key]||{icon:'◆',color:PALETTE.arcane};
      const entry=this.skillSystem.entry(key);
      return `<button class="skill-btn" data-skill="${key}" data-state="target" style="--skill-accent:${meta.color}" title="${def.name} Lv.${entry?.level||1}">
        <span class="sk-cd"></span>
        <span class="sk-icon">${meta.icon}</span>
        <span class="sk-name">${def.name}</span>
        <span class="sk-level">Lv.${entry?.level||1}</span>
        <span class="sk-cost"></span>
      </button>`;
    }).join('');
    $$('.skill-btn',row).forEach(btn=>{
      btn.onclick = ()=>{
        if(this.skillSystem.activate(btn.dataset.skill)){ GameAudio.play('skill_use'); restartCssAnimation(btn,'fx-use'); }
      };
    });
    this.renderSkillBar();
  }
  renderSkillBar(){
    $$('.skill-btn').forEach(btn=>{
      const key = btn.dataset.skill, def = CONFIG.skills[key];
      if(!def) return;
      const left = this.skillSystem.cooldownLeft(key);
      const reason=this.skillSystem.blockReason(key);
      const ready=reason===null;
      const state=ready?'ready':reason==='쿨타임'?'cooldown':'target';
      btn.disabled = !ready;
      btn.dataset.state=state;
      if(ready && !this.skillReadyState[key]) restartCssAnimation(btn,'fx-ready');
      this.skillReadyState[key]=ready;
      const fill = btn.querySelector('.sk-cd');
      // [2026-09-16] 스킬 버튼이 전장 우하단 정사각 오버레이가 되면서 가로 바 대신
      // 세로로 줄어드는 가림막을 쓴다. 남은 쿨타임 비율이 그대로 높이다.
      if(fill) fill.style.height = (clamp(left/(this.skillSystem.entry(key)?.cooldownSec||def.cooldownSec||1),0,1)*100).toFixed(0)+'%';
      // 비용은 쓸수록 오르므로 매 렌더마다 다시 읽는다.
      const costEl = btn.querySelector('.sk-cost');
      if(costEl){
        const need=this.skillSystem.energyCost(key);
        costEl.textContent=need>0?`⚡${need}`:'';
        costEl.classList.toggle('short', this.energy<need);
      }
      const titleCost=this.skillSystem.energyCost(key);
      btn.title=`${def.name} Lv.${this.skillSystem.entry(key)?.level||1} · ${titleCost>0?`에너지 ${titleCost}`:'에너지 소모 없음'}`;
    });
  }

  renderRunMetrics(){
    const totalSeconds=Math.max(0,Math.floor(this.elapsedTime));
    const minutes=Math.floor(totalSeconds/60);
    const seconds=totalSeconds%60;
    const timer=$('#run-timer');
    if(timer) timer.textContent=`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
    const score=$('#run-score');
    if(score) score.textContent=String(this.scoreSystem?.score||0);
  }
  updateHpUi(){
    const maxHp = RunConfig.playerStat('hp');
    const ratio = clamp(this.playerHpCurrent/maxHp,0,1);
    $('#player-hp-bar').style.width = ratio*100+'%';
    $('#player-hp-label').textContent = `용광로 핵 · ${Math.max(0,Math.round(this.playerHpCurrent))} / ${maxHp}`;
    // [2026-09-18 연출 세션 A] 저HP 경고. 회복으로 기준을 넘으면 해제된다.
    // 표시용 비율만 보고 판정에는 관여하지 않는다.
    const low = this.running && ratio>0 && ratio<=CONFIG.presentation.coreLowPct;
    $('#combat-wrap')?.classList.toggle('is-critical',!!low);
    $('#hud')?.querySelector('.hp-wrap')?.classList.toggle('is-critical',!!low);
    if(low && !this.coreLowAnnounced){ this.coreLowAnnounced=true; GameAudio.play('core_low'); }
    if(!low) this.coreLowAnnounced=false;
    // 핵 외형 단계 — 그리기 쪽이 읽는다.
    const stages=CONFIG.presentation.coreStages||[];
    this.coreStage=stages.reduce((n,edge)=>ratio<=edge?n+1:n,0);
  }
  applyDamageToPlayer(dmg,impact=this.playerPos){
    if(this.ending) return;
    this.coreHitUntil=performance.now()+140;
    this.playerHpCurrent -= dmg;
    this.effects.playerHit(impact);
    spawnFloatNumber(this.floatLayer, impact.x, impact.y, '-'+formatDamage(dmg), 'dmg-player');
    this.updateHpUi();
    if(this.playerHpCurrent <= 0){
      this.playerHpCurrent = 0; this.updateHpUi();
      this.onDefeat();
    }
  }
  start(){
    this.resetCinematic();
    GameState.set('playing');
    this.applyFieldResolution();
    this.playerHpCurrent = RunConfig.playerStat('hp');
    this.coreHitUntil = 0;
    // [2026-09-04] 점수 기반 지급은 첫 100점까지 시간이 걸리므로 시작 에너지를 준다.
    this.energy = CONFIG.scoring.startEnergy;
    this.elapsedTime = 0;
    this.stats = {generated:0,merges:0,ordersCompleted:0,skillsUsed:0,energySpent:0,enemiesKilled:0,bossesKilled:0,damageDealt:0,criticalHits:0,pierceDamage:0};
    this.skillReadyState = {};
    this.updateHpUi(); this.updateEnergyUi();
    this.mergeBoard.cells.fill(null); this.mergeBoard.render();
    this.effects.reset();
    this.attackModuleSystem.reset();
    this.heroField.reset();
    this.orderSheetSystem.closeDetail();
    this.combatSystem.reset();
    this.scoreSystem.reset();
    this.renderRunMetrics();
    this.skillSystem.reset();
    this.buildSkillBar();
    this.orderSheetSystem.reset();
    this.orderGaugeSystem.reset();
    this.statusEffectSystem.reset();
    this.combatEffectSystem.reset();
    this.generator.resetOpeningGuarantee();
    this.enemySystem.enemies = [];
    this.waveSystem.finished = false;
    this.waveSystem.startWave(0);
    this.hitStopUntil = 0;
    this.hitStopCooldownUntil = 0;
    this.running = true;
    syncToolButtons();          // 위쪽 GameState.set('playing') 시점에는 아직 running이 false다.
    this.tutorial.start();
    // 첫 rAF 타임스탬프를 기준으로 삼는다. performance.now()와 섞으면 첫 dt가 음수가 될 수 있다.
    this.lastTime = null;
    requestAnimationFrame(this.loop.bind(this));
  }
  // [2026-09-15] 히트스톱 — 타격 순간 전체 dt를 짧게 눌렀다 푼다. 승패 연출 슬로우(timeScale)와
  // 같은 자리에서 곱해지므로 두 연출이 겹쳐도 한쪽만 적용된다. 좌표·수치는 건드리지 않는다.
  // 쿨타임을 두는 이유: 후반 물량전에서는 초당 수십 번 적중이 나와, 제한이 없으면 게임 전체가
  // 계속 느린 상태로 눌려 있게 된다. 보스 처치만 force로 이 제한을 무시한다.
  hitStop(seconds,force=false){
    if(this.ending||!(seconds>0)||this.prefersReducedMotion()) return;
    const now=performance.now();
    if(!force && now<this.hitStopCooldownUntil) return;
    this.hitStopUntil=Math.max(this.hitStopUntil,now+seconds*1000);
    this.hitStopCooldownUntil=now+CONFIG.presentation.hitStopCooldownSec*1000;
  }
  frameScale(){
    if(this.ending) return this.timeScale;
    return performance.now()<this.hitStopUntil ? CONFIG.presentation.hitStopTimeScale : 1;
  }
  loop(now){
    if(!this.running) return;
    // 첫 프레임은 dt=0으로 스폰·렌더한다. 이후에도 시간 역행과 긴 프레임을 제한한다.
    const realDt = this.lastTime === null ? 0 : Math.max(0, Math.min(0.05, (now-this.lastTime)/1000));
    this.lastTime = Math.max(this.lastTime ?? now, now);
    if(!this.ending) this.elapsedTime += realDt;
    this.renderRunMetrics();
    // [2026-09-09] dt를 시스템 사이마다 다시 계산하는 것은 중복이 아니다. waveSystem.update가
    // 마지막 WAVE를 끝내며 onClear를, enemySystem/combatSystem이 플레이어 사망으로 onDefeat를
    // 부르면 그 프레임 도중에 this.ending이 켜진다. 매번 다시 계산해야 승패가 확정된 시점부터
    // 같은 프레임의 남은 시스템에도 연출 슬로우가 걸린다. 지우면 슬로우가 한 프레임 늦어진다.
    let dt=realDt*this.frameScale();
    this.waveSystem.update(dt);
    if(!this.running) return;
    dt=realDt*this.frameScale();
    this.statusEffectSystem.update(dt);
    this.skillSystem.update(dt);
    this.enemySystem.update(dt);
    if(!this.running) return;
    dt=realDt*this.frameScale();
    this.combatSystem.update(dt);
    this.effects.update(dt);
    this.renderSkillBar();       // 쿨타임 게이지를 매 프레임 갱신
    this.render();
    requestAnimationFrame(this.loop.bind(this));
  }
  render(){
    const ctx = this.ctx;
    ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    GameArt.drawField(ctx,this.canvas.width,this.canvas.height);
    // 초기 기본 공격과 방어·회복 효과는 핵에서 발생한다. 영웅은 핵 뒤에서 사격한다.
    this.effects.drawPlayerAura(ctx);
    GameArt.drawCore(ctx,this);
    this.heroField.draw(ctx);
    this.enemySystem.draw(ctx);
    this.combatSystem.draw(ctx);
    this.effects.draw(ctx);
  }
  onClear(){
    this.beginEndSequence('clear');
  }
  onDefeat(immediate=false){
    // immediate는 사용자가 누른 중도 종료 경로다(RunHost.defeat). 패배 연출을 건너뛴다.
    this.endReason = immediate ? 'quit' : 'defeat';
    if(immediate) this.finishRun('defeat');
    else this.beginEndSequence('defeat');
  }
  renderResultStats(){
    const el=$('#result-stats');
    if(!el) return;
    // [2026-09-07] 확정(인철): 결과 화면에 경과 시간과 누적 점수를 함께 표시한다.
    const totalSeconds=Math.max(0,Math.floor(this.elapsedTime));
    const elapsed=`${String(Math.floor(totalSeconds/60)).padStart(2,'0')}:${String(totalSeconds%60).padStart(2,'0')}`;
    const rows=[
      [this.currentWaveCfg?.wave||1,'도달 웨이브'],
      [elapsed,'경과 시간'],
      [this.scoreSystem?.score||0,'누적 점수'],
      [this.stats.ordersCompleted,'완료 주문서'],
      [this.stats.merges,'머지'],
      [this.stats.skillsUsed,'스킬 사용'],
      [Math.round(this.stats.damageDealt).toLocaleString('ko-KR'),'누적 피해'],
      [this.stats.criticalHits,'치명타 적중'],
      [Math.round(this.stats.pierceDamage).toLocaleString('ko-KR'),'관통 피해'],
    ];
    const renderRow=([value,label])=>`<div class="result-stat"><strong>${value}</strong><span>${label}</span></div>`;
    el.innerHTML=rows.slice(0,6).map(renderRow).join('')+`<details class="result-details"><summary>세부 전투 기록</summary><div>${rows.slice(6).map(renderRow).join('')}</div></details>`;
  }
}

/* =====================================================================
   Start screen wiring (§18)
   ===================================================================== */
function buildStartScreen(state=Campaign.state){
  const list=$('#skill-pick-list'),inv=state.skillInventory;
  list.innerHTML=inv.equipped.map(key=>{const x=inv.skills[key],def=CONFIG.skills[key],meta=SKILL_DEFS[key];return `<div class="skill-slot" style="--skill-accent:${meta.color}"><span class="skill-icon">${meta.icon}</span><b>${def.name}</b><small>Lv.${x.level} · ${SkillLobbyUI.effectText(key,x)}<br>쿨타임 ${SkillGrowthSystem.cooldown(key)}초</small></div>`;}).join('');
  $('#start-btn').disabled=false;
  $('#start-btn').textContent=`전투 시작 · 행동력 ${CAMPAIGN_CONFIG.entryCost}`;
  $('#start-btn').onclick=()=>Campaign.enter();
}

