/* ===== tools.js ===== */
/* =====================================================================
   [replaceObjectContents] 설정 객체를 다른 설정 값으로 치환한다.
   밸런스 에디터 UI는 balance-editor.html로 분리됐고, 이 함수는
   Campaign.resetData()의 데이터 초기화 경로에서 계속 쓴다.
   ===================================================================== */
function replaceObjectContents(target,source){
  Object.keys(target).forEach(key=>delete target[key]);
  Object.assign(target,cloneConfig(source));
}
/* =====================================================================
   [GAME_MANUAL] ❓ 게임 설명서 — 순수 플레이 가이드
   ---------------------------------------------------------------------
   기획서.md(개발/기획 결정 로그)와는 완전히 다른 문서다. 이 GAME_MANUAL은
   "어떻게 플레이하면 되는지"만 담는 사용자 설명서 — 인철 요청: "기획서 말고 별도로
   내부 메뉴로 설명서를 만들어봐. 게임 설명서" (2026-09-02).
   여기 적힌 수치·용어는 기획서.md/CONFIG의 확정·미확정 여부와 무관하게 "현재 기본값
   기준으로 이렇게 진행된다"만 설명한다 — 밸런스 수치가 바뀌면 이 설명서도 같이 갱신할 것.
   ===================================================================== */
function buildGameManual(){
  const sc=CONFIG.scoring, gen=CONFIG.generator, og=CONFIG.orderGauge, board=CONFIG.board;
  const killsPerGrant=Math.max(1,Math.ceil(sc.pointsPerGrant/Math.max(1,sc.normalKill)));
  const maxLevel=CharacterGrowthRules.maxStars*CharacterGrowthRules.levelsPerStar;
  const gacha=CONFIG.meta.gacha, stamina=CAMPAIGN_CONFIG;
  const stageWaves=[1,2,3].map(id=>campaignStage(id).waves).join('·');
  const travel=ENEMY_TYPE_KEYS.map(k=>`${ENEMY_TYPE_LABELS[k]} ${CONFIG.enemy.types[k].travelTimeSec}초`).join(' · ');
  const loop=ARCHETYPE_LOOP.map(k=>k===BOSS_SLOT?'보스':WAVE_ARCHETYPES[k].short).join(' → ');
  const durations=Object.values(WAVE_ARCHETYPES).map(a=>a.timing?.durationSec ?? CONFIG.waveTiming.durationSec);
  const dopamine=[
    CONFIG.featureFlags.criticalMerge&&CONFIG.criticalMerge.chance>0
      ? `머지할 때 ${Math.round(CONFIG.criticalMerge.chance*100)}% 확률로 티어가 한 단계 더 오른다(크리티컬 머지).` : null,
    CONFIG.featureFlags.goldenPiece&&CONFIG.goldenPiece.chance>0
      ? `생성할 때 ${Math.round(CONFIG.goldenPiece.chance*100)}% 확률로 상위 티어 피스가 바로 나온다(골든 피스).` : null,
  ].filter(Boolean);
  return {
  intro: '용광로 핵을 지키는 실시간 머지 디펜스다. 전투는 자동이고, 당신이 하는 일은 아래 보드에서 피스를 합쳐 공격을 강화하는 것뿐이다.',
  sections: [
    { title: '① 한 판의 흐름', body: [
      `적을 잡으면 <b>점수</b>가 쌓이고, ${sc.pointsPerGrant}점마다 <b>에너지</b> ${sc.energyPerGrant}을 받는다(일반 적 약 ${killsPerGrant}기). WAVE ${sc.waveStartBonusFromWave}부터는 새 WAVE가 시작될 때마다 ${sc.waveStartBonus}점을 더 받는다. 시작 에너지는 ${sc.startEnergy}이다.`,
      `에너지 ${gen.costPerPiece}로 <b>피스</b>를 만들고, 같은 색·같은 티어끼리 합쳐 티어를 올린다(최대 T${CONFIG.colors.maxTier}).`,
      '<b>주문서</b>가 요구하는 색을 보드에 갖추면 주문서를 눌러 미사일을 강화한다. 소모한 피스의 티어 합계가 강화 레벨이 된다.',
      '즉 <b>적 처치 → 에너지 → 피스 → 주문서 → 더 센 공격</b>의 순환이다. 이 순환을 빨리 돌릴수록 강해진다.',
    ]},
    { title: '② 보드와 주문서', body: [
      `보드는 ${board.rows}×${board.cols} 칸이다. 꽉 차면 생성기가 멈추니 합칠 수 있는 건 바로 합치자. 생성기를 꾹 누르면 ${gen.holdIntervalSec}초 간격으로 계속 만든다.`,
      `주문서는 ${CONFIG.orderSheet.slotCount}칸이며 한 칸은 항상 재료 1개짜리로 유지된다. 재료는 1~3개이고 많을수록 강화 상한이 높다(Lv.4 / 8 / 12).`,
      `피스를 만들거나 머지할 때마다 주문서 게이지가 1점 오르고, ${og.maxCharge}점마다 새 주문서가 온다. 스킬로 쓴 에너지는 게이지에 들어가지 않는다. 중간보스를 잡으면 ${og.midBossOrders}장을 한 번에 준다.`,
      '미사일은 연쇄(흩어진 적) · 폭발(뭉친 적) · 산탄(가까운 적) · 레이저(직선상의 적) 4종이며 서로 독립적으로 발사된다.',
      ...dopamine,
    ]},
    { title: '③ 스킬', body: [
      `로비에서 고른 ${CONFIG.skillPickCount}종이 전장 오른쪽 아래에 나온다. 쿨타임이 길어 타이밍이 중요하다.`,
      `스킬은 <b>에너지를 쓴다</b>. 각 스킬의 첫 사용은 ${CONFIG.skillEnergy.firstCost}이고, 그 스킬을 쓸 때마다 ${CONFIG.skillEnergy.costStep}씩 올라간다(${[0,1,2,3].map(n=>CONFIG.skillEnergy.firstCost+n*CONFIG.skillEnergy.costStep).join(' → ')} …). 비용은 스킬마다 따로 쌓이고 한 판 동안 내려가지 않는다. 버튼에 다음 비용이 표시된다.`,
      `${SKILL_KEYS.filter(k=>CONFIG.skills[k]?.energyFree).map(k=>`<b>${CONFIG.skills[k].name}</b>`).join(' · ')}은 예외로 에너지를 쓰지 않는다. 대신 쿨타임이 길다.`,
      `전체 ${SKILL_KEYS.length}종이 공격 · 제어(스턴/감속/밀어내기) · 강화 · 회복 · 에너지로 나뉜다. 제어는 보스에게도 걸린다.`,
      '공격 스킬의 피해는 그때까지 쌓은 공격력 강화를 함께 반영한다 — 강화가 붙을수록 스킬도 세진다.',
    ]},
    { title: '④ 적과 WAVE', body: [
      `적은 ${ENEMY_TYPE_KEYS.length}종이다. 핵까지 오는 데 걸리는 시간이 다르고, 빠른 쪽이 체력이 낮다 — ${travel}.`,
      '현재 WAVE의 성격은 <b>전장 왼쪽 위</b>에 항상 떠 있다. 이걸 보고 미리 대응하면 된다.',
      `${ARCHETYPE_LOOP_MIN_STAGE}스테이지부터는 ${loop} 순서를 ${ARCHETYPE_LOOP.length}WAVE 주기로 반복한다. 그 전 스테이지는 성격 구분 없이 진행된다.`,
      'WAVE마다 적 수가 크게 달라 보여도 전체 위협량은 같게 맞춰져 있다 — 탱커는 단단해서 적게 오고, 근접은 약해서 많이 온다.',
      `WAVE는 성격에 따라 ${Math.min(...durations)}~${Math.max(...durations)}초이며, 생존 개체가 ${Math.round(CONFIG.waveTiming.earlyTransitionAlivePct*100)}% 이하로 줄면 바로 다음으로 넘어간다.`,
      '핵의 최대 HP는 편성한 4인의 체력 합계다. 자동 회복은 없으니 회복은 스킬로만 한다.',
    ]},
    { title: '⑤ 로비에서 키우기', body: [
      `스테이지는 ${stageWaves} WAVE로 길어지고 이후는 ${campaignStage(3).waves} WAVE다. 입장에 행동력 ${stamina.entryCost}를 쓰며 ${Math.round(stamina.recoveryMs/60000)}분마다 1씩 최대 ${stamina.staminaMax}까지 찬다.`,
      `수호자 4인과 스킬 ${CONFIG.skillPickCount}종을 미리 편성한다. 레벨은 골드로, 성급은 조각으로 올리며 둘 다 ${CharacterGrowthRules.maxStars}성·${maxLevel}레벨이 상한이다.`,
      `소환은 ${gacha.currencyId==='starfire'?'별불':'골드'} ${gacha.cost}에 결과 ${gacha.resultsPerPull}개이며, 결과마다 수호자 ${gacha.characterWeight}% · 스킬 ${gacha.skillWeight}%로 나온다. 중복은 조각이 된다.`,
      '통과한 WAVE만큼 골드를 받고 마일스톤이 추가 보상을 준다. 새 스테이지를 처음 클리어할 때만 별불이 나온다.',
    ]},
  ],
  tips: [
    '보드 자리를 비워두는 게 최우선이다 — 자리가 없으면 에너지가 있어도 아무것도 못 한다.',
    '주문서는 준비되자마자 쓰지 않아도 된다. 고티어 피스를 더 모아 쓰면 같은 주문서로 더 높은 레벨을 얻는다.',
    '전장 왼쪽 위 WAVE 성격을 보고 광역기를 아껴두자. 돌격은 한꺼번에 도달하고 물량은 계속 밀려온다.',
    '보스는 체력이 크고 한 기만 나온다 — 광역보다 단일 화력이 잘 통한다.',
  ],
  };
}
const ManualPanel = {
  build(){
    const panel = $('#manual-panel');
    // [2026-09-17] 설명서 문구는 CONFIG에서 수치를 읽어 렌더 시점에 만든다. 밸런스 수치를 바꿔도
    // 설명서가 따로 낡지 않으며, 확률이 0인 기능(크리티컬 머지·골든 피스)은 문장 자체가 빠진다.
    const GAME_MANUAL = buildGameManual();
    panel.innerHTML = `
      <h2>❓ 게임 설명서</h2>
      <div class="note">${GAME_MANUAL.intro}</div>
      ${GAME_MANUAL.sections.map(sec=>`
        <div class="doc-section">
          <h3>${sec.title}</h3>
          <ul>${sec.body.map(t=>`<li>${t}</li>`).join('')}</ul>
        </div>
      `).join('')}
      <div class="doc-rules">
        <h3>💡 실전 팁</h3>
        <ul>${GAME_MANUAL.tips.map(t=>`<li>${t}</li>`).join('')}</ul>
      </div>
      <div class="editor-buttons">
        <button id="close-manual-btn">닫기</button>
      </div>
    `;
    $('#close-manual-btn').onclick = ()=>panel.classList.remove('open');
  },
};

/* =====================================================================
   [TutorialSystem] 스테이지 1 최초 입장 — 실제 행동에 반응하는 4단계 안내
   ===================================================================== */
class TutorialSystem {
  constructor(game){
    this.game=game;
    this.active=false;
    this.step='';
    this.focused=[];
    document.querySelectorAll('.tutorial-focus').forEach(el=>el.classList.remove('tutorial-focus'));
    const layer=$('#tutorial-layer');
    if(layer) layer.hidden=true;
    const skip=$('#tutorial-skip');
    if(skip) skip.onclick=()=>this.complete(true);
  }
  start(){
    if(this.game.stageId!==1 || this.game.host.tutorialDone()) return;
    this.active=true;
    this.setStep('energy');
  }
  data(){
    return {
      energy:{index:'1 / 4',title:'에너지로 피스를 만드세요',body:`생성기를 누르면 에너지 ${CONFIG.generator.costPerPiece}을 사용해 피스가 생성됩니다.\n적을 처치해 ${CONFIG.scoring.pointsPerGrant}점을 채우면 에너지 ${CONFIG.scoring.energyPerGrant}을 받습니다.`,targets:['#energy-status-row','#generator-btn'],anchor:'#generator-btn'},
      order:{index:'2 / 4',title:'주문서에 필요한 피스를 모으세요',body:'주문서에 표시된 색의 피스를 보드에 준비하세요.\n같은 색과 같은 티어의 피스는 합칠 수 있습니다.',targets:['#order-sheet-panel','#board'],anchor:'#order-sheet-panel'},
      ready:{index:'3 / 4',title:'주문서를 완성하세요',body:'조건이 충족되었습니다.\n빛나는 주문서를 누르면 영웅이 소환됩니다.\n같은 미사일의 다음 주문서는 영웅을 강화합니다.',targets:['.order-card.ready'],anchor:'.order-card.ready'},
      skill:{index:'4 / 4',title:'스킬은 에너지를 쓰고 쿨타임이 흐릅니다',body:`로비에서 장착한 스킬입니다. 버튼에 표시된 에너지를 소모하며, 같은 스킬을 쓸수록 비용이 ${CONFIG.skillEnergy.costStep}씩 올라갑니다.`,targets:['#skill-row'],anchor:'#skill-row'},
    }[this.step];
  }
  setStep(step){
    if(!this.active) return;
    this.step=step;
    Analytics.track('tutorial_step',{step,skipped:0});
    this.render();
  }
  clearFocus(){
    this.focused.forEach(el=>el.classList.remove('tutorial-focus'));
    this.focused=[];
  }
  render(){
    const layer=$('#tutorial-layer'),card=$('#tutorial-card'),d=this.data();
    if(!layer||!card||!d) return;
    this.clearFocus();
    d.targets.forEach(selector=>document.querySelectorAll(selector).forEach(el=>{
      el.classList.add('tutorial-focus');this.focused.push(el);
    }));
    $('#tutorial-step').textContent=`튜토리얼 ${d.index}`;
    $('#tutorial-title').textContent=d.title;
    $('#tutorial-body').textContent=d.body;
    layer.hidden=false;
    requestAnimationFrame(()=>this.placeCard(document.querySelector(d.anchor)));
  }
  placeCard(target){
    const card=$('#tutorial-card');
    if(!card) return;
    const margin=10,viewW=window.innerWidth,viewH=window.innerHeight;
    const r=target?.getBoundingClientRect?.();
    const cardW=card.offsetWidth,cardH=card.offsetHeight;
    let left=r ? clamp(r.left+r.width/2-cardW/2,12,viewW-cardW-12) : (viewW-cardW)/2;
    let top=r && r.top-cardH-margin>=8 ? r.top-cardH-margin : r ? r.bottom+margin : (viewH-cardH)/2;
    top=clamp(top,8,viewH-cardH-8);
    card.style.left=`${Math.round(left)}px`;
    card.style.top=`${Math.round(top)}px`;
  }
  hasReadyOrder(){
    return this.game.orderSheetSystem.slots.some(slot=>slot&&this.game.orderSheetSystem.preview(slot).ready);
  }
  onGenerated(){
    if(!this.active) return;
    if(this.step==='energy'){
      this.setStep('order');
      setTimeout(()=>this.checkOrderReady(),500);
    } else this.checkOrderReady();
  }
  onBoardChanged(){ this.checkOrderReady(); }
  checkOrderReady(){
    if(this.active&&this.step==='order'&&this.hasReadyOrder()) this.setStep('ready');
  }
  onOrderCompleted(){
    if(this.active&&this.step==='ready') this.setStep('skill');
  }
  onSkillUsed(){
    if(this.active&&this.step==='skill') this.complete(false);
  }
  complete(skipped=false){
    if(!this.active) return;
    this.active=false;
    this.clearFocus();
    const layer=$('#tutorial-layer');
    if(layer) layer.hidden=true;
    this.game.host.completeTutorial();
    Analytics.track('tutorial_step',{step:'done',skipped:skipped?1:0});
    if(!skipped) logAction('튜토리얼 완료!');
  }
}

