/* ===== campaign-ui.js ===== */
/* =====================================================================
   [CampaignView] 로비·출전 준비·결과 화면의 DOM 렌더 전담
   ---------------------------------------------------------------------
   상태를 읽지 않는다. 그릴 값을 인자로 받기만 하므로, 화면 문구를 고칠 때
   저장·경제 코드를 건드릴 일이 없다. 진행 상태는 Campaign이 소유한다.
   ===================================================================== */
const CampaignView={
  // 결과 화면에 마지막으로 그린 보상 카드. 언어가 바뀌면 이 상태 그대로 다시 그린다.
  rewardState:null,
  warn(message){$('#save-status').textContent=message;},
  notice(message){GameFeedback.toast(message);},
  lobbyPage(page){
    ['home','characters','skills','gacha'].forEach(p=>$('#lobby-'+p).hidden=p!==page);
    $$('[data-lobby-nav]').forEach(b=>{if(b.dataset.lobbyNav===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  },
  scrollLobbyTop(){$('#lobby-scroll').scrollTop=0;},
  wallet({recovered,gold,starfire,chargeClicks,locked,selectedStage}){
    const max=CAMPAIGN_CONFIG.staminaMax,entry=CAMPAIGN_CONFIG.entryCost,sec=CampaignEconomy.secondsToNextTick(recovered);
    // [연출 세션 B] 재화가 바뀌는 지점은 전부 countUp을 지난다. 값이 그대로면
    // 아무 일도 하지 않으므로 1초마다 도는 이 렌더가 조용하다.
    GameFeedback.countUp($('#stamina-value'),recovered.stamina,{format:v=>`${I18N.num(Math.round(v))} / ${I18N.num(max)}`});
    GameFeedback.countUp($('#gold-value'),gold);
    GameFeedback.countUp($('#starfire-value'),starfire);
    $('#stamina-timer').textContent=recovered.stamina>=max?t('lobby.stamina.full'):t('lobby.stamina.timer',{time:`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`});
    $('#stamina-charge-count').textContent=t('lobby.stamina.chargeCount',{n:chargeClicks||0});
    $('#stamina-charge-btn').setAttribute('aria-label',t('lobby.stamina.chargeAria',{n:CampaignEconomy.chargeAmount}));
    $('#stamina-charge-btn').disabled=locked||recovered.stamina>=max;
    $('#prepare-btn').disabled=locked||recovered.stamina<entry;
    $('#prepare-btn').innerHTML=recovered.stamina<entry
      ?t('lobby.prepare.waiting',{current:recovered.stamina,need:entry})
      :t('lobby.prepare.ready',{sword:GameArt.icon('sword'),energy:GameArt.icon('energy'),cost:entry});
  },
  // 배너 캡션이 곧 스테이지 정보다. 별도 카드는 눌러도 아무 일이 없는 표시용이었다.
  stageHeader(st){
    $('#stage-eyebrow').textContent=t('lobby.stage.eyebrow',{id:String(st.id).padStart(2,'0')});
    $('#stage-name').textContent=t(st.nameKey);
    $('#stage-meta').innerHTML=t('lobby.stage.meta',{waves:st.waves,gold:CampaignEconomy.stageTotalGold(st)});
  },
  partySummary(party){
    // 평균 공격력은 편성 4인의 평균(party.stats.atk), 총 체력은 핵 체력 합계다.
    $('#home-party-atk').textContent=I18N.num(Math.round(party.stats.atk));
    $('#home-party-hp').textContent=I18N.num(party.stats.hp);
    $('#lobby-party-summary').innerHTML=party.members.map(m=>`<button class="lobby-party-member" data-home-hero="${m.characterId}" aria-label="${t('lobby.party.memberAria',{name:t(m.nameKey),level:m.level})}">${GameArt.portrait(m.characterId)}<span class="member-label">${GameArt.module(m.specialtyMissileId,'module-mini')}<b>${t(m.nameKey)}</b><em>${t('common.level',{n:m.level})}</em></span></button>`).join('');
    $$('[data-home-hero]').forEach(b=>b.onclick=()=>CharacterLobbyUI.open(Campaign,b.dataset.homeHero,b));
  },
  brief(st,party){
    $('#stage-brief').innerHTML=`<div class="brief-scene"><span class="brief-kicker">${t('prepare.brief.kicker',{id:String(st.id).padStart(2,'0')})}</span><h2>${t(st.nameKey)}</h2><div><span>${t('prepare.brief.waves',{n:st.waves})}</span><span>${t('prepare.brief.clearGold',{gold:CampaignEconomy.stageTotalGold(st)})}</span></div></div><div class="brief-party">${party.members.map(m=>`<span>${GameArt.portrait(m.characterId)}<b>${t('common.level',{n:m.level})}</b></span>`).join('')}<div>${t('prepare.brief.coreHp')} <b>${I18N.num(party.stats.hp)}</b><br>${t('prepare.brief.teamDef')} <b>${party.stats.def}</b></div></div>`;
    $('#start-btn').textContent=t('prepare.start',{cost:CAMPAIGN_CONFIG.entryCost});
  },
  rerenderReward(){
    const state=this.rewardState;
    if(!state) return;
    if(state.kind==='reward') this.reward(state.r);
    else this.rewardFailure(state.onRetry);
  },
  reward(r){
    this.rewardState={kind:'reward',r};
    $('#retry-btn').disabled=false;
    // [연출 세션 B] 최고 기록을 갱신했으면 골드 옆에 스탬프를 찍는다.
    const stamp=r.newBestWave||r.newBestScore?`<span class="new-best">${t('growth.newBest')}</span>`:'';
    $('#result-reward').innerHTML=`<span>${t('result.reward.gold')}</span><strong><em data-count>+${I18N.num(r.total)}</em>${stamp}</strong><div class="reward-breakdown"><span>${t('result.reward.waves')} <b>+${I18N.num(r.waveGold)}</b></span><span>${t('result.reward.bonus')} <b>+${I18N.num(r.bonus)}</b></span></div><p>${r.clear?t('result.reward.unlocked',{stage:r.stageId+1}):t('result.reward.retryHint')}</p><small>${t('result.reward.done')}</small>`;
    GameFeedback.countUp($('#result-reward [data-count]'),r.total,{from:0,format:v=>`+${I18N.num(Math.round(v))}`});
    if(stamp) GameAudio.play('new_best');
  },
  /* [연출 세션 B · B-3] 결과 화면 맨 아래 안내 줄. 스테이지 돌파 별불은 여기서
     알리기만 하고 수령은 로비 마일스톤에서 한다(연출개선안 미결 항목). */
  resultHint(state,result){
    const el=$('#result-milestone-hint'); if(!el) return;
    const ready=MilestoneSystem.claimableCount(state);
    el.textContent=result?.clear&&result.firstClear
      ? t('result.starfireHint')
      : ready ? t('result.milestoneHint',{n:ready}) : '';
  },
  rewardFailure(onRetry){this.rewardState={kind:'failure',onRetry};$('#result-reward').innerHTML=`<p>${t('result.reward.failed')}</p><button class="secondary" id="retry-reward">${t('result.reward.retrySave')}</button>`;$('#retry-reward').onclick=onRetry;$('#retry-btn').disabled=true;},
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
      // GachaSystem은 문구가 아니라 키를 돌려준다 — 표시할 때 현재 언어로 바꾼다.
      if(!result||result.error){this.busy=false;if(result?.error)GameFeedback.toast(t(result.error));this.render(campaign);return;}
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
  badge(r){return r.duplicate?`<span class="pull-badge dup">${t('gacha.badge.dup',{n:r.gained})}</span>`:`<span class="pull-badge">${t('gacha.badge.new')}</span>`;},
  /* [연출 세션 B · B-5] 중복은 "몇 개 더 모으면 승급인지"까지 보여 준다.
     need가 0이면(최대 성급) 진행바를 내지 않는다. */
  shardBar(r){
    if(!r.duplicate||!(r.need>0)) return '';
    const held=Number(r.shards)||0,pct=Math.min(100,held/r.need*100);
    return `<span class="pull-shard">${t('gacha.badge.dup',{n:r.gained})} · ${I18N.num(held)} / ${I18N.num(r.need)}`
      +`<span class="pull-shard-track"><i data-shard-fill style="--fill:${pct.toFixed(1)}%"></i></span></span>`;
  },
  label(r){return r.type==='skill'?t('gacha.label.skill'):t('gacha.label.character',{rarity:t(RarityTable[r.rarityId].nameKey)});},
  reducedMotion(){try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}},
  reveal(res,campaign){
    this.revealFocus=document.activeElement;
    const results=res.results||[];
    this.batch={results,flipped:results.map(()=>false),phase:'cards'};this.flipLockUntil=0;
    $('#reveal-content').innerHTML=`<h2 id="reveal-title" class="reveal-kicker">${t('gacha.reveal.title',{n:results.length})}</h2><div class="pull-grid">${results.map((r,i)=>`<div class="pull-slot tier-${this.tierOf(r)}" style="--hint:${this.hintColor(r)};--front:${this.frontColor(r)}"><button class="pull-card" data-pull-index="${i}" aria-label="${t('gacha.reveal.cardAria',{n:i+1})}"><span class="pull-back"><i></i></span><span class="pull-front">${this.art(r)}<b>${t(r.nameKey)}</b>${this.badge(r)}${this.shardBar(r)}</span></button></div>`).join('')}</div><div class="pull-legend" aria-label="${t('gacha.reveal.legendAria')}">${
      RARITY_KEYS.map(id=>`<span><i style="background:${RarityTable[id].color}"></i>${t(RarityTable[id].nameKey)}</span>`).join('')
    }<span><i style="background:${PALETTE.skill}"></i>${t('gacha.reveal.legendSkill')}</span></div>
    <p class="pull-hint">${t('gacha.reveal.hint')}</p>`;
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
    if(slot)slot.querySelector('.pull-card').setAttribute('aria-label',t('gacha.reveal.revealedAria',{name:t(r.nameKey),label:this.label(r),state:r.duplicate?t('gacha.state.dup',{n:r.gained}):t('gacha.state.new')}));
    const fill=slot?.querySelector('[data-shard-fill]');
    if(fill) requestAnimationFrame(()=>{ fill.style.width=fill.style.getPropertyValue('--fill'); });
    if(tier==='legend'&&!this.reducedMotion()){slot?.classList.add('burst');this.flipLockUntil=performance.now()+this.LEGEND_LOCK_MS;}
    else if(tier==='epic'&&!this.reducedMotion())slot?.classList.add('glint');
    GameAudio.play(tier==='legend'||tier==='epic'?'reveal':'tap');
    this.updateButtons();return true;
  },
  updateButtons(){
    const b=this.batch,close=$('#reveal-close');if(!b)return;
    if(b.phase==='cards'){const left=b.flipped.filter(x=>!x).length;close.textContent=left?t('gacha.reveal.next',{n:left}):t('gacha.reveal.summaryButton');}
    else close.textContent=t('common.continue');
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
    $('#reveal-content').innerHTML=`<h2 id="reveal-title" class="reveal-kicker">${t('gacha.summary.title')}</h2><div class="pull-stats" data-summary></div><div class="pull-summary">${rows.map(({r})=>`<div class="pull-row tier-${this.tierOf(r)}" style="--front:${this.frontColor(r)}">${this.art(r)}<div><b>${t(r.nameKey)}</b><small>${this.label(r)}</small></div>${this.badge(r)}</div>`).join('')}</div>`;
    // 신규 수·조각 합계는 0에서 올라온다. [연출 세션 B · B-5]
    GameFeedback.countUp($('#reveal-content [data-summary]'),shards,{from:0,
      format:v=>t('gacha.summary.stats',{fresh,shards:Math.round(v)})});
    $('#reveal-skip').hidden=true;this.updateButtons();$('#reveal-close').focus();
  },
  closeReveal(campaign){$('#recruit-modal').hidden=true;$('#recruit-modal .reveal-dialog').classList.remove('pull-mode');this.batch=null;this.flipLockUntil=0;this.busy=false;this.render(campaign);if(this.revealFocus?.isConnected)this.revealFocus.focus();this.revealFocus=null;},
  render(campaign){
    const state=campaign.state,price=GachaSystem.cost(state),balance=WalletSystem.balance(state,CONFIG.meta.gacha.currencyId),locked=campaign.broken||!!state.active,poor=balance<price;
    $('#gacha-count').textContent=t('gacha.count',{n:state.gachaCount||0});
    $('#gacha-cost').textContent=I18N.num(price);
    $('#gacha-pull-btn').disabled=locked||poor||this.busy;
    $('#gacha-pull-btn').textContent=this.busy?t('gacha.pulling'):poor?t('gacha.poor'):t('gacha.pull');
    $('#gacha-nav-dot').hidden=poor||locked;
    const g=CONFIG.meta.gacha;
    $('#gacha-hint').textContent=poor?t('gacha.hint.poor',{n:Math.max(0,price-balance)}):t('gacha.hint.odds',{character:g.characterWeight,skill:g.skillWeight});
    $('#gacha-odds').innerHTML=`<div><span>${t('gacha.odds.character')}</span><b>${g.characterWeight}%</b></div><div><span>${t('gacha.odds.skill')}</span><b>${g.skillWeight}%</b></div>`+GachaSystem.odds().map(o=>{const r=RarityTable[o.rarityId];return `<div><span class="rarity-chip" style="--rarity-color:${r.color}">${t('gacha.odds.rarity',{rarity:t(r.nameKey)})}</span><span>${o.pct.toFixed(1)}%</span></div>`;}).join('');
    const chars=state.characterInventory.characters;
    $('#gacha-progress').innerHTML=RARITY_KEYS.slice().reverse().map(k=>{const r=RarityTable[k],pool=CharacterRepository.list().filter(c=>c.rarityId===k);return `<div><span class="rarity-chip" style="--rarity-color:${r.color}">${t('gacha.odds.rarity',{rarity:t(r.nameKey)})}</span><span>${pool.filter(c=>chars[c.characterId]?.owned).length} / ${pool.length}</span></div>`;}).join('')+`<div><span>${t('gacha.progress.skills')}</span><span>${SKILL_KEYS.filter(key=>state.skillInventory.skills[key].owned).length} / ${SKILL_KEYS.length}</span></div>`;
    const box=$('#gacha-result'),r=this.lastResult;box.hidden=!r;
    if(!r){box.innerHTML='';return;}
    const list=r.results||[],fresh=list.filter(x=>!x.duplicate).length,shards=list.reduce((s,x)=>s+(x.duplicate?x.gained:0),0),best=list.slice().sort((x,y)=>this.rank(y)-this.rank(x))[0];
    box.innerHTML=`${best?this.art(best):''}<div><b>${t('gacha.recent.title',{n:list.length})}</b><p>${t('gacha.recent.body',{fresh,shards,best:best&&best.type!=='skill'?t('gacha.recent.best',{rarity:t(RarityTable[best.rarityId].nameKey),name:t(best.nameKey)}):''})}</p></div>`;
  },
};

