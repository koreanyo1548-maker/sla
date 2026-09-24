/* [2026-09-24] Shared vector art and player-facing presentation.
   This layer reads game state; damage, rewards and progression stay in their systems. */
Object.assign(GameArt.icons,{
  music:'<path d="M9 17V5l11-2v12M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',
  pause:'<path d="M8 5v14M16 5v14" stroke-width="4"/>',
  play:'<path d="m8 4 12 8-12 8z" fill="currentColor" stroke="none"/>',
  forge:'<path d="m4 8 3-5h10l3 5-5 5v6h4v2H5v-2h4v-6z"/><path d="M4 8h16M9 13h6"/>',
  hand:'<path d="M9 11V4a2 2 0 0 1 4 0v7-3a2 2 0 0 1 3 0v3-1a2 2 0 0 1 3 0v3-1a2 2 0 0 1 3 0v4c0 4-3 6-7 6h-2c-2 0-3-1-4-3l-4-5a2 2 0 0 1 3-2l1 1z"/>',
  skill_strong_single:'<path d="m4 20 9-9M10 8l8-5 3 3-5 8zM8 14l3 3"/><path d="m5 5 2 2M15 19l2 2"/>',
  skill_aoe:'<path d="M4 20h16M7 16l4-9 3 2 4-6M9 3l-4 7 3 1-3 5M15 14l4-3 2 3-2 3"/>',
  skill_defense:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>',
  skill_heal:'<path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5z"/><path d="m3 3 1 1M20 20l1 1"/>',
  skill_energy_surge:'<path d="m13 2-8 11h6l-1 9 9-13h-7zM3 7H1M23 17h-2"/>',
  skill_attack_buff:'<path d="m4 20 13-16 4-1-1 4L7 20M3 16l5 5M4 3l6 7M14 15l6 6M16 21l5-5"/>',
  skill_defense_buff:'<path d="m12 2 9 4v7c0 4-9 9-9 9s-9-5-9-9V6zM12 6v12M7 10h10"/>',
  skill_stun:'<path d="m12 2 2 6 6-3-3 6 5 2-6 2 2 6-6-4-5 4 1-6-6-2 6-2-3-6 6 3z"/>',
  skill_slow:'<path d="M12 2v20M3 7l18 10M3 17 21 7M8 4l4 3 4-3M8 20l4-3 4 3M3 11l4-2V5M17 19v-4l4-2"/>',
  skill_knockback:'<path d="M3 6h9l-3-3M3 12h18l-4-4M3 18h9l-3 3M17 16l4-4"/>',
  skill_regen:'<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5M12 8v8M8 12h8"/>',
});
GameArt.skill=function(key,cls=''){
  return `<span class="skill-art ${cls}" style="--skill-ink:${SKILL_DEFS[key]?.color||'#DDB86A'}">${this.icon('skill_'+key)}</span>`;
};
GameArt.piece=function(piece){
  const tier=clamp(piece.tier+1,1,CONFIG.colors.maxTier);
  return `<span class="piece-setting">${this.sprite(CONFIG.colors.names.indexOf(piece.color))}</span><span class="piece-rank" aria-hidden="true">${Array.from({length:tier},()=>'<i></i>').join('')}</span><div class="tier">${tier}</div>`;
};

const GamePresentation={
  init(){
    document.querySelectorAll('[data-ui-icon]').forEach(el=>el.innerHTML=GameArt.icon(el.dataset.uiIcon));
    document.getElementById('pause-button').onclick=()=>RunHost.current?.setPause('manual',true);
    document.getElementById('resume-button').onclick=()=>{
      const game=RunHost.current;if(!game)return;
      game.setPause('manual',false);game.setPause('resume',false);GameAudio.unlock();
    };
    document.getElementById('pause-options').onclick=()=>OptionsUI.open();
    document.getElementById('pause-layer').onkeydown=event=>{
      if(event.key==='Escape'){event.preventDefault();document.getElementById('resume-button').click();}
      if(event.key==='Tab'){
        event.preventDefault();
        const resume=document.getElementById('resume-button'),options=document.getElementById('pause-options');
        (document.activeElement===resume?options:resume).focus();
      }
    };
    document.getElementById('result-upgrade').onclick=()=>{
      if(Campaign.broken||Campaign.state.active)return;
      Campaign.showLobby();Campaign.navigate('upgrade');
    };
    this.rotationQuery=matchMedia('(max-height:500px) and (orientation:landscape) and (pointer:coarse)');
    const rotation=()=>this.syncEnvironment();
    this.rotationQuery.addEventListener?.('change',rotation);
    document.addEventListener('visibilitychange',rotation);
    window.addEventListener('resize',()=>{
      const tutorial=RunHost.current?.tutorial;
      if(tutorial?.active)tutorial.positionGuide();
    });
    document.addEventListener('keydown',event=>{
      if(event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,textarea,select,[contenteditable]'))return;
      const game=RunHost.current;if(!game?.running||game.ending)return;
      if(!document.getElementById('options-panel').hidden||!document.getElementById('order-detail').hidden)return;
      if(event.code==='KeyP'){
        event.preventDefault();
        if(game.paused){game.setPause('manual',false);game.setPause('resume',false);}
        else game.setPause('manual',true);
      }
      if(!game.paused&&['Digit1','Digit2'].includes(event.code)){
        const key=RunConfig.selectedSkills[Number(event.code.slice(-1))-1];
        if(key&&game.skillSystem.activate(key)){GameAudio.play('skill_use');this.skillCast(key);}
      }
    });
    // Critical art has a visible loading state; errors/timeouts never trap the player.
    const loading=document.getElementById('boot-screen'),bar=document.getElementById('boot-progress');
    const images=['forge_lobby','battlefield','battle_sprites'].map(key=>GameArt.images[key]).filter(Boolean);
    let ready=0,closed=false;
    const finish=()=>{if(closed)return;closed=true;loading.hidden=true;document.getElementById('app').removeAttribute('aria-busy');};
    const fallback=setTimeout(finish,7000);
    Promise.all(images.map(img=>new Promise(resolve=>{
      const done=()=>{ready++;bar.style.width=(ready/images.length*100)+'%';resolve();};
      if(img.complete)done();else{img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});}
    }))).then(()=>{clearTimeout(fallback);finish();});
  },
  syncEnvironment(){
    const game=RunHost.current;if(!game?.running||game.ending)return;
    const rotated=!!this.rotationQuery?.matches,hidden=document.hidden;
    if(rotated||hidden)game.setPause('resume',true);
    game.setPause('rotation',rotated);game.setPause('background',hidden);
  },
  renderPause(game){
    const paused=game.paused,app=document.getElementById('app');
    app.dataset.paused=String(paused);
    for(const id of ['board-wrap','skill-row'])document.getElementById(id).inert=paused;
    const panel=document.getElementById('pause-layer');
    const show=paused&&(game.pauseReasons.has('manual')||game.pauseReasons.has('resume'))
      &&document.getElementById('options-panel').hidden&&document.getElementById('order-detail').hidden&&!this.rotationQuery?.matches;
    const opening=panel.hidden&&show;panel.hidden=!show;
    if(opening)document.getElementById('resume-button').focus();
    if(!paused)game.tutorial?.positionGuide();
    else game.tutorial?.clearFocus();
  },
  resetPause(){
    document.getElementById('pause-layer').hidden=true;
    document.getElementById('app').dataset.paused='false';
    for(const id of ['board-wrap','skill-row'])document.getElementById(id).inert=false;
  },
  start(game){
    this.resetPause();this.syncEnvironment();
    const waves=RunConfig.waves();
    document.getElementById('wave-track').innerHTML='<span id="wave-track-fill"></span>'+
      waves.filter(w=>w.type!=='normal').map(w=>`<i style="left:${Math.min(98,(w.wave-1)/waves.length*100)}%" class="${w.type==='finalboss'?'final':''}"></i>`).join('');
    this.wave(game);this.boardHint(game);
  },
  wave(game){
    const track=document.getElementById('wave-track'),fill=document.getElementById('wave-track-fill');
    const current=game.currentWaveCfg?.wave||1,total=RunConfig.waves().length;
    if(fill)fill.style.width=((current-1)/total*100)+'%';
    track.setAttribute('aria-valuenow',current);track.setAttribute('aria-valuemax',total);
  },
  boardHint(game){
    const hint=document.getElementById('forge-hint');if(!hint)return;
    let key='polish.board.hint';
    if(!game.mergeBoard.emptyIndices().length)key=game.mergeBoard.hasMergePair()?'polish.board.full':'polish.board.spend';
    else if(game.energy<CONFIG.generator.costPerPiece)key='polish.board.energy';
    else if(game.orderSheetSystem.slots.some(slot=>slot&&game.orderSheetSystem.preview(slot).ready))key='polish.board.ready';
    hint.textContent=t(key);hint.dataset.state=key.split('.').at(-1);
  },
  skillCast(key){
    const flash=document.getElementById('skill-flash'),name=document.getElementById('skill-announcement');
    if(!flash||!name)return;
    flash.style.setProperty('--cast-color',SKILL_DEFS[key].color);restartCssAnimation(flash,'is-casting');
    name.innerHTML=GameArt.skill(key)+`<span>${t(SKILL_DEFS[key].nameKey)}</span>`;
    restartCssAnimation(name,'is-casting');
  },
};
