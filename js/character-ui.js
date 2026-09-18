/* ===== character-ui.js ===== */
/* Collection, formation and guardian detail presentation. No economy mutations here. */
const CharacterLobbyUI={
  modalCharacterId:null,filter:'all',ownedOnly:false,lastFocus:null,bound:false,
  // [2026-09-15] 캐릭터의 모든 패시브를 해금 상태와 함께 보여준다. 2번 행은 3성에 열린다.
  passiveLines(c,owned){
    const ids=[c.innatePassiveId,...(c.passiveSlots?.star||[])].filter(Boolean);
    return ids.map(pid=>{
      const unlock=PassiveUnlockTable.find(u=>u.characterId===c.characterId&&u.passiveId===pid);
      const need=unlock&&unlock.unlockType==='star'?unlock.unlockValue:0;
      const open=!need||(Number(owned?.star)||1)>=need;
      return {passiveId:pid,name:PassiveTable[pid]?.name||'',text:this.passiveText(pid),open,need};
    });
  },
  passiveText(id){
    const labels=Object.fromEntries(COMBAT_FACTOR_KEYS.map(key=>[key,COMBAT_FACTOR_LABELS[key].short]));
    return PassiveEffectTable.filter(e=>e.passiveId===id).map(e=>{
      const pct=v=>Math.round((Number(v)||0)*100);
      if(e.kind==='factor')return `${e.scope==='global'?'전체':MISSILE_DEFS[e.targetId].label} ${labels[e.factorKey]||e.factorKey} +${pct(e.value)}%`;
      if(e.kind==='status_on_hit')return `적중 시 ${pct(e.chance)}% 확률로 ${StatusEffectTable[e.statusId].name} ${StatusEffectTable[e.statusId].duration}초`;
      if(e.kind==='damage_vs_status')return `${StatusEffectTable[e.statusId].name} 상태의 적에게 피해 +${pct(e.value)}%`;
      if(e.kind==='module_rule'){
        const q=e.params||{};
        if(e.ruleId==='unusedTargetBonus')return `남은 연결 횟수당 첫 대상 피해 +${pct(q.value)}%`;
        if(e.ruleId==='centerDamageBonus')return `중앙 탄환 피해 +${pct(q.value)}%`;
        if(e.ruleId==='secondary')return `처치 시 2차 폭발 · 피해 ${pct(q.damagePct)}% / 반경 ${pct(q.radiusPct)}%`;
        if(e.ruleId==='empowered')return `${pct(q.chance)}% 확률로 강화 레이저 · 피해 +${pct(q.damagePct)}% / 폭 +${pct(q.widthPct)}%`;
        if(e.ruleId==='focused')return `광선에 적이 1기만 걸리면 그 대상 피해 +${pct(q.damagePct)}%`;
      }
      const c=e.condition,label=c.tagType==='race'?RaceTable[c.tagId]:c.tagType==='identity'?IdentityTable[c.tagId]:MISSILE_DEFS[c.tagId]?.label;
      return `${label} ${c.count}명 편성 시 ${e.scope==='module'?MISSILE_DEFS[e.targetId].label:'전체'} ${labels[e.factorKey]} +${pct(e.value)}%`;
    }).join(' / ');
  },
  init(campaign){
    if(this.bound)return;this.bound=true;
    const modal=$('#character-modal');
    modal.addEventListener('click',event=>{
      if(event.target.closest('[data-character-close]')){this.close();return;}
      if(event.target.closest('[data-go-recruit]')){this.close();campaign.navigate('gacha');return;}
      const action=event.target.closest('[data-character-action]');
      if(action&&this.modalCharacterId){
        const id=this.modalCharacterId;
        if(CharacterGrowthSystem.transact(campaign,id,action.dataset.characterAction)){GameFeedback.burst($('#character-modal-content'));GameFeedback.toast(`${CharacterTable[id].name} 성장 완료`);}
        else campaign.render();return;
      }
      if(event.target.closest('[data-character-deploy]')&&this.modalCharacterId){
        const c=CharacterTable[this.modalCharacterId];
        if(CharacterGrowthSystem.assign(campaign,this.modalCharacterId)){GameAudio.play('up');this.close();GameFeedback.toast(`${c.name} · ${MISSILE_DEFS[c.specialtyMissileId].label} 편성 완료`);}
      }
    });
    document.addEventListener('keydown',event=>{
      if(modal.hidden)return;
      if(event.key==='Escape'){event.preventDefault();this.close();}
      if(event.key==='Tab'){
        const list=[...modal.querySelectorAll('button:not(:disabled)')].filter(b=>b.offsetParent!==null);
        if(!list.length)return;const first=list[0],last=list.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    });
  },
  canGrow(campaign,id){const x=campaign.state.characterInventory.characters[id];return ['levelUp','rankUp'].some(action=>CharacterGrowthSystem.allowed(x,action)&&CharacterGrowthSystem.payable(campaign,id,x,action));},
  renderFormation(party){
    return `<div class="formation-panel"><strong>출전 부대 <small>슬롯을 눌러 수호자 교체</small></strong><div class="formation-grid">${party.members.map(m=>`<button class="formation-slot ${this.filter===m.specialtyMissileId?'active':''}" data-formation-module="${m.specialtyMissileId}" aria-label="${MISSILE_DEFS[m.specialtyMissileId].label} 편성 ${m.name} 레벨 ${m.level}">${GameArt.portrait(m.characterId)}${GameArt.module(m.specialtyMissileId,'formation-module')}<b>${m.name}</b><em>Lv.${m.level}</em></button>`).join('')}</div><div class="formation-total"><span>체력 <b>${party.stats.hp.toLocaleString('ko-KR')}</b></span><span>방어 <b>${party.stats.def}</b></span><span>평균 공격 <b>${Math.round(party.stats.atk).toLocaleString('ko-KR')}</b></span></div></div>`;
  },
  renderFilters(){
    return `<div class="character-filters" aria-label="특화 미사일 필터">${['all',...CONFIG.moduleKeys].map(id=>`<button class="character-filter ${this.filter===id?'active':''}" data-character-filter="${id}" aria-pressed="${this.filter===id}">${id==='all'?'전체':GameArt.module(id)+MISSILE_DEFS[id].label}</button>`).join('')}</div>`;
  },
  renderRoster(campaign){
    const inv=campaign.state.characterInventory;
    const list=CharacterRepository.list().filter(c=>(this.filter==='all'||c.specialtyMissileId===this.filter)&&(!this.ownedOnly||inv.characters[c.characterId].owned))
      .sort((a,b)=>Number(inv.characters[b.characterId].owned)-Number(inv.characters[a.characterId].owned)||(RarityTable[b.rarityId].order-RarityTable[a.rarityId].order)||a.sortOrder-b.sortOrder);
    return `<div class="roster-toolbar"><span>보유 우선 · 높은 등급순</span><button data-owned-toggle aria-pressed="${this.ownedOnly}">${this.ownedOnly?'☑':'☐'} 보유만 보기</button></div><div class="character-roster">${list.map(c=>{
      const x=inv.characters[c.characterId],deployed=inv.formation[c.specialtyMissileId]===c.characterId,r=RarityTable[c.rarityId];
      return `<button data-character-id="${c.characterId}" class="${deployed?'chosen':''}${x.owned?'':' locked'}" style="--character-color:${r.color}" aria-label="${c.name} ${r.name} ${x.owned?'레벨 '+x.level:'미보유'} 상세"><span class="roster-art-wrap">${GameArt.portrait(c.characterId)}<span class="roster-rarity">${r.short}</span>${deployed?'<span class="deployed-badge">출전</span>':''}${x.owned&&this.canGrow(campaign,c.characterId)?'<span class="growth-ready" aria-label="성장 가능">↑</span>':''}</span><div class="roster-copy"><b>${c.name}</b><small>${x.owned?`${'★'.repeat(x.star)} <span>Lv.${x.level}</span>`:'미보유'} </small>${GameArt.module(c.specialtyMissileId,'module-mini')}</div></button>`;
    }).join('')}</div>`;
  },
  render(campaign){
    const chars=campaign.state.characterInventory.characters,list=CharacterRepository.list();
    $('#character-count').textContent=`${list.filter(c=>chars[c.characterId].owned).length} / ${list.length} 보유`;
    $('#growth-list').innerHTML=this.renderFormation(PartyCombatAdapter.snapshot(campaign.state))+this.renderFilters()+this.renderRoster(campaign);
    $$('[data-formation-module]').forEach(b=>b.onclick=()=>{this.filter=b.dataset.formationModule;this.render(campaign);});
    $$('[data-character-filter]').forEach(b=>b.onclick=()=>{this.filter=b.dataset.characterFilter;this.render(campaign);});
    $('[data-owned-toggle]').onclick=()=>{this.ownedOnly=!this.ownedOnly;this.render(campaign);};
    $$('[data-character-id]').forEach(b=>b.onclick=()=>this.open(campaign,b.dataset.characterId,b));
    $('#growth-nav-dot').hidden=!list.some(c=>chars[c.characterId].owned&&this.canGrow(campaign,c.characterId));
    if(this.modalCharacterId&&!$('#character-modal').hidden)this.renderModal(campaign);
  },
  open(campaign,id,source){
    if(!CharacterTable[id])return false;
    this.modalCharacterId=id;this.lastFocus=source||document.activeElement;
    $('#character-modal').hidden=false;$('#character-modal').setAttribute('aria-hidden','false');
    this.renderModal(campaign);requestAnimationFrame(()=>$('#character-modal [data-character-close].character-modal-close')?.focus());return true;
  },
  close(){
    const modal=$('#character-modal'),wasOpen=!modal.hidden;modal.hidden=true;modal.setAttribute('aria-hidden','true');this.modalCharacterId=null;
    const focus=this.lastFocus;this.lastFocus=null;if(wasOpen&&focus?.isConnected)focus.focus();
  },
  renderModal(campaign){
    const id=this.modalCharacterId,c=CharacterTable[id];if(!c){this.close();return;}
    const inv=campaign.state.characterInventory,x=inv.characters[id],stats=CharacterGrowthSystem.stats(id,x),next=CharacterGrowthSystem.stats(id,{...x,level:x.level+1});
    // [2026-09-15] 성급 배율이 생겼으므로 승급 상승폭도 레벨업과 같이 미리 보여준다.
    const canRank=CharacterGrowthSystem.allowed(x,'rankUp'),rankNext=canRank?CharacterGrowthSystem.stats(id,{...x,star:x.star+1}):null;
    const passives=this.passiveLines(c,x);
    const r=RarityTable[c.rarityId],def=MISSILE_DEFS[c.specialtyMissileId],assigned=inv.formation[c.specialtyMissileId]===id,locked=campaign.broken||!!campaign.state.active;
    const button=(action,label)=>{
      const ok=CharacterGrowthSystem.allowed(x,action),payable=CharacterGrowthSystem.payable(campaign,id,x,action);
      const detail=action==='levelUp'?(ok?CharacterGrowthSystem.costs(id,x,action).map(k=>`${k.amount.toLocaleString('ko-KR')} 골드`).join(' + '):'레벨 상한'):(x.star>=CharacterGrowthRules.maxStars?'최대 성급':`조각 ${CharacterGrowthSystem.shardCost(id,x)}개`);
      return `<button class="primary" data-character-action="${action}" ${locked||!ok||!payable?'disabled':''}>${label}<small>${detail}</small></button>`;
    };
    $('#character-modal-content').innerHTML=`<div class="character-modal-scroll"><div class="character-modal-hero">${GameArt.portrait(id)}<div class="character-hero-name"><span class="rarity-chip" style="--rarity-color:${r.color}">${r.name}</span><h2 id="character-modal-title">${c.name}</h2><span class="character-stars">${'★'.repeat(x.star)}</span></div></div><div class="character-modal-body"><div class="character-tags"><span>${IdentityTable[c.identityId]}</span><span>${RaceTable[c.raceId]}</span><span style="color:${def.color}">${def.label} 특화</span></div><div class="character-level-bar"><b>${x.owned?'Lv.'+x.level:'미보유'}</b><div class="level-track"><span style="width:${x.level/CharacterGrowthRules.maxLevel*100}%"></span></div><span>${CharacterGrowthRules.maxLevel}</span></div><div class="character-stats">${[['atk','공격력'],['def','방어력'],['hp','체력']].map(([k,label])=>`<div><small>${label}</small><b>${stats[k].toLocaleString('ko-KR')}</b><small>${x.owned&&CharacterGrowthSystem.allowed(x,'levelUp')?`다음 ${next[k].toLocaleString('ko-KR')}`:canRank?`승급 시 ${rankNext[k].toLocaleString('ko-KR')}`:'기본 능력치'}</small></div>`).join('')}</div>${passives.map(pv=>`<div class="character-modal-section character-modal-passive${pv.open?'':' passive-locked'}"><strong>${pv.need?`성급 패시브 · ${pv.need}성 해금`:'고정 패시브'}</strong><b>${pv.name}${pv.open?'':' 🔒'}</b><ul class="passive-lines">${pv.text.split(' / ').map(t=>`<li>${t}</li>`).join('')}</ul></div>`).join('')}${x.owned?`<div class="shard-line"><span>${c.name} 조각</span><b>${x.shards}${x.star<CharacterGrowthRules.maxStars?' / '+CharacterGrowthSystem.shardCost(id,x):''}</b></div>`:`<p class="meta-note">영입에서 획득할 수 있습니다. ${r.name} 등급 전체 확률 ${GachaSystem.odds().find(o=>o.rarityId===c.rarityId).pct.toFixed(1)}%</p>`}</div></div><div class="character-modal-footer">${x.owned?`<div class="character-actions">${button('levelUp','레벨 올리기')}${button('rankUp','성급 올리기')}</div><button class="secondary character-deploy-button" data-character-deploy ${locked||assigned?'disabled':''}>${assigned?`${def.label} 슬롯 출전 중`:'출전 부대에 편성'}</button>`:`<button class="primary character-deploy-button" data-go-recruit>영입하러 가기</button>`}</div>`;
  },
};

// [2026-09-16] 확정(인철): 마일스톤은 한 번으로 끝나지 않고 반복한다. 목표·보상 수치는 CONFIG.meta.milestones.
// 스테이지 돌파만 별불, 나머지는 골드다. 저장에는 항목별 수령 단계 수(milestoneClaims)만 남긴다.
const MILESTONE_TABLE=[
  {id:'stage_clear',icon:'⚑',name:'불씨 전선 돌파',description:'새로운 최고 스테이지 클리어',metric:'stagesCleared',currencyId:'starfire'},
  {id:'waves',icon:'〽',name:'전선 유지',description:'WAVE 통과',metric:'waves',currencyId:'gold'},
  {id:'bosses',icon:'♛',name:'강적 사냥',description:'보스 처치',metric:'bosses',currencyId:'gold'},
  {id:'skills_used',icon:'✦',name:'전술 운용',description:'스킬 사용',metric:'skillsUsed',currencyId:'gold'},
  {id:'orders',icon:'▤',name:'숙련된 제작자',description:'주문서 완료',metric:'orders',currencyId:'gold'},
  {id:'merges',icon:'◆',name:'융합의 손길',description:'머지 성공',metric:'merges',currencyId:'gold'},
];
// [2026-09-16] 확정(인철): 반복이 안 되는 수집·승급 목표(스킬 4종 보유, 스킬 2성)는 목록에서 빼고
// 판정 팩터만 남긴다. 플레이 패턴이 확정되면 목록에 다시 섞는다. progress()가 계속 계산한다.
const MILESTONE_RESERVED_METRICS=['ownedSkills','highestSkillStar'];
const MilestoneSystem={
  conf(row){return CONFIG.meta.milestones[row.id];},
  progress(state,row){
    if(row.metric==='ownedSkills')return SKILL_KEYS.filter(key=>state.skillInventory.skills[key].owned).length;
    if(row.metric==='highestSkillStar')return Math.max(...SKILL_KEYS.map(key=>state.skillInventory.skills[key].star));
    // 서로 다른 클리어 스테이지 수. 로비는 최고 스테이지만 입장하므로 새 스테이지를 깰 때만 오른다.
    if(row.metric==='stagesCleared')return Array.isArray(state.cleared)?new Set(state.cleared).size:0;
    return Number(state.lifetime?.[row.metric])||0;
  },
  claims(state,row){const n=Number(state.milestoneClaims?.[row.id]);return Number.isSafeInteger(n)&&n>0?n:0;},
  interval(row,n){const c=this.conf(row);return Math.max(1,Math.round(c.target+c.targetStep*n));},
  reward(row,n){const c=this.conf(row),v=c.reward+c.rewardStep*n;return Math.max(0,Math.round(c.rewardCap>0?Math.min(c.rewardCap,v):v));},
  // 현재 단계(수령한 단계 수 = tier)와, 지금 받을 수 있는 단계 수·보상 합계.
  status(state,row){
    const tier=this.claims(state,row),value=this.progress(state,row);
    let start=0;for(let i=0;i<tier;i++)start+=this.interval(row,i);
    const need=this.interval(row,tier);
    let count=0,total=0,edge=start;
    while(count<1000){const step=this.interval(row,tier+count);if(value<edge+step)break;edge+=step;total+=this.reward(row,tier+count);count++;}
    return {tier,value,current:Math.max(0,Math.min(need,value-start)),need,ready:count>0,count,total,reward:this.reward(row,tier)};
  },
  claimable(state,row){return this.status(state,row).ready;},
  // 받을 수 있는 단계가 여러 개면 한 번에 모두 받는다.
  claim(campaign,id){
    const row=MILESTONE_TABLE.find(x=>x.id===id);if(!row||GameState.current!=='lobby'||!campaign.read()||campaign.state.active)return false;
    const next=cloneConfig(campaign.state),st=this.status(next,row);if(!st.ready)return false;
    next.milestoneClaims??={};next.milestoneClaims[id]=st.tier+st.count;
    if(!WalletSystem.earn(next,row.currencyId,st.total))return false;
    if(!campaign.commit(next))return false;
    Analytics.track('milestone_claim',{id,tier:st.tier+st.count});
    campaign.render();MilestoneUI.render(campaign);GameFeedback.toast(`${CurrencyTable[row.currencyId].name} +${st.total.toLocaleString('ko-KR')} 획득`);return true;
  },
  claimableCount(state){return MILESTONE_TABLE.filter(row=>this.claimable(state,row)).length;},
};

const SkillLobbyUI={
  selectedKey:null,lastFocus:null,bound:false,
  init(campaign){
    if(this.bound)return;this.bound=true;
    $$('[data-skill-close]').forEach(el=>el.onclick=()=>this.close());
    $$('[data-open-skills]').forEach(el=>el.onclick=()=>campaign.navigate('skills'));
    $('#prepare-change-skills').onclick=()=>{campaign.showLobby();campaign.navigate('skills');};
  },
  // [2026-09-16 v0916_7] 스킬 키별 switch 대신 처리 방식(effect)과 제어(control)로 문구를 만든다.
  effectText(key,x){
    const cfg=CONFIG.skills[key],def=SKILL_DEFS[key],v=SkillGrowthSystem.effect(key,x),dur=SkillGrowthSystem.duration(key,x),pct=n=>Math.round(n*1000)/10,dmg=`공격력의 ${Math.round(v*100)}%`;
    const control={
      stun:()=>`스턴 ${cfg.stunSec}초`,
      slow:()=>`이동·공격속도 -${pct(cfg.slowPct)}% ${cfg.slowSec}초`,
      knockback:()=>`밀어내기 ${cfg.knockbackPx}`,
    }[def.control];
    switch(def.effect){
      case 'projectile': case 'damageAll': return control?`${dmg} · ${control()}`:dmg;
      case 'damageReduction': return `피해 ${pct(v)}% 감소 · ${dur}초`;
      case 'heal': return `최대 HP ${pct(v)}% 회복`;
      case 'energy': return `에너지 ${Math.round(v)} 즉시 획득`;
      case 'attackBuff': return `일반 공격력 +${pct(v)}% · ${dur}초`;
      case 'defenseBuff': return `방어력 +${pct(v)}% · ${dur}초`;
      case 'regen': return `초당 최대 HP ${pct(v)}% · ${dur}초 (총 ${pct(v*dur)}%)`;
    }
    return def.description;
  },
  statsText(key,x){const s=SkillGrowthSystem.stats(key,x);return `공격 +${s.atk} · 방어 +${s.def} · 체력 +${s.hp}`;},
  render(campaign){
    const inv=campaign.state.skillInventory,equipped=inv.equipped;
    $('#skill-count').textContent=`${SKILL_KEYS.filter(key=>inv.skills[key].owned).length} / ${SKILL_KEYS.length} 보유`;
    const slotHtml=equipped.map((key,index)=>{const x=inv.skills[key],d=CONFIG.skills[key],m=SKILL_DEFS[key];return `<button class="skill-slot" data-skill-open="${key}" style="--skill-accent:${m.color}"><span class="skill-icon">${m.icon}</span><b>${index+1}. ${d.name}</b><small>Lv.${x.level} · ${this.effectText(key,x)}</small></button>`;}).join('');
    $('#skill-lobby-content').innerHTML=`<div class="skill-equipped-panel"><strong>장착 스킬 · 전투 능력치에 합산</strong><div class="skill-equipped-grid">${slotHtml}</div></div><div class="skill-card-grid">${SKILL_KEYS.map(key=>{const x=inv.skills[key],d=CONFIG.skills[key],m=SKILL_DEFS[key];return `<button class="skill-card${x.owned?'':' locked'}${equipped.includes(key)?' equipped':''}" data-skill-open="${key}" style="--skill-accent:${m.color}"><span class="skill-level">${x.owned?'Lv.'+x.level:'미보유'}</span><span class="skill-icon">${m.icon}</span><b>${d.name}</b><small>${x.owned?this.effectText(key,x):'소환에서 획득'}</small><div class="skill-stars">${'★'.repeat(x.star)}${'☆'.repeat(CharacterGrowthRules.maxStars-x.star)}</div></button>`;}).join('')}</div>`;
    $$('[data-skill-open]').forEach(button=>button.onclick=()=>this.open(campaign,button.dataset.skillOpen,button));
    const ready=SKILL_KEYS.some(key=>{const x=inv.skills[key];return SkillGrowthSystem.allowed(x,'levelUp')&&SkillGrowthSystem.costs(x).length>0&&WalletSystem.canPay(campaign.state,SkillGrowthSystem.costs(x))||SkillGrowthSystem.allowed(x,'rankUp')&&x.shards>=SkillGrowthSystem.shardCost(x);});
    $('#skill-nav-dot').hidden=!ready;
    $('#home-skill-summary').innerHTML=equipped.map(key=>{const m=SKILL_DEFS[key];return `<span class="hs-skill-icon" style="--skill-accent:${m.color}">${m.icon}<em>${CONFIG.skills[key].name}</em></span>`;}).join('');
    if(this.selectedKey&&!$('#skill-modal').hidden)this.renderModal(campaign,this.selectedKey);
  },
  open(campaign,key,focus){this.selectedKey=key;this.lastFocus=focus||document.activeElement;this.renderModal(campaign,key);$('#skill-modal').hidden=false;$('#skill-modal').setAttribute('aria-hidden','false');},
  close(){this.selectedKey=null;$('#skill-modal').hidden=true;$('#skill-modal').setAttribute('aria-hidden','true');if(this.lastFocus?.isConnected)this.lastFocus.focus();},
  renderModal(campaign,key){
    const x=campaign.state.skillInventory.skills[key],d=CONFIG.skills[key],m=SKILL_DEFS[key],stats=SkillGrowthSystem.stats(key,x),nextStats=SkillGrowthSystem.stats(key,{...x,level:x.level+1}),equipped=campaign.state.skillInventory.equipped;
    const levelAllowed=SkillGrowthSystem.allowed(x,'levelUp'),rankAllowed=SkillGrowthSystem.allowed(x,'rankUp'),levelCost=SkillGrowthSystem.levelCost(x),rankCost=SkillGrowthSystem.shardCost(x);
    $('#skill-modal-content').innerHTML=`<div class="character-modal-scroll"><div class="skill-detail-head" style="--skill-accent:${m.color}"><div class="skill-detail-icon">${m.icon}</div><div><h2 id="skill-modal-title">${d.name}</h2><div class="skill-stars">${'★'.repeat(x.star)}${'☆'.repeat(CharacterGrowthRules.maxStars-x.star)}</div><small>${x.owned?`Lv.${x.level} / ${CharacterGrowthRules.maxLevel}`:'미보유'}</small></div></div><div class="character-modal-section"><strong>액티브 효과</strong><p>${m.description}</p><b>${this.effectText(key,x)}</b><small>쿨타임 ${SkillGrowthSystem.cooldown(key)}초 · ${d.growth==='duration'?`성급 상승 시 지속 +${d.durationPerStar}초`:'성급 상승 시 효과 성장'}</small></div><div class="character-modal-section"><strong>장착 능력치</strong><div class="character-stats">${[['atk','공격'],['def','방어'],['hp','체력']].map(([s,label])=>`<div><small>${label}</small><b>+${stats[s]}</b><small>${levelAllowed?'다음 +'+nextStats[s]:'현재 최대'}</small></div>`).join('')}</div></div>${x.owned?`<div class="shard-line"><span>${d.name} 조각</span><b>${x.shards}${x.star<CharacterGrowthRules.maxStars?' / '+rankCost:''}</b></div>`:'<p class="meta-note">불씨 소환에서 획득할 수 있습니다.</p>'}</div><div class="character-modal-footer">${x.owned?`<div class="skill-detail-actions"><button class="primary" data-skill-action="levelUp" ${!levelAllowed||WalletSystem.balance(campaign.state,'gold')<levelCost?'disabled':''}>레벨 올리기<small>${levelAllowed?`골드 ${levelCost.toLocaleString('ko-KR')}`:'레벨 상한'}</small></button><button class="secondary" data-skill-action="rankUp" ${!rankAllowed||x.shards<rankCost?'disabled':''}>성급 올리기<small>조각 ${rankCost}</small></button></div><div class="skill-equip-actions">${Array.from({length:CONFIG.skillPickCount},(_,slot)=>slot).map(slot=>`<button class="secondary" data-skill-slot="${slot}">${equipped[slot]===key?`${slot+1}번 장착 중`:`${slot+1}번 슬롯 장착`}</button>`).join('')}</div>`:''}</div>`;
    $$('[data-skill-action]').forEach(button=>button.onclick=()=>{if(SkillGrowthSystem.transact(campaign,key,button.dataset.skillAction)){this.renderModal(campaign,key);MilestoneUI.render(campaign);}});
    $$('[data-skill-slot]').forEach(button=>button.onclick=()=>{if(SkillGrowthSystem.equip(campaign,key,Number(button.dataset.skillSlot)))this.renderModal(campaign,key);});
  },
};
const MilestoneUI={
  init(campaign){$('#open-milestones').onclick=()=>this.open(campaign);$('#close-milestones').onclick=()=>this.close();},
  open(campaign){this.render(campaign);$('#milestone-panel').hidden=false;},close(){$('#milestone-panel').hidden=true;},
  // 배너 위 요약 스트립. 받을 게 있으면 그것을, 없으면 가장 가까운 목표를 보여준다.
  // 마일스톤을 상단 아이콘(옵션처럼 보였다)에서 모험 컨텐츠로 옮기기 위한 표시다.
  strip(state){
    const ready=MILESTONE_TABLE.filter(row=>MilestoneSystem.claimable(state,row));
    if(ready.length){
      const totals={};
      ready.forEach(row=>{const st=MilestoneSystem.status(state,row);totals[row.currencyId]=(totals[row.currencyId]||0)+st.total;});
      const reward=Object.entries(totals).map(([id,n])=>`${CurrencyTable[id].name} +${n.toLocaleString('ko-KR')}`).join(' · ');
      return {ready:true,text:'보상 받기',sub:`${ready.length}개`,pct:100,reward};
    }
    let best=null;
    MILESTONE_TABLE.forEach(row=>{
      const st=MilestoneSystem.status(state,row),pct=st.need>0?st.current/st.need:0;
      if(!best||pct>best.pct)best={row,st,pct};
    });
    if(!best)return {ready:false,text:'진행 중인 목표 없음',sub:'',pct:0};
    return {ready:false,text:best.row.name,
      sub:`${best.st.current.toLocaleString('ko-KR')} / ${best.st.need.toLocaleString('ko-KR')}`,
      pct:Math.min(100,best.pct*100)};
  },
  renderStrip(campaign){
    const el=$('#milestone-strip-body'),state=campaign.state;
    if(!el||!state)return;
    const s=this.strip(state);
    $('#open-milestones').classList.toggle('ready',s.ready);
    // pill은 좁다. 게이지는 버리고 목표 이름과 진행만 남긴다(자세한 건 패널에서 본다).
    $('#open-milestones').setAttribute('aria-label',`마일스톤 미션 · ${s.text} ${s.sub}`.trim());
    el.innerHTML=`<b>${s.text}</b><small>${s.sub}</small>`;
  },
  render(campaign){
    const state=campaign.state;if(!state)return;const count=MilestoneSystem.claimableCount(state);
    $('#milestone-home-dot').hidden=!count;
    this.renderStrip(campaign);
    $('#milestone-list').innerHTML=MILESTONE_TABLE.map(row=>{const st=MilestoneSystem.status(state,row),cur=CurrencyTable[row.currencyId].name,pct=Math.min(100,st.current/st.need*100),fmt=n=>n.toLocaleString('ko-KR');return `<article class="milestone-card${st.ready?' claimable':''}"><span class="milestone-icon">${row.icon}</span><div class="milestone-copy"><b>${row.name}<em class="milestone-tier">${fmt(st.tier+1)}단계</em></b><small>${row.description} · ${fmt(st.current)} / ${fmt(st.need)}</small><div class="milestone-progress"><i style="width:${pct}%"></i></div><div class="milestone-reward">${cur} +${fmt(st.ready?st.total:st.reward)}${st.count>1?` · ${st.count}단계 한꺼번에`:''}</div></div><button data-claim-milestone="${row.id}" ${st.ready?'':'disabled'}>${st.ready?'받기':'진행 중'}</button></article>`;}).join('');
    $$('[data-claim-milestone]').forEach(button=>button.onclick=()=>MilestoneSystem.claim(campaign,button.dataset.claimMilestone));
  },
};

