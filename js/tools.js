/* ===== tools.js ===== */
/* =====================================================================
   [replaceObjectContents] 설정 객체를 다른 설정 값으로 치환한다.
   [2026-09-19 세션 7] 유일한 호출부였던 Campaign.resetData()를 걷어내면서 지금은
   부르는 곳이 없다. 아래 밸런스 에디터를 다시 붙일 자리라 남겨 둔다.
   [2026-09-18] 확정(인철): balance-editor.html을 지우고 순수 빌드 상태로 되돌렸다.
   밸런스 에디터는 나중에 별도 빌드 에디터로 다시 만든다 — 그때 붙일 자리가
   이 함수와 config.js의 CONFIG/FACTORY_DEFAULT_CONFIG/cloneConfig다.
   ===================================================================== */
function replaceObjectContents(target,source){
  Object.keys(target).forEach(key=>delete target[key]);
  Object.assign(target,cloneConfig(source));
}
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
  /* [2026-09-18 세션 3B] 문구는 문자열 테이블에 있고 여기에는 키와 자리표시자 값만 둔다.
     CONFIG 수치를 문장에 박지 않으므로 밸런스를 바꿔도 안내가 따로 낡지 않는다. */
  data(){
    return {
      energy:{index:'1 / 4',titleKey:'tutorial.energy.title',bodyKey:'tutorial.energy.body',params:{cost:CONFIG.generator.costPerPiece,points:CONFIG.scoring.pointsPerGrant,energy:CONFIG.scoring.energyPerGrant},targets:['#energy-status-row','#generator-btn'],anchor:'#generator-btn'},
      order:{index:'2 / 4',titleKey:'tutorial.order.title',bodyKey:'tutorial.order.body',targets:['#order-sheet-panel','#board'],anchor:'#order-sheet-panel'},
      ready:{index:'3 / 4',titleKey:'tutorial.ready.title',bodyKey:'tutorial.ready.body',targets:['.order-card.ready'],anchor:'.order-card.ready'},
      skill:{index:'4 / 4',titleKey:'tutorial.skill.title',bodyKey:'tutorial.skill.body',params:{step:CONFIG.skillEnergy.costStep},targets:['#skill-row'],anchor:'#skill-row'},
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
    $('#tutorial-step').textContent=t('tutorial.step',{index:d.index});
    $('#tutorial-title').textContent=t(d.titleKey);
    $('#tutorial-body').textContent=t(d.bodyKey,d.params);
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

