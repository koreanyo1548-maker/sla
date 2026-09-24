/* ===== heroes.js ===== */
/* =====================================================================
   [HeroFieldSystem] 미사일별 수호자 배치·소환·강화 연출
   ---------------------------------------------------------------------
   소환된 수호자는 해당 미사일의 발사 원점만 가진다. HP·적의 목표·편성 패시브는
   공용 용광로 핵에 있으며 수호자는 적의 공격 대상이 아니다.
   ===================================================================== */
class HeroFieldSystem {
  constructor(game){this.game=game;this.reset();}
  reset(){this.units={};}
  slotPosition(key){
    const keys=CONFIG.moduleKeys,index=keys.indexOf(key);
    return {x:CONFIG.field.width*(index+1)/(keys.length+1),y:CONFIG.field.height-CONFIG.field.playerOffsetY};
  }
  origin(key){
    if(!this.units[key])return this.game.playerPos;
    const p=this.slotPosition(key);return {x:p.x-27,y:p.y-75};
  }
  upgrade(key,level){
    const now=performance.now(),existing=this.units[key];
    if(existing){existing.level+=level;existing.upgradedAt=now;}
    else {
      const id=RunConfig.partySnapshot?.formation?.[key]||DEFAULT_FORMATION[key];
      this.units[key]={id,level,summonedAt:now,upgradedAt:now,shotAt:-10000};
    }
    const p=this.slotPosition(key),color=CONFIG.attackModules[key].color;
    this.game.effects.ring(p.x,p.y,color,existing?27:44,.45,2);
    this.game.effects.emit(p.x,p.y-25,color,existing?5:16,20,90,.5,2);
    const labelKey=CharacterTable[this.units[key].id]?.nameKey||CONFIG.attackModules[key].labelKey;
    const label=t(labelKey);
    spawnFloatNumber(this.game.floatLayer,p.x,p.y-85,existing?t('battle.hero.upgrade',{n:level}):t('battle.hero.summon',{name:label}), 'enhance');
  }
  shot(key){
    const unit=this.units[key];if(!unit)return;
    unit.shotAt=performance.now();
    // [2026-09-18 연출 세션 A] 머즐 플래시 구현은 VisualEffects.playerShot 한 곳에 둔다.
    // 영웅이 있을 때는 그 영웅 위치, 없을 때는 핵 위치에서 같은 연출이 난다.
    this.game.effects.playerShot(key,this.origin(key));
  }
  draw(ctx){
    const g=this.game,now=performance.now(),reduced=g.prefersReducedMotion();
    for(const key of CONFIG.moduleKeys){
      const p=this.slotPosition(key),unit=this.units[key],color=CONFIG.attackModules[key].color;
      ctx.save();
      ctx.fillStyle=unit?'#06151899':'#0b181766';
      ctx.beginPath();ctx.ellipse(p.x,p.y+4,28,8,0,0,Math.PI*2);ctx.fill();
      if(!unit){
        ctx.strokeStyle='#7898a24d';ctx.lineWidth=1;ctx.stroke();
        ctx.globalAlpha=.32;GameArt.drawSprite(ctx,12+CONFIG.moduleKeys.indexOf(key),p.x,p.y-7,31);ctx.globalAlpha=1;
        ctx.fillStyle='#a0b2b7';ctx.font='10px system-ui';ctx.textAlign='center';
        ctx.fillText(t(CONFIG.attackModules[key].labelKey),p.x,p.y+22);ctx.restore();continue;
      }
      const ratio=reduced?1:clamp((now-unit.summonedAt)/450,0,1);
      const shot=reduced?0:Math.max(0,1-(now-unit.shotAt)/180);
      // [2026-09-18 연출 세션 A] 0.55 → 0.9초. 주문서 스파크가 도착한 뒤에도 남아 있어야
      // 어느 영웅이 강해졌는지 눈에 들어온다.
      const pulse=Math.max(0,1-(now-unit.upgradedAt)/900);
      ctx.strokeStyle=color;ctx.globalAlpha=.5;ctx.lineWidth=1.5;ctx.stroke();ctx.globalAlpha=ratio;
      if(pulse>0){ctx.shadowColor=color;ctx.shadowBlur=12*pulse;}
      const breath=reduced?0:Math.sin(g.elapsedTime*2.6+CONFIG.moduleKeys.indexOf(key));
      const bob=breath*1.2;
      const size=104,spriteTop=p.y-size*.88+(1-ratio)*18+bob+shot*4;
      // Breathing and recoil move the illustration only. origin() remains the aiming source.
      ctx.save();ctx.translate(p.x,p.y-10);ctx.rotate(-shot*.055);
      ctx.scale(1-breath*.006+shot*.035,1+breath*.009-shot*.025);ctx.translate(-p.x,-p.y+10);
      const ok=GameArt.drawFighter(ctx,unit.id,p.x-size/2,spriteTop,size);
      if(!ok){ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x,p.y-25,14,0,Math.PI*2);ctx.fill();}
      ctx.restore();
      ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.textAlign='center';
      // Compact level plaques keep four guardians readable on a narrow iframe.
      const label=`Lv.${unit.level}`;ctx.font='700 10px system-ui';
      const labelWidth=Math.max(32,ctx.measureText(label).width+12);
      ctx.fillStyle='#101f2ad9';ctx.fillRect(p.x-labelWidth/2,spriteTop-16,labelWidth,15);
      ctx.fillStyle=color;ctx.fillRect(p.x-labelWidth/2,spriteTop-16,2,15);
      ctx.fillStyle='#f6e7c7';ctx.fillText(label,p.x+1,spriteTop-5);
      ctx.restore();
    }
  }
}
