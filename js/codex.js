/* ===== codex.js ===== */
/* 성급 기반 도감 진행도와 보상을 계산하는 순수 로직. 저장·DOM·전투 객체를 직접 다루지 않는다. */
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
  baseProgress(state,definition){
    const members=this.memberState(state,definition.memberFilter);
    const score=members.reduce((sum,member)=>sum+member.star,0);
    const level=definition.levels.filter(row=>score>=row.requiredScore).length;
    return {
      definition,members,score,level,
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
    return {definition,sides,level,maxLevel:definition.levels.length,next:definition.levels[level]||null};
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
  addUnlockedRewards(factors,progress){
    progress.definition.levels.slice(0,progress.level).forEach(row=>(row.rewards||[]).forEach(reward=>this.addReward(factors,reward)));
  },
  snapshot(state){
    const groupOrder=Object.fromEntries(CodexDatabase.baseGroups.map(group=>[group.groupId,group.groupOrder]));
    const base=CodexDatabase.baseEntries.map(entry=>this.baseProgress(state,entry))
      .sort((a,b)=>(groupOrder[a.definition.groupId]||0)-(groupOrder[b.definition.groupId]||0)||a.definition.sortOrder-b.definition.sortOrder);
    const relations=CodexDatabase.relationEntries.map(entry=>this.relationProgress(state,entry))
      .sort((a,b)=>a.definition.sortOrder-b.definition.sortOrder);
    const factors=this.emptyFactors();
    [...base,...relations].forEach(progress=>this.addUnlockedRewards(factors,progress));
    return {
      base,relations,factors,
      unlockedLevels:[...base,...relations].reduce((sum,progress)=>sum+progress.level,0),
      totalLevels:[...base,...relations].reduce((sum,progress)=>sum+progress.maxLevel,0),
    };
  },
};
