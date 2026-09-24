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
/* [2026-09-24] First-run guided forge: two generated pieces → one manual merge
   → an order → a skill. Combat waits during the first three actions. The short
   skill lesson uses CONFIG.onboarding.skillTimeScale, then normal time resumes.
   No save/economy schema changes; the existing tutorialCompleted flag is used. */
class TutorialSystem {
  constructor(game){
    this.game=game;this.active=false;this.step='';this.focused=[];this.generated=0;
    document.querySelectorAll('.tutorial-focus').forEach(el=>el.classList.remove('tutorial-focus'));
    $('#tutorial-layer').hidden=true;
    $('#tutorial-skip').onclick=()=>this.complete(true);
  }
  start(){
    if(this.game.stageId!==1||this.game.host.tutorialDone())return;
    const slot=this.game.orderSheetSystem.slots[0];
    if(!slot)return;
    this.practiceColor=slot.requirements[0].color;
    // The first order retains its missile/stat; only this guided lesson uses one material.
    slot.requirements=[{color:this.practiceColor,need:1,role:'designated'}];slot.grade=1;
    this.active=true;this.generated=0;this.mergeStart=this.game.stats.merges;this.setStep('energy');
  }
  allows(action){
    if(!this.active||this.step==='skill')return true;
    if(this.step==='energy')return action==='generate';
    if(this.step==='merge')return action==='board';
    return this.step==='order'&&action==='order';
  }
  holdsCombat(){return this.active&&this.step!=='skill';}
  practicePiece(){
    if(!this.active||this.step!=='energy'||this.generated>=CONFIG.onboarding.practicePieces)return null;
    return {type:'color',color:this.practiceColor,tier:0,golden:false};
  }
  setStep(step){
    this.game.generator.stopHold();this.step=step;
    Analytics.track('tutorial_step',{step,skipped:0});this.render();
  }
  clearFocus(){this.focused.forEach(el=>el.classList.remove('tutorial-focus'));this.focused=[];}
  render(){
    if(!this.active)return;
    this.game.updateEnergyUi();this.game.orderSheetSystem.render();this.clearFocus();
    const steps=['energy','merge','order','skill'],index=steps.indexOf(this.step);
    $('#tutorial-step').textContent=t('tutorial.step',{index:`${index+1} / ${steps.length}`});
    $('#tutorial-title').textContent=t('polish.tutorial.'+this.step+'.title');
    $('#tutorial-body').textContent=t('polish.tutorial.'+this.step+'.body',{n:CONFIG.onboarding.practicePieces});
    $('#tutorial-dots').innerHTML=steps.map((_,i)=>`<i class="${i<=index?'lit':''}"></i>`).join('');
    $('#tutorial-layer').hidden=false;
    this.positionGuide();
  }
  positionGuide(){
    if(!this.active)return;
    this.clearFocus();
    let target=null,from=null,to=null;
    if(this.step==='energy')target=$('#generator-btn');
    if(this.step==='merge'){
      const pair=this.game.mergeBoard.findMergePair();
      if(pair){from=this.game.mergeBoard.cellEls[pair[0]];to=this.game.mergeBoard.cellEls[pair[1]];target=from;this.focus(to);}
    }
    if(this.step==='order')target=$('.order-card[data-slot="0"] .oc-apply');
    if(this.step==='skill')target=$('.skill-btn:not(:disabled)');
    if(target)this.focus(target);
    const card=$('#tutorial-card'),wrap=$('#combat-wrap').getBoundingClientRect();
    const width=card.offsetWidth||280,height=card.offsetHeight||140;
    card.style.left=Math.round(clamp(wrap.left+(wrap.width-width)/2,8,innerWidth-width-8))+'px';
    const targetTop=target?.getBoundingClientRect().top??innerHeight;
    const preferredTop=Math.min(wrap.top+18,targetTop-height-14);
    card.style.top=Math.round(clamp(preferredTop,8,Math.max(8,innerHeight-height-8)))+'px';
    const guide=$('#tutorial-guide');guide.hidden=!target;
    if(!target)return;
    const rect=target.getBoundingClientRect(),dest=to?.getBoundingClientRect();
    guide.innerHTML=GameArt.icon('hand');guide.dataset.motion=from?'merge':'tap';
    guide.style.left=rect.left+rect.width*.55+'px';guide.style.top=rect.top+rect.height*.6+'px';
    guide.style.setProperty('--guide-dx',dest?dest.left+dest.width/2-rect.left-rect.width/2+'px':'0px');
    guide.style.setProperty('--guide-dy',dest?dest.top+dest.height/2-rect.top-rect.height/2+'px':'0px');
  }
  focus(el){if(el){el.classList.add('tutorial-focus');this.focused.push(el);}}
  onGenerated(){
    if(!this.active)return;
    if(this.step==='energy'&&++this.generated>=CONFIG.onboarding.practicePieces)this.setStep('merge');
  }
  onBoardChanged(){
    if(!this.active)return;
    if(this.step==='merge'&&this.game.stats.merges>this.mergeStart)this.setStep('order');
    else this.positionGuide();
  }
  onOrderCompleted(){if(this.active&&this.step==='order')this.setStep('skill');}
  onSkillUsed(){if(this.active&&this.step==='skill')this.complete(false);}
  update(){
    if(!this.active||this.step!=='skill')return;
    // Only move the hand when a different skill becomes usable, not every frame.
    const key=$('.skill-btn:not(:disabled)')?.dataset.skill||'';
    if(key!==this.readyKey){this.readyKey=key;this.positionGuide();}
  }
  stop(){
    this.active=false;this.clearFocus();$('#tutorial-layer').hidden=true;$('#tutorial-guide').hidden=true;
  }
  complete(skipped=false){
    if(!this.active)return;
    this.stop();this.game.host.completeTutorial();
    this.game.updateEnergyUi();this.game.orderSheetSystem.render();
    Analytics.track('tutorial_step',{step:'done',skipped:skipped?1:0});
  }
}
