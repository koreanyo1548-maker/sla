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
    ['home','characters','codex','skills','upgrade'].forEach(p=>$('#lobby-'+p).hidden=p!==page);
    $$('[data-lobby-nav]').forEach(b=>{if(b.dataset.lobbyNav===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  },
  scrollLobbyTop(){$('#lobby-scroll').scrollTop=0;},
  wallet({recovered,gold,starfire,locked,selectedStage}){
    const max=CAMPAIGN_CONFIG.staminaMax,entry=CAMPAIGN_CONFIG.entryCost,sec=CampaignEconomy.secondsToNextTick(recovered);
    // [연출 세션 B] 재화가 바뀌는 지점은 전부 countUp을 지난다. 값이 그대로면
    // 아무 일도 하지 않으므로 1초마다 도는 이 렌더가 조용하다.
    GameFeedback.countUp($('#stamina-value'),recovered.stamina,{format:v=>`${I18N.num(Math.round(v))} / ${I18N.num(max)}`});
    GameFeedback.countUp($('#gold-value'),gold);
    GameFeedback.countUp($('#starfire-value'),starfire);
    $('#stamina-timer').textContent=recovered.stamina>=max?t('lobby.stamina.full'):t('lobby.stamina.timer',{time:`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`});
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

/* =====================================================================
   [UpgradeLobbyUI] 공용 레벨업 6종 — 예전 소환 창의 자리
   ---------------------------------------------------------------------
   [2026-09-18] 확정(인철): 뽑기를 없애고 이 창을 미사일 4 + 스킬 슬롯 2, 모두 여섯 트랙의
   레벨을 올리는 창으로 바꿨다. 레벨이 곧 해금이라, 카드마다 "다음에 무엇이 열리는지"를 같이 낸다.
   ===================================================================== */
const UpgradeLobbyUI={
  bound:false,
  init(campaign){
    if(this.bound)return;this.bound=true;
    RevealUI.init(campaign);
  },
  trackIcon(state,track){
    if(track.kind==='module')return GameArt.module(track.moduleId,'module-mini');
    const key=state.skillInventory.equipped[track.slot];
    return `<span class="uc-skill-icon" style="--icon-color:${SKILL_DEFS[key]?.color||PALETTE.skill}">${SKILL_DEFS[key]?.icon||'◆'}</span>`;
  },
  trackName(state,track){
    if(track.kind==='module')return t(MISSILE_DEFS[track.moduleId].labelKey);
    const key=state.skillInventory.equipped[track.slot];
    return key?t(CONFIG.skills[key].nameKey):t('skill.card.unequipped');
  },
  // 슬롯 번호는 카드 왼쪽 위에 따로 붙인다. 제목에 "슬롯 1 · "을 달고 있으면 그만큼
  // 이름 자리가 좁아져 영문 스킬 이름이 줄임표로 잘렸다(제목은 한 줄 고정이다).
  slotBadge(track){
    if(track.kind==='module')return '';
    return `<span class="uc-slot">${t('upgrade.track.slot',{n:track.slot+1})}</span>`;
  },
  // 이 레벨업으로 실제로 오르는 값. 미사일은 편성 수호자의 공격력, 스킬은 장착 스킬의 공격 보너스다.
  // 비용만 보이고 무엇이 오르는지 안 보이면 여섯 트랙 중 어디에 골드를 쓸지 고를 근거가 없다.
  gainLine(state,track,level){
    if(track.kind==='module'){
      const id=state.characterInventory.formation[track.moduleId],owned=state.characterInventory.characters[id];
      if(!id||!owned)return '';
      const stat=lv=>CharacterGrowthSystem.stats(id,{...owned,level:lv}).atk;
      return t('upgrade.gain.atk',{from:I18N.num(stat(level)),to:I18N.num(stat(level+1))});
    }
    const key=state.skillInventory.equipped[track.slot];
    if(!key)return '';
    // 스킬마다 오르는 능력치가 다르다(용광 방벽은 공격이 0이라 "+0 → +0"이 나온다).
    // 이번 레벨에서 가장 많이 오르는 항목 하나를 골라 낸다.
    const from=SkillGrowthSystem.stats(key,{level}),to=SkillGrowthSystem.stats(key,{level:level+1});
    const best=[['atk','skill.detail.statAtk'],['def','skill.detail.statDef'],['hp','skill.detail.statHp']]
      .map(([id,labelKey])=>({id,labelKey,gain:to[id]-from[id]})).sort((a,b)=>b.gain-a.gain)[0];
    if(!best||best.gain<=0)return '';
    return t('upgrade.gain.skillStat',{stat:t(best.labelKey),from:I18N.num(from[best.id]),to:I18N.num(to[best.id])});
  },
  // 카드 아래 한 줄. 미사일은 다음에 열리는 수호자를, 스킬은 다음 무작위 해금까지의 합계를 알린다.
  unlockLine(state,track){
    if(track.kind==='module'){
      const need=UnlockSystem.nextUnlockLevel(state,track.moduleId);
      if(!need)return t('upgrade.unlock.moduleDone');
      const roster=UnlockSystem.roster(track.moduleId),next=roster.find(c=>!state.characterInventory.characters[c.characterId]?.owned);
      return t('upgrade.unlock.module',{level:need,rarity:t(RarityTable[next.rarityId].nameKey)});
    }
    const need=UnlockSystem.nextSkillTotal(state);
    if(!need)return t('upgrade.unlock.skillDone');
    return t('upgrade.unlock.skill',{need,current:LevelTrackSystem.skillLevelTotal(state)});
  },
  card(campaign,track){
    const state=campaign.state,level=LevelTrackSystem.level(state,track.trackId),max=CharacterGrowthRules.maxLevel;
    const allowed=LevelTrackSystem.allowed(level),cost=LevelTrackSystem.cost(level),payable=LevelTrackSystem.payable(state,level);
    const locked=campaign.broken||!!state.active,short=Math.max(0,cost-WalletSystem.balance(state,'gold'));
    const color=track.kind==='module'?MISSILE_DEFS[track.moduleId].color:PALETTE.skill;
    // 비용 자리는 상태에 따라 세 가지다 — 올릴 수 있으면 가격, 골드가 모자라면 부족분, 끝났으면 상한.
    const detail=!allowed?t('upgrade.levelMax'):short>0?t('upgrade.short',{n:I18N.num(short)}):t('upgrade.cost',{amount:I18N.num(cost)});
    return `<article class="track-card${allowed&&!payable?' poor':''}" style="--track-color:${color}">`
      +this.slotBadge(track)
      +`<span class="uc-icon">${this.trackIcon(state,track)}</span>`
      +`<div class="uc-body"><div class="uc-title"><b>${this.trackName(state,track)}</b><span class="uc-level">${t('common.level',{n:level})}<em>/ ${max}</em></span></div>`
      +`<div class="level-track"><span style="width:${level/max*100}%"></span></div>`
      +`${allowed?`<small class="uc-gain">${this.gainLine(state,track,level)}</small>`:''}`
      +`<small class="uc-unlock">${this.unlockLine(state,track)}</small></div>`
      +`<button class="primary" data-track-up="${track.trackId}" ${locked||!allowed||!payable?'disabled':''}>${t('upgrade.levelUp')}<small>${detail}</small></button></article>`;
  },
  levelUp(campaign,trackId){
    const unlocked=LevelTrackSystem.levelUp(campaign,trackId);
    if(!unlocked){campaign.render();return;}
    // burst가 레벨업 소리까지 낸다 — 여기서 따로 울리면 두 번 겹친다.
    GameFeedback.burst($(`[data-track-up="${trackId}"]`)?.closest('.track-card'));
    if(unlocked.length)RevealUI.show(unlocked,campaign);
  },
  render(campaign){
    const state=campaign.state;
    const ready=LEVEL_TRACKS.some(track=>{const level=LevelTrackSystem.level(state,track.trackId);return LevelTrackSystem.allowed(level)&&LevelTrackSystem.payable(state,level);});
    // 머리 칩은 누적 레벨 같은 허수가 아니라 이 창이 여는 것, 즉 수호자 수집률을 낸다.
    const roster=CharacterRepository.list();
    $('#upgrade-count').textContent=t('upgrade.count',{owned:roster.filter(c=>state.characterInventory.characters[c.characterId]?.owned).length,total:roster.length});
    $('#upgrade-list').innerHTML=LEVEL_TRACKS.map(track=>this.card(campaign,track)).join('');
    $$('[data-track-up]').forEach(button=>button.onclick=()=>this.levelUp(campaign,button.dataset.trackUp));
    $('#upgrade-nav-dot').hidden=!ready;
    const chars=state.characterInventory.characters;
    $('#upgrade-progress').innerHTML=MISSILE_KEYS.map(id=>{const roster=UnlockSystem.roster(id);return `<div><span>${GameArt.module(id,'module-mini')}${t(MISSILE_DEFS[id].labelKey)}</span><span>${roster.filter(c=>chars[c.characterId]?.owned).length} / ${roster.length}</span></div>`;}).join('')
      +`<div><span>${t('upgrade.progress.skills')}</span><span>${SKILL_KEYS.filter(key=>state.skillInventory.skills[key].owned).length} / ${SKILL_KEYS.length}</span></div>`;
  },
};
/* =====================================================================
   [RevealUI] 해금 공개 연출 — 소환 카드 연출의 1장 판
   ---------------------------------------------------------------------
   [2026-09-18] 확정(인철): 뽑기는 없애되 카드 공개 연출은 남겨 해금의 순간에 쓴다.
   뒷면 빛으로 등급을 예고하고, 누르면 뒤집힌다. 전설은 버스트, 에픽은 글린트까지 그대로다.
   레벨업 한 번이 여는 대상은 보통 하나지만, 저장 보정으로 여럿이 한꺼번에 열릴 수 있어 줄로 받는다.
   ===================================================================== */
const RevealUI={
  queue:[],current:null,revealed:false,lastFocus:null,bound:false,
  LEGEND_LOCK_MS:900,
  init(campaign){
    if(this.bound)return;this.bound=true;
    $('#reveal-close').onclick=()=>this.advance(campaign);
    document.addEventListener('keydown',e=>{
      if($('#recruit-modal').hidden)return;
      if(e.key==='Escape'){e.preventDefault();this.advance(campaign);}
    });
  },
  tierOf(r){return r.type==='skill'?'skill':r.rarityId;},
  hintColor(r){return r.type==='skill'?PALETTE.skill:RarityTable[r.rarityId].color;},
  art(r){return r.type==='skill'?`<span class="pull-icon" style="--icon-color:${this.hintColor(r)}">${SKILL_DEFS[r.skillKey]?.icon||'◆'}</span>`:GameArt.portrait(r.characterId);},
  label(r){return r.type==='skill'?t('reveal.label.skill'):t('reveal.label.character',{rarity:t(RarityTable[r.rarityId].nameKey),module:t(MISSILE_DEFS[r.moduleId].labelKey)});},
  reducedMotion(){try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}},
  show(list,campaign){
    this.queue=[...list];
    if(!this.queue.length)return;
    this.lastFocus=document.activeElement;
    $('#recruit-modal .reveal-dialog').classList.add('pull-mode');
    $('#recruit-modal').hidden=false;
    this.next(campaign);
  },
  next(campaign){
    this.current=this.queue.shift()||null;
    if(!this.current){this.close();return;}
    this.revealed=false;
    const r=this.current;
    $('#reveal-content').innerHTML=`<h2 id="reveal-title" class="reveal-kicker">${t('reveal.title')}</h2>`
      +`<div class="pull-grid single"><div class="pull-slot tier-${this.tierOf(r)}" style="--hint:${this.hintColor(r)};--front:${this.hintColor(r)}">`
      +`<button class="pull-card" data-reveal-card aria-label="${t('reveal.cardAria')}"><span class="pull-back"><i></i></span>`
      +`<span class="pull-front">${this.art(r)}<b>${t(r.nameKey)}</b><span class="pull-badge">${t('reveal.badge.new')}</span></span></button></div></div>`
      +`<p class="pull-hint">${t('reveal.hint')}</p>`;
    $('[data-reveal-card]').onclick=()=>this.flip();
    $('#reveal-close').textContent=t('reveal.open');
    GameAudio.play('reveal');requestAnimationFrame(()=>$('#reveal-close').focus());
  },
  flip(){
    if(this.revealed||!this.current)return false;
    this.revealed=true;
    const r=this.current,tier=this.tierOf(r),slot=$('#reveal-content .pull-slot');
    slot?.classList.add('flipped');
    $('[data-reveal-card]')?.setAttribute('aria-label',t('reveal.revealedAria',{name:t(r.nameKey),label:this.label(r)}));
    if(tier==='legend'&&!this.reducedMotion())slot?.classList.add('burst');
    else if(tier==='epic'&&!this.reducedMotion())slot?.classList.add('glint');
    const hint=$('.pull-hint',$('#reveal-content'));if(hint)hint.textContent=this.label(r);
    $('#reveal-close').textContent=this.queue.length?t('reveal.nextOne',{n:this.queue.length}):t('common.continue');
    GameAudio.play(tier==='legend'||tier==='epic'?'reveal':'tap');
    return true;
  },
  advance(campaign){
    if(!this.current){this.close();return;}
    if(!this.revealed){this.flip();return;}
    if(this.queue.length){this.next(campaign);return;}
    this.close();
    if(campaign)campaign.render();
  },
  close(){
    if($('#recruit-modal').hidden)return;
    $('#recruit-modal').hidden=true;$('#recruit-modal .reveal-dialog').classList.remove('pull-mode');
    this.queue=[];this.current=null;this.revealed=false;
    if(this.lastFocus?.isConnected)this.lastFocus.focus();
    this.lastFocus=null;
  },
};
