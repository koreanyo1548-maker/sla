/* ===== codex-ui.js ===== */
/* 도감 표시 전담. 진행도와 보상 판정은 CodexSystem 결과만 사용한다. */
const CodexLobbyUI={
  tab:'base',
  pct(value){
    const n=Math.round((Number(value)||0)*1000)/10;
    return Number.isInteger(n)?String(n):n.toFixed(1);
  },
  factorText(reward){
    const label=COMBAT_FACTOR_LABELS[reward.factorKey];
    return `${label?t(label.shortKey):reward.factorKey} +${this.pct(reward.value)}%`;
  },
  accumulatedRewards(progress){
    const totals={};
    progress.definition.levels.slice(0,progress.level).forEach(row=>(row.rewards||[]).forEach(reward=>{
      totals[reward.factorKey]=(totals[reward.factorKey]||0)+(Number(reward.value)||0);
    }));
    return CodexDatabase.rewardFactorKeys.filter(key=>totals[key]).map(factorKey=>({factorKey,value:totals[factorKey]}));
  },
  filterName(filter){
    return [filter?.raceId?RaceTable[filter.raceId]:null,filter?.identityId?IdentityTable[filter.identityId]:null,filter?.rarityId?RarityTable[filter.rarityId]?.nameKey:null]
      .filter(Boolean).map(key=>t(key)).join(' · ');
  },
  memberStrip(members){
    return `<div class="codex-members">${members.map(member=>`<div class="codex-member${member.owned?'':' locked'}" title="${t(member.nameKey)}"><span class="codex-member-art">${GameArt.portrait(member.characterId)}</span><b>${t(member.nameKey)}</b><small>${member.owned?`★${member.star}`:t('common.notOwned')}</small></div>`).join('')}</div>`;
  },
  summary(snapshot){
    const rewards=CodexDatabase.rewardFactorKeys.map(factorKey=>({factorKey,value:snapshot.factors.global[factorKey]})).filter(reward=>reward.value);
    return `<section class="codex-summary"><strong>${t('codex.summary.title')}</strong><div class="codex-effect-list">${rewards.length?rewards.map(reward=>`<span>${this.factorText(reward)}</span>`).join(''):`<small>${t('codex.summary.empty')}</small>`}</div></section>`;
  },
  baseCard(progress){
    const d=progress.definition,next=progress.next;
    const target=next?.requiredScore||progress.maxScore;
    const width=Math.min(100,target?progress.score/target*100:100);
    const current=this.accumulatedRewards(progress);
    const rewardText=current.length?current.map(reward=>this.factorText(reward)).join(' · '):next?.rewards?.map(reward=>this.factorText(reward)).join(' · ');
    return `<article class="codex-card" style="--codex-accent:${d.accent}"><header><span class="codex-mark"></span><b>${t(d.nameKey)}</b><em>${t('codex.level',{level:progress.level,max:progress.maxLevel})}</em></header><div class="codex-progress"><span style="width:${width}%"></span></div><div class="codex-card-meta"><small>${next?t('codex.score',{current:progress.score,required:next.requiredScore}):t('codex.scoreMax',{current:progress.score,max:progress.maxScore})}</small><strong>${progress.level?t('codex.totalReward',{reward:rewardText}):t('codex.nextReward',{reward:rewardText})}</strong></div>${this.memberStrip(progress.members)}</article>`;
  },
  baseContent(snapshot){
    return CodexDatabase.baseGroups.slice().sort((a,b)=>a.groupOrder-b.groupOrder).map(group=>{
      const entries=snapshot.base.filter(progress=>progress.definition.groupId===group.groupId);
      return `<section class="codex-group"><h3>${t(group.nameKey)}</h3><div class="codex-base-grid">${entries.map(progress=>this.baseCard(progress)).join('')}</div></section>`;
    }).join('');
  },
  relationSide(side,next,index){
    const required=next?.requiredSideScores?.[index]||side.maxScore;
    const width=Math.min(100,required?side.score/required*100:100);
    return `<div class="codex-relation-side"><strong>${this.filterName(side.memberFilter)}</strong><div class="codex-progress"><span style="width:${width}%"></span></div><small>${next?t('codex.score',{current:side.score,required}):t('codex.scoreMax',{current:side.score,max:side.maxScore})}</small>${this.memberStrip(side.members)}</div>`;
  },
  relationCard(progress){
    const d=progress.definition;
    const currentTitle=progress.level?t(d.levels[progress.level-1].titleKey):t('codex.relation.undiscovered');
    return `<article class="codex-relation-card" style="--codex-accent:${d.accent}"><header><div><span>${t('codex.relation.label')}</span><h3>${t(d.nameKey)}</h3></div><em>${t('codex.level',{level:progress.level,max:progress.maxLevel})}</em></header><strong class="codex-relation-current">${currentTitle}</strong><p>${t(d.descKey)}</p><div class="codex-relation-sides">${progress.sides.map((side,index)=>this.relationSide(side,progress.next,index)).join('<i>×</i>')}</div><div class="codex-relation-levels">${d.levels.map(row=>`<div class="${row.level<=progress.level?'unlocked':''}"><span>${row.level}</span><b>${t(row.titleKey)}</b><small>${row.rewards.map(reward=>this.factorText(reward)).join(' · ')}</small></div>`).join('')}</div></article>`;
  },
  relationContent(snapshot){return `<div class="codex-relation-list">${snapshot.relations.map(progress=>this.relationCard(progress)).join('')}</div>`;},
  render(campaign){
    const root=$('#codex-content');if(!root||!campaign?.state)return;
    const snapshot=CodexSystem.snapshot(campaign.state);
    $('#codex-count').textContent=t('codex.count',{current:snapshot.unlockedLevels,total:snapshot.totalLevels});
    $('#codex-summary').innerHTML=this.summary(snapshot);
    root.innerHTML=this.tab==='relation'?this.relationContent(snapshot):this.baseContent(snapshot);
    $$('[data-codex-tab]').forEach(button=>{
      button.classList.toggle('active',button.dataset.codexTab===this.tab);
      button.setAttribute('aria-selected',String(button.dataset.codexTab===this.tab));
      button.onclick=()=>{this.tab=button.dataset.codexTab==='relation'?'relation':'base';this.render(campaign);};
    });
  },
};
