/* ===== art.js ===== */
/* Presentation assets. Atlas coordinates are independent of combat hitboxes. */
const GameArt = {
  images: {},
  ready:false,
  icons: {
    forge:'<path d="M3 8h18l-4 5h-4v4h4v3H7v-3h3v-4H6z"/><path d="M11 2 8 6h7l-2-4"/>',
    merge:'<path d="m3 7 4-4 4 4-4 4zM13 7l4-4 4 4-4 4zM8 18l4-4 4 4-4 4zM7 12l3 3m7-3-3 3"/>',
    shield:'<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z"/><path d="m8 12 3 3 5-6"/>',
    heal:'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
    burst:'<path d="m12 2 2 6 6-4-3 7 5 2-7 2 3 6-6-4-4 5 1-7-7-2 6-3-3-6 6 4z"/>',
    slow:'<path d="M4 7h16M6 12h12M9 17h6M10 3h4M11 21h2"/>',
    knockback:'<path d="m4 6 6 6-6 6m7-12 6 6-6 6M21 5v14"/>',
    home:'<path d="m3 11 9-8 9 8v9H3z"/><path d="M9 20v-7h6v7"/>',
    heroes:'<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z"/><path d="m9 9 3-2 3 2-3 7z"/>',
    codex:'<path d="M4 4h6a2 2 0 0 1 2 2v14a3 3 0 0 0-3-3H4z"/><path d="M20 4h-6a2 2 0 0 0-2 2v14a3 3 0 0 1 3-3h5z"/>',
    recruit:'<path d="M4 10h16v10H4zM3 7h18v4H3zM12 7v13"/><path d="M12 7C5 7 6 1 9 3l3 4c7 0 6-6 3-4z"/>',
    relic:'<path d="m12 2 7 5-2.7 8.5L12 22l-4.3-6.5L5 7z"/><path d="m5 7 7 4 7-4M12 11v11"/>',
    skill:'<path d="M13 2 5 13h6l-1 9 9-13h-7z"/><circle cx="18" cy="5" r="2"/>',
    starfire:'<path d="m12 2 2.6 6.1L21 9l-4.8 4.4 1.3 6.4L12 16.5l-5.5 3.3 1.3-6.4L3 9l6.4-.9z"/>',
    gold:'<ellipse cx="12" cy="12" rx="8" ry="9"/><path d="M14 7h-4v5h4v5h-4M12 5v14"/>',
    energy:'<path d="M13 2 5 13h6l-1 9 9-13h-7z"/>',
    back:'<path d="m14 5-7 7 7 7M7 12h13"/>',
    sword:'<path d="m7 17 12-14 2 2-14 12M4 14l6 6M3 21l3-3"/>',
    settings:'<path d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/><circle cx="12" cy="12" r="3"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
    sound:'<path d="M4 9h4l5-5v16l-5-5H4zM16 8q5 4 0 8M19 5q8 7 0 14"/>',
    milestone:'<path d="M6 3v18"/><path d="M6 4h11l-3 4 3 4H6z"/>',
  },
  icon(key,cls=''){return `<svg class="ui-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${this.icons[key]||this.icons.heroes}</svg>`;},
  portrait(id,cls=''){
    const index=Math.max(0,Number(id.split('_')[1])-1),sheet=Math.floor(index/8)+1,tile=index%8;
    return `<span class="hero-art ${cls}" style="--portrait:var(--heroes-0${sheet});--portrait-x:${(tile%4)*100/3}%;--portrait-y:${Math.floor(tile/4)*100}%" aria-hidden="true"></span>`;
  },
  sprite(index,cls=''){return `<span class="sprite-art ${cls}" style="--sprite-x:${index%4*100/3}%;--sprite-y:${Math.floor(index/4)*100/3}%" aria-hidden="true"></span>`;},
  module(key,cls=''){return this.sprite(12+MISSILE_KEYS.indexOf(key),cls);},
  skill(key,cls=''){
    const icon={strong_single:'sword',aoe:'burst',defense:'shield',heal:'heal',energy_surge:'energy',attack_buff:'sword',defense_buff:'shield',stun:'burst',slow:'slow',knockback:'knockback',regen:'heal'}[key]||'skill';
    return this.icon(icon,'spell-icon '+cls);
  },
  init(){
    let complete=0;
    const pending=[];
    const total=Object.keys(ASSET_URLS).length;
    for(const [key,url] of Object.entries(ASSET_URLS)){
      const img=new Image();
      this.images[key]=img;
      pending.push(new Promise(resolve=>{
        let settled=false;
        const finish=ok=>{
          if(settled)return;settled=true;clearTimeout(timer);
          complete++;
          const bar=document.getElementById('loading-progress');
          if(bar)bar.style.width=(complete/total*100)+'%';
          resolve(ok);
        };
        const timer=setTimeout(()=>finish(false),20000);
        img.onload=()=>finish(true);img.onerror=()=>finish(false);
      }));
      img.src=url;
      // [2026-09-18 세션 1] 자산이 파일로 빠지며 상대 경로가 생겼다. 커스텀 속성 안의
      // url()은 그 속성을 쓰는 스타일시트(css/*.css) 기준으로 풀리므로, 문서 기준
      // 절대 URL로 바꿔 넘긴다. data: URL은 new URL이 그대로 돌려준다.
      document.documentElement.style.setProperty('--'+key.replaceAll('_','-'),`url("${new URL(url,document.baseURI).href}")`);
    }
    document.querySelectorAll('[data-ui-icon]').forEach(el=>el.innerHTML=this.icon(el.dataset.uiIcon));
    document.querySelectorAll('[data-sprite]').forEach(el=>el.innerHTML=this.sprite(Number(el.dataset.sprite)));
    return Promise.all(pending).then(results=>{this.ready=results.every(Boolean);return this.ready;});
  },
  drawSprite(ctx,index,x,y,size){
    const img=this.images.battle_sprites;if(!img?.complete||!img.naturalWidth)return false;
    const w=img.naturalWidth/4,h=img.naturalHeight/4;
    ctx.drawImage(img,(index%4)*w,Math.floor(index/4)*h,w,h,x-size/2,y-size/2,size,size);return true;
  },
  // [2026-09-18] 런타임 색키를 걷어냈다. 아틀라스가 알파를 갖게 되면서
  // keyFighterPixels·prepareFighterAtlas가 할 일이 없어졌다. 초록 배경 시절의
  // 원본은 git 이력에 남아 있다(88ac93a 이전).
  drawFighter(ctx,id,x,y,size){
    const index=Number(id.split('_')[1])-1;
    const img=this.images['fighters_0'+(Math.floor(index/8)+1)];
    if(!img?.complete||!img.naturalWidth)return false;
    const tile=index%8,w=img.naturalWidth/4,h=img.naturalHeight/2;
    ctx.drawImage(img,tile%4*w,Math.floor(tile/4)*h,w,h,x,y,size,size);return true;
  },
  drawField(ctx,width,height){
    const img=this.images.battlefield;
    if(!img?.complete||!img.naturalWidth){
      ctx.fillStyle='#263b3c';ctx.fillRect(0,0,width,height);return false;
    }
    // 성벽이 없는 연속 바닥을 전체 전장에 매핑한다. 핵은 별도 오브젝트다.
    ctx.drawImage(img,0,0,img.naturalWidth,img.naturalHeight,0,0,width,height);
    ctx.fillStyle='#171C2030';ctx.fillRect(0,0,width,height);return true;
  },
  // [2026-09-18 연출 세션 A] 핵이 맞으면 반응하고, 남은 HP에 따라 외형이 바뀐다.
  // 판정은 전부 Game 쪽에 있고 여기서는 game이 찍어 둔 표시용 필드만 읽는다.
  drawCore(ctx,game){
    const p=game.playerPos,r=CONFIG.field.coreRadius,pr=CONFIG.presentation;
    const now=performance.now();
    const hit=now<game.coreHitUntil;
    const flash=now<(game.coreFlashUntil||0);
    // 적 피격과 같은 squash 파라미터를 재사용한다.
    const sq=clamp(1-(now-(game.coreSquashAt||-99999))/(pr.squashSec*1000),0,1);
    const amt=pr.squashAmount*sq;
    const stage=game.coreStage||0;                 // 0=건강, 1~3=단계
    ctx.save();
    ctx.fillStyle='#171C2099';ctx.beginPath();
    ctx.ellipse(p.x,p.y+r*.72,r*.9,r*.28,0,0,Math.PI*2);ctx.fill();
    if(amt>0){ ctx.translate(p.x,p.y); ctx.scale(1+amt,1-amt); ctx.translate(-p.x,-p.y); }
    if(flash){ctx.shadowColor='#ffffff';ctx.shadowBlur=18;}
    else if(hit){ctx.shadowColor='#F77A3D';ctx.shadowBlur=14;}
    // 단계가 오를수록 불꽃이 어두워진다.
    ctx.globalAlpha=1-stage*0.11;
    // 미사일 활성화 여부와 관계없이 보호 대상의 크기·불투명도를 유지한다.
    if(!this.drawSprite(ctx,10,p.x,p.y,r*2)){
      ctx.fillStyle=flash?'#ffffff':hit?'#F2E9D8':'#5EDBF4';ctx.beginPath();
      ctx.moveTo(p.x,p.y-r);ctx.lineTo(p.x+r*.7,p.y);ctx.lineTo(p.x,p.y+r);
      ctx.lineTo(p.x-r*.7,p.y);ctx.closePath();ctx.fill();
    }
    ctx.globalAlpha=1;ctx.shadowBlur=0;
    if(flash){
      // 스프라이트를 흰색으로 덮는 대신 얇은 흰 테두리를 올린다 — 스프라이트 모양을 유지한다.
      ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.globalAlpha=.85;
      ctx.beginPath();ctx.arc(p.x,p.y,r*.92,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
    }
    this.drawCoreCracks(ctx,p,r,stage);
    ctx.restore();
  },
  // 균열 라인. 단계마다 한 줄씩 늘어난다. 각도는 고정이라 프레임마다 흔들리지 않는다.
  CORE_CRACKS:[
    [[-0.55,-0.45],[-0.12,0.05],[-0.30,0.62]],
    [[0.52,-0.38],[0.14,0.12],[0.36,0.66]],
    [[0.05,-0.85],[-0.06,-0.20],[0.22,0.18]],
  ],
  drawCoreCracks(ctx,p,r,stage){
    if(stage<=0) return;
    ctx.save();
    ctx.strokeStyle='#171C20';ctx.lineWidth=1.6;ctx.lineCap='round';ctx.globalAlpha=.75;
    this.CORE_CRACKS.slice(0,Math.min(stage,this.CORE_CRACKS.length)).forEach(points=>{
      ctx.beginPath();
      points.forEach(([nx,ny],i)=>{
        const x=p.x+nx*r, y=p.y+ny*r;
        i?ctx.lineTo(x,y):ctx.moveTo(x,y);
      });
      ctx.stroke();
    });
    ctx.restore();
  },
};

/* Short interface sounds only after a user gesture; preference is device-local.
   저장 키는 진행 데이터(slagma.campaign.v4)와 별도라 데이터 초기화에 영향받지 않는다. */
const SOUND_PREF_KEY='slagma.sound';
const GameAudio={
  enabled:true,context:null,master:null,voices:0,lastPlayed:new Map(),
  init(){
    try{this.enabled=SaveStorage.load(SOUND_PREF_KEY)!=='off';}catch(_){}
    // 브라우저 오디오 정책을 지킨다. 첫 실제 입력에서만 컨텍스트를 연다.
    document.addEventListener('pointerdown',()=>this.unlock(),{capture:true,passive:true});
    document.addEventListener('keydown',()=>this.unlock(),{capture:true});
    this.render();
  },
  unlock(){
    if(!this.enabled)return;
    try{
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
      if(!this.context){
        this.context=new Audio();
        this.master=this.context.createGain();this.master.gain.value=.65;
        const limiter=this.context.createDynamicsCompressor();
        limiter.threshold.value=-14;limiter.knee.value=12;limiter.ratio.value=6;
        this.master.connect(limiter);limiter.connect(this.context.destination);
      }
      if(this.context.state==='suspended')this.context.resume().catch(()=>{});
    }catch(_){}
  },
  render(){
    const b=document.getElementById('sound-toggle'); if(!b) return;
    const actionKey=this.enabled?'tools.soundOff':'tools.soundOn';
    b.setAttribute('aria-pressed',String(this.enabled));
    b.setAttribute('aria-label',t(actionKey));
    b.title=t(actionKey);
    b.innerHTML=`<span class="sound-option-label">${GameArt.icon('sound')}<span>${t('options.sound.title')}</span></span><strong>${this.enabled?'ON':'OFF'}</strong>`;
    b.classList.toggle('muted',!this.enabled);
  },
  toggle(){
    this.enabled=!this.enabled;
    try{SaveStorage.save(SOUND_PREF_KEY,this.enabled?'on':'off');}catch(_){}
    if(this.enabled)this.unlock();
    if(this.master)this.master.gain.setTargetAtTime(this.enabled ? 0.65 : 0,this.context.currentTime,.015);
    this.render();this.play('up');
  },
  // 짧은 음색을 직접 합성한다. 공격은 낮은 볼륨과 호출 간격 제한으로 겹침을 줄이고,
  // 성장·승패는 별도 선율로 구분한다. 파일 다운로드나 자동 재생은 필요하지 않다.
  SOUNDS:{
    tap:{notes:[520],duration:.07,volume:.05},
    up:{notes:[440,660,880]},
    reveal:{notes:[392,523,659,784],duration:.25},
    generate:{notes:[310,465],duration:.07,gap:.035,volume:.06},
    merge:{notes:[523,784,1047],duration:.13,gap:.055,volume:.075},
    order_complete:{notes:[330,440,660,880],duration:.2,gap:.055,volume:.08},
    skill_use:{notes:[220,440,880],type:'triangle',duration:.24,slide:1.25,volume:.075},
    hit_chain:{notes:[740],type:'triangle',duration:.06,slide:.5,volume:.022,interval:130},
    hit_explosion:{notes:[95,63],type:'triangle',duration:.13,slide:.45,volume:.06,interval:180},
    hit_scatter:{notes:[310],type:'triangle',duration:.06,slide:.55,volume:.025,interval:150},
    hit_laser:{notes:[880],type:'sine',duration:.13,slide:.32,volume:.025,interval:190},
    kill:{notes:[620],duration:.06,slide:1.2,volume:.022,interval:180},
    kill_boss:{notes:[196,294,392,587],type:'triangle',duration:.3,volume:.085},
    level_up:{notes:[392,494,587,784],duration:.22},
    star_up:{notes:[523,659,784,1047],duration:.28},
    passive_unlock:{notes:[440,554,659,880],duration:.25},
    new_best:{notes:[587,784,988],duration:.24},
    stage_unlock:{notes:[392,523,659,784],duration:.23},
    core_hit:{notes:[130,87],type:'triangle',duration:.16,slide:.8,volume:.085,interval:230},
    core_low:{notes:[196,147,196],type:'triangle',gap:.16,duration:.2,volume:.075,interval:2000},
    wave_clear:{notes:[392,523,659],duration:.2,volume:.07},
    boss_alert:{notes:[147,139,147],type:'triangle',gap:.2,duration:.3,volume:.085,interval:1500},
    clear:{notes:[262,330,392,523,659,784],gap:.11,duration:.38,volume:.095},
    defeat:{notes:[330,294,247,196],type:'triangle',gap:.18,duration:.4,volume:.075},
  },
  play(kind='tap'){
    if(!this.enabled||document.hidden)return;
    const sound=this.SOUNDS[kind];if(!sound)return;
    const now=performance.now(),last=this.lastPlayed.get(kind)??-Infinity;
    if(now-last<(sound.interval||65))return;
    // 전투 중에는 이미 열린 컨텍스트만 쓴다. resume은 입력 이벤트에서 처리한다.
    const ctx=this.context;if(!ctx||ctx.state!=='running'||!this.master)return;
    this.lastPlayed.set(kind,now);
    try{
      sound.notes.forEach((freq,i)=>{
        if(this.voices>=16)return;
        const osc=ctx.createOscillator(),gain=ctx.createGain();
        const start=ctx.currentTime+i*(sound.gap||.075),duration=sound.duration||.18;
        osc.type=sound.type||'sine';osc.frequency.setValueAtTime(freq,start);
        if(sound.slide)osc.frequency.exponentialRampToValueAtTime(freq*sound.slide,start+duration);
        gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(sound.volume||.065,start+.008);
        gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
        osc.connect(gain);gain.connect(this.master);this.voices++;
        osc.onended=()=>{this.voices--;osc.disconnect();gain.disconnect();};
        osc.start(start);osc.stop(start+duration+.01);
      });
    }catch(_){}
  },
};

/* 별 아이콘을 낱개 요소로 낸다 — 승급 연출(GameFeedback.starUp)이 하나씩
   채우려면 텍스트 한 덩어리가 아니라 개별 요소여야 한다. [연출 세션 B] */
function starMarkup(star,max=0){
  const filled=Math.max(0,Math.floor(Number(star)||0));
  return Array.from({length:Math.max(filled,Math.floor(Number(max)||0))},
    (_,i)=>i<filled?'<i>★</i>':'<i class="empty">☆</i>').join('');
}

/* =====================================================================
   [GameFeedback] 로비·성장 피드백
   ---------------------------------------------------------------------
   [2026-09-18 연출 세션 B] 수치가 바뀌는 자리는 countUp 하나로 모으고(B-1),
   성장은 레벨업·승급·패시브 해금이 서로 다르게 보이게 한다(B-2). 토스트는
   덮어쓰지 않고 최대 세 개까지 쌓인다(B-6).

   prefers-reduced-motion이 켜져 있으면 tween과 별 채우기를 건너뛰고 결과
   값만 박는다 — 연출이 없을 뿐 정보는 그대로 보인다.
   ===================================================================== */
const GameFeedback={
  TOAST_MS:2200, TOAST_MAX:3, STAR_STEP_MS:150,
  counters:new WeakMap(),
  reduced(){ try{ return matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(_){ return false; } },

  /* --- B-1 수치 변화 ---------------------------------------------------
     직전 값은 요소가 스스로 들고 있다(dataset.countValue). 호출부가 이전
     값을 따로 보관하지 않아도 되고, 1초마다 도는 지갑 렌더는 값이 그대로면
     조용히 지나간다. 모달처럼 통째로 다시 그려지는 자리는 from을 넘긴다. */
  countUp(el,to,{from,duration=650,format=value=>I18N.num(Math.round(value))}={}){
    if(!el) return;
    const target=Number(to);
    const previous=Number.isFinite(Number(from))?Number(from):Number(el.dataset.countValue);
    el.dataset.countValue=String(target);
    const running=this.counters.get(el);
    if(running){ cancelAnimationFrame(running); this.counters.delete(el); }
    if(!Number.isFinite(target)){ el.textContent=String(to); return; }
    if(!Number.isFinite(previous)||previous===target||this.reduced()){ el.textContent=format(target); return; }
    el.classList.remove('fx-count-gain','fx-count-loss');
    void el.offsetWidth;
    // 줄어드는 값(레벨업 비용 지출)은 붉은 톤, 느는 값은 금색이다.
    el.classList.add(target>previous?'fx-count-gain':'fx-count-loss');
    const startedAt=performance.now();
    const step=now=>{
      const ratio=Math.max(0,Math.min(1,(now-startedAt)/duration));
      const eased=1-Math.pow(1-ratio,3);
      el.textContent=format(previous+(target-previous)*eased);
      if(ratio<1){ this.counters.set(el,requestAnimationFrame(step)); return; }
      this.counters.delete(el);
      el.textContent=format(target);
    };
    this.counters.set(el,requestAnimationFrame(step));
  },

  /* --- B-2 레벨업 ------------------------------------------------------ */
  burst(el){
    if(!el) return;
    el.classList.remove('growth-burst'); void el.offsetWidth; el.classList.add('growth-burst');
    GameAudio.play('level_up');
  },

  /* --- B-2 승급 --------------------------------------------------------
     별을 STAR_STEP_MS 간격으로 하나씩 채우고 초상에 흰 플래시와 등급색 링을
     얹는다. 레벨업의 growth-burst보다 크게 보이도록 링이 밖으로 퍼진다. */
  starUp({stars,hero,color}={}){
    GameAudio.play('star_up');
    if(this.reduced()) return;
    if(stars) [...stars.querySelectorAll('i')].forEach((star,index)=>{
      star.classList.remove('fx-star-fill'); void star.offsetWidth;
      star.style.animationDelay=`${index*this.STAR_STEP_MS}ms`;
      star.classList.add('fx-star-fill');
    });
    if(!hero) return;
    restartCssAnimation(hero,'fx-star-flash');
    const ring=document.createElement('span');
    ring.className='star-ring';
    if(color) ring.style.setProperty('--ring-color',color);
    hero.appendChild(ring);
    setTimeout(()=>ring.remove(),800);
  },

  /* --- B-2 패시브 해금 --------------------------------------------------
     승급 연출 뒤에 카드가 아래에서 올라온다. 해금 시점 판단(3성)은 호출부가
     PassiveUnlockTable에서 읽는다 — 여기는 보여 주기만 한다. */
  passiveReveal({name,lines=[]}={}){
    const panel=document.getElementById('passive-reveal');
    if(!panel) return;
    GameAudio.play('passive_unlock');
    document.getElementById('passive-reveal-name').textContent=name||'';
    document.getElementById('passive-reveal-lines').innerHTML=lines.map(line=>`<li>${line}</li>`).join('');
    panel.hidden=false;
    document.getElementById('passive-reveal-close').focus();
  },
  closePassiveReveal(){
    const panel=document.getElementById('passive-reveal');
    if(panel) panel.hidden=true;
  },

  /* --- B-6 토스트 큐 ----------------------------------------------------
     예전에는 한 줄을 덮어써서 연달아 오는 알림이 서로를 지웠다. 이제 아래로
     쌓이고 위(오래된 것)부터 사라진다. */
  toast(message){
    const host=document.getElementById('lobby-notice');
    if(!host||!message) return;
    const item=document.createElement('div');
    item.className='toast';
    item.textContent=message;
    host.appendChild(item);
    while(host.children.length>this.TOAST_MAX) host.firstElementChild.remove();
    requestAnimationFrame(()=>item.classList.add('visible'));
    setTimeout(()=>{
      item.classList.remove('visible');
      setTimeout(()=>item.remove(),220);
    },this.TOAST_MS);
  },
};
