/* ===== campaign-ui.js ===== */
/* =====================================================================
   [CampaignView] 로비·출전 준비·결과 화면의 DOM 렌더 전담
   ---------------------------------------------------------------------
   상태를 읽지 않는다. 그릴 값을 인자로 받기만 하므로, 화면 문구를 고칠 때
   저장·경제 코드를 건드릴 일이 없다. 진행 상태는 Campaign이 소유한다.
   ===================================================================== */
const CampaignView={
  warn(message){$('#save-status').textContent=message;},
  notice(message){GameFeedback.toast(message);},
  lobbyPage(page){
    ['home','characters','skills','gacha'].forEach(p=>$('#lobby-'+p).hidden=p!==page);
    $$('[data-lobby-nav]').forEach(b=>{if(b.dataset.lobbyNav===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  },
  scrollLobbyTop(){$('#lobby-scroll').scrollTop=0;},
  wallet({recovered,gold,starfire,chargeClicks,locked,selectedStage}){
    const max=CAMPAIGN_CONFIG.staminaMax,entry=CAMPAIGN_CONFIG.entryCost,sec=CampaignEconomy.secondsToNextTick(recovered);
    $('#stamina-value').textContent=`${recovered.stamina} / ${max}`;
    $('#gold-value').textContent=gold.toLocaleString('ko-KR');
    $('#starfire-value').textContent=starfire.toLocaleString('ko-KR');
    $('#stamina-timer').textContent=recovered.stamina>=max?'행동력 충전 완료':`+1 회복 ${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
    $('#stamina-charge-count').textContent=`충전 ${chargeClicks||0}회`;
    $('#stamina-charge-btn').disabled=locked||recovered.stamina>=max;
    $('#prepare-btn').disabled=locked||recovered.stamina<entry;
    $('#prepare-btn').innerHTML=recovered.stamina<entry?`행동력 회복 중 <small>${recovered.stamina} / ${entry}</small>`:`${GameArt.icon('sword')} 전투 준비 <small>${GameArt.icon('energy')} ${entry}</small>`;
  },
  // 배너 캡션이 곧 스테이지 정보다. 별도 카드는 눌러도 아무 일이 없는 표시용이었다.
  stageHeader(st){
    $('#stage-eyebrow').textContent=`모험 · ${String(st.id).padStart(2,'0')}`;
    $('#stage-name').textContent=st.name;
    $('#stage-meta').innerHTML=`${st.waves} 웨이브 · 클리어 <b>+${CampaignEconomy.stageTotalGold(st).toLocaleString('ko-KR')}</b> 골드`;
  },
  partySummary(party){
    // 평균 공격력은 편성 4인의 평균(party.stats.atk), 총 체력은 핵 체력 합계다.
    $('#home-party-atk').textContent=Math.round(party.stats.atk).toLocaleString('ko-KR');
    $('#home-party-hp').textContent=party.stats.hp.toLocaleString('ko-KR');
    $('#lobby-party-summary').innerHTML=party.members.map(m=>`<button class="lobby-party-member" data-home-hero="${m.characterId}" aria-label="${m.name} 레벨 ${m.level} 상세">${GameArt.portrait(m.characterId)}<span class="member-label">${GameArt.module(m.specialtyMissileId,'module-mini')}<b>${m.name}</b><em>Lv.${m.level}</em></span></button>`).join('');
    $$('[data-home-hero]').forEach(b=>b.onclick=()=>CharacterLobbyUI.open(Campaign,b.dataset.homeHero,b));
  },
  brief(st,party){
    $('#stage-brief').innerHTML=`<div class="brief-scene"><span class="brief-kicker">스테이지 ${String(st.id).padStart(2,'0')}</span><h2>${st.name}</h2><div><span>${st.waves} 웨이브</span><span>클리어 +${CampaignEconomy.stageTotalGold(st)} 골드</span></div></div><div class="brief-party">${party.members.map(m=>`<span>${GameArt.portrait(m.characterId)}<b>Lv.${m.level}</b></span>`).join('')}<div>핵 체력 <b>${party.stats.hp.toLocaleString('ko-KR')}</b><br>팀 방어 <b>${party.stats.def}</b></div></div>`;
    $('#start-btn').textContent=`전투 시작 · 행동력 ${CAMPAIGN_CONFIG.entryCost}`;
  },
  reward(r){
    $('#retry-btn').disabled=false;
    $('#result-reward').innerHTML=`<span>획득 골드</span><strong>+${r.total.toLocaleString('ko-KR')}</strong><div class="reward-breakdown"><span>웨이브 통과 <b>+${r.waveGold}</b></span><span>클리어 보너스 <b>+${r.bonus}</b></span></div><p>${r.clear?`스테이지 ${r.stageId+1}이 열렸습니다`:'수호자와 스킬을 성장시키고 다시 도전하세요'}</p><small>보상 지급 완료</small>`;
  },
  rewardFailure(onRetry){$('#result-reward').innerHTML='<p>보상을 저장하지 못했습니다.</p><button class="secondary" id="retry-reward">보상 저장 재시도</button>';$('#retry-reward').onclick=onRetry;$('#retry-btn').disabled=true;},
};

const GachaLobbyUI={
  lastResult:null,busy:false,revealFocus:null,batch:null,flipLockUntil:0,
  // [2026-09-16] 확정(인철): 10개를 뒷면 카드로 깔고 등급 빛으로 예고 → 한 장씩 공개(전설은 긴 연출) →
  // 요약 화면. 전체 공개(스킵)는 처음부터 노출한다.
  LEGEND_LOCK_MS:900,
  init(campaign){
    $('#gacha-pull-btn').onclick=()=>{
      if(this.busy)return;this.busy=true;
      const result=GachaSystem.pull(campaign);
      if(!result||result.error){this.busy=false;if(result?.error)GameFeedback.toast(result.error);this.render(campaign);return;}
      this.lastResult=result;campaign.render();this.reveal(result,campaign);
    };
    $('#reveal-close').onclick=()=>this.advance(campaign);
    $('#reveal-skip').onclick=()=>this.showSummary();
    document.addEventListener('keydown',e=>{
      if($('#recruit-modal').hidden)return;
      if(e.key==='Escape'){e.preventDefault();if(this.batch?.phase==='cards')this.showSummary();else this.closeReveal(campaign);}
      if(e.key==='Tab'){e.preventDefault();const skip=$('#reveal-skip'),close=$('#reveal-close');(document.activeElement===close&&!skip.hidden?skip:close).focus();}
    });
  },
  tierOf(r){return r.type==='skill'?'skill':r.rarityId;},
  rank(r){return r.type==='skill'?0:(RarityTable[r.rarityId]?.order||0);},
  // 뒷면 빛: 수호자는 등급색, 스킬은 스킬 공통색(어떤 스킬인지는 뒤집어야 보인다).
  hintColor(r){return r.type==='skill'?PALETTE.skill:RarityTable[r.rarityId].color;},
  frontColor(r){return r.type==='skill'?(SKILL_DEFS[r.skillKey]?.color||PALETTE.skill):RarityTable[r.rarityId].color;},
  art(r){return r.type==='skill'?`<span class="pull-icon" style="--icon-color:${this.frontColor(r)}">${SKILL_DEFS[r.skillKey]?.icon||'◆'}</span>`:GameArt.portrait(r.characterId);},
  badge(r){return r.duplicate?`<span class="pull-badge dup">조각 +${r.gained}</span>`:'<span class="pull-badge">NEW</span>';},
  label(r){return r.type==='skill'?'전투 스킬':`${RarityTable[r.rarityId].name} 수호자`;},
  reducedMotion(){try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}},
  reveal(res,campaign){
    this.revealFocus=document.activeElement;
    const results=res.results||[];
    this.batch={results,flipped:results.map(()=>false),phase:'cards'};this.flipLockUntil=0;
    $('#reveal-content').innerHTML=`<h2 id="reveal-title" class="reveal-kicker">불씨 소환 · ${results.length}개</h2><div class="pull-grid">${results.map((r,i)=>`<div class="pull-slot tier-${this.tierOf(r)}" style="--hint:${this.hintColor(r)};--front:${this.frontColor(r)}"><button class="pull-card" data-pull-index="${i}" aria-label="${i+1}번째 카드 공개"><span class="pull-back"><i></i></span><span class="pull-front">${this.art(r)}<b>${r.name}</b>${this.badge(r)}</span></button></div>`).join('')}</div><div class="pull-legend" aria-label="빛 색상별 등급">${
      RARITY_KEYS.map(id=>`<span><i style="background:${RarityTable[id].color}"></i>${RarityTable[id].name}</span>`).join('')
    }<span><i style="background:${PALETTE.skill}"></i>스킬</span></div>
    <p class="pull-hint">카드를 눌러 한 장씩 공개하세요.</p>`;
    $$('#reveal-content [data-pull-index]').forEach(b=>b.onclick=()=>this.flip(Number(b.dataset.pullIndex)));
    $('#recruit-modal .reveal-dialog').classList.add('pull-mode');
    $('#reveal-skip').hidden=false;
    this.updateButtons();
    $('#recruit-modal').hidden=false;GameAudio.play('reveal');requestAnimationFrame(()=>$('#reveal-close').focus());
  },
  flip(i){
    const b=this.batch;if(!b||b.phase!=='cards'||b.flipped[i]===undefined||b.flipped[i])return false;
    if(performance.now()<this.flipLockUntil)return false;   // 전설 연출 중에는 다음 카드를 잠깐 막는다(스킵은 항상 가능)
    b.flipped[i]=true;
    const r=b.results[i],tier=this.tierOf(r),slot=$$('#reveal-content .pull-slot')[i];
    slot?.classList.add('flipped');
    if(slot)slot.querySelector('.pull-card').setAttribute('aria-label',`${r.name} · ${this.label(r)} · ${r.duplicate?'조각 +'+r.gained:'신규'}`);
    if(tier==='legend'&&!this.reducedMotion()){slot?.classList.add('burst');this.flipLockUntil=performance.now()+this.LEGEND_LOCK_MS;}
    else if(tier==='epic'&&!this.reducedMotion())slot?.classList.add('glint');
    GameAudio.play(tier==='legend'||tier==='epic'?'reveal':'tap');
    this.updateButtons();return true;
  },
  updateButtons(){
    const b=this.batch,close=$('#reveal-close');if(!b)return;
    if(b.phase==='cards'){const left=b.flipped.filter(x=>!x).length;close.textContent=left?`다음 공개 (${left})`:'결과 요약';}
    else close.textContent='계속하기';
  },
  advance(campaign){
    const b=this.batch;
    if(!b||b.phase==='summary'){this.closeReveal(campaign);return;}
    const next=b.flipped.indexOf(false);
    if(next>=0)this.flip(next);else this.showSummary();
  },
  showSummary(){
    const b=this.batch;if(!b)return;
    b.flipped=b.flipped.map(()=>true);b.phase='summary';this.flipLockUntil=0;
    const rows=b.results.map((r,i)=>({r,i})).sort((a,c)=>this.rank(c.r)-this.rank(a.r)||(a.r.type===c.r.type?0:a.r.type==='skill'?1:-1)||a.i-c.i);
    const fresh=b.results.filter(r=>!r.duplicate).length,shards=b.results.reduce((s,r)=>s+(r.duplicate?r.gained:0),0);
    $('#reveal-content').innerHTML=`<h2 id="reveal-title" class="reveal-kicker">소환 결과</h2><div class="pull-stats">신규 ${fresh} · 조각 +${shards}</div><div class="pull-summary">${rows.map(({r})=>`<div class="pull-row tier-${this.tierOf(r)}" style="--front:${this.frontColor(r)}">${this.art(r)}<div><b>${r.name}</b><small>${this.label(r)}</small></div>${this.badge(r)}</div>`).join('')}</div>`;
    $('#reveal-skip').hidden=true;this.updateButtons();$('#reveal-close').focus();
  },
  closeReveal(campaign){$('#recruit-modal').hidden=true;$('#recruit-modal .reveal-dialog').classList.remove('pull-mode');this.batch=null;this.flipLockUntil=0;this.busy=false;this.render(campaign);if(this.revealFocus?.isConnected)this.revealFocus.focus();this.revealFocus=null;},
  render(campaign){
    const state=campaign.state,price=GachaSystem.cost(state),balance=WalletSystem.balance(state,CONFIG.meta.gacha.currencyId),locked=campaign.broken||!!state.active,poor=balance<price;
    $('#gacha-count').textContent=`누적 ${(state.gachaCount||0).toLocaleString('ko-KR')}개 소환`;
    $('#gacha-cost').textContent=price.toLocaleString('ko-KR');
    $('#gacha-pull-btn').disabled=locked||poor||this.busy;
    $('#gacha-pull-btn').textContent=this.busy?'소환 완료':poor?'별불이 부족합니다':'불씨 소환';
    $('#gacha-nav-dot').hidden=poor||locked;
    const g=CONFIG.meta.gacha;
    $('#gacha-hint').textContent=poor?`새로운 최고 스테이지를 클리어하고 마일스톤에서 별불을 받으세요. ${Math.max(0,price-balance).toLocaleString('ko-KR')} 별불이 더 필요합니다.`:`수호자 ${g.characterWeight}% · 스킬 ${g.skillWeight}%. 중복 결과는 각 조각으로 전환됩니다.`;
    $('#gacha-odds').innerHTML=`<div><span>수호자</span><b>${g.characterWeight}%</b></div><div><span>스킬 · 희귀도 없음</span><b>${g.skillWeight}%</b></div>`+GachaSystem.odds().map(o=>{const r=RarityTable[o.rarityId];return `<div><span class="rarity-chip" style="--rarity-color:${r.color}">수호자 ${r.name}</span><span>${o.pct.toFixed(1)}%</span></div>`;}).join('');
    const chars=state.characterInventory.characters;
    $('#gacha-progress').innerHTML=RARITY_KEYS.slice().reverse().map(k=>{const r=RarityTable[k],pool=CharacterRepository.list().filter(c=>c.rarityId===k);return `<div><span class="rarity-chip" style="--rarity-color:${r.color}">수호자 ${r.name}</span><span>${pool.filter(c=>chars[c.characterId]?.owned).length} / ${pool.length}</span></div>`;}).join('')+`<div><span>전투 스킬</span><span>${SKILL_KEYS.filter(key=>state.skillInventory.skills[key].owned).length} / ${SKILL_KEYS.length}</span></div>`;
    const box=$('#gacha-result'),r=this.lastResult;box.hidden=!r;
    if(!r){box.innerHTML='';return;}
    const list=r.results||[],fresh=list.filter(x=>!x.duplicate).length,shards=list.reduce((s,x)=>s+(x.duplicate?x.gained:0),0),best=list.slice().sort((x,y)=>this.rank(y)-this.rank(x))[0];
    box.innerHTML=`${best?this.art(best):''}<div><b>최근 소환 ${list.length}개</b><p>신규 ${fresh} · 조각 +${shards}${best&&best.type!=='skill'?` · 최고 ${RarityTable[best.rarityId].name} ${best.name}`:''}</p></div>`;
  },
};

