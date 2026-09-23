/* ===== core.js ===== */
/* =====================================================================
   Palette — canvas 그리기 색의 단일 소스. CSS 커스텀 프로퍼티에서 읽어
   스타일시트 팔레트와 어긋나지 않게 한다.
   ===================================================================== */
const PALETTE = (() => {
  const cs = getComputedStyle(document.documentElement);
  const v = name => cs.getPropertyValue(name).trim();
  // [2026-09-17] 별칭(--accent 등)이 아니라 원시 토큰을 읽는다. 별칭 값은 var(--primary)라
  // getPropertyValue가 그대로 돌려줄 수 있고, 그러면 캔버스 fillStyle이 무효가 된다.
  const pick = (token,fallback) => { const value=v(token); return /^#|^rgb|^hsl/.test(value) ? value : fallback; };
  return {
    accent: pick('--primary',   '#DDB86A'),
    ember:  pick('--explosion', '#F77A3D'),
    toxic:  pick('--scatter',   '#48C986'),
    arcane: pick('--laser',     '#A876E8'),
    skill:  pick('--chain',     '#5EDBF4'),
    hp:     pick('--danger',    '#F2645A'),
    energy: pick('--energy',    '#5EDBF4'),
  };
})();

/* =====================================================================
   Utility
   ===================================================================== */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
function rand(min, max){ return Math.random()*(max-min)+min; }
function randInt(min, max){ return Math.floor(rand(min, max+1)); }
function choice(arr){ return arr[randInt(0, arr.length-1)]; }
function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
// [2026-09-09] 적 히트박스 반지름. 판정(레이저·폭발·산탄)과 렌더가 같은 함수를 읽어
// 한쪽만 바뀌어 원과 판정이 어긋나는 일이 없게 한다.
// [2026-09-14] 미사일 고유 규칙 값 = 전역 기본값(CONFIG, 기본 0) + 편성 캐릭터 패시브 가산.
// 판정 코드는 이 함수만 부르고 어디서 값이 왔는지는 신경 쓰지 않는다.
function moduleRuleValue(moduleKey, ruleId, field=null){
  const def=CONFIG.attackModules[moduleKey]||{};
  const base=field ? Number(def[ruleId]?.[field]) : Number(def[ruleId]);
  const rule=RunConfig.partySnapshot?.moduleRules?.[moduleKey]?.[ruleId];
  const add=rule ? Number(field ? rule[field] : rule.value) : 0;
  return (Number.isFinite(base)?base:0) + (Number.isFinite(add)?add:0);
}
// 공격 종류 → 해당 미사일 키. 2차 폭발은 폭발 미사일로 집계한다. 미사일이 아니면 null.
function missileKeyForSource(sourceKind){
  if(sourceKind==='explosion_secondary') return 'explosion';
  return CONFIG.moduleKeys.includes(sourceKind) ? sourceKind : null;
}
// [2026-09-18] 중간보스·최종보스 판정 반경을 나눴다(기획서.md의 "단일 값의 한계" 해소) —
// 크기 배율(CONFIG.boss.midSizeMul/finalSizeMul)이 보스 종류마다 달라져 공용 값으로는
// 렌더와 판정이 더 이상 맞지 않는다.
function enemyHitRadius(e){
  if(!e.isBoss) return CONFIG.hitbox.enemyRadius;
  return e.bossKind==='final' ? CONFIG.hitbox.bossRadiusFinal : CONFIG.hitbox.bossRadiusMid;
}
// 적 몸체 크기를 핵 앞 정지 거리와 렌더링에서 함께 사용한다.
// [2026-09-18] 확정(인철): 중간보스·최종보스 기본 크기(78·92)에 CONFIG.boss의
// midSizeMul(1.2)·finalSizeMul(1.3)을 곱해 스프라이트를 키운다.
function enemyVisualSize(e){
  if(e.isBoss) return e.bossKind==='final'?92*CONFIG.boss.finalSizeMul:78*CONFIG.boss.midSizeMul;
  return e.type==='tank'?48:e.type==='ranged'?42:38;
}
const CoreField={
  position(){return {x:CONFIG.field.width/2,y:CONFIG.field.coreY};},
  // 모든 적의 목표는 같은 핵이다. 탄착·타격 이펙트는 접근 방향의 핵 표면에 놓는다.
  impactPoint(from){
    const p=this.position(),dx=from.x-p.x,dy=from.y-p.y,d=Math.hypot(dx,dy);
    if(d<1e-7)return p;
    const r=CONFIG.field.coreRadius;
    return {x:p.x+dx/d*r,y:p.y+dy/d*r};
  },
};
function projectileMaxRange(canvas){ return Math.hypot(canvas.width,canvas.height)*CONFIG.hitbox.projectileRangeMul; }
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){ const j=randInt(0,i); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
// [2026-09-16] 전투 하단 로그 줄을 없앴다(인철 확정). 표시 대상이 사라져도 호출부를
// 전부 고치지 않도록 여기서 흡수하며, 마지막 문구는 디버깅용으로 남긴다.
function logAction(msg){
  logAction.last = msg;
  const el = $('#action-log');
  if(!el) return;
  el.textContent = msg;
  restartCssAnimation(el, 'fx-log');
}
function restartCssAnimation(el, className){
  if(!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  el.addEventListener('animationend', ()=>el.classList.remove(className), {once:true});
}
// [2026-09-23] 확정(인철): 백만 이상 피해는 뒤 세 자리씩 a·b·c 단위로 접는다.
// 백만은 1000a, 십억은 1000b이며 실제 전투 계산값은 줄이지 않는다.
function damageUnit(index){
  let value=index,unit='';
  do{unit=String.fromCharCode(97+value%26)+unit;value=Math.floor(value/26)-1;}while(value>=0);
  return unit;
}
function formatDamage(n){
  if(n<1)return I18N.num(n,{min:1,max:1});
  const value=Math.round(n);
  if(value<1000000)return I18N.num(value);
  let divisor=1000,unitIndex=0;
  while(value/divisor>=1000000){divisor*=1000;unitIndex++;}
  return `${Math.floor(value/divisor)}${damageUnit(unitIndex)}`;
}
// Canvas 판정 좌표를 CSS로 표시되는 전투 컨테이너 좌표로 변환한다.
// 모바일에서는 canvas.width(440)와 표시 폭이 달라 이 변환 없이는 피해 숫자가 피격 지점에서 벗어난다.
function combatLayerPoint(container,x,y){
  const canvas=container?.querySelector?.('#combat-canvas');
  if(!canvas) return {x,y};
  const canvasRect=canvas.getBoundingClientRect();
  const layerRect=container.getBoundingClientRect();
  return {
    x:canvasRect.left-layerRect.left+x*(canvasRect.width/canvas.width),
    y:canvasRect.top-layerRect.top+y*(canvasRect.height/canvas.height),
  };
}
function spawnFloatNumber(container, x, y, text, cls){
  const d = document.createElement('div');
  d.className = 'float-num ' + cls;
  d.textContent = text;
  const p=combatLayerPoint(container,x,y);
  d.style.left = p.x + 'px';
  d.style.top = p.y + 'px';
  container.appendChild(d);
  setTimeout(()=>d.remove(), 700);
}
function spawnDamageStack(container,x,y,entries){
  if(!entries.length) return;
  const d=document.createElement('div');
  d.className='damage-stack';
  const p=combatLayerPoint(container,x,y);
  d.style.left=p.x+'px';
  d.style.top=p.y+'px';
  d.innerHTML=entries.map(entry=>{
    const crit=entry.critical?t('battle.critPrefix'):'';
    const pierce=entry.pierceDamage>0?`<em>${t('battle.pierce',{damage:formatDamage(entry.pierceDamage)})}</em>`:'';
    return `<span class="damage-value${entry.critical?' critical':''}" style="color:${DAMAGE_COLORS[entry.kind]||'#ffffff'}">${crit}-${formatDamage(entry.damage)}${pierce}</span>`;
  }).join('');
  container.appendChild(d);
  setTimeout(()=>d.remove(),720);
}

/* =====================================================================
   [GameState] §2 전체 게임 플로우 상태 관리
   ===================================================================== */
const GameState = {
  // 상태 → 표시할 화면. lobby·playing·clear·defeat 네 상태를 쓴다.
  // [2026-09-19 세션 7] 출전 준비 화면(start)을 없애 로비에서 바로 전투로 간다.
  SCREENS: { lobby:'#screen-lobby', playing:'#screen-game', clear:'#screen-result', defeat:'#screen-result' },
  current: 'lobby',
  set(state){
    this.current = state;$('#app').dataset.state=state;
    $$('.screen').forEach(s=>s.classList.remove('active'));
    const screen=this.SCREENS[state];
    if(screen) $(screen).classList.add('active');
    // 도구 버튼(종료·초기화)의 hidden을 화면에 맞춘다. campaign.js에 있고
    // 호출 시점은 항상 로딩 이후다. 이유는 그쪽 주석에 적었다.
    syncToolButtons();
  }
};

/* =====================================================================
   [RunConfig] §18 — 스테이지 시작 시 전달되는 런 설정
   ===================================================================== */
const RunConfig = {
  selectedSkills: [],
  skillSnapshot: null,
  // 전투 입장 시 4인 편성의 능력치·고정 패시브를 불변 스냅샷으로 전달한다.
  partySnapshot: null,
  // 성급에서 계산한 도감 진행도와 영구 전투 팩터. 저장값이 아니라 입장 시점의 불변 계산 결과다.
  codexSnapshot: null,
  // [2026-09-16 v0916_7] 스테이지·편성으로 확정되는 전투 수치. 이전에는 Campaign.enter가
  // CONFIG.player·CONFIG.enemy.base·CONFIG.waves를 직접 덮어써서, 같은 값이 CONFIG와
  // partySnapshot 두 경로로 읽혔고 에디터 입력이 입장 시 덮여 효과가 없었다.
  // 이제 CONFIG는 런 동안 설정 기본값 그대로이며 전투 코드는 아래 접근자만 읽는다.
  // { stageId, player:{atk,def,hp}, enemyBase:{hp,atk,def}, waves:[...], bossCompositions:{wave:{...}} }
  battle: null,
  playerStat(key){ return this.battle?.player?.[key] ?? CONFIG.player[key]; },
  enemyBaseStat(key){ return this.battle?.enemyBase?.[key] ?? CONFIG.enemy.base[key] ?? 0; },
  waves(){ return this.battle?.waves ?? buildStageWaves(DEFAULT_STAGE_COUNT,CONFIG.stage); },
  bossComposition(wave){ return (this.battle?.bossCompositions ?? buildBossCompositions(this.waves().length,CONFIG.stage,this.battle?.stageId??1))[wave]; },
  clear(){ this.selectedSkills=[]; this.skillSnapshot=null; this.partySnapshot=null; this.codexSnapshot=null; this.battle=null; },
};

// 전투 중 빠르게 구분할 수 있도록 미사일·강화 종류에 고정 아이콘과 강조색을 부여한다. 스킬은 SKILL_DEFS에 있다.
const MODULE_ICONS = Object.fromEntries(MISSILE_KEYS.map(key=>[key,MISSILE_DEFS[key].icon]));
const STAT_ICONS = {
  damage:'⚔', speed:'»',
  ...Object.fromEntries(MISSILE_KEYS.map(key=>[MISSILE_DEFS[key].special.stat,MISSILE_DEFS[key].special.icon])),
};
const DAMAGE_COLORS = {
  basic:'#F2E9D8',
  ...Object.fromEntries(MISSILE_KEYS.map(key=>[key,MISSILE_DEFS[key].color])),
  explosion_secondary:MISSILE_DEFS.explosion.color,
  ...Object.fromEntries(SKILL_KEYS.filter(skillDealsDamage).map(key=>[key,SKILL_DEFS[key].damageColor||SKILL_DEFS[key].color])),
};

