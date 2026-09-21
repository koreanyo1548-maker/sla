/* ===== codex-ui.js ===== */
/* 도감 표시 전담. 진행도·수령 판정은 CodexSystem 결과만 사용하고, 저장은 CodexSystem.claim이 쓴다.
   [2026-09-21] 로비 하단 탭에서 홈 팝업으로 옮겼다(MilestoneUI와 같은 구조).
   카드에서 초상 스트립을 빼고 접이식으로 내렸다 — 등급·종족·신분이 모두 24명 전원을 덮어
   같은 얼굴이 한 화면에 세 번 나왔고, 그 탓에 이름과 보상 문구가 7.5~9px까지 밀려 있었다.
   [2026-09-21] 보상이 수령 방식이 되면서 카드에 받기 버튼과 유도점이 붙었다. 카드는 영역
   전체가 여닫는 버튼이라 <button> 안에 받기 <button>을 넣을 수 없다 — 카드를 role="button"
   요소로 두고 받기만 진짜 버튼으로 두며, 받기 클릭은 여닫기로 번지지 않게 막는다. */
const CodexLobbyUI={
  tab:'base',expanded:null,bound:false,
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
  // 접었을 때는 그리지 않는다 — 카드 20장의 초상을 항상 만드는 것이 이전 화면의 밀도 문제였다.
  memberList(members){
    return `<div class="codex-members">${members.map(member=>`<div class="codex-member${member.owned?'':' locked'}"><span class="codex-member-art">${GameArt.portrait(member.characterId)}</span><b>${t(member.nameKey)}</b><small>${member.owned?starMarkup(member.star,CharacterGrowthRules.maxStars):t('common.notOwned')}</small></div>`).join('')}</div>`;
  },
  overview(snapshot){
    const rewards=CodexDatabase.rewardFactorKeys.map(factorKey=>({factorKey,value:snapshot.factors.global[factorKey]})).filter(reward=>reward.value);
    const width=snapshot.totalLevels?snapshot.claimedLevels/snapshot.totalLevels*100:0;
    const ready=snapshot.readyCount?`<span class="codex-overview-ready">${t('codex.overview.ready',{n:snapshot.readyCount})}</span>`:'';
    return `<section class="codex-overview"><div class="codex-overview-head"><strong>${t('codex.overview.title')}</strong><em>${t('codex.count',{current:snapshot.claimedLevels,total:snapshot.totalLevels})}</em></div><div class="codex-progress"><span style="width:${width}%"></span></div>${ready}<div class="codex-effect-list">${rewards.length?rewards.map(reward=>`<span>${this.factorText(reward)}</span>`).join(''):`<small>${t('codex.summary.empty')}</small>`}</div></section>`;
  },
  // 카드 껍데기. 여닫기는 영역 전체가 맡으므로 <article>이 role="button"을 쓴다.
  card(progress,className,inner){
    const d=progress.definition,open=this.expanded===d.codexId;
    return `<article class="${className}${open?' open':''}${progress.claimable?' claimable':''}" style="--codex-accent:${d.accent}" data-codex-card="${d.codexId}" role="button" tabindex="0" aria-expanded="${open}" aria-label="${t(d.nameKey)}">${inner(open)}</article>`;
  },
  baseCard(progress){
    const d=progress.definition,next=progress.next;
    const target=next?.requiredScore||progress.maxScore;
    const width=Math.min(100,target?progress.score/target*100:100);
    const claimed=CodexSystem.claimedRewards(progress);
    // 받은 게 있으면 누적을, 없으면 다음 단계 보상을 낸다. 최종 단계까지 달성하고 아직 받지
    // 않았다면 next가 없어 낼 값이 없는데, 그 값은 바로 아래 받기 버튼이 이미 보여 준다.
    const rewardText=claimed.length
      ?t('codex.totalReward',{reward:this.rewardList(claimed)})
      :next?t('codex.nextReward',{reward:this.rewardList(next.rewards||[])}):'';
    const scoreText=next
      ?`${t('codex.score',{current:progress.score,required:next.requiredScore})} · ${t('codex.needStars',{n:next.requiredScore-progress.score})}`
      :t('codex.scoreMax',{current:progress.score,max:progress.maxScore});
    return this.card(progress,'codex-card',open=>
      `<div class="codex-card-head"><span class="codex-mark"></span><b>${t(d.nameKey)}</b>${this.steps(progress)}<em>${t('codex.level',{level:progress.claimed,max:progress.maxLevel})}</em></div><div class="codex-progress"><span style="width:${width}%"></span></div><div class="codex-card-meta"><small>${scoreText}</small>${rewardText?`<strong>${rewardText}</strong>`:''}</div>${this.claimButton(progress)}${open?this.memberList(progress.members):''}`);
  },
  baseContent(snapshot){
    return CodexDatabase.baseGroups.slice().sort((a,b)=>a.groupOrder-b.groupOrder).map(group=>{
      const entries=snapshot.base.filter(progress=>progress.definition.groupId===group.groupId);
      return `<section class="codex-group"><h3>${t(group.nameKey)}</h3><div class="codex-base-grid">${entries.map(progress=>this.baseCard(progress)).join('')}</div></section>`;
    }).join('');
  },
  // 좌우 진영을 한 줄로 줄였다. 초상까지 넣으면 3열 배치가 좁은 폭에서 20px 아래로 무너진다.
  relationSide(side,next,index){
    const required=next?.requiredSideScores?.[index]||side.maxScore;
    const width=Math.min(100,required?side.score/required*100:100);
    return `<div class="codex-relation-side"><strong>${this.filterName(side.memberFilter)}</strong><div class="codex-progress"><span style="width:${width}%"></span></div><small>${next?t('codex.score',{current:side.score,required}):t('codex.scoreMax',{current:side.score,max:side.maxScore})}</small></div>`;
  },
  relationCard(progress){
    const d=progress.definition;
    const currentTitle=progress.claimed?t(d.levels[progress.claimed-1].titleKey):t('codex.relation.undiscovered');
    const members=progress.sides.flatMap(side=>side.members);
    return this.card(progress,'codex-relation-card',open=>
      `<div class="codex-card-head codex-relation-head"><span class="codex-relation-label">${t('codex.relation.label')}</span><b>${t(d.nameKey)}</b>${this.steps(progress)}<em>${t('codex.level',{level:progress.claimed,max:progress.maxLevel})}</em></div><strong class="codex-relation-current">${currentTitle}</strong><p>${t(d.descKey)}</p><div class="codex-relation-sides">${progress.sides.map((side,index)=>this.relationSide(side,progress.next,index)).join('<i>×</i>')}</div><div class="codex-relation-levels">${d.levels.map(row=>`<div class="${row.level<=progress.claimed?'unlocked':row.level<=progress.level?'ready':''}"><span>${row.level}</span><b>${t(row.titleKey)}</b><small>${row.rewards.map(reward=>this.factorText(reward)).join(' · ')}</small></div>`).join('')}</div>${this.claimButton(progress)}${open?this.memberList(members):''}`);
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
    GameAudio.play('up');
    GameFeedback.toast(t('codex.toast.claimed',{name:t(result.nameKey),n:result.count,reward:this.rewardList(result.rewards)}));
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
      button.onclick=()=>{this.tab=button.dataset.codexTab==='relation'?'relation':'base';this.expanded=null;this.render(campaign);};
    });
    $$('[data-codex-claim]',root).forEach(button=>{
      // 받기는 카드 안에 있다 — 여닫기로 번지지 않게 막는다.
      button.onclick=event=>{event.stopPropagation();this.claim(campaign,button.dataset.codexClaim);};
    });
    $$('[data-codex-card]',root).forEach(card=>{
      const toggle=()=>{this.expanded=this.expanded===card.dataset.codexCard?null:card.dataset.codexCard;this.render(campaign);};
      card.onclick=toggle;
      card.onkeydown=event=>{
        if(event.target!==card)return;   // 받기 버튼의 Enter·Space를 가로채지 않는다
        if(event.key!=='Enter'&&event.key!==' ')return;
        event.preventDefault();toggle();
      };
    });
  },
};
