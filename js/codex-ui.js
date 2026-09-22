/* ===== codex-ui.js ===== */
/* 도감 표시 전담. 진행도·수령 판정은 CodexSystem 결과만 사용하고, 저장은 CodexSystem.claim이 쓴다.
   [2026-09-22] 도감의 주인공을 수치표가 아니라 수호자 초상으로 되돌렸다. 초상은 항상 노출하고
   미보유·보유·성급을 명도와 별 문양으로 직접 표현한다. 수령 뒤에는 해당 카드의 초상 → 단계 문장 →
   누적 효과가 차례로 반응해 어떤 영구 효과가 적용됐는지를 화면 안에서 확인할 수 있다. */
const CodexLobbyUI={
  tab:'base',bound:false,
  init(campaign){
    if(this.bound)return;this.bound=true;
    $('#open-codex').onclick=()=>this.open(campaign);
    $('#close-codex').onclick=()=>this.close();
  },
  open(campaign){$('#codex-panel').hidden=false;this.render(campaign);},
  close(){$('#codex-panel').hidden=true;},
  pct(value){
    const n=Math.round((Number(value)||0)*1000)/10;
    return Number.isInteger(n)?String(n):n.toFixed(1);
  },
  factorText(reward){
    const label=COMBAT_FACTOR_LABELS[reward.factorKey];
    return `${label?t(label.shortKey):reward.factorKey} +${this.pct(reward.value)}%`;
  },
  rewardList(rewards){return rewards.map(reward=>this.factorText(reward)).join(' · ');},
  filterName(filter){
    return [filter?.raceId?RaceTable[filter.raceId]:null,filter?.identityId?IdentityTable[filter.identityId]:null,filter?.rarityId?RarityTable[filter.rarityId]?.nameKey:null]
      .filter(Boolean).map(key=>t(key)).join(' · ');
  },
  // 단계 칸은 세 상태다 — 받음(on) · 달성했지만 미수령(ready) · 미달성.
  steps(progress){
    return `<span class="codex-steps" aria-hidden="true">${progress.definition.levels
      .map((row,index)=>`<i class="${index<progress.claimed?'on':index<progress.level?'ready':''}"></i>`).join('')}</span>`;
  },
  claimButton(progress){
    if(progress.claimable<=0)return '';
    const rewards=CodexSystem.pendingRewards(progress);
    return `<button class="codex-claim" data-codex-claim="${progress.definition.codexId}">${t('codex.claim',{n:progress.claimable})}<small>${this.rewardList(rewards)}</small></button>`;
  },
  memberPortrait(member){
    const name=t(member.nameKey),star=Math.max(0,Number(member.star)||0);
    const aria=member.owned?t('codex.memberAria',{name,star}):t('codex.memberLockedAria',{name});
    const stars=Array.from({length:CharacterGrowthRules.maxStars},(_,index)=>`<i class="${index<star?'on':''}"></i>`).join('');
    return `<figure class="codex-portrait${member.owned?' owned':' locked'}" aria-label="${aria}"><span class="codex-portrait-art">${GameArt.portrait(member.characterId)}</span><span class="codex-portrait-stars" aria-hidden="true">${stars}</span><figcaption>${name}</figcaption></figure>`;
  },
  memberList(members,className=''){
    return `<div class="codex-portraits${className?` ${className}`:''}">${members.map(member=>this.memberPortrait(member)).join('')}</div>`;
  },
  overview(snapshot){
    const rewards=CodexDatabase.rewardFactorKeys.map(factorKey=>({factorKey,value:snapshot.factors.global[factorKey]})).filter(reward=>reward.value);
    const width=snapshot.totalLevels?snapshot.claimedLevels/snapshot.totalLevels*100:0;
    const ready=snapshot.readyCount?`<span class="codex-overview-ready">${t('codex.overview.ready',{n:snapshot.readyCount})}</span>`:'';
    return `<section class="codex-overview"><div class="codex-overview-head"><strong>${t('codex.overview.title')}</strong><em>${t('codex.count',{current:snapshot.claimedLevels,total:snapshot.totalLevels})}</em></div><div class="codex-progress"><span style="width:${width}%"></span></div>${ready}<div class="codex-effect-list">${rewards.length?rewards.map(reward=>`<span data-codex-factor="${reward.factorKey}">${this.factorText(reward)}</span>`).join(''):`<small>${t('codex.summary.empty')}</small>`}</div></section>`;
  },
  card(progress,className,inner){
    const d=progress.definition;
    return `<article class="${className}${progress.claimable?' claimable':''}" style="--codex-accent:${d.accent}" data-codex-card="${d.codexId}" aria-label="${t(d.nameKey)}">${inner()}</article>`;
  },
  baseCard(progress){
    const d=progress.definition,next=progress.next;
    const claimed=CodexSystem.claimedRewards(progress);
    // 받은 게 있으면 누적을, 없으면 다음 단계 보상을 낸다. 최종 단계까지 달성하고 아직 받지
    // 않았다면 next가 없어 낼 값이 없는데, 그 값은 바로 아래 받기 버튼이 이미 보여 준다.
    const rewardText=claimed.length
      ?t('codex.totalReward',{reward:this.rewardList(claimed)})
      :next?t('codex.nextReward',{reward:this.rewardList(next.rewards||[])}):'';
    const scoreText=next
      ?`${t('codex.score',{current:progress.score,required:next.requiredScore})} · ${t('codex.needStars',{n:next.requiredScore-progress.score})}`
      :t('codex.scoreMax',{current:progress.score,max:progress.maxScore});
    return this.card(progress,'codex-card',()=>
      `<div class="codex-card-head"><span class="codex-mark"></span><b>${t(d.nameKey)}</b>${this.steps(progress)}<em>${t('codex.level',{level:progress.claimed,max:progress.maxLevel})}</em></div>${this.memberList(progress.members)}<div class="codex-card-meta"><small>${scoreText}</small>${rewardText?`<strong>${rewardText}</strong>`:''}</div>${this.claimButton(progress)}`);
  },
  baseContent(snapshot){
    return CodexDatabase.baseGroups.slice().sort((a,b)=>a.groupOrder-b.groupOrder).map(group=>{
      const entries=snapshot.base.filter(progress=>progress.definition.groupId===group.groupId);
      return `<section class="codex-group"><h3>${t(group.nameKey)}</h3><div class="codex-base-grid">${entries.map(progress=>this.baseCard(progress)).join('')}</div></section>`;
    }).join('');
  },
  relationSide(side,next,index){
    const required=next?.requiredSideScores?.[index]||side.maxScore;
    const score=next?t('codex.score',{current:side.score,required}):t('codex.scoreMax',{current:side.score,max:side.maxScore});
    return `<div class="codex-relation-side"><strong>${this.filterName(side.memberFilter)}</strong>${this.memberList(side.members,'compact')}<small>${score}</small></div>`;
  },
  relationCard(progress){
    const d=progress.definition;
    const currentTitle=progress.claimed?t(d.levels[progress.claimed-1].titleKey):t('codex.relation.undiscovered');
    return this.card(progress,'codex-relation-card',()=>
      `<div class="codex-card-head codex-relation-head"><span class="codex-relation-label">${t('codex.relation.label')}</span><b>${t(d.nameKey)}</b>${this.steps(progress)}<em>${t('codex.level',{level:progress.claimed,max:progress.maxLevel})}</em></div><div class="codex-relation-sides">${progress.sides.map((side,index)=>this.relationSide(side,progress.next,index)).join('<i>×</i>')}</div><strong class="codex-relation-current">${currentTitle}</strong><p>${t(d.descKey)}</p><div class="codex-relation-levels">${d.levels.map(row=>`<div class="${row.level<=progress.claimed?'unlocked':row.level<=progress.level?'ready':''}"><span>${row.level}</span><b>${t(row.titleKey)}</b><small>${row.rewards.map(reward=>this.factorText(reward)).join(' · ')}</small></div>`).join('')}</div>${this.claimButton(progress)}`);
  },
  relationContent(snapshot){return `<div class="codex-relation-list">${snapshot.relations.map(progress=>this.relationCard(progress)).join('')}</div>`;},
  // 홈 배너의 pill 본문. 받을 게 있으면 그것을, 없으면 가장 가까운 다음 단계를 보여 준다.
  strip(snapshot){
    const text=t('codex.count',{current:snapshot.claimedLevels,total:snapshot.totalLevels});
    if(snapshot.readyCount)return {ready:true,text,sub:t('codex.strip.ready',{n:snapshot.readyCount})};
    let best=null;
    snapshot.base.forEach(progress=>{
      if(!progress.next)return;
      const need=progress.next.requiredScore-progress.score;
      if(!best||need<best.need)best={need,nameKey:progress.definition.nameKey};
    });
    return {ready:false,text,sub:best?t('codex.strip.next',{name:t(best.nameKey),n:best.need}):t('codex.strip.done')};
  },
  renderStrip(snapshot){
    const el=$('#codex-strip-body');if(!el)return;
    const s=this.strip(snapshot);
    const pill=$('#open-codex');
    pill.classList.toggle('ready',s.ready);
    pill.setAttribute('aria-label',t('codex.strip.aria',{text:s.text,sub:s.sub}).trim());
    // 점이 아니라 개수를 낸다 — 몇 개가 밀려 있는지가 보여야 들어간다(마일스톤과 같은 규칙).
    const dot=$('#codex-home-dot');
    dot.hidden=!snapshot.readyCount; dot.textContent=snapshot.readyCount?I18N.num(snapshot.readyCount):'';
    el.innerHTML=`<b>${s.text}</b><small>${s.sub}</small>`;
  },
  claim(campaign,codexId){
    const result=CodexSystem.claim(campaign,codexId);
    if(!result)return;
    this.render(campaign);
    this.playClaimFx(result);
    GameAudio.play('up');
    GameFeedback.toast(t('codex.toast.claimed',{name:t(result.nameKey),n:result.count,reward:this.rewardList(result.rewards)}));
  },
  playClaimFx(result){
    const card=$(`[data-codex-card="${result.codexId}"]`);if(!card)return;
    const burst=document.createElement('div');
    burst.className='codex-claim-burst';
    burst.textContent=t('codex.applied',{reward:this.rewardList(result.rewards)});
    card.appendChild(burst);card.classList.add('just-claimed');
    result.rewards.forEach(reward=>$(`[data-codex-factor="${reward.factorKey}"]`)?.classList.add('just-increased'));
    setTimeout(()=>{card.classList.remove('just-claimed');burst.remove();$$('.just-increased').forEach(el=>el.classList.remove('just-increased'));},1100);
  },
  render(campaign){
    if(!campaign?.state)return;
    const snapshot=CodexSystem.snapshot(campaign.state);
    this.renderStrip(snapshot);
    const root=$('#codex-content');
    if(!root||$('#codex-panel').hidden)return;
    $('#codex-overview').innerHTML=this.overview(snapshot);
    root.innerHTML=this.tab==='relation'?this.relationContent(snapshot):this.baseContent(snapshot);
    $$('[data-codex-tab]').forEach(button=>{
      const ready=button.dataset.codexTab==='relation'?snapshot.relationReady:snapshot.baseReady;
      button.classList.toggle('active',button.dataset.codexTab===this.tab);
      // 유도점은 ::after로 붙인다 — 탭 문구는 data-i18n이 통째로 다시 쓰므로 자식을 넣을 수 없다.
      button.classList.toggle('has-ready',ready>0);
      button.setAttribute('aria-selected',String(button.dataset.codexTab===this.tab));
      button.onclick=()=>{this.tab=button.dataset.codexTab==='relation'?'relation':'base';this.render(campaign);};
    });
    $$('[data-codex-claim]',root).forEach(button=>{
      button.onclick=()=>this.claim(campaign,button.dataset.codexClaim);
    });
  },
};
