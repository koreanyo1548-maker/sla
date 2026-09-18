/* ===== art.js ===== */
/* Presentation assets. Atlas coordinates are independent of combat hitboxes. */
const GameArt = {
  images: {},
  icons: {
    home:'<path d="m3 11 9-8 9 8v9H3z"/><path d="M9 20v-7h6v7"/>',
    heroes:'<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z"/><path d="m9 9 3-2 3 2-3 7z"/>',
    recruit:'<path d="M4 10h16v10H4zM3 7h18v4H3zM12 7v13"/><path d="M12 7C5 7 6 1 9 3l3 4c7 0 6-6 3-4z"/>',
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
  init(){
    for(const [key,url] of Object.entries(ASSET_URLS)){
      const img=new Image();
      this.images[key]=img;
      img.src=url;
      // [2026-09-18 세션 1] 자산이 파일로 빠지며 상대 경로가 생겼다. 커스텀 속성 안의
      // url()은 그 속성을 쓰는 스타일시트(css/*.css) 기준으로 풀리므로, 문서 기준
      // 절대 URL로 바꿔 넘긴다. data: URL은 new URL이 그대로 돌려준다.
      document.documentElement.style.setProperty('--'+key.replaceAll('_','-'),`url("${new URL(url,document.baseURI).href}")`);
    }
    document.querySelectorAll('[data-ui-icon]').forEach(el=>el.innerHTML=this.icon(el.dataset.uiIcon));
    document.querySelectorAll('[data-sprite]').forEach(el=>el.innerHTML=this.sprite(Number(el.dataset.sprite)));
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
  enabled:false,context:null,
  init(){try{this.enabled=SaveStorage.load(SOUND_PREF_KEY)==='on';}catch(_){}this.render();},
  render(){const b=document.getElementById('sound-toggle');if(b){b.setAttribute('aria-pressed',String(this.enabled));b.title=this.enabled?'효과음 끄기':'효과음 켜기';b.innerHTML=GameArt.icon('sound');b.classList.toggle('muted',!this.enabled);}},
  toggle(){this.enabled=!this.enabled;try{SaveStorage.save(SOUND_PREF_KEY,this.enabled?'on':'off');}catch(_){}this.render();this.play('up');},
  /* [2026-09-18 연출 세션 A] 호출 지점을 먼저 심는다.
     아래 MELODIES에 있는 kind만 소리가 나고, 없는 kind는 조용히 통과한다. 연출
     코드가 hit_chain·core_hit 같은 이름으로 미리 부르되 실제 소리는 로드맵 6단계
     (아트·사운드)에서 이 표를 채우면 그때부터 난다. 호출부는 그때 손대지 않는다.
     지금 정의된 셋(tap·up·reveal)은 기존 동작 그대로다. */
  MELODIES:{
    tap:[440],
    up:[440,660,880],
    reveal:[392,523,659,784],
    // 로드맵 6단계에서 채운다 — 인플레이
    hit_chain:null, hit_explosion:null, hit_scatter:null, hit_laser:null,
    kill:null, kill_boss:null, merge:null, generate:null,
    order_complete:null, skill_use:null,
    core_hit:null, core_low:null,
    wave_clear:null, boss_alert:null, clear:null, defeat:null,
  },
  play(kind='tap'){
    if(!this.enabled)return;
    const melody=this.MELODIES[kind];
    if(!melody?.length)return;          // 미정의·미구현 kind는 무음
    try{
      const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
      const ctx=this.context??=new C();if(ctx.state==='suspended')ctx.resume();
      melody.forEach((freq,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain(),t=ctx.currentTime+i*.075;osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.04,t+.01);gain.gain.exponentialRampToValueAtTime(.001,t+.17);osc.connect(gain);gain.connect(ctx.destination);osc.start(t);osc.stop(t+.18);});
    }catch(_){}
  },
};

const GameFeedback={
  timer:null,
  toast(message){const el=document.getElementById('lobby-notice');if(!el)return;el.textContent=message;el.classList.add('visible');clearTimeout(this.timer);this.timer=setTimeout(()=>el.classList.remove('visible'),2800);},
  burst(el){if(!el)return;el.classList.remove('growth-burst');void el.offsetWidth;el.classList.add('growth-burst');GameAudio.play('up');},
};

