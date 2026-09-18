/* ===== combat.js ===== */
/* =====================================================================
   [VisualEffects] 판정과 분리된 Canvas/DOM 연출 계층
   ===================================================================== */
class VisualEffects {
  // 공격 종류 → 사운드 kind. 기본 공격·스킬은 여기 없으므로 소리가 나지 않는다.
  static HIT_SOUNDS={chain:'hit_chain',explosion:'hit_explosion',scatter:'hit_scatter',laser:'hit_laser'};
  constructor(game){
    this.game = game;
    this.particles = [];
    this.rings = [];
    this.lightningArcs = [];
    this.damageNumbers = new Map();
    this.playerAura = null;
    this.ghosts = [];
  }
  reset(){ this.particles=[]; this.rings=[]; this.lightningArcs=[]; this.beams=[]; this.ghosts=[]; this.damageNumbers.clear(); this.playerAura=null; }
  // [2026-09-04] 레이저 광선 — 짧게 남았다가 사라지는 직선.
  beam(from,to,color,width){
    (this.beams=this.beams||[]).push({x1:from.x,y1:from.y,x2:to.x,y2:to.y,color,
      width:Math.max(3,width),life:.16,maxLife:.16});
  }
  emit(x,y,color,count,speedMin=35,speedMax=120,life=.45,size=3){
    for(let i=0;i<count;i++){
      const a=rand(0,Math.PI*2), speed=rand(speedMin,speedMax), ttl=rand(life*.7,life*1.2);
      this.particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,
        life:ttl,maxLife:ttl,color,size:rand(size*.6,size*1.35),gravity:rand(15,55)});
    }
    if(this.particles.length>VISUAL_CONFIG.maxParticles){
      this.particles.splice(0,this.particles.length-VISUAL_CONFIG.maxParticles);
    }
  }
  ring(x,y,color,maxRadius=55,duration=.45,lineWidth=3){
    this.rings.push({x,y,color,radius:5,maxRadius,life:duration,maxLife:duration,lineWidth});
  }
  lightning(from,to,color=CONFIG.attackModules.chain.color){
    const points=[];
    const segments=7;
    for(let i=0;i<=segments;i++){
      const ratio=i/segments;
      points.push({
        x:from.x+(to.x-from.x)*ratio+(i===0||i===segments?0:rand(-7,7)),
        y:from.y+(to.y-from.y)*ratio+(i===0||i===segments?0:rand(-7,7)),
      });
    }
    this.lightningArcs.push({points,color,life:.18,maxLife:.18});
  }
  // [2026-09-15] 피격 반응을 흰색 플래시 하나에서 밀림·압축·미사일별 파편으로 나눈다.
  // 좌표(enemy.x/y)는 건드리지 않고 표시용 필드만 얹으므로 판정은 그대로다.
  enemyHit(enemy,sourceKind='basic'){
    const now=performance.now(), p=CONFIG.presentation;
    enemy.hitFlashUntil = now+85;
    const dir=this.hitDirection(enemy,sourceKind);
    if(!this.game.prefersReducedMotion()){
      enemy.fxOffsetX=dir.x*p.hitPushPx; enemy.fxOffsetY=dir.y*p.hitPushPx;
      enemy.fxOffsetLife=p.hitPushRecoverSec; enemy.fxOffsetMax=p.hitPushRecoverSec;
      enemy.fxSquashAt=now;
    }
    this.hitBurst(enemy,sourceKind,dir);
    // [2026-09-18 연출 세션 A] 미사일 4종은 소리도 구분한다. 정의되지 않은 kind는 무음이다.
    if(VisualEffects.HIT_SOUNDS[sourceKind]) GameAudio.play(VisualEffects.HIT_SOUNDS[sourceKind]);
  }
  // 발사 원점에서 적을 향하는 방향. 해당 미사일의 영웅이 없으면 거점 기준이다.
  hitDirection(enemy,sourceKind){
    const key=missileKeyForSource(sourceKind);
    const o=key?this.game.heroField.origin(key):this.game.playerPos;
    const dx=enemy.x-o.x, dy=enemy.y-o.y, d=Math.hypot(dx,dy)||1;
    return {x:dx/d,y:dy/d};
  }
  // 미사일 4종이 색만 다르던 것을 파편 모양으로 구분한다 — 연쇄는 스파크, 폭발은 충격파,
  // 산탄은 진행 방향 원뿔, 레이저는 천천히 꺼지는 잔광이다.
  hitBurst(enemy,sourceKind,dir){
    const n=VISUAL_CONFIG.hitParticles, c=CONFIG.attackModules[sourceKind]?.color||'#ffffff';
    if(sourceKind==='chain'){
      this.emit(enemy.x,enemy.y,c,n,40,130,.22,2.2);
      this.lightning({x:enemy.x-dir.x*18,y:enemy.y-dir.y*18},{x:enemy.x,y:enemy.y},c);
    } else if(sourceKind==='explosion'||sourceKind==='explosion_secondary'){
      this.emit(enemy.x,enemy.y,CONFIG.attackModules.explosion.color,n,20,70,.30,3.2);
      this.ring(enemy.x,enemy.y,CONFIG.attackModules.explosion.color,22,.20,2);
    } else if(sourceKind==='scatter'){
      const base=Math.atan2(dir.y,dir.x);
      for(let i=0;i<n;i++){
        const a=base+rand(-.5,.5), sp=rand(70,160), ttl=rand(.10,.18);
        this.particles.push({x:enemy.x,y:enemy.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,
          life:ttl,maxLife:ttl,color:c,size:rand(1.4,2.4),gravity:20});
      }
      if(this.particles.length>VISUAL_CONFIG.maxParticles){
        this.particles.splice(0,this.particles.length-VISUAL_CONFIG.maxParticles);
      }
    } else if(sourceKind==='laser'){
      this.emit(enemy.x,enemy.y,c,3,15,45,.45,2.6);
      this.ring(enemy.x,enemy.y,c,16,.34,1.5);
    } else {
      this.emit(enemy.x,enemy.y,'#ffffff',n,25,85,.28,2.5);
    }
  }
  // 짧은 시간 안에 같은 적에게 들어온 피해는 공격 종류·치명타·관통 여부별로 합산한다.
  queueDamage(enemy,hit){
    const sourceKind=hit.sourceKind||'basic';
    const signature=`${sourceKind}|${hit.critical?'critical':'normal'}|${hit.pierceDamage>0?'pierce':'plain'}`;
    const current=this.damageNumbers.get(enemy.id);
    if(current){
      const entry=current.entries[signature]||(current.entries[signature]={kind:sourceKind,damage:0,pierceDamage:0,critical:!!hit.critical});
      entry.damage+=hit.finalDamage;entry.pierceDamage+=hit.pierceDamage||0;
      current.x=enemy.x; current.y=enemy.y; current.enemy=enemy;
    } else {
      this.damageNumbers.set(enemy.id,{entries:{[signature]:{kind:sourceKind,damage:hit.finalDamage,pierceDamage:hit.pierceDamage||0,critical:!!hit.critical}},x:enemy.x,y:enemy.y,enemy,life:.14});
    }
  }
  // [2026-09-14] 정렬 순서를 MISSILE_KEYS에서 파생한다. 미사일을 추가해도 이 배열을
  // 따로 고칠 필요가 없고, 목록에 없는 종류가 indexOf -1 로 맨 앞에 튀어 오르던 것도
  // 맨 뒤로 밀리게 바꿨다.
  static damageOrder = ['basic',...MISSILE_KEYS.flatMap(k=>k==='explosion'?[k,'explosion_secondary']:[k]),...SKILL_KEYS.filter(skillDealsDamage)];
  flushDamage(enemyId){
    const item=this.damageNumbers.get(enemyId);
    if(!item) return;
    const x=item.enemy?.x??item.x, y=item.enemy?.y??item.y;
    const order=VisualEffects.damageOrder;
    const rank=kind=>{ const i=order.indexOf(kind); return i<0 ? order.length : i; };
    const entries=Object.values(item.entries).sort((a,b)=>rank(a.kind)-rank(b.kind));
    spawnDamageStack(this.game.floatLayer,x,y,entries);
    this.damageNumbers.delete(enemyId);
  }
  enemyKilled(enemy){
    this.flushDamage(enemy.id);
    this.emit(enemy.x,enemy.y,enemy.isBoss?PALETTE.energy:PALETTE.ember,
      enemy.isBoss?VISUAL_CONFIG.killParticles*2:VISUAL_CONFIG.killParticles,45,180,.65,4);
    this.ring(enemy.x,enemy.y,enemy.isBoss?PALETTE.energy:PALETTE.ember,enemy.isBoss?78:38,.5,3);
    // [2026-09-15] 처치가 '배열에서 조용히 사라짐'이던 것을 잔상으로 남긴다. 일반과 보스의
    // 지속·확대량을 나눠 물량전에서 처치 리듬이 눈에 보이게 하는 것이 목적이다.
    if(!this.game.prefersReducedMotion()){
      const life=CONFIG.presentation.killAfterimageSec*(enemy.isBoss?1.8:1);
      if(life>0) this.ghosts.push({x:enemy.x,y:enemy.y,sprite:enemy.fxSprite??5,
        size:enemy.fxSize??38,life,maxLife:life,boss:!!enemy.isBoss});
    }
    if(enemy.isBoss) restartCssAnimation($('#combat-wrap'),'fx-shake');
  }
  // [2026-09-18 연출 세션 A] 핵이 맞는 것을 보이게 한다. 근접 타격과 원거리 탄 도달이
  // 같은 연출을 쓴다 — 플레이어에게는 "핵이 맞았다"는 같은 사건이다.
  // point는 핵 표면(CoreField.impactPoint), dir은 적→핵 방향의 단위 벡터다.
  coreImpact(point,dir){
    const g=this.game, p=CONFIG.presentation;
    g.coreFlashUntil=performance.now()+p.coreFlashSec*1000;
    if(!g.prefersReducedMotion()) g.coreSquashAt=performance.now();
    this.ring(point.x,point.y,PALETTE.hp,p.coreImpactRadius,.3,2);
    // 파편은 적이 온 쪽으로 튄다(핵에서 바깥으로).
    const n=Math.max(0,Math.round(p.coreImpactParticles));
    for(let i=0;i<n;i++){
      const spread=rand(-.7,.7), speed=rand(45,130);
      const a=Math.atan2(dir?.y??-1,dir?.x??0)+Math.PI+spread;
      this.particles.push({x:point.x,y:point.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,
        life:.32,maxLife:.32,color:PALETTE.hp,size:rand(1.6,3),gravity:rand(20,60)});
    }
    if(this.particles.length>VISUAL_CONFIG.maxParticles){
      this.particles.splice(0,this.particles.length-VISUAL_CONFIG.maxParticles);
    }
    GameAudio.play('core_hit');
  }
  // 적 원거리 발사 순간. 탄이 어디서 왔는지 보이게 한다.
  muzzleFlash(x,y){
    this.ring(x,y,PALETTE.hp,9,CONFIG.presentation.muzzleFlashSec,2);
  }
  // [2026-09-18 연출 세션 A] 발사 순간을 세게 만든다. moduleKey를 받으면 그 미사일 색을 쓰고,
  // 없으면(기본 공격) 기존 accent 색이다. origin이 없으면 핵 위치를 쓴다(기존 동작).
  playerShot(moduleKey=null,origin=null){
    const p=origin||this.game.playerPos;
    const color=(moduleKey&&CONFIG.attackModules[moduleKey]?.color)||PALETTE.accent;
    this.emit(p.x,p.y-15,color,5,15,55,.25,2);
    this.ring(p.x,p.y-15,color,10,.1,2);
  }
  playerHit(p=this.game.playerPos){
    this.emit(p.x,p.y,PALETTE.hp,10,35,125,.45,3);
    restartCssAnimation($('#combat-wrap'),'fx-player-hit');
    restartCssAnimation($('#player-hp-bar').parentElement,'fx-hp-hit');
    if(VISUAL_CONFIG.shakeOnPlayerHit) restartCssAnimation($('#combat-wrap'),'fx-shake');
  }
  // [2026-09-16 v0916_7] 스킬 연출을 SKILL_DEFS.fx로 고른다. 스킬 키별 분기를 두지 않는다.
  skill(kind,target=null,duration=0){
    const fx=VisualEffects.SKILL_FX[SKILL_DEFS[kind]?.fx];
    if(fx) fx(this,kind,target,duration);
  }
  static SKILL_FX = {
    lance(fx,kind,target){
      if(!target) return;
      fx.ring(target.x,target.y,PALETTE.arcane,58,.38,4);
      fx.emit(target.x,target.y,PALETTE.arcane,VISUAL_CONFIG.skillParticles,60,210,.55,4);
      restartCssAnimation($('#combat-wrap'),'fx-shake');
    },
    bombard(fx,kind,target){
      const targets=Array.isArray(target)?target:[];
      targets.forEach(e=>{
        fx.lightning({x:e.x,y:Math.max(-20,e.y-90)},e,PALETTE.ember);
        fx.ring(e.x,e.y,PALETTE.ember,34,.42,4);
        fx.emit(e.x,e.y,PALETTE.ember,Math.max(5,Math.floor(VISUAL_CONFIG.skillParticles/3)),50,180,.55,4);
      });
      restartCssAnimation($('#combat-wrap'),'fx-shake');
      if(!fx.game.prefersReducedMotion()) restartCssAnimation($('#combat-wrap'),'fx-shake-soft');
    },
    shield(fx,kind,target,duration){
      const p=fx.game.playerPos;
      fx.playerAura={color:PALETTE.accent,remaining:duration||CONFIG.skills[kind].durationSec};
      fx.ring(p.x,p.y,PALETTE.accent,42,.45,4);
      fx.emit(p.x,p.y,PALETTE.accent,18,25,90,.55,3);
    },
    heal(fx){
      const p=fx.game.playerPos;
      fx.ring(p.x,p.y,PALETTE.toxic,48,.5,4);
      fx.emit(p.x,p.y,PALETTE.toxic,VISUAL_CONFIG.skillParticles,25,115,.7,4);
    },
    energy(fx){
      const p=fx.game.playerPos;
      fx.ring(p.x,p.y,PALETTE.energy,52,.45,4);
      fx.emit(p.x,p.y,PALETTE.energy,VISUAL_CONFIG.skillParticles,40,150,.6,3);
    },
    aura(fx,kind,target,duration){
      const p=fx.game.playerPos,color=SKILL_DEFS[kind].color;
      fx.playerAura={color,remaining:duration||1};
      fx.ring(p.x,p.y,color,46,.45,4);
      fx.emit(p.x,p.y,color,18,25,100,.55,3);
    },
    control(fx,kind,target){
      const def=SKILL_DEFS[kind],color=def.color,push=def.control==='knockback';
      (Array.isArray(target)?target:[]).forEach(e=>{
        fx.ring(e.x,e.y,color,push?40:30,.4,3);
        fx.emit(e.x,e.y,color,Math.max(4,Math.floor(VISUAL_CONFIG.skillParticles/4)),40,160,.5,3);
      });
      if(push){ const core=CoreField.position(); fx.ring(core.x,core.y,color,120,.45,5); }
    },
  };
  // 투사체 잔상 — 좌표 배열만 들고 있다가 알파 감쇠로 그린다. 판정과 무관하다.
  pushTrail(p){
    const len=Math.max(0,Math.round(CONFIG.presentation.projectileTrailLen||0));
    if(len<=0||this.game.prefersReducedMotion())return;
    (p.trail=p.trail||[]).push({x:p.x,y:p.y});
    if(p.trail.length>len)p.trail.splice(0,p.trail.length-len);
  }
  update(dt){
    this.particles.forEach(p=>{
      p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=p.gravity*dt;
      p.vx*=Math.pow(.985,dt*60); p.vy*=Math.pow(.985,dt*60);
    });
    this.particles=this.particles.filter(p=>p.life>0);
    this.rings.forEach(r=>{r.life-=dt; const ratio=1-r.life/r.maxLife; r.radius=5+(r.maxRadius-5)*ratio;});
    this.rings=this.rings.filter(r=>r.life>0);
    this.lightningArcs.forEach(a=>a.life-=dt);
    this.lightningArcs=this.lightningArcs.filter(a=>a.life>0);
    this.beams=(this.beams||[]).filter(b=>{b.life-=dt; return b.life>0;});
    this.ghosts=(this.ghosts||[]).filter(g=>{g.life-=dt; return g.life>0;});
    this.damageNumbers.forEach((item,id)=>{
      item.life-=dt;
      if(item.life<=0) this.flushDamage(id);
    });
    if(this.playerAura){this.playerAura.remaining-=dt;if(this.playerAura.remaining<=0)this.playerAura=null;}
  }
  drawPlayerAura(ctx){
    if(!this.playerAura) return;
    const p=this.game.playerPos, pulse=1+Math.sin(performance.now()/90)*.08;
    ctx.save(); ctx.globalAlpha=.45; ctx.strokeStyle=this.playerAura.color; ctx.lineWidth=3;
    ctx.shadowBlur=14; ctx.shadowColor=this.playerAura.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,23*pulse,0,Math.PI*2); ctx.stroke(); ctx.restore();
  }
  draw(ctx){
    ctx.save();
    (this.ghosts||[]).forEach(gh=>{
      const ratio=clamp(gh.life/gh.maxLife,0,1);
      ctx.globalAlpha=ratio*.55;
      const size=gh.size*(1+(1-ratio)*(gh.boss ? .55 : .35));
      if(!GameArt.drawSprite(ctx,gh.sprite,gh.x,gh.y,size)){
        ctx.fillStyle=gh.boss ? PALETTE.energy : PALETTE.ember;
        ctx.beginPath();ctx.arc(gh.x,gh.y,size*.3,0,Math.PI*2);ctx.fill();
      }
    });
    ctx.globalAlpha=1;
    this.rings.forEach(r=>{
      ctx.globalAlpha=clamp(r.life/r.maxLife,0,1);
      ctx.strokeStyle=r.color; ctx.lineWidth=r.lineWidth; ctx.shadowBlur=10; ctx.shadowColor=r.color;
      ctx.beginPath(); ctx.arc(r.x,r.y,r.radius,0,Math.PI*2); ctx.stroke();
    });
    this.particles.forEach(p=>{
      ctx.globalAlpha=clamp(p.life/p.maxLife,0,1);
      ctx.fillStyle=p.color; ctx.shadowBlur=8; ctx.shadowColor=p.color;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
    });
    this.lightningArcs.forEach(a=>{
      ctx.globalAlpha=clamp(a.life/a.maxLife,0,1);
      ctx.strokeStyle=a.color; ctx.lineWidth=2.5; ctx.shadowBlur=14; ctx.shadowColor=a.color;
      ctx.beginPath();
      a.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
      ctx.stroke();
      ctx.globalAlpha*=.75; ctx.strokeStyle='#ffffff'; ctx.lineWidth=.8; ctx.stroke();
    });
    (this.beams||[]).forEach(b=>{
      const a=clamp(b.life/b.maxLife,0,1);
      ctx.globalAlpha=a; ctx.strokeStyle=b.color; ctx.lineWidth=b.width;
      ctx.shadowBlur=18; ctx.shadowColor=b.color; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(b.x1,b.y1); ctx.lineTo(b.x2,b.y2); ctx.stroke();
      ctx.globalAlpha=a*.9; ctx.strokeStyle='#ffffff'; ctx.lineWidth=Math.max(1,b.width*.28); ctx.stroke();
    });
    ctx.restore();
  }
}

/* =====================================================================
   [CombatFactorSystem] 1차 공통 팩터 + 2차 미사일 전용 팩터 집계
   ---------------------------------------------------------------------
   성장 콘텐츠는 피해 공식을 직접 만지지 않고 registerSource()로 수치만 공급한다.
   같은 팩터는 출처별로 더하며, 공통 버킷과 미사일 전용 버킷은 별도로 유지한다.
   ===================================================================== */
const COMBAT_FACTOR_KEYS = [
  'attackPct','damagePct','critChance','critDamagePct',
  'defenseIgnore','pierceRate','attackSpeedPct','bossDamagePct',
];
// 전투 팩터 표시 이름. 밸런스 에디터는 '증가율'이 붙은 긴 이름, 패시브 문구는 짧은 이름을 쓴다.
const COMBAT_FACTOR_LABELS = {
  attackPct:{short:'공격력',long:'공격력 증가율'}, damagePct:{short:'피해량',long:'피해량 증가율'},
  critChance:{short:'치명타율',long:'치명타율'}, critDamagePct:{short:'치명타 피해',long:'치명타 피해량'},
  defenseIgnore:{short:'방어 무시율',long:'방어 무시율'}, pierceRate:{short:'관통 피해율',long:'관통 피해율'},
  attackSpeedPct:{short:'공격속도',long:'공격속도 증가율'}, bossDamagePct:{short:'보스 피해',long:'보스 피해 증가율'},
};
function freshCombatFactors(){
  return Object.fromEntries(COMBAT_FACTOR_KEYS.map(key=>[key,0]));
}
class CombatFactorSystem {
  constructor(game){
    this.game=game;
    this.sources=new Map();
    this.registerSource('config',()=>CONFIG.combatFactors);
    this.registerSource('party',cloneConfig(RunConfig.partySnapshot?.factors||{}));
    // 기존 주문서의 공격력·공격속도 강화도 2차 팩터 공급원으로 편입한다.
    this.registerSource('order_upgrades',()=>({
      global:{},
      modules:Object.fromEntries(CONFIG.moduleKeys.map(key=>{
        const state=game.attackModuleSystem.modules[key]||{};
        return [key,{damagePct:Number(state.damagePct)||0,attackSpeedPct:Number(state.speedPct)||0}];
      })),
    }));
  }
  registerSource(id,source){
    if(!id || (typeof source!=='function' && (!source||typeof source!=='object'))) return false;
    this.sources.set(id,source);return true;
  }
  removeSource(id){ return this.sources.delete(id); }
  readSource(source){
    try{return typeof source==='function'?(source()||{}):(source||{});}
    catch(error){console.error(`[CombatFactorSystem] '${source}' 공급원 오류`,error);return {};}
  }
  addFactors(target,values){
    COMBAT_FACTOR_KEYS.forEach(key=>{const value=Number(values?.[key]);if(Number.isFinite(value))target[key]+=value;});
  }
  snapshot(moduleKey=null){
    const global=freshCombatFactors(),module=freshCombatFactors();
    this.sources.forEach(source=>{
      const data=this.readSource(source);
      this.addFactors(global,data.global);
      if(moduleKey) this.addFactors(module,data.modules?.[moduleKey]);
    });
    return {global,module};
  }
  attacksPerSec(base,moduleKey=null){
    const factors=this.snapshot(moduleKey);
    const pct=factors.global.attackSpeedPct+factors.module.attackSpeedPct;
    return Math.max(0.01,Number(base||0)*(1+pct));
  }
}

/* =====================================================================
   [StatusEffectSystem / CombatEffectSystem] 캐릭터 고정 패시브의 조건부 효과
   ---------------------------------------------------------------------
   상태는 적 단위로 보관하며 같은 상태 재적중 시 중첩하지 않고 지속시간만 갱신한다.
   상태 부여와 상태 대상 추가 피해는 데이터 행으로 처리해 캐릭터/미사일 분기를 만들지 않는다.
   ===================================================================== */
class StatusEffectSystem{
  constructor(game){this.game=game;}
  reset(){this.game.enemySystem.enemies.forEach(e=>{e.statuses={};});}
  has(target,statusId){return !!target?.statuses?.[statusId]?.remaining;}
  apply(target,statusId,duration){
    const def=StatusEffectTable[statusId];if(!target||target.dead||!def)return false;
    target.statuses??={};
    target.statuses[statusId]={remaining:Math.max(.1,Number(duration)||def.duration)};
    this.game.effects.ring(target.x,target.y,def.color,enemyHitRadius(target)+7,.25,2);
    return true;
  }
  update(dt){
    this.game.enemySystem.enemies.forEach(target=>{
      Object.entries(target.statuses||{}).forEach(([id,state])=>{state.remaining-=dt;if(state.remaining<=0)delete target.statuses[id];});
    });
  }
}
class CombatEffectSystem{
  constructor(game){this.game=game;this.effects=cloneConfig(RunConfig.partySnapshot?.effects||[]);}
  reset(){this.effects=cloneConfig(RunConfig.partySnapshot?.effects||[]);}
  stackValue(effects){
    const added=effects.filter(e=>e.stackMode==='add').reduce((sum,e)=>sum+(Number(e.value)||0),0);
    const limited=effects.filter(e=>e.stackMode!=='add').reduce((max,e)=>Math.max(max,Number(e.value)||0),0);
    return added+limited;
  }
  beforeDamage(baseDamage,target,sourceKind,context={}){
    const module=missileKeyForSource(sourceKind);let bonus=0;
    if(module&&!context.proc){
      bonus=this.stackValue(this.effects.filter(e=>e.kind==='damage_vs_status'&&e.sourceId===module&&this.game.statusEffectSystem.has(target,e.statusId)));
    }
    return {baseDamage:Math.max(0,Number(baseDamage)||0)*(1+bonus),target,sourceKind};
  }
  afterDamage(target,sourceKind,context={}){
    const module=missileKeyForSource(sourceKind);if(!module||context.proc)return;
    this.effects.filter(e=>e.kind==='status_on_hit'&&e.sourceId===module).forEach(e=>{
      if(Math.random()<clamp(Number(e.chance)||0,0,1))this.game.statusEffectSystem.apply(target,e.statusId,e.duration);
    });
  }
}

/* =====================================================================
   [DamageResolver] 모든 플레이어 공격의 단일 최종 피해 계산기
   ---------------------------------------------------------------------
   기본 피해 → 공격력 → 공통/전용 피해 → 치명타 → 보스 보정 → 방어/관통 순서다.
   반환값에 계산 내역을 남겨 표시·통계·향후 발동 조건이 같은 판정을 재사용하게 한다.
   ===================================================================== */
class DamageResolver {
  constructor(game){this.game=game;}
  calculate(baseDamage,target,sourceKind='basic',critRoll=Math.random()){
    const moduleKey=missileKeyForSource(sourceKind);
    const {global,module}=this.game.combatFactorSystem.snapshot(moduleKey);
    const rules=CONFIG.combatRules;
    const critChance=clamp(global.critChance+module.critChance,0,rules.critChanceCap);
    const critical=critRoll<critChance;
    const critDamagePct=Math.max(0,global.critDamagePct+module.critDamagePct);
    const defenseIgnore=clamp(global.defenseIgnore+module.defenseIgnore,0,rules.defenseIgnoreCap);
    const pierceRate=clamp(global.pierceRate+module.pierceRate,0,rules.pierceRateCap);
    // [2026-09-16] 달군 칼날은 일반 공격력(기본 공격·미사일)에만 더한다. 스킬 피해(분쇄창·광역·제어)에는 적용하지 않는다.
    const skillAttackPct=(sourceKind==='basic'||moduleKey)?(this.game.skillSystem?.attackBuffPct?.()||0):0;
    const attackMul=Math.max(0,(1+global.attackPct+skillAttackPct)*(1+module.attackPct));
    const damageMul=Math.max(0,(1+global.damagePct)*(1+module.damagePct));
    const bossMul=target?.isBoss?Math.max(0,1+global.bossDamagePct+module.bossDamagePct):1;
    const preDefense=Math.max(0,Number(baseDamage)||0)*attackMul*damageMul*(critical?1+critDamagePct:1)*bossMul;
    const targetDefense=Math.max(0,Number(target?.def)||0);
    const effectiveDefense=targetDefense*(1-defenseIgnore);
    const defenseConstant=Math.max(1,Number(rules.defenseConstant)||1);
    const defenseMultiplier=defenseConstant/(defenseConstant+effectiveDefense);
    const normalPart=preDefense*(1-pierceRate)*defenseMultiplier;
    const piercePart=preDefense*pierceRate;
    const unrounded=normalPart+piercePart;
    const finalDamage=Math.max(Number(rules.minimumDamage)||0,Math.round(unrounded));
    const pierceDamage=unrounded>0?Math.round(finalDamage*(piercePart/unrounded)):0;
    return {finalDamage,pierceDamage,normalDamage:finalDamage-pierceDamage,critical,
      critChance,critDamagePct,defenseIgnore,pierceRate,effectiveDefense,defenseMultiplier,
      sourceKind,moduleKey,baseDamage:Number(baseDamage)||0,preDefense};
  }
  resolve({baseDamage,target,sourceKind='basic',roll}){
    return this.calculate(baseDamage,target,sourceKind,Number.isFinite(roll)?roll:Math.random());
  }
  expectedDamage(baseDamage,moduleKey=null,target={def:0,isBoss:false}){
    const sourceKind=moduleKey||'basic';
    const normal=this.calculate(baseDamage,target,sourceKind,1).finalDamage;
    const factors=this.game.combatFactorSystem.snapshot(moduleKey);
    const chance=clamp(factors.global.critChance+factors.module.critChance,0,CONFIG.combatRules.critChanceCap);
    if(chance<=0)return normal;
    const critical=this.calculate(baseDamage,target,sourceKind,0).finalDamage;
    return normal*(1-chance)+critical*chance;
  }
}

/* =====================================================================
   [AttackModuleSystem] 연쇄·폭발·산탄·레이저 독립 공격과 주문서 강화 상태
   ===================================================================== */
class AttackModuleSystem {
  constructor(game){ this.game=game; this.reset(); }
  // 미사일 고유 스탯 메타는 MISSILE_DEFS에서 파생한다. 수치 상태만 여기서 관리한다.
  static SPECIAL = Object.fromEntries(MISSILE_KEYS.map(key=>[
    key,
    {stat:MISSILE_DEFS[key].special.stat,table:MISSILE_DEFS[key].special.table,base:MISSILE_DEFS[key].special.base}
  ]));
  reset(){
    this.basicActive = true;
    this.modules = {};
    CONFIG.moduleKeys.forEach(key=>{
      this.modules[key] = { active:false, damagePct:0, speedPct:0, specialBonus:0 };
    });
  }
  applyUpgrade(moduleKey, stat, level){
    const state = this.modules[moduleKey];
    const def = CONFIG.attackModules[moduleKey];
    if(!state || !def) return;
    const spec = AttackModuleSystem.SPECIAL[moduleKey];
    const levelTable = stat==='damage' ? CONFIG.attackModules.damageBonusByLevel
      : stat==='speed' ? CONFIG.attackModules.speedBonusByLevel
      : def[spec.table];
    const idx = clamp(level-1, 0, levelTable.length-1);
    this.game.heroField.upgrade(moduleKey,level);
    state.active = true;
    // [2026-09-04] 확정(인철): 활성 미사일이 하나라도 생기면 기본 공격은 그냥 꺼진다.
    this.basicActive = false;
    if(stat==='damage') state.damagePct += CONFIG.attackModules.damageBonusByLevel[idx];
    else if(stat==='speed') state.speedPct += CONFIG.attackModules.speedBonusByLevel[idx];
    else if(spec && stat===spec.stat){
      // [2026-09-07] 산탄 최초 보정(+1발)을 제거했다. 이제 baseProjectiles 3이 활성화 시점의 값이고,
      // 발사 수 강화는 레벨 표의 증가량만 누적된다.
      state.specialBonus += def[spec.table][idx];
    }
  }
  activeKeys(){ return Object.keys(this.modules).filter(k=>this.modules[k].active); }
  // 누적 공격력 강화 합계 — 스킬 위력 계산에도 쓰인다.
  totalDamagePct(){ return CONFIG.moduleKeys.reduce((a,k)=>a+(this.modules[k]?.damagePct||0),0); }
  damage(moduleKey){
    const def=CONFIG.attackModules[moduleKey];
    const attack=RunConfig.partySnapshot?.attackByModule?.[moduleKey]??RunConfig.playerStat('atk');
    return Math.max(1,Math.round(attack*def.baseDamageMul));
  }
  attacksPerSec(moduleKey){
    const def=CONFIG.attackModules[moduleKey];
    return this.game.combatFactorSystem.attacksPerSec(def.baseAttacksPerSec,moduleKey);
  }
  specialValue(moduleKey){
    const def=CONFIG.attackModules[moduleKey], state=this.modules[moduleKey];
    const spec=AttackModuleSystem.SPECIAL[moduleKey];
    if(!spec) return 0;
    return def[spec.base]+state.specialBonus;
  }
}

/* =====================================================================
   [SkillSystem] 스킬 발동·쿨타임·지속 효과
   ---------------------------------------------------------------------
   [2026-09-16 v0916_7] 스킬 키별 if/else를 SKILL_DEFS 디스패치로 바꿨다. 발동 조건(requires)·
   처리(effect)·제어(control)를 정의에서 읽는다. 쿨타임·버프·피해 감소·지속 회복 상태도 전부
   이 시스템이 소유한다(이전에는 CombatSystem·game.skillBuffs·game.skillCooldowns에 나뉘어 있었다).
   모든 타이머는 게임 dt로만 흐른다 — 일시정지·히트스톱·종료 연출 동안 멈춘다.
   ===================================================================== */
class SkillSystem {
  constructor(game){ this.game = game; this.reset(); }
  reset(){
    this.cooldowns = {};
    this.useCounts = {};   // 스킬별 사용 횟수 — 비용이 여기서 나온다. 런 시작에만 초기화한다.
    this.state = {attackPct:0,attackLeft:0,defPct:0,defLeft:0,reductionPct:0,reductionLeft:0,regenPerTick:0,regenTicks:0,regenTickLeft:0};
  }
  // 다음 사용에 드는 에너지. 스킬마다 따로 누적한다(A를 써도 B의 비용은 오르지 않는다).
  energyCost(skillKey){
    // energyFree 스킬은 누적 비용에서 빠진다. 사용 판정(blockReason)·차감(activate)·버튼 표시가
    // 모두 이 값에서 파생되므로 여기 한 곳만 0으로 두면 나머지는 따라온다.
    if(CONFIG.skills[skillKey]?.energyFree) return 0;
    const c=CONFIG.skillEnergy;
    const used=this.useCounts[skillKey]||0;
    return Math.max(0, Math.round((Number(c?.firstCost)||0) + used*(Number(c?.costStep)||0)));
  }
  // [2026-09-04 버그 수정] 스킬 피해가 기본 공격력만 참조해 런 내내 강화와 무관하게 고정돼 있었다.
  // 확정(인철): "기본 공격력은 그대로 쓰되 공격력 강화 레벨 합산을 스킬에도 적용한다".
  attackPower(){
    return RunConfig.playerStat('atk') * (1 + this.game.attackModuleSystem.totalDamagePct());
  }
  entry(skillKey){return RunConfig.skillSnapshot?.equipped?.find(item=>item.key===skillKey)||null;}
  attackBuffPct(){return this.state.attackLeft>0?this.state.attackPct:0;}
  defenseBuffPct(){return this.state.defLeft>0?this.state.defPct:0;}
  damageReductionPct(){return this.state.reductionLeft>0?clamp(this.state.reductionPct,0,0.99):0;}
  // 핵 HP를 amount만큼 회복하고 실제 증가량만 표시한다. 즉시 회복과 지속 회복이 함께 쓴다.
  healCore(amount){
    const g=this.game,maxHp=RunConfig.playerStat('hp'),before=g.playerHpCurrent;
    g.playerHpCurrent=clamp(g.playerHpCurrent+amount,0,maxHp);
    const actual=Math.max(0,Math.round((g.playerHpCurrent-before)*10)/10);
    g.updateHpUi();
    if(actual>0)spawnFloatNumber(g.floatLayer,g.playerPos.x,g.playerPos.y-20,'+'+formatDamage(actual),'heal');
    return actual;
  }
  cooldownLeft(skillKey){ return Math.max(0,this.cooldowns[skillKey]||0); }
  update(dt){
    Object.keys(this.cooldowns).forEach(key=>this.cooldowns[key]=Math.max(0,this.cooldowns[key]-dt));
    const b=this.state;
    b.reductionLeft=Math.max(0,b.reductionLeft-dt);
    b.attackLeft=Math.max(0,b.attackLeft-dt);b.defLeft=Math.max(0,b.defLeft-dt);
    if(b.regenTicks>0&&!this.game.ending){
      b.regenTickLeft-=dt;
      while(b.regenTickLeft<=0&&b.regenTicks>0){this.healCore(RunConfig.playerStat('hp')*b.regenPerTick);b.regenTicks--;b.regenTickLeft+=1;}
    }
  }
  // 발동할 수 없는 사유를 코드로 돌려준다(null이면 쓸 수 있다). 화면에 그대로 나가는
  // 값이 아니다 — 버튼 상태 판정(game.js renderSkillBar)과 디버그 로그가 이 코드를 본다.
  blockReason(skillKey){
    const def=SKILL_DEFS[skillKey],entry=this.entry(skillKey);
    if(!def||!CONFIG.skills[skillKey]||!entry) return 'notEquipped';
    if(this.game.ending) return 'ended';
    if(this.cooldownLeft(skillKey) > 0) return 'cooldown';
    if(this.game.energy < this.energyCost(skillKey)) return 'noEnergy';
    return def.requires ? SkillSystem.REQUIRES[def.requires](this) : null;
  }
  canUse(skillKey){ return this.blockReason(skillKey)===null; }
  // 플레이어 입력 진입점 — 성공 발동한 경우에만 개별 쿨타임을 시작한다.
  activate(skillKey){
    const reason = this.blockReason(skillKey);
    if(reason){ logAction(`${CONFIG.skills[skillKey]?.name||'스킬'} 사용 불가 (${reason})`); return false; }
    // 비용은 발동이 확정된 뒤에 뺀다 — use()가 false를 돌려주면 에너지를 잃지 않는다.
    const cost=this.energyCost(skillKey);
    if(!this.use(skillKey)) return false;
    if(cost>0){
      this.game.energy-=cost;
      this.game.stats.energySpent+=cost;
      // 주문서 게이지에는 넣지 않는다(확정) — 게이지는 피스 생성과 머지만 센다.
      this.game.updateEnergyUi();
    }
    this.useCounts[skillKey]=(this.useCounts[skillKey]||0)+1;
    this.game.stats.skillsUsed++;
    this.cooldowns[skillKey]=this.entry(skillKey)?.cooldownSec||CONFIG.skills[skillKey].cooldownSec;
    this.game.renderSkillBar();
    this.game.tutorial?.onSkillUsed();
    return true;
  }
  use(skillKey){
    const cfg=CONFIG.skills[skillKey],entry=this.entry(skillKey);
    if(!Number.isFinite(entry?.effect)) return false;
    const detail=SkillSystem.EFFECTS[SKILL_DEFS[skillKey].effect](this,skillKey,entry,cfg);
    if(detail===false) return false;
    Analytics.track('skill_used',{skill:skillKey,wave:this.game.currentWaveCfg?.wave||0});
    logAction(`${cfg.name} ${entry.star}성 → ${detail}`);
    return true;
  }
  static REQUIRES = {
    enemy:system=>system.game.combatSystem.liveEnemies().length===0?'noTarget':null,
    missingHp:system=>system.game.playerHpCurrent>=RunConfig.playerStat('hp')?'fullHp':null,
  };
  // 각 처리는 성공 시 행동 로그 문구를, 발동할 수 없으면 false를 돌려준다.
  static EFFECTS = {
    // 체력이 가장 높은 적에게 전용 탄을 쏜다. 피해는 명중 시 CombatSystem.HIT.strong_single이 준다.
    projectile(system,key,entry){
      const g=system.game,target=g.enemySystem.getHighestHpEnemy();
      if(!target) return false;
      const dmg=Math.round(system.attackPower()*entry.effect);
      g.combatSystem.fire(key,target,dmg,{skillProjectile:true});
      return `발사 ${dmg} 피해`;
    },
    // 모든 적에게 피해를 주고, 정의에 제어가 있으면 살아남은 적에게 건다.
    damageAll(system,key,entry,cfg){
      const g=system.game,targets=g.combatSystem.liveEnemies();
      if(!targets.length) return false;
      const dmg=Math.round(system.attackPower()*entry.effect),control=SkillSystem.CONTROLS[SKILL_DEFS[key].control];
      targets.forEach(e=>{
        g.enemySystem.damageEnemy(e,dmg,key);
        if(control&&!e.dead) control(g,e,cfg);
      });
      g.effects.skill(key,targets);
      return `전체 ${dmg} 피해`;
    },
    damageReduction(system,key,entry){
      const b=system.state;b.reductionPct=entry.effect;b.reductionLeft=entry.duration;
      system.game.effects.skill(key,null,entry.duration);
      return `피해 ${Math.round(entry.effect*1000)/10}% 감소 (${entry.duration}초)`;
    },
    heal(system,key,entry){
      const actual=system.healCore(Math.round(RunConfig.playerStat('hp')*entry.effect));
      system.game.effects.skill(key);
      return `실제 ${formatDamage(actual)} 회복`;
    },
    energy(system,key,entry){
      const g=system.game,amount=Math.max(0,Math.round(entry.effect));
      g.energy+=amount;g.updateEnergyUi();
      g.effects.skill(key);
      spawnFloatNumber(g.floatLayer,g.playerPos.x,g.playerPos.y-40,t('battle.skill.energyGain',{n:amount}),'enhance');
      return `에너지 +${amount}`;
    },
    attackBuff(system,key,entry){
      const b=system.state;b.attackPct=entry.effect;b.attackLeft=entry.duration;
      system.game.effects.skill(key,null,entry.duration);
      return `일반 공격력 +${Math.round(entry.effect*1000)/10}% (${entry.duration}초)`;
    },
    defenseBuff(system,key,entry){
      const b=system.state;b.defPct=entry.effect;b.defLeft=entry.duration;
      system.game.effects.skill(key,null,entry.duration);
      return `방어력 +${Math.round(entry.effect*1000)/10}% (${entry.duration}초)`;
    },
    regen(system,key,entry){
      const b=system.state;b.regenPerTick=entry.effect;b.regenTicks=Math.max(0,Math.round(entry.duration));b.regenTickLeft=1;
      system.game.effects.skill(key,null,entry.duration);
      return `초당 ${Math.round(entry.effect*1000)/10}% · ${entry.duration}초`;
    },
  };
  // [2026-09-16] 확정(인철): 스턴은 이동·공격을 멈추고 감속은 둘 다 늦춘다. 보스에게도 그대로 적용한다.
  static CONTROLS = {
    stun(g,e,cfg){ e.stunLeft=Math.max(e.stunLeft||0,cfg.stunSec); },
    slow(g,e,cfg){ e.slowLeft=Math.max(e.slowLeft||0,cfg.slowSec); e.slowPct=cfg.slowPct; },
    knockback(g,e,cfg){ g.enemySystem.knockback(e,cfg.knockbackPx); },
  };
}
// 정의가 가리키는 처리·조건·제어·연출이 실제로 있는지 로드 시점에 확인한다(오타가 조용히 무시되지 않게).
(function validateSkillDefs(){
  const configKeys=Object.keys(DEFAULT_CONFIG.skills);
  if(configKeys.length!==SKILL_KEYS.length||configKeys.some((key,i)=>key!==SKILL_KEYS[i])) throw Error('SKILL_DEFS와 CONFIG.skills의 스킬 목록이 다릅니다');
  SKILL_KEYS.forEach(key=>{
    const d=SKILL_DEFS[key];
    if(!SkillSystem.EFFECTS[d.effect]||(d.requires&&!SkillSystem.REQUIRES[d.requires])||(d.control&&!SkillSystem.CONTROLS[d.control])||!VisualEffects.SKILL_FX[d.fx])
      throw Error(`스킬 정의 오류: ${key}`);
  });
})();

/* =====================================================================
   [CombatSystem] §4,5 — 플레이어 타겟팅/공격, 피해 계산
   ===================================================================== */
class CombatSystem {
  constructor(game){
    this.game = game;
    this.cooldowns = this.freshCooldowns();
    this.projectiles = [];
    this.scatterMirror = false;
  }
  // [2026-09-04 버그 수정] 쿨타임 목록을 { basic, chain, explosion, scatter }로 하드코딩해 뒀던 탓에
  // 새로 추가한 관통·레이저는 cooldowns[key]가 undefined였고, 발사 조건 undefined<=0 이 항상 false라
  // 한 번도 발사되지 않았다. CONFIG.moduleKeys에서 만들어 미사일을 추가해도 빠지지 않게 한다.
  freshCooldowns(){
    const cd = { basic:0 };
    CONFIG.moduleKeys.forEach(k=>{ cd[k]=0; });
    return cd;
  }
  reset(){
    this.cooldowns = this.freshCooldowns();
    this.projectiles = [];
    this.scatterMirror = false;
  }
  get activeDamageReduction(){
    const base=clamp(CONFIG.player.damageReductionBase,0,0.99);
    const skill=this.game.skillSystem?.damageReductionPct?.()||0;
    return 1-(1-base)*(1-skill);
  }
  // §5 최종 피해 = max(최소 피격 피해, 적 공격력 - 합산 방어력) × (1 - 피해 감소율)
  // 방어 수치 영역은 20배 정수 단위이므로 최소 피격 피해도 1 → 20으로 함께 올린다.
  // 감소율 곱셈 이후에 다시 정수로 반올림 + 최소 1을 강제하면, 난이도 초반처럼 raw가
  // 이미 1인 상황에서 방어 스킬 70% 감소가 0.3 → 반올림 0 → 다시 최소 1로 튕겨 올라가
  // 방어 스킬이 사실상 무효화된다(인철 지적, 2026-09-01). 그래서 감소율 적용 후에는
  // 더 이상 정수/최소값을 강제하지 않고 소수 피해를 그대로 반환 — HP도 내부적으로는
  // 소수로 추적하고 화면 표시(updateHpUi)에서만 반올림한다.
  computeIncomingDamage(enemyAtk){
    const finalDef = RunConfig.playerStat('def') * (1 + CONFIG.player.defIncreaseRate + (this.game.skillSystem?.defenseBuffPct?.()||0));
    const raw = Math.max(CONFIG.combatRules.minimumIncomingDamage, enemyAtk - finalDef);
    return raw * (1 - this.activeDamageReduction);
  }
  liveEnemies(){ return this.game.enemySystem.enemies.filter(e=>!e.dead); }
  nearestTargets(count,origin=this.game.playerPos){
    const p=origin;
    return this.liveEnemies().sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)).slice(0,count);
  }
  fire(kind,target,dmg,extra={}){
    const g=this.game;
    const origin=g.heroField.origin(kind);
    if(g.heroField.units[kind])g.heroField.shot(kind);else g.effects.playerShot();
    this.projectiles.push({
      x:origin.x+(extra.offsetX||0), y:origin.y,
      target, owner:'player', kind, motion:'homing', speed:CONFIG.player.projectileSpeed, dmg, ...extra,
    });
  }
  fireScatter(target,dmg,count){
    const g=this.game;
    const origin=g.heroField.origin('scatter');g.heroField.shot('scatter');
    const baseAngle=Math.atan2(target.y-origin.y,target.x-origin.x);
    const spread=CONFIG.attackModules.scatter.spreadAngleDeg*Math.PI/180;
    const projectileCount=Math.max(1,Math.round(count));
    const centerBonus=moduleRuleValue('scatter','centerDamageBonus');
    const offsets=[0]; // 첫 탄은 항상 현재 목표를 향한다.
    for(let step=1;offsets.length<projectileCount;step++){
      if(offsets.length+2<=projectileCount){
        offsets.push(-step,step);
      } else {
        // 짝수 발사 수의 남는 한 발은 매 공격마다 좌우를 바꿔 장기 편향을 없앤다.
        offsets.push((this.scatterMirror?1:-1)*step);
        this.scatterMirror=!this.scatterMirror;
      }
    }
    offsets.forEach(offset=>{
      const angle=baseAngle+offset*spread;
      this.projectiles.push({
        x:origin.x,y:origin.y,owner:'player',kind:'scatter',motion:'linear',
        speed:CONFIG.player.projectileSpeed,dmg:Math.round(dmg*(1+(offset===0?centerBonus:0))),
        vx:Math.cos(angle),vy:Math.sin(angle),distanceLeft:projectileMaxRange(g.canvas),
        center:offset===0,
      });
    });
  }
  fireBasic(){
    const target=this.game.enemySystem.getNearestEnemy();
    if(target) this.fire('basic',target,Math.round(RunConfig.playerStat('atk')));
  }
  // [2026-09-11] 발사 방식도 MISSILE_DEFS에서 읽는다. 새 미사일 추가 시 별도 FIRE 맵을
  // 병행 수정하지 않아도 되며, 정의가 잘못되면 한 번만 경고하고 발사를 건너뛴다.
  static missingFireWarned = new Set();
  fireModule(key){
    const system=this.game.attackModuleSystem;
    const meta=MISSILE_DEFS[key];
    const fire=meta?.fire;
    const target=this.nearestTargets(1,this.game.heroField.origin(key))[0];
    if(!target) return;
    if(!fire){
      this.warnMissingFire(key,'발사 메타가 없습니다');
      return;
    }
    const damage=system.damage(key), special=system.specialValue(key);
    if(fire.mode==='projectile' && fire.option){
      this.fire(key,target,damage,{[fire.option]:special});
      return;
    }
    if(fire.mode==='method' && typeof this[fire.method]==='function'){
      this[fire.method](target,damage,special);
      return;
    }
    this.warnMissingFire(key,`발사 방식(${fire.mode||'unknown'})이 유효하지 않습니다`);
  }
  warnMissingFire(key,reason){
    if(CombatSystem.missingFireWarned.has(key)) return;
    CombatSystem.missingFireWarned.add(key);
    console.error(`[CombatSystem] '${key}' 미사일: ${reason}. MISSILE_DEFS를 확인하세요.`);
    logAction(`⚠ '${key}' 미사일이 발사되지 않습니다 (정의 오류)`);
  }
  // [2026-09-04] 레이저 — 비행 시간 없이 즉시 판정한다. 플레이어에서 목표를 지나 화면 끝까지 이은
  // 선에서 광선 폭 안에 들어온 적을 모두 타격한다. 단일 대상에도 그대로 유효하다.
  fireLaser(target,dmg,width){
    const g=this.game;
    const origin=g.heroField.origin('laser');g.heroField.shot('laser');
    const angle=Math.atan2(target.y-origin.y,target.x-origin.x);
    const far=projectileMaxRange(g.canvas);
    const x2=origin.x+Math.cos(angle)*far, y2=origin.y+Math.sin(angle)*far;
    let actualWidth=width;
    let actualDmg=dmg;
    const empChance=moduleRuleValue('laser','empowered','chance');
    if(empChance>0 && Math.random()<clamp(empChance,0,1)){
      actualDmg=Math.round(actualDmg*(1+moduleRuleValue('laser','empowered','damagePct')));
      actualWidth=actualWidth*(1+moduleRuleValue('laser','empowered','widthPct'));
    }
    const half=Math.max(2,actualWidth/2);
    const victims=this.liveEnemies().filter(e=>
      this.segmentDistance(e.x,e.y,origin.x,origin.y,x2,y2) <= half+enemyHitRadius(e));
    // [2026-09-15] 초점 수렴 훅 — 직선에 걸린 적이 1기일 때만 적용한다.
    if(victims.length===1){
      actualDmg=Math.round(actualDmg*(1+moduleRuleValue('laser','focused','damagePct')));
    }
    victims.forEach(e=>g.enemySystem.damageEnemy(e,actualDmg,'laser'));
    g.effects.beam(origin,{x:x2,y:y2},CONFIG.attackModules.laser.color,actualWidth);
  }
  // [2026-09-14] 명중 처리를 MISSILE_DEFS 파생 디스패치로 바꿨다. 발사(fireModule)만
  // 테이블이고 명중은 p.kind에 대한 if/else 체인이라, 미사일을 추가하면 정의 한 곳이
  // 아니라 여기와 draw()를 함께 고쳐야 했다. 이제 정의에 hit/render를 적으면 두 곳이
  // 따라온다. 핸들러 이름이 없으면 단일 대상 처리로 떨어지므로 조용히 무시되지 않는다.
  // 각 핸들러는 (system, p, target)을 받는 순수 함수 형태로 두어 인스턴스 상태에
  // 의존하는 부분을 system 인자 하나로 좁혔다.
  static HIT = {
    // 목표를 시작점으로 가까운 순서대로 연결한다.
    chain(system,p,target){
      const g=system.game, color=CONFIG.attackModules[p.kind].color;
      const candidates=system.liveEnemies().filter(e=>e!==target)
        .sort((a,b)=>Math.hypot(a.x-target.x,a.y-target.y)-Math.hypot(b.x-target.x,b.y-target.y));
      const maxTargets=Math.max(1,Math.round(p.chainTargets||1));
      const victims=[target,...candidates.slice(0,Math.max(0,maxTargets-1))];
      const unused=Math.max(0,maxTargets-victims.length);
      const unusedBonus=moduleRuleValue(p.kind,'unusedTargetBonus');
      victims.forEach((e,i)=>{
        if(e.dead) return;
        let hitDmg=p.dmg;
        // 남는 연결 횟수 보너스는 첫 대상의 본 피해와 한 번에 합산한다.
        // 보너스가 먼저 적을 처치해 기본 피해가 사라지는 순서 의존 버그를 방지한다.
        if(i===0 && unused>0 && unusedBonus>0) hitDmg+=Math.round(p.dmg*unused*unusedBonus);
        g.enemySystem.damageEnemy(e,hitDmg,p.kind);
        const previous=i===0?{x:p.x,y:p.y}:victims[i-1];
        g.effects.lightning(previous,e,color);
        g.effects.emit(e.x,e.y,color,6,30,105,.28,2.5);
        g.effects.ring(e.x,e.y,color,18,.22,2);
      });
    },
    // 착탄 지점 반경 안의 적을 모두 때린다.
    splash(system,p,target){
      const g=system.game, color=CONFIG.attackModules[p.kind].color;
      const victims=system.liveEnemies().filter(e=>Math.hypot(e.x-target.x,e.y-target.y)<=p.radius+enemyHitRadius(e));
      const hitDmg=p.dmg;
      const killed=[];
      victims.forEach(e=>{
        if(g.enemySystem.damageEnemy(e,hitDmg,p.kind)) killed.push({x:e.x,y:e.y});
        if(e!==target) g.effects.ring(e.x,e.y,color,20,.22,2);
      });
      // 처치 지점에서 한 번 더 터지는 2차 폭발 훅.
      const secDamagePct=moduleRuleValue(p.kind,'secondary','damagePct');
      const secRadiusPct=moduleRuleValue(p.kind,'secondary','radiusPct');
      if(killed.length && secDamagePct>0 && secRadiusPct>0){
        const secondaryRadius=p.radius*secRadiusPct;
        const secondaryDmg=Math.round(p.dmg*secDamagePct);
        killed.forEach(origin=>{
          const secondaryVictims=system.liveEnemies().filter(e=>Math.hypot(e.x-origin.x,e.y-origin.y)<=secondaryRadius+enemyHitRadius(e));
          secondaryVictims.forEach(e=>g.enemySystem.damageEnemy(e,secondaryDmg,'explosion_secondary',{proc:true}));
          g.effects.ring(origin.x,origin.y,color,secondaryRadius,.28,2);
        });
      }
      g.effects.ring(target.x,target.y,color,p.radius,.38,3);
      g.effects.emit(target.x,target.y,color,12,35,145,.45,3);
    },
    // 스킬 전용 단일 탄 — 전용 연출을 함께 재생한다.
    strong_single(system,p,target){
      system.game.enemySystem.damageEnemy(target,p.dmg,'strong_single');
      system.game.effects.skill('strong_single',target);
    },
    single(system,p,target){
      system.game.enemySystem.damageEnemy(target,p.dmg,p.kind||'basic');
    },
  };
  resolvePlayerHit(p){
    const name=MISSILE_DEFS[p.kind]?.hit ?? p.kind;
    (CombatSystem.HIT[name] || CombatSystem.HIT.single)(this,p,p.target);
  }
  update(dt){
    const g = this.game;
    Object.keys(this.cooldowns).forEach(k=>{ this.cooldowns[k]-=dt; });
    if(g.attackModuleSystem.basicActive){
      if(this.liveEnemies().length && this.cooldowns.basic<=0){
        this.cooldowns.basic=1/g.combatFactorSystem.attacksPerSec(CONFIG.player.atkSpeed);
        this.fireBasic();
      }
    } else {
      g.attackModuleSystem.activeKeys().forEach(key=>{
        if(this.liveEnemies().length && this.cooldowns[key]<=0){
          this.cooldowns[key]=1/g.attackModuleSystem.attacksPerSec(key);
          this.fireModule(key);
        }
      });
    }
    // 투사체 이동/충돌
    // 주의: 이동 "전" 거리만으로 충돌을 판정하면, 프레임당 이동거리(step)가 목표까지
    // 남은 거리보다 큰 경우(투사체가 빠르거나 dt가 순간적으로 크게 튈 때) 실제로는
    // 이번 프레임에 지나쳐야 할 목표를 그대로 스쳐 지나가버리는 오버슈트가 생긴다
    // (인철 지적, 2026-09-01). 그래서 "이번 프레임 이동거리 >= 남은 거리"이면 이동시키지
    // 않고 그 자리에서 명중 처리한다 — 목표를 지나칠 프레임이면 애초에 명중으로 취급.
    this.projectiles = this.projectiles.filter(p=>{
      // [2026-09-18 연출 세션 A] 이동 전 위치를 잔상으로 남긴다. 좌표만 복사하므로
      // 판정에 관여하지 않는다. 레이저는 투사체가 아니라 빔이라 여기 오지 않는다.
      g.effects?.pushTrail(p);
      if(p.owner==='player'){
        if(p.motion==='linear'){
          // [2026-09-07] 직선탄은 발사 각도로 직진해 경로에 처음 닿은 적 한 기에게만 피해를 준다.
          // [2026-09-14] 분기 조건을 p.kind==='scatter'에서 발사 시 기록하는 p.motion으로 바꿨다.
          // 직선으로 나는 미사일을 추가할 때 이 분기를 고칠 필요가 없다.
          const step=p.speed*dt, nx=p.x+p.vx*step, ny=p.y+p.vy*step;
          const hit=this.liveEnemies().find(e=>this.segmentDistance(e.x,e.y,p.x,p.y,nx,ny)<=enemyHitRadius(e)+CONFIG.hitbox.laserEdgePad);
          if(hit){
            // [2026-09-14] 확정(인철): 볼리 중복 적중 보너스는 채택하지 않는다. 같은 묶음의
            // 탄이 같은 적에게 여러 발 맞아도 각 발은 제 피해만 준다(근접 다중 명중 자체는
            // 2026-09-04 확정대로 유지). 중앙탄 2배가 산탄의 조절 수단이다.
            g.enemySystem.damageEnemy(hit,p.dmg,p.kind);
            return false;
          }
          p.x=nx; p.y=ny; p.distanceLeft-=step;
          return p.distanceLeft>0 && p.x>-20 && p.x<g.canvas.width+20 && p.y>-20 && p.y<g.canvas.height+20;
        }
        if(!p.target || p.target.dead) return false;
        const dx = p.target.x - p.x, dy = p.target.y - p.y;
        const dist = Math.hypot(dx,dy);
        const step = p.speed*dt;
        if(dist < CONFIG.hitbox.homingHitDist || step >= dist){
          this.resolvePlayerHit(p);
          return false;
        }
        p.x += dx/dist*step; p.y += dy/dist*step;
        return true;
      } else {
        // 발사 시 고정한 핵 표면에 닿으면 소멸한다. 영웅 영역으로 통과하지 않는다.
        const dx = p.target.x - p.x, dy = p.target.y - p.y;
        const dist = Math.hypot(dx,dy);
        const step2 = p.speed*dt;
        if(dist <= 1e-7 || step2 >= dist){
          const fromX=p.x, fromY=p.y;
          p.x=p.target.x;p.y=p.target.y;
          // 근접 타격과 같은 연출 — 도달 방향만 탄의 진행 방향에서 가져온다.
          const d0=Math.hypot(fromX-p.target.x,fromY-p.target.y);
          g.effects?.coreImpact(p.target,d0>1e-7?{x:(fromX-p.target.x)/d0,y:(fromY-p.target.y)/d0}:{x:0,y:-1});
          g.applyDamageToPlayer(this.computeIncomingDamage(p.dmg),p.target);
          return false;
        }
        p.x += dx/dist*step2; p.y += dy/dist*step2;
        return true;
      }
    });
  }
  segmentDistance(px,py,x1,y1,x2,y2){
    const dx=x2-x1,dy=y2-y1,len2=dx*dx+dy*dy;
    const proj=len2?clamp(((px-x1)*dx+(py-y1)*dy)/len2,0,1):0;
    return Math.hypot(px-(x1+proj*dx),py-(y1+proj*dy));
  }
  // [2026-09-14] 투사체 렌더도 MISSILE_DEFS.render에서 모양을 읽는다.
  // 정의가 없는 종류(기본 공격, 적 탄)는 기본 구체로 떨어진다.
  static RENDER = {
    bolt(ctx,p){
      const flicker=Math.sin(performance.now()/35+p.x)*4;
      ctx.strokeStyle=ctx.fillStyle; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(p.x-8,p.y+flicker); ctx.lineTo(p.x,p.y-flicker); ctx.lineTo(p.x+8,p.y+flicker); ctx.stroke();
    },
    lance(ctx,p){
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(Math.atan2(p.target.y-p.y,p.target.x-p.x));
      ctx.fillStyle=PALETTE.arcane; ctx.fillRect(-9,-4,18,8);
      ctx.fillStyle='#ffffff'; ctx.beginPath(); ctx.moveTo(10,0);ctx.lineTo(3,-6);ctx.lineTo(3,6);ctx.closePath();ctx.fill();ctx.restore();
    },
    orb(ctx,p,spec){
      ctx.beginPath(); ctx.arc(p.x,p.y,spec?.radius??4,0,Math.PI*2); ctx.fill();
    },
  };
  // 미사일이 아닌 플레이어 투사체(스킬 탄)의 모양.
  static NON_MISSILE_RENDER = { strong_single:{shape:'lance'} };
  static DEFAULT_RENDER = { shape:'orb', radius:4 };
  draw(ctx){
    ctx.save();
    // 잔상을 먼저 깔고 그 위에 탄을 그린다.
    this.projectiles.forEach(p=>{
      if(!p.trail?.length) return;
      const color=p.owner==='enemy' ? PALETTE.hp : (CONFIG.attackModules[p.kind]?.color || PALETTE.accent);
      ctx.strokeStyle=color; ctx.shadowBlur=6; ctx.shadowColor=color; ctx.lineCap='round';
      for(let i=1;i<p.trail.length;i++){
        const ratio=i/p.trail.length;
        ctx.globalAlpha=ratio*.45; ctx.lineWidth=1+ratio*2;
        ctx.beginPath(); ctx.moveTo(p.trail[i-1].x,p.trail[i-1].y); ctx.lineTo(p.trail[i].x,p.trail[i].y); ctx.stroke();
      }
      if(p.trail.length){
        const last=p.trail[p.trail.length-1];
        ctx.globalAlpha=.5; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.moveTo(last.x,last.y); ctx.lineTo(p.x,p.y); ctx.stroke();
      }
    });
    ctx.globalAlpha=1;
    this.projectiles.forEach(p=>{
      const moduleDef=p.owner==='player' ? CONFIG.attackModules[p.kind] : null;
      ctx.fillStyle = p.owner==='enemy' ? PALETTE.hp : (moduleDef?.color || PALETTE.accent);
      ctx.shadowBlur=10; ctx.shadowColor=ctx.fillStyle;
      const spec = (p.owner==='player'
        ? (MISSILE_DEFS[p.kind]?.render ?? CombatSystem.NON_MISSILE_RENDER[p.kind])
        : null) || CombatSystem.DEFAULT_RENDER;
      (CombatSystem.RENDER[spec.shape] || CombatSystem.RENDER.orb)(ctx,p,spec);
    });
    ctx.restore();
  }
}

/* =====================================================================
   [EnemySystem] §11,12 — 스폰, 이동, 타입 행동, 사망/에너지 보상
   ===================================================================== */
class EnemySystem {
  constructor(game){
    this.game = game;
    this.enemies = []; // {id,type,hp,maxHp,atk,atkSpeed,x,y,waveIndex,stopped,attackCd,dead,isBoss}
    this.nextId = 1;
  }
  // [2026-09-04] HP와 ATK가 서로 다른 계수로 성장한다.
  hpMultiplier(difficulty){ return 1 + (difficulty-1) * CONFIG.enemy.hpStepPct; }
  atkMultiplier(difficulty){ return 1 + (difficulty-1) * CONFIG.enemy.atkStepPct; }

  spawnEnemy(type, difficulty, waveIndex, speedMul=1){
    const g = this.game;
    const typeDef = CONFIG.enemy.types[type];
    const canvasW = g.canvas.width;
    let hp = RunConfig.enemyBaseStat('hp') * this.hpMultiplier(difficulty) * typeDef.hpMul;
    let atk = RunConfig.enemyBaseStat('atk') * this.atkMultiplier(difficulty) * typeDef.atkMul;
    const e = {
      id: this.nextId++, type, isBoss:false, bossKind:null,
      hp: Math.round(hp), maxHp: Math.round(hp), atk: Math.round(atk),
      def:Math.max(0,RunConfig.enemyBaseStat('def')*typeDef.defMul),
      atkSpeed: CONFIG.enemy.base.atkSpeed,
      // 배경의 좌우 난간·용암을 제외한 진입로 안에서 개별 무작위 분산한다.
      x: rand(CONFIG.field.spawnMargin,canvasW-CONFIG.field.spawnMargin), y: -20,
      waveIndex, stopped:false, attackCd: rand(0,0.5), dead:false,
      statuses:{},
      // 아키타입 속도 배율은 도달 시간을 나눈다(돌격전 1.4 → 근접 7초가 5초로 당겨진다).
      travelTimeSec: (typeDef.travelTimeSec || CONFIG.enemy.base.travelTimeSec)/Math.max(0.1,Number(speedMul)||1),
    };
    this.prepareApproach(e);
    this.enemies.push(e);
    return e;
  }

  // 소환 위치부터 실제 공격 위치까지의 거리를 사용한다. 보스의 y=-30도 포함한다.
  // 기본 10초는 이동에 전달되는 게임 시간 기준이며, 기존 히트스톱/승패 슬로우는 유지한다.
  prepareApproach(e){
    const core=CoreField.position(),dx=core.x-e.x,dy=core.y-e.y;
    const distance=Math.hypot(dx,dy),ux=distance>0?dx/distance:0,uy=distance>0?dy/distance:1;
    const typeDef=CONFIG.enemy.types[e.type];
    const clearance=CONFIG.field.coreRadius+enemyVisualSize(e)/2+CONFIG.field.enemyContactGap;
    const range=e.type==='ranged'?distance*typeDef.rangePct:0;
    const stopDistance=Math.max(clearance,range);
    const travelDistance=Math.max(0,distance-stopDistance);
    e.attackPos={x:e.x+ux*travelDistance,y:e.y+uy*travelDistance};
    e.coreTarget=CoreField.impactPoint(e);
    // 출현 위치마다 다른 대각선 이동 거리를 사용해 공격 위치까지 10초를 맞춘다.
    e.moveSpeed=travelDistance/e.travelTimeSec;
  }

  // §14 보스 HP = 해당 웨이브가 일반 웨이브였다면의 총 HP 합계 (ASSUMPTION 구성 사용)
  computeBossHp(waveCfg){
    const comp = RunConfig.bossComposition(waveCfg.wave);
    const mul = this.hpMultiplier(waveCfg.difficulty);
    let total = 0;
    ENEMY_TYPE_KEYS.forEach(type=>{
      const cnt = comp?.[type] || 0;
      total += cnt * RunConfig.enemyBaseStat('hp') * mul * (CONFIG.enemy.types[type]?.hpMul || 0);
    });
    return Math.round(total);
  }

  spawnBoss(waveCfg, kind){
    const g = this.game;
    // §16 "보스 타입은 에디터에서 선택" — 랜덤이 아니라 CONFIG.boss.midType/finalType 고정값 사용.
    const bossType = kind==='mid' ? CONFIG.boss.midType : CONFIG.boss.finalType;
    const hpExtraMul = kind==='mid' ? CONFIG.boss.midHpExtraMul : CONFIG.boss.finalHpExtraMul;
    const hp = Math.round(this.computeBossHp(waveCfg) * hpExtraMul);
    let atk = RunConfig.enemyBaseStat('atk') * this.atkMultiplier(waveCfg.difficulty) * CONFIG.enemy.types[bossType].atkMul;
    atk *= kind==='mid' ? CONFIG.boss.midAtkMul : CONFIG.boss.finalAtkMul;
    const e = {
      id: this.nextId++, type: bossType, isBoss:true, bossKind: kind,
      hp, maxHp: hp, atk: Math.round(atk),
      def:Math.max(0,RunConfig.enemyBaseStat('def')*CONFIG.enemy.types[bossType].defMul),atkSpeed: CONFIG.enemy.base.atkSpeed,
      x: g.canvas.width/2, y: -30, waveIndex: waveCfg.wave-1, stopped:false,
      attackCd: 0.5, dead:false,
      statuses:{},
      travelTimeSec: (CONFIG.enemy.types[bossType].travelTimeSec || CONFIG.enemy.base.travelTimeSec),
    };
    this.prepareApproach(e);
    this.enemies.push(e);
    logAction(`${kind==='mid'?'중간':'최종'}보스 등장 (HP ${hp})`);
    return e;
  }

  getNearestEnemy(){
    const g = this.game;
    let best=null, bestD=Infinity;
    this.enemies.forEach(e=>{
      if(e.dead) return;
      const d = Math.hypot(e.x-g.playerPos.x, e.y-g.playerPos.y);
      if(d<bestD){bestD=d;best=e;}
    });
    return best;
  }
  getHighestHpEnemy(){
    let best=null;
    this.enemies.forEach(e=>{ if(!e.dead && (!best || e.hp>best.hp)) best=e; });
    return best;
  }
  damageEnemy(e, dmg, sourceKind='basic',context={}){
    if(e.dead || this.game.ending) return false;
    const prepared=this.game.combatEffectSystem.beforeDamage(dmg,e,sourceKind,context);
    const hit=this.game.damageResolver.resolve(prepared);
    e.hp -= hit.finalDamage;
    this.game.stats.damageDealt+=hit.finalDamage;
    this.game.stats.pierceDamage+=hit.pierceDamage;
    if(hit.critical)this.game.stats.criticalHits++;
    this.game.effects.enemyHit(e,sourceKind);
    this.game.effects.queueDamage(e,hit);
    if(hit.critical) this.game.hitStop(CONFIG.presentation.hitStopSec);
    this.game.combatEffectSystem.afterDamage(e,sourceKind,context);
    if(e.hp<=0){
      e.dead = true;
      this.game.stats.enemiesKilled++;if(e.isBoss)this.game.stats.bossesKilled++;
      GameAudio.play(e.isBoss?'kill_boss':'kill');
      this.game.hitStop(e.isBoss?CONFIG.presentation.bossKillStopSec:CONFIG.presentation.killStopSec,!!e.isBoss);
      this.game.effects.enemyKilled(e);
      // [2026-09-04] 처치 보상은 에너지 직접 지급이 아니라 점수다. 점수가 일정량 쌓일 때마다
      // ScoreSystem이 에너지를 지급한다(목돈 지급을 없애 생성 간격 상한과 맞추기 위함).
      const points = e.isBoss
        ? (e.bossKind==='mid' ? CONFIG.scoring.midBoss : CONFIG.scoring.finalBoss)
        : CONFIG.scoring.normalKill;
      if(points>0){
        this.game.scoreSystem.add(points);
        spawnFloatNumber(this.game.floatLayer, e.x+8, e.y, `+${points}`, 'enhance');
      }
      if(e.isBoss && e.bossKind==='mid'){
        this.game.orderGaugeSystem.addStock(CONFIG.orderGauge.midBossOrders);
        logAction(`중간보스 처치! ${points}점, 주문서 +${CONFIG.orderGauge.midBossOrders}`);
      } else if(e.isBoss) logAction('최종보스 처치!');
      return true;
    }
    return false;
  }
  // [2026-09-16] 열풍 분출 — 핵 중심에서 바깥으로 실제 좌표를 민다. 공격 위치는 그대로라 다시 걸어온다.
  knockback(e,px){
    const core=CoreField.position();let ux=e.x-core.x,uy=e.y-core.y;const d=Math.hypot(ux,uy);
    if(d>1e-6){ux/=d;uy/=d;}else{ux=0;uy=-1;}
    const w=this.game.canvas.width,nx=clamp(e.x+ux*px,8,w-8),ny=Math.max(-30,e.y+uy*px),mx=nx-e.x,my=ny-e.y;
    if(Math.hypot(mx,my)<0.5)return false;
    e.x=nx;e.y=ny;e.stopped=false;
    if(!this.game.prefersReducedMotion()){e.fxOffsetX=-mx;e.fxOffsetY=-my;e.fxOffsetMax=0.25;e.fxOffsetLife=0.25;}
    return true;
  }
  update(dt){
    const g = this.game;
    this.enemies = this.enemies.filter(e=>!e.dead);
    this.enemies.forEach(e=>{
      if(e.fxOffsetLife>0) e.fxOffsetLife=Math.max(0,e.fxOffsetLife-dt);
      const typeDef = CONFIG.enemy.types[e.type];
      // [2026-09-16] 스턴은 이동·공격을 멈추고, 감속은 이동·공격을 함께 늦춘다(인철). 보스도 같다.
      let active=dt;
      if(e.stunLeft>0){const used=Math.min(active,e.stunLeft);e.stunLeft-=used;active-=used;}
      if(e.slowLeft>0){const used=Math.min(dt,e.slowLeft);e.slowLeft-=used;active-=Math.min(active,used)*clamp(e.slowPct||0,0,0.95);}
      let attackDt=active;
      const dx=e.attackPos.x-e.x,dy=e.attackPos.y-e.y;
      const remaining=Math.hypot(dx,dy);
      if(remaining>1e-7){
        const moveTime=remaining/e.moveSpeed;
        if(moveTime>active+1e-7){
          const step=e.moveSpeed*active;
          e.x+=dx/remaining*step;e.y+=dy/remaining*step;
          e.stopped=false;
          e.fxWindup=0;               // 이동 중에는 예비 자세를 남기지 않는다
          return;
        }
        // 목적지에 고정해 큰 프레임에서도 핵을 통과하거나 왕복하지 않게 한다.
        attackDt=Math.max(0,active-moveTime);
      }
      e.x=e.attackPos.x;e.y=e.attackPos.y;
      e.stopped=true;
      e.attackCd-=attackDt;
      // [2026-09-18 연출 세션 A] 공격이 오기 전에 보이게 한다. 남은 쿨다운이 예비 구간에
      // 들어오면 표시용 필드만 찍고, EnemySystem.draw가 그 값으로 기울기·확대를 그린다.
      // attackCd·atkSpeed·피해량은 건드리지 않으므로 판정은 그대로다.
      const windup=CONFIG.presentation.windupSec;
      e.fxWindup=(attackDt>0&&windup>0&&e.attackCd<windup)?clamp(1-e.attackCd/windup,0,1):0;
      if(e.attackCd<=0){
        e.attackCd=1/e.atkSpeed;
        e.fxWindup=0;                  // 타격 순간 원래 크기로 스냅
        if(e.type==='ranged'){
          g.effects?.muzzleFlash(e.x,e.y);
          g.combatSystem.projectiles.push({
            x:e.x,y:e.y,owner:'enemy',dmg:e.atk,
            speed:typeDef.projectileSpeed,target:{...e.coreTarget},
          });
        }else{
          // 핵 표면에 임팩트를 먼저 놓고 피해를 적용한다 — 순서가 바뀌면 패배 연출이
          // 시작된 뒤에 링이 떠서 어색하다.
          const at=e.coreTarget, d=Math.hypot(e.x-at.x,e.y-at.y);
          g.effects?.coreImpact(at,d>1e-7?{x:(e.x-at.x)/d,y:(e.y-at.y)/d}:{x:0,y:-1});
          g.applyDamageToPlayer(g.combatSystem.computeIncomingDamage(e.atk),at);
        }
      }
    });
    this.syncBossHpBar();
  }
  /* [2026-09-18 연출 세션 A · A-5] 전장 상단 보스 HP바.
     스프라이트 위 58px 바는 그대로 두고 하나 더 둔다 — 물량 속에서 보스 HP가
     어디 있는지 찾지 않게 하는 것이 목적이다. 매 프레임 DOM 쓰기는 width 하나뿐이다.
     보스는 WAVE당 한 기라 첫 보스만 본다. */
  syncBossHpBar(){
    const bar=$('#boss-hp'), fill=$('#boss-hp-fill');
    if(!bar||!fill) return;
    const boss=this.enemies.find(e=>e.isBoss&&!e.dead);
    if(boss){
      const pct=clamp(boss.hp/boss.maxHp,0,1)*100;
      if(this.bossBarId!==boss.id){
        // 새 보스 — 0에서 시작해 현재 비율까지 0.6초에 채운다.
        this.bossBarId=boss.id;
        bar.classList.remove('is-defeated');
        bar.classList.add('is-active','is-spawning');
        fill.style.width='0%';
        // 다음 프레임에 목표 폭을 줘야 transition이 걸린다.
        requestAnimationFrame(()=>{ if(this.bossBarId===boss.id) fill.style.width=pct+'%'; });
        setTimeout(()=>bar.classList.remove('is-spawning'),650);
      } else {
        fill.style.width=pct+'%';
      }
      return;
    }
    if(this.bossBarId!=null){
      // 보스가 사라졌다 — 갈라지며 사라진다.
      this.bossBarId=null;
      bar.classList.add('is-defeated');
      setTimeout(()=>{ bar.classList.remove('is-active','is-defeated'); fill.style.width='0%'; },460);
    }
  }
  draw(ctx){
    this.enemies.forEach(e=>{
      const baseColor = e.isBoss ? PALETTE.energy : (e.type==='tank' ? PALETTE.arcane : e.type==='ranged' ? PALETTE.accent : PALETTE.hp);
      const color = performance.now()<e.hitFlashUntil ? '#ffffff' : baseColor;
      const r = enemyHitRadius(e); // 판정 반경은 유지하고 장식 스프라이트는 읽기 쉬운 크기로 그린다
      const visualSize=enemyVisualSize(e);
      ctx.save();
      const sprite=e.isBoss?(e.bossKind==='final'?9:8):(e.type==='melee'?5:e.type==='ranged'?6:7);
      e.fxSprite=sprite; e.fxSize=visualSize;   // 처치 잔상이 같은 그림·크기를 쓰게 한다
      const bob=e.stopped?0:Math.sin(performance.now()/130+e.id)*1.1;
      // [2026-09-15] 밀림과 압축은 표시 좌표에만 얹는다. e.x/e.y는 그대로라 히트박스·조준은 불변이다.
      const kt=e.fxOffsetMax?clamp(e.fxOffsetLife/e.fxOffsetMax,0,1):0, ease=kt*kt;
      const ox=(e.fxOffsetX||0)*ease, oy=(e.fxOffsetY||0)*ease;
      const sq=clamp(1-(performance.now()-(e.fxSquashAt||-99999))/(CONFIG.presentation.squashSec*1000),0,1);
      const amt=CONFIG.presentation.squashAmount*sq;
      // [2026-09-18 연출 세션 A] 예비동작 — 핵 쪽으로 기울며 커진다. 표시 좌표만 바꾼다.
      const wu=this.game.prefersReducedMotion()?0:clamp(e.fxWindup||0,0,1);
      let lx=0,ly=0;
      if(wu>0){
        const at=e.coreTarget||this.game.playerPos, d=Math.hypot(at.x-e.x,at.y-e.y);
        if(d>1e-7){const lean=CONFIG.presentation.windupLeanPx*wu;lx=(at.x-e.x)/d*lean;ly=(at.y-e.y)/d*lean;}
      }
      const dx0=e.x+ox+lx, dy0=e.y+oy+bob+ly;
      ctx.fillStyle='#171C2066';ctx.beginPath();ctx.ellipse(e.x,e.y+r*.65,r*.9,r*.35,0,0,Math.PI*2);ctx.fill();
      if(performance.now()<e.hitFlashUntil){ctx.shadowBlur=8;ctx.shadowColor='#ffffff';}
      if(amt>0){ ctx.translate(dx0,dy0); ctx.scale(1+amt,1-amt); ctx.translate(-dx0,-dy0); }
      const wuScale=1+CONFIG.presentation.windupScale*wu;
      if(wu>0){ ctx.translate(dx0,dy0); ctx.scale(wuScale,wuScale); ctx.translate(-dx0,-dy0); }
      if(!GameArt.drawSprite(ctx,sprite,dx0,dy0,visualSize)){ctx.fillStyle=color;ctx.beginPath();ctx.arc(dx0,dy0,r,0,Math.PI*2);ctx.fill();}
      ctx.restore();
      // hp bar — 스프라이트와 같이 밀려야 떨어져 보이지 않는다
      const w = e.isBoss ? 58 : 30;
      const hpPct = clamp(e.hp/e.maxHp,0,1);
      ctx.fillStyle = '#171C20CC'; ctx.fillRect(e.x+ox-w/2, e.y+oy-visualSize*.42, w, 4);
      ctx.fillStyle = '#5CCB8A'; ctx.fillRect(e.x+ox-w/2, e.y+oy-visualSize*.42, w*hpPct, 4);
      const statuses=Object.keys(e.statuses||{}).filter(id=>StatusEffectTable[id]);
      // [2026-09-18 연출 세션 A] 글자만으로는 물량전에서 안 보인다. 글자는 그대로 두고
      // 스프라이트 위에 시각 신호를 더한다. 융해는 주황 틴트, 감전은 스파크 점.
      if(statuses.includes('melted')){
        ctx.save();
        ctx.globalAlpha=.28; ctx.fillStyle=StatusEffectTable.melted.color;
        ctx.beginPath(); ctx.arc(dx0,dy0,visualSize*.34,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }
      if(statuses.includes('shocked')&&!this.game.prefersReducedMotion()){
        ctx.save();
        // 0.3초 주기로 자리를 바꾸는 점 3개. id를 섞어 적마다 위상이 다르다.
        const phase=Math.floor(performance.now()/300)+e.id;
        ctx.fillStyle=StatusEffectTable.shocked.color;
        ctx.shadowBlur=6; ctx.shadowColor=StatusEffectTable.shocked.color;
        for(let i=0;i<3;i++){
          const a=((phase+i*2)%6)/6*Math.PI*2;
          const rr=visualSize*.36;
          ctx.beginPath();
          ctx.arc(dx0+Math.cos(a)*rr,dy0+Math.sin(a)*rr*.7,1.5,0,Math.PI*2);
          ctx.fill();
        }
        ctx.restore();
      }
      statuses.forEach((id,index)=>{
        const def=StatusEffectTable[id];ctx.save();ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.fillStyle=def.color;ctx.shadowBlur=5;ctx.shadowColor=def.color;
        ctx.fillText(def.short,e.x+(index-(statuses.length-1)/2)*10,e.y+visualSize*.42+8);ctx.restore();
      });
      const cc=[];if(e.stunLeft>0)cc.push(SKILL_DEFS.stun);if(e.slowLeft>0)cc.push(SKILL_DEFS.slow);
      cc.forEach(({icon,color:c},i)=>{ctx.save();ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillStyle=c;ctx.shadowBlur=5;ctx.shadowColor=c;ctx.fillText(icon,e.x+ox+(i-(cc.length-1)/2)*11,e.y+oy-visualSize*.42-5);ctx.restore();});
    });
  }
}

/* =====================================================================
   [WaveSystem] §13,14,15 — 최대 30 WAVE 진행, 스폰 타이밍, 조기 전환, 보스
   ===================================================================== */
class WaveSystem {
  constructor(game){
    this.game = game;
    this.waveIndex = 0; // 0-based
    this.waveTimer = 0;
    this.spawnScheduled = [];
    this.waveEnemyTotal = 0;
    this.finished = false;
  }
  get currentWaveCfg(){ return RunConfig.waves()[this.waveIndex]; }

  // 세 스폰 비율을 모두 사용하고, 반올림 뒤에도 총 개체수가 정확히 보존되도록 배분한다.
  allocateSpawnSizes(total, ratios=CONFIG.waveTiming.spawnRatios){
    const weights = ratios.map(v=>Math.max(0, Number(v) || 0));
    const sum = weights.reduce((a,b)=>a+b, 0);
    if(sum<=0) return weights.map((_,i)=>i===0 ? total : 0);
    const exact = weights.map(v=>total*v/sum);
    const sizes = exact.map(Math.floor);
    let remainder = total - sizes.reduce((a,b)=>a+b, 0);
    const order = exact.map((v,i)=>({i, fraction:v-sizes[i]}))
      .sort((a,b)=>b.fraction-a.fraction);
    for(let i=0;i<remainder;i++) sizes[order[i%order.length].i]++;
    return sizes;
  }

  startWave(idx){
    this.waveIndex = idx;
    this.waveTimer = 0;
    const cfg = this.currentWaveCfg;
    this.game.currentWaveCfg = cfg;
    $('#wave-label').textContent = t('battle.waveLabel',{n:cfg.wave,total:RunConfig.waves().length});
    // [2026-09-18 확정(인철)] WAVE 시작 보너스 — waveStartBonusFromWave번째 WAVE부터
    // WAVE가 시작될 때마다 점수를 지급한다(WAVE 1은 제외).
    if(cfg.wave >= CONFIG.scoring.waveStartBonusFromWave){
      this.game.scoreSystem.add(CONFIG.scoring.waveStartBonus);
    }
    // [2026-09-17] WAVE 시작 float 텍스트는 없애고 전장 좌상단 배지에 상시 표기한다.
    const label = waveTypeName(cfg,'label');
    this.renderWaveTypeBadge(cfg, idx>0);
    if(this.game.effects){
      this.game.effects.ring(this.game.playerPos.x,this.game.playerPos.y-55,PALETTE.accent,95,.6,3);
    }

    if(cfg.type === 'normal'){
      const list = [];
      ENEMY_TYPE_KEYS.forEach(type=>{ for(let i=0;i<(cfg[type]||0);i++) list.push(type); });
      this.waveEnemyTotal = list.length;
      const timing = waveTimingFor(cfg);
      const shuffled = shuffle(list);
      const sizes = this.allocateSpawnSizes(this.waveEnemyTotal, timing.spawnRatios);
      let cursor = 0;
      this.spawnScheduled = sizes.map((size,i)=>{
        const batch = shuffled.slice(cursor, cursor+sizes[i]);
        cursor += sizes[i];
        return { time: timing.spawnTimesSec[i] ?? 0, types: batch, done:false };
      });
      logAction(`WAVE ${cfg.wave} 시작 — ${label} (${this.waveEnemyTotal}기)`);
    } else {
      this.waveEnemyTotal = 1;
      this.spawnScheduled = [{ time:0, boss: cfg.type==='midboss'?'mid':'final', done:false }];
      GameAudio.play('boss_alert');
      this.game.showBossAlert(cfg.type==='finalboss'?'final':'mid');
      logAction(`WAVE ${cfg.wave} 시작 — ${label}`);
    }
  }

  /* [2026-09-18 연출 세션 A · A-4] WAVE를 넘길 때 배지에 비트를 준다.
     조기 전환이든 시간 경과든 "한 WAVE를 넘겼다"는 신호가 없어서 리듬이 끊겼다.
     캡션을 잠깐 CLEAR로 바꾸고 배지를 팝시킨다. 바로 뒤에 startWave가 새 WAVE
     이름을 넣으며 fx-next 슬라이드를 얹으므로 둘이 한 동작으로 읽힌다. */
  playWaveClearBeat(){
    const badge=$('#wave-type-badge'), caption=badge?.querySelector('.wave-type-caption');
    GameAudio.play('wave_clear');
    if(!badge||!caption) return;
    restartCssAnimation(badge,'fx-clear');
    caption.textContent=t('battle.waveCaptionClear');
    clearTimeout(this.captionTimer);
    this.captionTimer=setTimeout(()=>{ caption.textContent=t('battle.waveCaption'); },520);
  }
  renderWaveTypeBadge(cfg,slide=false){
    const badge=$('#wave-type-badge'), name=$('#wave-type-name');
    if(!badge||!name) return;
    name.textContent=waveTypeName(cfg,'short');
    badge.classList.toggle('is-boss', cfg?.type!=='normal');
    if(slide) restartCssAnimation(badge,'fx-next');
  }

  currentWaveAliveCount(){
    return this.game.enemySystem.enemies.filter(e=>e.waveIndex===this.waveIndex && !e.dead).length;
  }

  update(dt){
    if(this.finished || this.game.ending) return;
    this.waveTimer += dt;
    const cfg = this.currentWaveCfg;

    this.spawnScheduled.forEach(s=>{
      if(!s.done && this.waveTimer >= s.time){
        s.done = true;
        if(s.boss){
          this.game.enemySystem.spawnBoss(cfg, s.boss);
        } else {
          s.types.forEach(type=>this.game.enemySystem.spawnEnemy(type, cfg.difficulty, this.waveIndex, waveSpeedMul(cfg)));
        }
      }
    });

    const allBatchesSpawned = this.spawnScheduled.every(s=>s.done);
    const alive = this.currentWaveAliveCount();

    let shouldAdvance = false;
    if(cfg.type === 'normal'){
      if(this.waveTimer >= waveTimingFor(cfg).durationSec) shouldAdvance = true;
      // ASSUMPTION: 조기 전환 판정은 해당 웨이브 스폰이 전부 끝난 뒤부터 체크 (스폰 도중 오판 방지)
      if(allBatchesSpawned && this.waveEnemyTotal>0){
        if(alive / this.waveEnemyTotal <= CONFIG.waveTiming.earlyTransitionAlivePct) shouldAdvance = true;
      }
    } else {
      // 보스 웨이브: 보스 처치 시 종료 (ASSUMPTION: 문서에 보스전 자체 타이머 규정 없음)
      if(allBatchesSpawned && alive === 0) shouldAdvance = true;
    }

    if(shouldAdvance){
      this.game.completedWaves=this.waveIndex+1;
      if(!this.game.host.progress(this.game.runId,this.game.completedWaves)){
        this.game.running=false; this.game.generator.stopHold();
        this.game.host.warn('notice.progressSaveFailed'); return;
      }
      if(this.waveIndex >= RunConfig.waves().length-1){
        this.finished = true;
        this.game.onClear();          // 마지막 WAVE는 클리어 시네마틱이 받는다
      } else {
        this.playWaveClearBeat();
        this.startWave(this.waveIndex+1);
      }
    }
  }
}

