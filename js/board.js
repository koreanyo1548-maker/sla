/* ===== board.js ===== */
/* =====================================================================
   [MergeBoard] §6 — 2×8 셀(CONFIG.board), 드래그·탭 머지, 랜덤 생성 위치
   ===================================================================== */
class MergeBoard {
  constructor(game){
    this.game = game;
    this.rows = CONFIG.board.rows;
    this.cols = CONFIG.board.cols;
    this.cells = new Array(this.rows*this.cols).fill(null); // piece or null
    this.el = $('#board');
    this.cellEls = [];
    this.dragState = null;this.selectedIndex=null;this.dragGhost=null;
    this.buildDom();
    // 안전망: 피스 div가 사라져 pointerup을 못 받는 경우에도 손을 떼면 반드시 정리한다.
    ['pointerup','pointercancel'].forEach(evt=>document.addEventListener(evt,()=>{
      if(this.dragState||this.dragGhost) requestAnimationFrame(()=>this.endDrag());
    }));
  }
  buildDom(){
    this.el.innerHTML = '';
    this.el.style.setProperty('--board-cols',this.cols);
    this.el.style.setProperty('--board-rows',this.rows);
    this.cellEls = [];
    for(let i=0;i<this.rows*this.cols;i++){
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.idx = i;cell.tabIndex=0;cell.setAttribute('role','button');
      cell.addEventListener('pointerup',()=>{if(!this.cells[i]&&this.selectedIndex!==null)this.tap(i);});
      cell.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();this.tap(i);}});
      this.el.appendChild(cell);
      this.cellEls.push(cell);
    }
  }
  emptyIndices(){
    const out=[];
    this.cells.forEach((c,i)=>{ if(!c) out.push(i); });
    return out;
  }
  placeRandom(piece){
    const empty = this.emptyIndices();
    if(empty.length===0) return false;
    const idx = choice(empty);
    this.cells[idx] = piece;
    this.render();
    this.game.orderSheetSystem.render();
    return true;
  }
  pieceLabel(piece){
    return CONFIG.colors.labels[piece.color] || piece.color;
  }
  pieceMaxTier(piece){
    return CONFIG.colors.maxTier; // 색깔 피스 공통 최대 티어(기본 4)
  }
  // [2026-09-15 버그 수정] 드래그를 끝내는 단일 창구.
  // 고스트는 document.body에 붙고 pointerup은 피스 div에 걸려 있어서, 드래그 도중
  // render()가 돌면 그 div가 파괴되며 pointerup이 영원히 오지 않고 고스트만 화면에 남았다.
  // (실제 발생 경로: 드래그 중 주문서가 실행되면 resolveSlot이 보드를 다시 그린다)
  endDrag(){
    this.dragGhost?.remove();
    this.dragGhost=null;
    const el=this.dragState?.el;
    if(el){ el.style.transform=''; el.classList.remove('dragging'); el.parentElement?.classList.remove('drag-source'); }
    this.dragState=null;
    this.el?.querySelectorAll('.piece.dragging').forEach(p=>{p.style.transform='';p.classList.remove('dragging');});
    this.el?.querySelectorAll('.cell.drag-source').forEach(c=>c.classList.remove('drag-source'));
  }
  render(){
    // 보드가 다시 그려지면 드래그 대상 div가 사라지므로 진행 중인 드래그를 여기서 끝낸다.
    // 피스 구성이 이미 바뀐 뒤라 예전 인덱스로 드롭을 마무리하면 엉뚱한 칸을 건드린다.
    if(this.dragState) this.endDrag();
    this.cellEls.forEach((cellEl, i)=>{
      cellEl.innerHTML = '';
      const piece = this.cells[i];
      cellEl.setAttribute('aria-label',piece?t('board.cellAria',{piece:this.pieceLabel(piece),tier:piece.tier+1}):t('board.cellEmptyAria'));
      cellEl.classList.toggle('selected-piece',this.selectedIndex===i);
      cellEl.classList.toggle('merge-candidate',this.selectedIndex!==null&&i!==this.selectedIndex&&!!piece&&!!this.cells[this.selectedIndex]&&this.canMerge(piece,this.cells[this.selectedIndex]));
      if(!piece) return;
      const div = document.createElement('div');
      div.className = 'piece color-' + piece.color + (piece.golden ? ' golden' : '') + (piece.fx ? ` fx-${piece.fx}` : '');
      div.innerHTML = `${GameArt.sprite(CONFIG.colors.names.indexOf(piece.color))}<div class="tier">${piece.tier+1}</div>`;
      div.dataset.idx = i;
      this.attachPieceEvents(div, i);
      cellEl.appendChild(div);
      delete piece.fx;
    });
  }
  // [2026-09-15 확정(인철)] 별도 고스트를 만들지 않고 원본 피스를 직접 움직이며,
  // 이동 범위를 보드 사각형 안으로 제한한다. 손가락이 보드를 벗어나도 드래그는 유지되고
  // 피스만 경계에 붙어 "여기는 놓을 데가 없다"를 알린다. 보드 밖에서 떼면 원래 자리로 돌아간다.
  // 고스트가 없으므로 드래그 중 render()가 돌아 피스 div가 사라져도 남는 잔상이 없다.
  clampToBoard(pointerX, pointerY){
    const board=this.el.getBoundingClientRect(), r=this.dragState.rect;
    const halfW=r.width/2, halfH=r.height/2;
    const cx=clamp(pointerX, board.left+halfW, board.right-halfW);
    const cy=clamp(pointerY, board.top+halfH, board.bottom-halfH);
    return {cx, cy, dx:cx-(r.left+halfW), dy:cy-(r.top+halfH)};
  }
  attachPieceEvents(div, idx){
    div.addEventListener('pointerdown', (ev)=>{
      if(!this.game.running||this.game.ending)return;
      ev.preventDefault();
      this.endDrag();
      this.dragState = { fromIdx: idx, el: div, startX: ev.clientX, startY: ev.clientY,
        rect: div.getBoundingClientRect(), moved:false, cx:ev.clientX, cy:ev.clientY };
      div.setPointerCapture(ev.pointerId);
    });
    div.addEventListener('pointermove', (ev)=>{
      const d=this.dragState;
      if(!d || d.fromIdx!==idx) return;
      if(!d.moved && Math.hypot(ev.clientX-d.startX, ev.clientY-d.startY) <= 6) return;
      if(!d.moved){ d.moved=true; div.classList.add('dragging'); div.parentElement?.classList.add('drag-source'); }
      const pos=this.clampToBoard(ev.clientX, ev.clientY);
      d.cx=pos.cx; d.cy=pos.cy;
      div.style.transform=`translate(${pos.dx}px, ${pos.dy}px)`;
    });
    div.addEventListener('pointercancel',()=>this.endDrag());
    div.addEventListener('pointerup', (ev)=>{
      ev.stopPropagation();
      const d=this.dragState;
      if(!d || d.fromIdx!==idx){ this.endDrag(); return; }
      const moved=d.moved, cx=d.cx, cy=d.cy;
      this.endDrag();
      if(!moved){ this.tap(idx); return; }
      // 주문서 직접 제출은 제거됐다. 드롭은 보드 내 머지/이동/교환만 처리한다.
      // 판정 기준은 손가락이 아니라 보드 안으로 제한된 피스의 중심이다 — 보이는 대로 놓인다.
      const board=this.el.getBoundingClientRect();
      const inside = ev.clientX>=board.left && ev.clientX<=board.right && ev.clientY>=board.top && ev.clientY<=board.bottom;
      const elAtPoint = inside ? document.elementFromPoint(cx, cy) : null;
      const targetCellEl = elAtPoint ? elAtPoint.closest('.cell') : null;
      if(targetCellEl && targetCellEl.dataset.idx!==undefined){
        const toIdx = parseInt(targetCellEl.dataset.idx,10);
        if(Number.isInteger(toIdx)){ this.selectedIndex=null; this.handleDrop(idx, toIdx); }
      }
      this.render();
      this.game.orderSheetSystem.render();this.game.updateEnergyUi();
      this.game.tutorial?.onBoardChanged();
    });
  }
  tap(index){
    if(!this.game.running||this.game.ending)return;
    if(this.selectedIndex===null){if(this.cells[index])this.selectedIndex=index;}
    else if(this.selectedIndex===index)this.selectedIndex=null;
    else{const from=this.selectedIndex;this.selectedIndex=null;this.handleDrop(from,index);}
    this.render();this.game.orderSheetSystem.render();this.game.updateEnergyUi();this.game.tutorial?.onBoardChanged();
  }
  handleDrop(fromIdx, toIdx){
    if(fromIdx===toIdx) return;
    const a = this.cells[fromIdx], b = this.cells[toIdx];
    if(!a) return;
    if(b && this.canMerge(a,b)){
      // §6 동일 종류+동일 티어 머지 → 즉시 1티어 상승.
      // [2026-09-02 도파민 옵션] 확정(인철): 가장 빈번한 행동인 머지 자체엔 랜덤이 없어
      // 도파민 서프라이즈가 비어있었다 — 소확률로 원래 상승분(+1) 위에 추가 티어를 더
      // 올리는 "크리티컬 머지"를 얹는다. on/off는 featureFlags, 확률·보너스는 criticalMerge에서 조정.
      const maxTier = this.pieceMaxTier(a);
      let bonus = 1;
      let crit = false;
      if(CONFIG.featureFlags.criticalMerge && Math.random() < clamp(CONFIG.criticalMerge.chance,0,1)){
        bonus += CONFIG.criticalMerge.bonusTiers;
        crit = true;
      }
      // canMerge가 최대 티어 피스를 이미 제외하므로 여기서는 항상 한 단계 이상 오른다.
      b.tier = clamp(a.tier+bonus, 0, maxTier-1);
      b.golden = false; // 크리티컬 머지 결과물은 골든 표시와 별개(중복 강조 방지)
      b.fx = crit ? 'critical' : 'merge';
      this.cells[fromIdx] = null;
      this.game.stats.merges++;GameAudio.play(crit?'reveal':'merge');
      this.game.orderGaugeSystem.addMerge();
      if(crit){
        logAction(`크리티컬 머지! ${this.pieceLabel(b)} T${b.tier+1}`);
        spawnFloatNumber(this.game.floatLayer, this.game.playerPos.x, this.game.playerPos.y-40, t('battle.merge.critical'), 'enhance');
      } else {
        logAction(`머지! ${this.pieceLabel(b)} T${b.tier+1}`);
      }
    } else if(!b){
      this.cells[toIdx] = a;
      this.cells[fromIdx] = null;
    } else {
      // 다른 종류/티어 → 위치 스왑 (ASSUMPTION: 문서에 명시 없음, 일반적 UX로 채택)
      this.cells[toIdx] = a;
      this.cells[fromIdx] = b;
    }
  }
  canMerge(a,b){
    // §21: 피스는 이제 색깔 피스 하나뿐 — 같은 색상 + 같은 티어만 머지 가능.
    return a.color === b.color && a.tier === b.tier && a.tier < this.pieceMaxTier(a)-1;
  }
}

/* =====================================================================
   [PieceGenerationPolicy] 피스 생성 규칙
   ---------------------------------------------------------------------
   Generator는 에너지 소비/배치/홀드 입력만 담당하고, 색상·초반 주문서 보정·골든 판정은
   이 정책 객체가 담당한다. OrderSheetSystem 내부 구조를 Generator가 직접 알지 않는다.
   ===================================================================== */
class PieceGenerationPolicy {
  constructor(game){ this.game=game; this.reset(); }
  reset(){ this.opening={generated:0,matched:0}; }
  activeColors(){ return CONFIG.colors.names.slice(0,clamp(CONFIG.colors.count,1,CONFIG.colors.names.length)); }
  currentOrderRequiredColors(){
    const active=new Set(this.activeColors());
    const slots=this.game.orderSheetSystem.slots;
    return [...new Set(slots.flatMap(slot=>(slot?.requirements||[]).map(req=>req.color)))].filter(color=>active.has(color));
  }
  isCurrentOrderRequiredColor(color){ return this.currentOrderRequiredColors().includes(color); }
  // 초반 보정: 첫 OPENING_PIECES개 생성 안에 현재 주문서 요구색이 OPENING_MATCHES개 이상 나오게 한다.
  static OPENING_PIECES = 5;
  static OPENING_MATCHES = 2;
  rollColor(){
    const active=this.activeColors();
    let color=choice(active);
    if(this.opening.generated<PieceGenerationPolicy.OPENING_PIECES){
      const remaining=PieceGenerationPolicy.OPENING_PIECES-this.opening.generated;
      const needed=Math.max(0,PieceGenerationPolicy.OPENING_MATCHES-this.opening.matched);
      const required=this.currentOrderRequiredColors();
      if(needed>0 && needed>=remaining && required.length) color=choice(required);
    }
    return color;
  }
  rollPiece(){
    let tier=0,golden=false;
    if(CONFIG.featureFlags.goldenPiece && Math.random()<clamp(CONFIG.goldenPiece.chance,0,1)){
      tier=clamp(CONFIG.goldenPiece.bonusTiers,0,CONFIG.colors.maxTier-1);golden=true;
    }
    return {type:'color',color:this.rollColor(),tier,golden};
  }
  recordGenerated(piece){
    if(this.opening.generated>=PieceGenerationPolicy.OPENING_PIECES) return;
    this.opening.generated++;
    if(this.isCurrentOrderRequiredColor(piece.color)) this.opening.matched++;
  }
}

/* =====================================================================
   [Generator] §6,17 — 에너지 보유/소비, 확률 생성, 홀드 연속 생성
   ===================================================================== */
class Generator {
  constructor(game){
    this.game=game;
    this.holdTimer=null;
    this.policy=new PieceGenerationPolicy(game);
  }
  resetOpeningGuarantee(){ this.policy.reset(); }
  activeColors(){ return this.policy.activeColors(); }
  rollPiece(){ return this.policy.rollPiece(); }
  generateOne(){
    const g = this.game;
    if(!g.running||g.ending) return false;
    if(g.energy < CONFIG.generator.costPerPiece) return false;
    if(g.mergeBoard.emptyIndices().length===0) return false;
    g.energy -= CONFIG.generator.costPerPiece;
    g.stats.generated++;
    g.stats.energySpent+=CONFIG.generator.costPerPiece;
    g.orderGaugeSystem.addEnergySpent(CONFIG.generator.costPerPiece);
    const piece = this.rollPiece();
    this.policy.recordGenerated(piece);
    piece.fx = 'spawn';
    g.mergeBoard.placeRandom(piece);
    restartCssAnimation($('#generator-btn'),'fx-generate');
    GameAudio.play('generate');
    if(piece.golden) logAction(`골든 피스! ${g.mergeBoard.pieceLabel(piece)} T${piece.tier+1}`);
    g.updateEnergyUi();
    g.tutorial?.onGenerated();
    return true;
  }
  startHold(){
    if(!this.game.running||this.game.ending)return;
    this.stopHold();
    if(!this.generateOne())return;
    this.holdTimer = setInterval(()=>{
      if(!this.generateOne()) this.stopHold();
    }, CONFIG.generator.holdIntervalSec*1000);
  }
  stopHold(){
    if(this.holdTimer){ clearInterval(this.holdTimer); this.holdTimer=null; }
  }
}


/* =====================================================================
   [OrderSheetSystem] §21 — 1~3성 강화 주문서, 자동 보드 판정
   ===================================================================== */
class OrderSheetSystem {
  constructor(game){
    this.game = game;
    this.slots = [];
    this.comboBag = [];
    this.qualityMisses = 0;
  }
  reset(){
    // [2026-09-04] 확정(인철): 시작 주문서 3장은 미사일 중 랜덤 3종의 공격력으로 배정한다.
    // 매 런 시작 구성이 달라지는 것이 의도다.
    // [2026-09-09 주석 정정] 확정 당시 대상은 5종이었으나 2026-09-07 관통 제거로 4종이 됐다.
    // moduleKeys를 셔플해 slotCount만큼 뽑으므로 코드 변경 없이 '4종 중 랜덤 3종'이 된다.
    this.qualityMisses = 0;
    const startingModules = shuffle(CONFIG.moduleKeys).slice(0,CONFIG.orderSheet.slotCount);
    const startingKeys = new Set(startingModules.map(module=>`${module}:damage`));
    this.comboBag = this.buildComboBag().filter(combo=>!startingKeys.has(`${combo.module}:${combo.stat}`));
    this.slots = startingModules.map((module,slotIdx)=>
      this.generateSheet({module,stat:'damage',grade:1},slotIdx));
    this.render();
  }
  statPool(moduleKey){
    return ['damage','speed',MISSILE_DEFS[moduleKey]?.special.stat].filter(Boolean);
  }
  buildComboBag(){
    return shuffle(CONFIG.moduleKeys.flatMap(module=>
      this.statPool(module).map(stat=>({module,stat}))));
  }
  drawCombo(){
    if(!this.comboBag.length) this.comboBag=this.buildComboBag();
    return this.comboBag.pop();
  }
  rollGrade(slotIdx){
    if(slotIdx===CONFIG.orderSheet.guaranteedEasySlot) return 1;
    if(this.qualityMisses>=CONFIG.orderSheet.qualityPityMisses){
      this.qualityMisses=0;
      return 3;
    }
    const weights=CONFIG.orderSheet.qualityWeights;
    const roll=Math.random();
    const grade=roll<weights[0] ? 1 : roll<weights[0]+weights[1] ? 2 : 3;
    this.qualityMisses=grade===3 ? 0 : this.qualityMisses+1;
    return grade;
  }
  generateSheet(forced=null, slotIdx=-1){
    const combo = forced?.module && forced?.stat ? forced : this.drawCombo();
    const module = combo.module;
    const stat = combo.stat;
    const colors = this.game.generator.activeColors();
    const grade = forced?.grade || this.rollGrade(slotIdx);
    const totalCost = clamp(grade,1,Math.min(3,colors.length));
    const designatedColor = forced?.color || CONFIG.orderSheet.designatedColors[module][stat];
    const otherColors = colors.filter(color=>color!==designatedColor);
    const requirements=[{color:designatedColor,need:1,role:'designated'}];
    for(let i=1;i<totalCost && otherColors.length;i++){
      const color=otherColors.splice(Math.floor(Math.random()*otherColors.length),1)[0];
      requirements.push({color,need:1,role:'additional'});
    }
    return { module, stat, grade, requirements };
  }
  selectedPieces(slot){
    if(!slot) return null;
    const selected=[];
    for(const req of slot.requirements){
      const matches=this.game.mergeBoard.cells.map((piece,index)=>({piece,index}))
        .filter(x=>x.piece?.color===req.color)
        .sort((a,b)=>b.piece.tier-a.piece.tier || a.index-b.index)
        .slice(0,req.need);
      if(matches.length<req.need) return null;
      selected.push(...matches);
    }
    return selected;
  }
  // 강화 레벨 상한은 미사일 강화표의 길이(Lv.1-12)다.
  maxLevel(){ return CONFIG.attackModules.damageBonusByLevel.length; }
  preview(slot){
    const selected=this.selectedPieces(slot);
    if(!selected) return {ready:false,level:0,selected:[]};
    const total=selected.reduce((sum,x)=>sum+x.piece.tier+1,0);
    return {ready:true,level:clamp(total,1,this.maxLevel()),selected};
  }
  rewardProgress(slot, preview=this.preview(slot)){
    const count=slot ? slot.requirements.reduce((sum,r)=>sum+r.need,0) : 0;
    const minLevel=clamp(count,1,this.maxLevel());
    const maxLevel=clamp(count*CONFIG.colors.maxTier,minLevel,this.maxLevel());
    if(!preview.ready) return {stars:0,minLevel,maxLevel,ratio:0};
    const ratio=maxLevel===minLevel ? 1 : clamp((preview.level-minLevel)/(maxLevel-minLevel),0,1);
    const stars=preview.level>=maxLevel ? 3 : ratio>=CONFIG.orderSheet.starSecondThreshold ? 2 : 1;
    return {stars,minLevel,maxLevel,ratio};
  }
  highlightedPieceIndices(){
    const result=new Set();
    this.slots.forEach(slot=>{
      const preview=this.preview(slot);
      if(preview.ready) preview.selected.forEach(x=>result.add(x.index));
    });
    return result;
  }
  syncBoardHighlights(){
    const highlighted=this.highlightedPieceIndices();
    this.game.mergeBoard.cellEls.forEach((cell,index)=>{
      const on=highlighted.has(index);
      cell.classList.toggle('order-match',on);
      const piece=cell.querySelector('.piece');
      if(piece) piece.classList.toggle('order-match',on);
    });
  }
  enhancementLabel(slot){
    const meta=MISSILE_DEFS[slot.module];
    const statLabel=slot.stat==='damage'?t('order.stat.damage'):slot.stat==='speed'?t('order.stat.speed'):meta?.special.stat===slot.stat?meta.special.label:slot.stat;
    return t('order.kindLabel',{module:meta?.label||CONFIG.attackModules[slot.module]?.label||slot.module,stat:statLabel});
  }
  resolveSlot(slotIdx){
    const slot = this.slots[slotIdx];
    const preview=this.preview(slot);
    if(!this.game.running||this.game.ending)return false;
    if(!slot || !preview.ready){
      if(slot) slot.fx='invalid';
      this.render();
      logAction('보드에 필요한 색상 피스가 부족합니다.');
      return false;
    }
    const g = this.game;
    preview.selected.forEach(x=>{ g.mergeBoard.cells[x.index]=null; });
    const kindLabel=this.enhancementLabel(slot);
    g.attackModuleSystem.applyUpgrade(slot.module,slot.stat,preview.level);
    g.stats.ordersCompleted++;
    GameAudio.play('order_complete');
    logAction(`${'★'.repeat(this.rewardProgress(slot,preview).stars)} ${kindLabel} Lv.${preview.level} 적용!`);
    // [2026-09-18 연출 세션 A] 카드→영웅 인과를 보이게 한다. 지금까지는 슬롯이 즉시
    // 비어서 "무엇이 강해졌는지"가 보이지 않았다. 완료 연출을 카드에 먼저 재생하고
    // 그 뒤에 비운다. 판정·강화 적용은 위에서 이미 끝났으므로 늦추는 것은 표시뿐이다.
    this.playCompletionFx(slotIdx,slot,t('order.completion',{kind:kindLabel,level:preview.level}));
    g.mergeBoard.render();g.updateEnergyUi();
    g.tutorial?.onOrderCompleted();
    return true;
  }
  /* 완료 연출 — 카드에 fx-complete 를 주고 약 0.3초 뒤에 슬롯을 비운다.
     그 사이 그 카드만 입력을 막는다(.is-resolving). reduced-motion이거나 연출을 붙일
     카드를 못 찾으면 예전처럼 즉시 비운다 — 연출이 진행을 막아서는 안 된다. */
  playCompletionFx(slotIdx,slot,label){
    const g=this.game;
    const finish=()=>{
      if(this.slots[slotIdx]!==slot) return;      // 그 사이 폐기·재충전으로 바뀌었으면 손대지 않는다
      this.slots[slotIdx]=null;
      g.orderGaugeSystem.refillCompletedSlot(slotIdx);
      this.render();
    };
    const card=$(`.order-card[data-slot="${slotIdx}"]`);
    if(!card||g.prefersReducedMotion()){ finish(); return; }
    card.classList.add('is-resolving');
    restartCssAnimation(card,'fx-complete');
    this.sendSparksToHero(card,slot.module);
    // 영웅 강화 펄스를 늘리고 강화 내용을 띄운다 — 스파크가 도착하는 타이밍에 맞춘다.
    setTimeout(()=>{
      if(!g.running&&!g.ending) return;
      const unit=g.heroField.units[slot.module];
      if(unit) unit.upgradedAt=performance.now();
      const p=g.heroField.slotPosition(slot.module);
      spawnFloatNumber(g.floatLayer,p.x,p.y-85,label,'upgrade');
    },350);
    setTimeout(finish,300);
  }
  /* 카드 중심에서 해당 미사일 영웅 위치로 글로우가 날아간다.
     출발점이 캔버스 좌표계 밖(보드 영역)이라 DOM 플로트 계층을 쓴다. 도착점은
     combatLayerPoint로 캔버스 표시 배율을 반영하므로 어떤 화면 비율에서도 맞는다. */
  sendSparksToHero(card,moduleKey){
    const g=this.game, layer=$('#fx-layer');
    if(!layer||!g.floatLayer) return;
    const layerRect=layer.getBoundingClientRect(), cardRect=card.getBoundingClientRect();
    const from={x:cardRect.left-layerRect.left+cardRect.width/2,y:cardRect.top-layerRect.top+cardRect.height/2};
    const hero=g.heroField.slotPosition(moduleKey);
    // 도착점은 캔버스 표시 배율을 반영해야 하므로 combatLayerPoint(#combat-wrap 기준)로
    // 구한 뒤 #fx-layer 좌표로 옮긴다. 화면 비율이 달라져도 그대로 맞는다.
    const wrapRect=g.floatLayer.getBoundingClientRect();
    const inWrap=combatLayerPoint(g.floatLayer,hero.x,hero.y-40);
    const to={x:inWrap.x+(wrapRect.left-layerRect.left),y:inWrap.y+(wrapRect.top-layerRect.top)};
    const color=CONFIG.attackModules[moduleKey]?.color||'#ffffff';
    for(let i=0;i<7;i++){
      const d=document.createElement('div');
      d.className='order-spark';
      d.style.left=from.x+rand(-10,10)+'px';
      d.style.top=from.y+rand(-8,8)+'px';
      d.style.setProperty('--spark-color',color);
      d.style.setProperty('--spark-dx',(to.x-from.x)+rand(-12,12)+'px');
      d.style.setProperty('--spark-dy',(to.y-from.y)+rand(-12,12)+'px');
      d.style.setProperty('--spark-dur',(0.30+i*0.012)+'s');
      layer.appendChild(d);
      setTimeout(()=>d.remove(),500);
    }
  }
  discard(slotIdx){
    if(!this.game.running||this.game.ending)return;
    if(!this.slots[slotIdx]) return;
    this.slots[slotIdx]=null;
    logAction('주문서를 폐기했습니다.');
    this.game.orderGaugeSystem.refillCompletedSlot(slotIdx);
    this.render();
  }
  fillSlot(slotIdx){
    if(this.slots[slotIdx]) return false;
    this.slots[slotIdx]=this.generateSheet(null,slotIdx);
    this.slots[slotIdx].fx='complete';
    return true;
  }
  closeDetail(){
    const modal=$('#order-detail');if(modal)modal.hidden=true;
    if(this.detailReturn?.isConnected)this.detailReturn.focus();
    this.detailSlot=null;this.detailReturn=null;
  }
  openDetail(index,trigger){
    const slot=this.slots[index];if(!slot||this.game.ending)return;
    this.detailSlot=slot;this.detailReturn=trigger;
    const p=this.preview(slot),progress=this.rewardProgress(slot,p);
    $('#order-detail-content').innerHTML=`<h3>${this.enhancementLabel(slot)}</h3>`
      +`<p>${t('order.detail.requirements',{colors:slot.requirements.map(r=>CONFIG.colors.labels[r.color]).join(' + ')})}</p>`
      +`<p>${t('order.detail.levelRange',{min:progress.minLevel,max:progress.maxLevel})}</p>`
      +`<p>${t(this.game.attackModuleSystem.modules[slot.module].active?'order.detail.enhance':'order.detail.summon')}</p>`
      +`<small>${t('order.detail.note')}</small>`;
    const modal=$('#order-detail');modal.hidden=false;
    $('#order-detail-close').onclick=()=>this.closeDetail();
    $('#order-detail-discard').onclick=()=>{if(this.slots[index]===slot)this.discard(index);this.closeDetail();};
    modal.onclick=ev=>{if(ev.target===modal)this.closeDetail();};
    modal.onkeydown=ev=>{
      if(ev.key==='Escape'){ev.preventDefault();this.closeDetail();}
      if(ev.key==='Tab'){ev.preventDefault();const close=$('#order-detail-close');(document.activeElement===close?$('#order-detail-discard'):close).focus();}
    };
    $('#order-detail-close').focus();
  }
  render(){
    const el=$('#order-sheet-panel');if(!el)return;
    if(this.detailSlot&&!this.slots.includes(this.detailSlot))this.closeDetail();
    el.innerHTML=this.slots.map((slot,i)=>{
      if(!slot)return `<div class="order-card empty" data-slot="${i}"><span>${t('order.empty.title')}</span><small>${t('order.empty.hint')}</small></div>`;
      const preview=this.preview(slot);
      const active=this.game.attackModuleSystem.modules[slot.module]?.active;
      const kindLabel=this.enhancementLabel(slot);
      const chips=slot.requirements.map(r=>{
        const tier=this.game.mergeBoard.cells.reduce((n,p)=>p?.color===r.color?Math.max(n,p.tier+1):n,0);
        return `<span class="oc-chip${tier?' available':''}">${GameArt.sprite(CONFIG.colors.names.indexOf(r.color))}<b>${tier}</b><span class="sr-only">${t('order.chipAria',{color:CONFIG.colors.labels[r.color]})}</span></span>`;
      }).join('');
      const label=t(active?'order.action.enhance':'order.action.summon');
      const fx=slot.fx?` fx-${slot.fx}`:'';delete slot.fx;
      return `<div class="order-card grade-${slot.grade}${preview.ready?' ready':''}${fx}" data-slot="${i}">
        <button class="oc-apply" data-slot="${i}" aria-label="${t('order.applyAria',{kind:kindLabel,state:preview.ready?t('order.applyReady',{level:preview.level,action:label}):t('order.applyShort')})}" ${preview.ready?'':'disabled'}>
          <span class="oc-title">${kindLabel}${preview.ready?`<b class="oc-level">${t('common.level',{n:preview.level})}</b>`:''}</span>
          <span class="oc-reqs">${chips}</span>
        </button>
        <button class="oc-info" data-slot="${i}" aria-label="${t('order.infoAria',{kind:kindLabel})}">×</button>
      </div>`;
    }).join('');
    $$('.oc-apply',el).forEach(btn=>btn.onclick=()=>this.resolveSlot(Number(btn.dataset.slot)));
    $$('.oc-info',el).forEach(btn=>btn.onclick=()=>this.openDetail(Number(btn.dataset.slot),btn));
    this.syncBoardHighlights();
  }

}

/* =====================================================================
   [ScoreSystem] 처치 점수 → 에너지 지급
   ---------------------------------------------------------------------
   확정(인철, 2026-09-04): 에너지를 처치 즉시 주지 않고 점수로 적립한 뒤
   pointsPerGrant 점마다 energyPerGrant 만큼 지급한다(2026-09-17 기준 20점당 1).
   생성기 버튼에 다음 지급까지의 진행도를 표시한다.
   기존 방식(일반 1 에너지 / 보스 15~200 에너지 목돈)은 생성 간격 상한(0.3초/개) 때문에
   런 전체 수입의 72%가 소비되지 못하고 버려졌다 — 그 목돈 구조를 없애기 위한 교체다.
   ===================================================================== */
class ScoreSystem {
  constructor(game){ this.game = game; this.score = 0; this.granted = 0; }
  reset(){ this.score = 0; this.granted = 0; this.render(); }
  add(points){
    if(!(points>0)) return;
    this.score += points;
    const unit = Math.max(1, CONFIG.scoring.pointsPerGrant);
    const should = Math.floor(this.score/unit) * CONFIG.scoring.energyPerGrant;
    const gain = should - this.granted;
    if(gain > 0){
      this.granted = should;
      this.game.addEnergy(gain);
      this.game.showEnergyGain(gain);
      logAction(`${unit}점 달성! 에너지 +${gain}`);
    }
    this.render();
  }
  render(){
    const unit = Math.max(1, CONFIG.scoring.pointsPerGrant);
    const into = this.score % unit;
    const fill = $('#gen-fill');
    if(fill) fill.style.width = (into/unit*100).toFixed(1)+'%';
    const label = $('#gen-score');
    if(label) label.textContent = `${into}/${unit}`;
    const total = $('#run-score');
    if(total) total.textContent = String(this.score);
  }
}

/* =====================================================================
   [OrderGaugeSystem] 에너지 소모/머지 행동으로 충전되는 주문서 공급 게이지
   ===================================================================== */
class OrderGaugeSystem {
  constructor(game){
    this.game = game;
    this.charge = 0;
    this.stock = 0;
  }
  reset(){
    this.charge = 0;
    this.stock = 0;
    this.render();
  }
  addEnergySpent(amount){ this.add(amount*CONFIG.orderGauge.pointPerEnergy); }
  addMerge(){ this.add(CONFIG.orderGauge.pointPerMerge); }
  add(points){
    this.charge += points;
    restartCssAnimation($('#order-gauge-wrap'),'fx-charge');
    while(this.charge >= CONFIG.orderGauge.maxCharge){
      this.charge -= CONFIG.orderGauge.maxCharge;
      this.stock += Math.max(1,Math.floor(CONFIG.orderGauge.ordersPerGrant));
      restartCssAnimation($('#order-gauge-wrap'),'fx-full');
      this.fillEmptySlots();
    }
    this.render();
  }
  fillEmptySlots(){
    const orders=this.game.orderSheetSystem;
    for(let i=0;i<orders.slots.length && this.stock>0;i++){
      if(orders.fillSlot(i)) this.stock--;
    }
    orders.render();
    logAction(this.stock>0 ? `보유 주문서 ${this.stock}개` : '새 주문서가 도착했습니다.');
  }
  addStock(amount=1){
    this.stock+=Math.max(0,Math.floor(amount));
    this.fillEmptySlots();
    this.render();
  }
  refillCompletedSlot(slotIdx){
    if(this.stock<=0) return false;
    if(this.game.orderSheetSystem.fillSlot(slotIdx)){
      this.stock--;
      this.render();
      return true;
    }
    return false;
  }
  render(){
    const wrap = $('#order-gauge-wrap');
    if(!wrap) return;
    wrap.style.display = 'flex';
    const bar = $('#order-gauge-bar');
    const label = $('#order-gauge-label');
    if(bar) bar.style.width = clamp(this.charge/CONFIG.orderGauge.maxCharge,0,1)*100 + '%';
    if(label) label.textContent = `${Math.floor(this.charge)}/${CONFIG.orderGauge.maxCharge}`;
    const stock=$('#order-stock-count');
    if(stock) stock.textContent=String(this.stock);
  }
}

