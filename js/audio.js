/* [2026-09-24] Original Web Audio score and game sounds.
   No downloads or third-party music. Audio starts only after a user gesture.
   Preferences stay separate from campaign saves; voices and impact rates are capped. */
const SOUND_PREF_KEY='slagma.sound';
const GameAudio={
  enabled:true,musicEnabled:true,context:null,scene:'lobby',voices:0,
  sfxVolume:.65,musicVolume:.32,lastSounds:new Map(),musicStep:0,musicTimer:null,
  init(){
    try{
      this.enabled=SaveStorage.load(SOUND_PREF_KEY)!=='off';
      this.musicEnabled=SaveStorage.load('slagma.music')!=='off';
      for(const [field,key] of [['sfxVolume','slagma.sfxVolume'],['musicVolume','slagma.musicVolume']]){
        const raw=SaveStorage.load(key),value=Number(raw);
        if(raw!==null&&raw!==undefined&&Number.isFinite(value))this[field]=clamp(value,0,1);
      }
    }catch(_){}
    const unlock=()=>this.unlock();
    document.addEventListener('pointerdown',unlock,{passive:true});
    document.addEventListener('keydown',unlock);
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){this.stopMusic();this.context?.suspend().catch(()=>{});}
      // Resuming audio is left to the player's next gesture, including Resume.
    });
    document.getElementById('music-toggle')?.addEventListener('click',()=>this.toggleMusic());
    for(const [id,field] of [['sfx-volume','sfxVolume'],['music-volume','musicVolume']]){
      document.getElementById(id)?.addEventListener('input',event=>this.setVolume(field,Number(event.target.value)/100));
    }
    this.render();
  },
  unlock(){
    if(document.hidden||(!this.enabled&&!this.musicEnabled))return;
    try{
      if(!this.context){
        const Audio=window.AudioContext||window.webkitAudioContext;
        if(!Audio)return;
        const ctx=this.context=new Audio();
        this.sfx=ctx.createGain();this.music=ctx.createGain();
        const compressor=ctx.createDynamicsCompressor();
        compressor.threshold.value=-16;compressor.knee.value=16;compressor.ratio.value=5;
        compressor.attack.value=.004;compressor.release.value=.18;
        this.sfx.connect(compressor);this.music.connect(compressor);compressor.connect(ctx.destination);
        const noise=ctx.createBuffer(1,ctx.sampleRate*.5,ctx.sampleRate),data=noise.getChannelData(0);
        for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
        this.noise=noise;
        this.applyLevels();
      }
      if(this.context.state==='suspended')this.context.resume().then(()=>this.startMusic()).catch(()=>{});
      else this.startMusic();
    }catch(_){}
  },
  save(key,value){try{SaveStorage.save(key,value);}catch(_){}},
  toggle(){
    this.enabled=!this.enabled;this.save(SOUND_PREF_KEY,this.enabled?'on':'off');
    this.unlock();this.applyLevels();this.render();this.play('tap');
  },
  toggleMusic(){
    this.musicEnabled=!this.musicEnabled;this.save('slagma.music',this.musicEnabled?'on':'off');
    if(this.musicEnabled)this.unlock();else this.stopMusic();
    this.applyLevels();this.render();
  },
  setVolume(field,value){
    if(!['sfxVolume','musicVolume'].includes(field))return;
    this[field]=clamp(value,0,1);this.save('slagma.'+field,String(this[field]));
    this.applyLevels();this.render();
  },
  applyLevels(){
    if(!this.context)return;
    this.sfx.gain.setTargetAtTime(this.enabled?this.sfxVolume*.7:0,this.context.currentTime,.04);
    this.music.gain.setTargetAtTime(this.musicEnabled?this.musicVolume*.34:0,this.context.currentTime,.08);
  },
  render(){
    for(const [id,on,key,icon] of [['sound-toggle',this.enabled,'polish.audio.sfx','sound'],['music-toggle',this.musicEnabled,'polish.audio.music','music']]){
      const button=document.getElementById(id);if(!button)continue;
      button.setAttribute('aria-pressed',String(on));button.classList.toggle('muted',!on);
      button.innerHTML=`<span class="sound-option-label">${GameArt.icon(icon)}<span>${t(key)}</span></span><strong>${t(on?'polish.on':'polish.off')}</strong>`;
    }
    for(const [id,field] of [['sfx-volume','sfxVolume'],['music-volume','musicVolume']]){
      const slider=document.getElementById(id),output=document.getElementById(id+'-value');
      const value=Math.round(this[field]*100);
      if(slider)slider.value=value;if(output)output.textContent=value+'%';
    }
  },
  setScene(scene){
    if(scene===this.scene)return;
    this.scene=scene;this.musicStep=0;this.stopMusic();this.startMusic();
  },
  tone(frequency,{type='sine',duration=.18,volume=.1,delay=0,end=frequency,bus='sfx'}={}){
    const ctx=this.context;if(!ctx||ctx.state!=='running'||this.voices>=40)return;
    const start=ctx.currentTime+delay,osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type=type;osc.frequency.setValueAtTime(Math.max(20,frequency),start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),start+duration);
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+.012);
    gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    osc.connect(gain);gain.connect(this[bus]);this.voices++;
    osc.onended=()=>{osc.disconnect();gain.disconnect();this.voices--;};
    osc.start(start);osc.stop(start+duration+.02);
  },
  hiss({duration=.12,volume=.12,frequency=1800,type='bandpass',delay=0}={}){
    const ctx=this.context;if(!ctx||ctx.state!=='running'||!this.noise||this.voices>=40)return;
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),start=ctx.currentTime+delay;
    source.buffer=this.noise;filter.type=type;filter.frequency.value=frequency;filter.Q.value=.7;
    gain.gain.setValueAtTime(volume,start);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    source.connect(filter);filter.connect(gain);gain.connect(this.sfx);this.voices++;
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();this.voices--;};
    source.start(start);source.stop(start+duration);
  },
  chime(notes,{duration=.28,step=.075,volume=.11,type='sine'}={}){
    notes.forEach((frequency,i)=>this.tone(frequency,{type,duration,volume,delay:i*step}));
  },
  play(kind='tap',detail={}){
    if(!this.enabled||document.hidden)return;
    if(!this.context||this.context.state!=='running')return;
    const now=performance.now(),impact=kind.startsWith('hit_');
    const gap=impact?70:kind==='kill'?110:kind==='core_hit'?180:kind==='generate'?65:40;
    if(now-(this.lastSounds.get(kind)??-Infinity)<gap)return;
    if(impact&&now-(this.lastImpact??-Infinity)<35)return;
    this.lastSounds.set(kind,now);if(impact)this.lastImpact=now;
    const n=(frequency,options)=>this.tone(frequency,options);
    switch(kind){
      case 'tap':n(630,{end:450,duration:.055,volume:.07});break;
      case 'generate':n(360,{end:650,duration:.09,volume:.065});n(960,{delay:.025,duration:.09,volume:.025});break;
      case 'merge':{
        const pitch=330*Math.pow(2,Math.min(4,detail.tier||1)/6);
        this.chime([pitch,pitch*1.25,pitch*1.5],{duration:.22,step:.045,volume:.1});break;
      }
      case 'hit_basic':n(260,{end:115,duration:.07,volume:.06});break;
      case 'hit_chain':this.hiss({duration:.07,frequency:3600,volume:.13});n(980,{end:380,duration:.07,volume:.045});break;
      case 'hit_explosion':this.hiss({duration:.21,frequency:550,type:'lowpass',volume:.29});n(115,{end:38,duration:.25,volume:.25});break;
      case 'hit_scatter':this.hiss({duration:.065,frequency:1800,volume:.18});n(180,{end:75,duration:.06,volume:.1});break;
      case 'hit_laser':n(900,{type:'triangle',end:180,duration:.12,volume:.08});break;
      case 'kill':n(430,{end:180,duration:.09,volume:.04});break;
      case 'kill_boss':this.hiss({duration:.4,frequency:420,type:'lowpass',volume:.28});this.chime([196,294,392,587],{step:.07,volume:.16,duration:.5});break;
      case 'core_hit':n(90,{end:42,duration:.2,volume:.22});this.hiss({frequency:700,duration:.1,volume:.11});break;
      case 'core_low':this.chime([220,165,220],{duration:.3,step:.18,volume:.12,type:'triangle'});break;
      case 'skill_use':n(180,{type:'triangle',end:960,duration:.2,volume:.11});this.chime([587,880,1175],{delay:0,step:.055,volume:.08});break;
      case 'boss_alert':this.chime([147,139,147],{type:'triangle',duration:.5,step:.2,volume:.14});break;
      case 'defeat':this.chime([392,330,262,196],{duration:.6,step:.18,volume:.13});break;
      case 'clear':this.chime([392,494,587,784,988,1175],{duration:.5,step:.12,volume:.13});break;
      case 'order_complete':this.chime([392,587,784],{duration:.35,step:.065,volume:.14});this.hiss({duration:.08,frequency:3500,volume:.065});break;
      case 'wave_clear':this.chime([523,659],{duration:.24,step:.075,volume:.08});break;
      case 'star_up':case 'passive_unlock':case 'stage_unlock':case 'reveal':this.chime([392,494,587,784],{duration:.4,step:.095,volume:.13});break;
      case 'new_best':case 'level_up':case 'up':this.chime([440,554,659],{duration:.3,step:.06,volume:.11});break;
    }
  },
  /* A sparse original pentatonic forge theme. Battle adds a soft bass pulse.
     A single timer schedules one beat; hidden tabs never accumulate a backlog. */
  startMusic(){
    if(this.musicTimer||!this.musicEnabled||!this.context||this.context.state!=='running'||document.hidden)return;
    const tick=()=>{
      if(document.hidden||!this.musicEnabled||this.context.state!=='running'){this.stopMusic();return;}
      const battle=this.scene==='battle',i=this.musicStep++%32;
      const melody=[0,null,7,12,10,null,7,null,3,null,7,10,7,null,3,null,5,null,12,14,12,null,7,null,3,5,7,null,2,null,0,null];
      const roots=[0,3,5,-2],root=roots[Math.floor(i/8)];
      if(i%8===0){
        [root,root+7,root+12].forEach(note=>this.tone(130.81*2**(note/12),{bus:'music',type:'sine',duration:2.8,volume:.085}));
      }
      if(melody[i]!==null)this.tone(261.63*2**(melody[i]/12),{bus:'music',type:'sine',duration:battle ? .65 : .95,volume:.09});
      if(battle&&i%2===0)this.tone(65.4*2**(root/12),{bus:'music',type:'triangle',duration:.19,volume:.13,end:46});
    };
    tick();this.musicTimer=setInterval(tick,this.scene==='battle'?300:430);
  },
  stopMusic(){if(this.musicTimer){clearInterval(this.musicTimer);this.musicTimer=null;}},
};
