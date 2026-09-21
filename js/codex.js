/* ===== codex.js ===== */
/* 성급 기반 도감의 진행도·수령 상태·보상을 계산한다. DOM과 전투 객체는 다루지 않는다.
   [2026-09-21] 보상이 "조건을 채우면 즉시 적용"에서 "받기를 눌러야 적용"으로 바뀌었다.
   그래서 달성 단계(level)와 수령 단계(claimed)를 따로 들고, 전투에 얹히는 것은 claimed까지다.
   저장을 쓰는 곳은 claim() 하나뿐이며 절차는 characters.js의 GrowthRules.rankUp과 같다
   (campaign.read → cloneConfig → commit → render). 문구와 연출은 돌려준 결과로 UI가 만든다. */
const CodexSystem={
  matches(character,filter){
    return !!character&&Object.entries(filter||{}).every(([key,value])=>character[key]===value);
  },
  members(filter){
    return CharacterRepository.list().filter(character=>this.matches(character,filter));
  },
  ownedStar(state,characterId){
    const owned=state?.characterInventory?.characters?.[characterId];
    return owned?.owned?Math.max(1,Number(owned.star)||1):0;
  },
  memberState(state,filter){
    return this.members(filter).map(character=>({
      ...character,
      owned:!!state?.characterInventory?.characters?.[character.characterId]?.owned,
      star:this.ownedStar(state,character.characterId),
    }));
  },
  claimedLevel(state,codexId){
    const n=Number(state?.codexClaims?.[codexId]);
    return Number.isSafeInteger(n)&&n>0?n:0;
  },
  // 받은 단계는 줄어들지 않는다 — 달성 단계보다 위로 자르지 않고 단계 수 상한만 씌운다.
  // 그래서 임계값이 바뀌어 달성 단계가 내려가도 이미 받은 보상은 그대로 남는다.
  claimState(state,definition,level){
    const claimed=Math.min(definition.levels.length,this.claimedLevel(state,definition.codexId));
    return {claimed,claimable:Math.max(0,level-claimed)};
  },
  baseProgress(state,definition){
    const members=this.memberState(state,definition.memberFilter);
    const score=members.reduce((sum,member)=>sum+member.star,0);
    const level=definition.levels.filter(row=>score>=row.requiredScore).length;
    return {
      definition,members,score,level,
      ...this.claimState(state,definition,level),
      maxLevel:definition.levels.length,
      maxScore:members.length*CharacterGrowthRules.maxStars,
      next:definition.levels[level]||null,
    };
  },
  relationProgress(state,definition){
    const sides=definition.sides.map(side=>{
      const members=this.memberState(state,side.memberFilter);
      return {...side,members,score:members.reduce((sum,member)=>sum+member.star,0),maxScore:members.length*CharacterGrowthRules.maxStars};
    });
    const level=definition.levels.filter(row=>row.requiredSideScores.every((need,index)=>sides[index].score>=need)).length;
    return {
      definition,sides,level,
      ...this.claimState(state,definition,level),
      maxLevel:definition.levels.length,
      next:definition.levels[level]||null,
    };
  },
  // codexId 하나의 진행도. 기본·관계 어느 쪽인지는 호출한 쪽이 알 필요가 없다.
  entryProgress(state,codexId){
    const base=CodexDatabase.baseEntries.find(entry=>entry.codexId===codexId);
    if(base)return this.baseProgress(state,base);
    const relation=CodexDatabase.relationEntries.find(entry=>entry.codexId===codexId);
    return relation?this.relationProgress(state,relation):null;
  },
  emptyFactors(){
    return {
      global:Object.fromEntries(CodexDatabase.rewardFactorKeys.map(key=>[key,0])),
      modules:Object.fromEntries(CONFIG.moduleKeys.map(module=>[module,Object.fromEntries(CodexDatabase.rewardFactorKeys.map(key=>[key,0]))])),
    };
  },
  addReward(factors,reward){
    if(!CodexDatabase.rewardFactorKeys.includes(reward.factorKey))return;
    const bucket=reward.scope==='module'&&CONFIG.moduleKeys.includes(reward.targetId)
      ?factors.modules[reward.targetId]
      :factors.global;
    bucket[reward.factorKey]+=(Number(reward.value)||0);
  },
  // 전투에 얹히는 것은 받은 단계까지다. 달성만 하고 받지 않은 단계는 여기에 들어오지 않는다.
  addClaimedRewards(factors,progress){
    progress.definition.levels.slice(0,progress.claimed).forEach(row=>(row.rewards||[]).forEach(reward=>this.addReward(factors,reward)));
  },
  // 단계 구간의 보상 합계를 팩터별로 묶는다. 누적 표시(0~claimed)와 수령 예정(claimed~level)이 같은 식을 쓴다.
  sumRewards(progress,from,to){
    const totals={};
    progress.definition.levels.slice(from,to).forEach(row=>(row.rewards||[]).forEach(reward=>{
      totals[reward.factorKey]=(totals[reward.factorKey]||0)+(Number(reward.value)||0);
    }));
    return CodexDatabase.rewardFactorKeys.filter(key=>totals[key]).map(factorKey=>({factorKey,value:totals[factorKey]}));
  },
  claimedRewards(progress){return this.sumRewards(progress,0,progress.claimed);},
  pendingRewards(progress){return this.sumRewards(progress,progress.claimed,progress.level);},
  snapshot(state){
    const groupOrder=Object.fromEntries(CodexDatabase.baseGroups.map(group=>[group.groupId,group.groupOrder]));
    const base=CodexDatabase.baseEntries.map(entry=>this.baseProgress(state,entry))
      .sort((a,b)=>(groupOrder[a.definition.groupId]||0)-(groupOrder[b.definition.groupId]||0)||a.definition.sortOrder-b.definition.sortOrder);
    const relations=CodexDatabase.relationEntries.map(entry=>this.relationProgress(state,entry))
      .sort((a,b)=>a.definition.sortOrder-b.definition.sortOrder);
    const all=[...base,...relations];
    const factors=this.emptyFactors();
    all.forEach(progress=>this.addClaimedRewards(factors,progress));
    return {
      base,relations,factors,
      claimedLevels:all.reduce((sum,progress)=>sum+progress.claimed,0),
      unlockedLevels:all.reduce((sum,progress)=>sum+progress.level,0),
      totalLevels:all.reduce((sum,progress)=>sum+progress.maxLevel,0),
      // 받을 수 있는 도감 수. 유도점(알림 점)과 탭 표시가 이 값만 본다.
      readyCount:all.filter(progress=>progress.claimable>0).length,
      baseReady:base.filter(progress=>progress.claimable>0).length,
      relationReady:relations.filter(progress=>progress.claimable>0).length,
    };
  },
  // 한 도감의 열린 단계를 한 번에 받는다. 성공하면 토스트에 쓸 명세를, 실패하면 null을 돌려준다.
  claim(campaign,codexId){
    if(GameState.current!=='lobby'||!campaign.read()||campaign.state.active)return null;
    const next=cloneConfig(campaign.state);
    const progress=this.entryProgress(next,codexId);
    if(!progress||progress.claimable<=0)return null;
    const rewards=this.pendingRewards(progress);
    next.codexClaims??={};
    next.codexClaims[codexId]=progress.level;
    if(!campaign.commit(next))return null;
    Analytics.track('codex_claim',{id:codexId,level:progress.level});
    campaign.render();
    return {codexId,nameKey:progress.definition.nameKey,count:progress.claimable,level:progress.level,rewards};
  },
};
