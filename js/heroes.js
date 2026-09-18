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
    const label=CharacterTable[this.units[key].id]?.name||CONFIG.attackModules[key].label;
    spawnFloatNumber(this.game.floatLayer,p.x,p.y-85,existing?`강화 +${level}`:`${label} 소환`, 'enhance');
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
        ctx.strokeStyle='#3D4A4F88';ctx.lineWidth=1;ctx.stroke();
        ctx.fillStyle='#747A78';ctx.font='11px system-ui';ctx.textAlign='center';
        ctx.fillText(CONFIG.attackModules[key].label,p.x,p.y+22);ctx.restore();continue;
      }
      const t=reduced?1:clamp((now-unit.summonedAt)/450,0,1);
      const shot=reduced?0:Math.max(0,1-(now-unit.shotAt)/180);
      // [2026-09-18 연출 세션 A] 0.55 → 0.9초. 주문서 스파크가 도착한 뒤에도 남아 있어야
      // 어느 영웅이 강해졌는지 눈에 들어온다.
      const pulse=Math.max(0,1-(now-unit.upgradedAt)/900);
      ctx.strokeStyle=color;ctx.globalAlpha=.5;ctx.lineWidth=1.5;ctx.stroke();ctx.globalAlpha=t;
      if(pulse>0){ctx.shadowColor=color;ctx.shadowBlur=12*pulse;}
      const bob=reduced?0:Math.sin(g.elapsedTime*2.6+CONFIG.moduleKeys.indexOf(key))*1.2;
      const size=104,spriteTop=p.y-size*.88+(1-t)*18+bob+shot*4;
      const ok=GameArt.drawFighter(ctx,unit.id,p.x-size/2,spriteTop,size);
      if(!ok){ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x,p.y-25,14,0,Math.PI*2);ctx.fill();}
      ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.textAlign='center';
      ctx.font='600 11px system-ui';ctx.fillStyle='#F2E9D8';
      const name=CharacterTable[unit.id]?.name||MISSILE_DEFS[key].label;
      ctx.fillText(`${MISSILE_DEFS[key].icon} ${name} Lv.${unit.level}`,p.x,spriteTop-6);
      ctx.restore();
    }
  }
}

