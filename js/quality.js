/* ===== quality.js =====
   Presentation and input for the 2026-09-24 quality pass. Economy, stage curves,
   save format, combat coordinates and reward rules remain owned by their systems. */
const QualityUI={
  lastHint:'',
  init(){
    $('#loading-retry').onclick=()=>location.reload();
    $('[data-open-upgrade]').onclick=()=>Campaign.navigate('upgrade');
    document.addEventListener('visibilitychange',()=>{
      RunHost.current?.setPaused('visibility',document.hidden);
    });
    window.addEventListener('blur',()=>RunHost.current?.setPaused('focus',true));
    window.addEventListener('focus',()=>RunHost.current?.setPaused('focus',false));
    // Letter shortcuts still work after clicking a button. Space on a focused
    // button or board cell keeps its native accessible activation.
    document.addEventListener('keydown',event=>{
      const game=RunHost.current;
      if(GameState.current!=='playing'||!game?.running||game.ending||game.paused||event.repeat||event.altKey||event.ctrlKey||event.metaKey)return;
      if(event.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
      const key=event.key.toLowerCase();
      if(key===' '&&event.target.closest?.('button,[role="button"]'))return;
      if(![' ','m','q','e'].includes(key))return;
      event.preventDefault();GameAudio.unlock();
      if(key===' ')game.generator.startHold();
      else if(key==='m')game.batchMergeSystem.activate();
      else{
        const skill=RunConfig.selectedSkills[key==='q'?0:1];
        if(skill)document.querySelector(`[data-skill="${skill}"]`)?.click();
      }
    });
    document.addEventListener('keyup',event=>{if(event.key===' ')RunHost.holdStop();});
    // A keyboard can also activate the generator directly after tabbing to it.
    $('#generator-btn').addEventListener('keydown',event=>{
      if(event.key===' '||event.key==='Enter'){event.preventDefault();if(!event.repeat)RunHost.holdStart();}
    });
    $('#generator-btn').addEventListener('keyup',event=>{
      if(event.key===' '||event.key==='Enter'){event.preventDefault();RunHost.holdStop();}
    });
    $('#generator-btn').addEventListener('blur',()=>RunHost.holdStop());
  },
  assetsLoaded(ok){
    const loader=$('#asset-loader');
    if(ok){loader.hidden=true;return;}
    $('#loading-message').textContent=t('quality.loadError');
    $('#loading-retry').hidden=false;
  },
  lobby(campaign){
    const stage=campaign.selectedStage;
    const first=Math.max(1,stage-2);
    $('#journey-progress').innerHTML=Array.from({length:5},(_,i)=>{
      const n=first+i,done=campaign.state.cleared.includes(n);
      return `<span class="journey-node${n===stage?' current':''}${done?' done':''}"${n===stage?' aria-current="step"':''}>${done?'✓':String(n).padStart(2,'0')}</span>`;
    }).join('');
    $('#journey-progress').setAttribute('aria-label',t('quality.chapterAria',{n:stage}));
    const tracks=LEVEL_TRACKS.map(track=>({track,level:LevelTrackSystem.level(campaign.state,track.trackId)}))
      .filter(x=>LevelTrackSystem.allowed(x.level)).sort((a,b)=>a.level-b.level);
    const next=tracks[0],el=$('#growth-objective');
    let title=t('quality.growthMax'),detail=t('quality.openGrowth');
    if(next){
      const cost=LevelTrackSystem.cost(next.level),short=Math.max(0,cost-campaign.state.gold);
      title=UpgradeLobbyUI.trackName(campaign.state,next.track);
      detail=short?t('quality.growthNeed',{gold:I18N.num(short)}):t('quality.growthReady',{name:title});
      el.classList.toggle('ready',short===0);
    }else el.classList.remove('ready');
    el.innerHTML=`<span class="objective-icon">${GameArt.icon('forge')}</span><span><small>${t('quality.growth')}</small><b>${detail}</b></span><span class="objective-arrow" aria-hidden="true">›</span>`;
  },
  battle(game){
    const ready=game.orderSheetSystem.slots.some(slot=>slot&&game.orderSheetSystem.preview(slot).ready);
    const full=game.mergeBoard.emptyIndices().length===0;
    const key=ready?'quality.readyOrders':full?(game.mergeBoard.hasMergePair()?'quality.fullMerge':'quality.fullOrder'):
      game.energy<CONFIG.generator.costPerPiece?'quality.waitEnergy':'quality.holdHint';
    if(this.lastHint===key)return;
    this.lastHint=key;
    $('#forge-hint').textContent=t(key);
    $('#forge-hint').classList.toggle('ready',ready);
  },
  tutorial(step){
    const gem=i=>GameArt.sprite(i,'tutorial-gem');
    const views={
      energy:`<span class="tutorial-tap">${GameArt.icon('forge')}</span><i>→</i>${gem(0)}${gem(1)}`,
      order:`${gem(1)}<i>+</i>${gem(1)}<i>→</i><span class="tutorial-merged">${gem(1)}<b>2</b></span>`,
      ready:`${gem(0)}${gem(1)}<i>→</i><span class="tutorial-tap">${GameArt.icon('heroes')}</span>`,
      skill:`${GameArt.skill(RunConfig.selectedSkills[0])}<i>→</i>${GameArt.icon('burst')}`,
    };
    $('#tutorial-visual').innerHTML=views[step]||'';
  },
};
