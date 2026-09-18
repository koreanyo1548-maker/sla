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
      if(e.kind==='factor')return t('passive.factor',{scope:e.scope==='global'?t('passive.scopeAll'):MISSILE_DEFS[e.targetId].label,stat:labels[e.factorKey]||e.factorKey,pct:pct(e.value)});
      if(e.kind==='status_on_hit')return t('passive.statusOnHit',{chance:pct(e.chance),status:StatusEffectTable[e.statusId].name,duration:StatusEffectTable[e.statusId].duration});
      if(e.kind==='damage_vs_status')return t('passive.damageVsStatus',{status:StatusEffectTable[e.statusId].name,pct:pct(e.value)});
      if(e.kind==='module_rule'){
        const q=e.params||{};
        if(e.ruleId==='unusedTargetBonus')return t('passive.rule.unusedTargetBonus',{pct:pct(q.value)});
        if(e.ruleId==='centerDamageBonus')return t('passive.rule.centerDamageBonus',{pct:pct(q.value)});
        if(e.ruleId==='secondary')return t('passive.rule.secondary',{damage:pct(q.damagePct),radius:pct(q.radiusPct)});
        if(e.ruleId==='empowered')return t('passive.rule.empowered',{chance:pct(q.chance),damage:pct(q.damagePct),width:pct(q.widthPct)});
        if(e.ruleId==='focused')return t('passive.rule.focused',{damage:pct(q.damagePct)});
      }
      const c=e.condition,label=c.tagType==='race'?RaceTable[c.tagId]:c.tagType==='identity'?IdentityTable[c.tagId]:MISSILE_DEFS[c.tagId]?.label;
      return t('passive.formation',{tag:label,count:c.count,scope:e.scope==='module'?MISSILE_DEFS[e.targetId].label:t('passive.scopeAll'),stat:labels[e.factorKey],pct:pct(e.value)});
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
        if(CharacterGrowthSystem.transact(campaign,id,action.dataset.characterAction)){GameFeedback.burst($('#character-modal-content'));GameFeedback.toast(t('character.toast.grown',{name:CharacterTable[id].name}));}
        else campaign.render();return;
      }
      if(event.target.closest('[data-character-deploy]')&&this.modalCharacterId){
        const c=CharacterTable[this.modalCharacterId];
        if(CharacterGrowthSystem.assign(campaign,this.modalCharacterId)){GameAudio.play('up');this.close();GameFeedback.toast(t('character.toast.deployed',{name:c.name,module:MISSILE_DEFS[c.specialtyMissileId].label}));}
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
    return `<div class="formation-panel"><strong>${t('character.formation.title')} <small>${t('character.formation.hint')}</small></strong><div class="formation-grid">${party.members.map(m=>`<button class="formation-slot ${this.filter===m.specialtyMissileId?'active':''}" data-formation-module="${m.specialtyMissileId}" aria-label="${t('character.formation.slotAria',{module:MISSILE_DEFS[m.specialtyMissileId].label,name:m.name,level:m.level})}">${GameArt.portrait(m.characterId)}${GameArt.module(m.specialtyMissileId,'formation-module')}<b>${m.name}</b><em>${t('common.level',{n:m.level})}</em></button>`).join('')}</div><div class="formation-total"><span>${t('character.formation.hp')} <b>${I18N.num(party.stats.hp)}</b></span><span>${t('character.formation.def')} <b>${party.stats.def}</b></span><span>${t('character.formation.atk')} <b>${I18N.num(Math.round(party.stats.atk))}</b></span></div></div>`;
  },
  renderFilters(){
    return `<div class="character-filters" aria-label="${t('character.filter.aria')}">${['all',...CONFIG.moduleKeys].map(id=>`<button class="character-filter ${this.filter===id?'active':''}" data-character-filter="${id}" aria-pressed="${this.filter===id}">${id==='all'?t('character.filter.all'):GameArt.module(id)+MISSILE_DEFS[id].label}</button>`).join('')}</div>`;
  },
  renderRoster(campaign){
    const inv=campaign.state.characterInventory;
    const list=CharacterRepository.list().filter(c=>(this.filter==='all'||c.specialtyMissileId===this.filter)&&(!this.ownedOnly||inv.characters[c.characterId].owned))
      .sort((a,b)=>Number(inv.characters[b.characterId].owned)-Number(inv.characters[a.characterId].owned)||(RarityTable[b.rarityId].order-RarityTable[a.rarityId].order)||a.sortOrder-b.sortOrder);
    return `<div class="roster-toolbar"><span>${t('character.roster.sort')}</span><button data-owned-toggle aria-pressed="${this.ownedOnly}">${this.ownedOnly?'☑':'☐'} ${t('character.roster.ownedOnly')}</button></div><div class="character-roster">${list.map(c=>{
      const x=inv.characters[c.characterId],deployed=inv.formation[c.specialtyMissileId]===c.characterId,r=RarityTable[c.rarityId];
      return `<button data-character-id="${c.characterId}" class="${deployed?'chosen':''}${x.owned?'':' locked'}" style="--character-color:${r.color}" aria-label="${t('character.roster.aria',{name:c.name,rarity:r.name,state:x.owned?t('character.roster.levelState',{level:x.level}):t('common.notOwned')})}"><span class="roster-art-wrap">${GameArt.portrait(c.characterId)}<span class="roster-rarity">${r.short}</span>${deployed?`<span class="deployed-badge">${t('character.roster.deployed')}</span>`:''}${x.owned&&this.canGrow(campaign,c.characterId)?`<span class="growth-ready" aria-label="${t('character.roster.growable')}">↑</span>`:''}</span><div class="roster-copy"><b>${c.name}</b><small>${x.owned?`${'★'.repeat(x.star)} <span>${t('common.level',{n:x.level})}</span>`:t('common.notOwned')} </small>${GameArt.module(c.specialtyMissileId,'module-mini')}</div></button>`;
    }).join('')}</div>`;
  },
  render(campaign){
    const chars=campaign.state.characterInventory.characters,list=CharacterRepository.list();
    $('#character-count').textContent=t('character.count',{owned:list.filter(c=>chars[c.characterId].owned).length,total:list.length});
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
      const detail=action==='levelUp'
        ?(ok?CharacterGrowthSystem.costs(id,x,action).map(k=>t('character.detail.levelCost',{amount:k.amount})).join(' + '):t('character.detail.levelMax'))
        :(x.star>=CharacterGrowthRules.maxStars?t('character.detail.rankMax'):t('character.detail.rankCost',{n:CharacterGrowthSystem.shardCost(id,x)}));
      return `<button class="primary" data-character-action="${action}" ${locked||!ok||!payable?'disabled':''}>${label}<small>${detail}</small></button>`;
    };
    $('#character-modal-content').innerHTML=`<div class="character-modal-scroll"><div class="character-modal-hero">${GameArt.portrait(id)}<div class="character-hero-name"><span class="rarity-chip" style="--rarity-color:${r.color}">${r.name}</span><h2 id="character-modal-title">${c.name}</h2><span class="character-stars">${'★'.repeat(x.star)}</span></div></div><div class="character-modal-body"><div class="character-tags"><span>${IdentityTable[c.identityId]}</span><span>${RaceTable[c.raceId]}</span><span style="color:${def.color}">${t('character.detail.specialty',{module:def.label})}</span></div><div class="character-level-bar"><b>${x.owned?t('common.level',{n:x.level}):t('common.notOwned')}</b><div class="level-track"><span style="width:${x.level/CharacterGrowthRules.maxLevel*100}%"></span></div><span>${CharacterGrowthRules.maxLevel}</span></div><div class="character-stats">${[['atk','character.detail.statAtk'],['def','character.detail.statDef'],['hp','character.detail.statHp']].map(([k,labelKey])=>`<div><small>${t(labelKey)}</small><b>${I18N.num(stats[k])}</b><small>${x.owned&&CharacterGrowthSystem.allowed(x,'levelUp')?t('character.detail.nextStat',{value:next[k]}):canRank?t('character.detail.rankUpStat',{value:rankNext[k]}):t('character.detail.baseStat')}</small></div>`).join('')}</div>${passives.map(pv=>`<div class="character-modal-section character-modal-passive${pv.open?'':' passive-locked'}"><strong>${pv.need?t('character.detail.starPassive',{n:pv.need}):t('character.detail.innatePassive')}</strong><b>${pv.name}${pv.open?'':' 🔒'}</b><ul class="passive-lines">${pv.text.split(' / ').map(line=>`<li>${line}</li>`).join('')}</ul></div>`).join('')}${x.owned?`<div class="shard-line"><span>${t('character.detail.shards',{name:c.name})}</span><b>${x.shards}${x.star<CharacterGrowthRules.maxStars?' / '+CharacterGrowthSystem.shardCost(id,x):''}</b></div>`:`<p class="meta-note">${t('character.detail.recruitHint',{rarity:r.name,pct:GachaSystem.odds().find(o=>o.rarityId===c.rarityId).pct.toFixed(1)})}</p>`}</div></div><div class="character-modal-footer">${x.owned?`<div class="character-actions">${button('levelUp',t('character.detail.levelUp'))}${button('rankUp',t('character.detail.rankUp'))}</div><button class="secondary character-deploy-button" data-character-deploy ${locked||assigned?'disabled':''}>${assigned?t('character.detail.deployed',{module:def.label}):t('character.detail.deploy')}</button>`:`<button class="primary character-deploy-button" data-go-recruit>${t('character.detail.goRecruit')}</button>`}</div>`;
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
    campaign.render();MilestoneUI.render(campaign);GameFeedback.toast(t('milestone.toast.claimed',{currency:CurrencyTable[row.currencyId].name,amount:st.total}));return true;
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
    const cfg=CONFIG.skills[key],def=SKILL_DEFS[key],v=SkillGrowthSystem.effect(key,x),dur=SkillGrowthSystem.duration(key,x),pct=n=>Math.round(n*1000)/10,dmg=t('skill.effect.damage',{pct:Math.round(v*100)});
    const control={
      stun:()=>t('skill.effect.stun',{sec:cfg.stunSec}),
      slow:()=>t('skill.effect.slow',{pct:pct(cfg.slowPct),sec:cfg.slowSec}),
      knockback:()=>t('skill.effect.knockback',{px:cfg.knockbackPx}),
    }[def.control];
    switch(def.effect){
      case 'projectile': case 'damageAll': return control?t('skill.effect.withControl',{damage:dmg,control:control()}):dmg;
      case 'damageReduction': return t('skill.effect.damageReduction',{pct:pct(v),sec:dur});
      case 'heal': return t('skill.effect.heal',{pct:pct(v)});
      case 'energy': return t('skill.effect.energy',{n:Math.round(v)});
      case 'attackBuff': return t('skill.effect.attackBuff',{pct:pct(v),sec:dur});
      case 'defenseBuff': return t('skill.effect.defenseBuff',{pct:pct(v),sec:dur});
      case 'regen': return t('skill.effect.regen',{pct:pct(v),sec:dur,total:pct(v*dur)});
    }
    return def.description;
  },
  statsText(key,x){const s=SkillGrowthSystem.stats(key,x);return t('skill.statsLine',{atk:s.atk,def:s.def,hp:s.hp});},
  render(campaign){
    const inv=campaign.state.skillInventory,equipped=inv.equipped;
    $('#skill-count').textContent=t('skill.count',{owned:SKILL_KEYS.filter(key=>inv.skills[key].owned).length,total:SKILL_KEYS.length});
    const slotHtml=equipped.map((key,index)=>{const x=inv.skills[key],d=CONFIG.skills[key],m=SKILL_DEFS[key];return `<button class="skill-slot" data-skill-open="${key}" style="--skill-accent:${m.color}"><span class="skill-icon">${m.icon}</span><b>${t('skill.slotName',{index:index+1,name:d.name})}</b><small>${t('skill.slotLine',{level:x.level,effect:this.effectText(key,x)})}</small></button>`;}).join('');
    $('#skill-lobby-content').innerHTML=`<div class="skill-equipped-panel"><strong>${t('skill.equipped.title')}</strong><div class="skill-equipped-grid">${slotHtml}</div></div><div class="skill-card-grid">${SKILL_KEYS.map(key=>{const x=inv.skills[key],d=CONFIG.skills[key],m=SKILL_DEFS[key];return `<button class="skill-card${x.owned?'':' locked'}${equipped.includes(key)?' equipped':''}" data-skill-open="${key}" style="--skill-accent:${m.color}"><span class="skill-level">${x.owned?t('common.level',{n:x.level}):t('common.notOwned')}</span><span class="skill-icon">${m.icon}</span><b>${d.name}</b><small>${x.owned?this.effectText(key,x):t('skill.card.locked')}</small><div class="skill-stars">${'★'.repeat(x.star)}${'☆'.repeat(CharacterGrowthRules.maxStars-x.star)}</div></button>`;}).join('')}</div>`;
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
    $('#skill-modal-content').innerHTML=`<div class="character-modal-scroll"><div class="skill-detail-head" style="--skill-accent:${m.color}"><div class="skill-detail-icon">${m.icon}</div><div><h2 id="skill-modal-title">${d.name}</h2><div class="skill-stars">${'★'.repeat(x.star)}${'☆'.repeat(CharacterGrowthRules.maxStars-x.star)}</div><small>${x.owned?t('skill.detail.levelOfMax',{level:x.level,max:CharacterGrowthRules.maxLevel}):t('common.notOwned')}</small></div></div><div class="character-modal-section"><strong>${t('skill.detail.active')}</strong><p>${m.description}</p><b>${this.effectText(key,x)}</b><small>${t('skill.detail.cooldown',{sec:SkillGrowthSystem.cooldown(key),growth:d.growth==='duration'?t('skill.detail.growthDuration',{sec:d.durationPerStar}):t('skill.detail.growthEffect')})}</small></div><div class="character-modal-section"><strong>${t('skill.detail.stats')}</strong><div class="character-stats">${[['atk','skill.detail.statAtk'],['def','skill.detail.statDef'],['hp','skill.detail.statHp']].map(([s,labelKey])=>`<div><small>${t(labelKey)}</small><b>+${stats[s]}</b><small>${levelAllowed?t('skill.detail.nextStat',{value:nextStats[s]}):t('skill.detail.maxStat')}</small></div>`).join('')}</div></div>${x.owned?`<div class="shard-line"><span>${t('skill.detail.shards',{name:d.name})}</span><b>${x.shards}${x.star<CharacterGrowthRules.maxStars?' / '+rankCost:''}</b></div>`:`<p class="meta-note">${t('skill.detail.gachaHint')}</p>`}</div><div class="character-modal-footer">${x.owned?`<div class="skill-detail-actions"><button class="primary" data-skill-action="levelUp" ${!levelAllowed||WalletSystem.balance(campaign.state,'gold')<levelCost?'disabled':''}>${t('skill.detail.levelUp')}<small>${levelAllowed?t('skill.detail.levelCost',{amount:levelCost}):t('skill.detail.levelMax')}</small></button><button class="secondary" data-skill-action="rankUp" ${!rankAllowed||x.shards<rankCost?'disabled':''}>${t('skill.detail.rankUp')}<small>${t('skill.detail.rankCost',{n:rankCost})}</small></button></div><div class="skill-equip-actions">${Array.from({length:CONFIG.skillPickCount},(_,slot)=>slot).map(slot=>`<button class="secondary" data-skill-slot="${slot}">${equipped[slot]===key?t('skill.detail.slotEquipped',{n:slot+1}):t('skill.detail.slotEquip',{n:slot+1})}</button>`).join('')}</div>`:''}</div>`;
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
      const reward=Object.entries(totals).map(([id,n])=>t('milestone.card.reward',{currency:CurrencyTable[id].name,amount:n})).join(' · ');
      return {ready:true,text:t('milestone.strip.claim'),sub:t('milestone.strip.count',{n:ready.length}),pct:100,reward};
    }
    let best=null;
    MILESTONE_TABLE.forEach(row=>{
      const st=MilestoneSystem.status(state,row),pct=st.need>0?st.current/st.need:0;
      if(!best||pct>best.pct)best={row,st,pct};
    });
    if(!best)return {ready:false,text:t('milestone.strip.none'),sub:'',pct:0};
    return {ready:false,text:best.row.name,
      sub:t('milestone.strip.progress',{current:best.st.current,need:best.st.need}),
      pct:Math.min(100,best.pct*100)};
  },
  renderStrip(campaign){
    const el=$('#milestone-strip-body'),state=campaign.state;
    if(!el||!state)return;
    const s=this.strip(state);
    $('#open-milestones').classList.toggle('ready',s.ready);
    // pill은 좁다. 게이지는 버리고 목표 이름과 진행만 남긴다(자세한 건 패널에서 본다).
    $('#open-milestones').setAttribute('aria-label',t('milestone.strip.aria',{text:s.text,sub:s.sub}).trim());
    el.innerHTML=`<b>${s.text}</b><small>${s.sub}</small>`;
  },
  render(campaign){
    const state=campaign.state;if(!state)return;const count=MilestoneSystem.claimableCount(state);
    $('#milestone-home-dot').hidden=!count;
    this.renderStrip(campaign);
    $('#milestone-list').innerHTML=MILESTONE_TABLE.map(row=>{const st=MilestoneSystem.status(state,row),cur=CurrencyTable[row.currencyId].name,pct=Math.min(100,st.current/st.need*100);return `<article class="milestone-card${st.ready?' claimable':''}"><span class="milestone-icon">${row.icon}</span><div class="milestone-copy"><b>${row.name}<em class="milestone-tier">${t('milestone.tier',{n:st.tier+1})}</em></b><small>${t('milestone.card.progress',{description:row.description,current:st.current,need:st.need})}</small><div class="milestone-progress"><i style="width:${pct}%"></i></div><div class="milestone-reward">${t('milestone.card.reward',{currency:cur,amount:st.ready?st.total:st.reward})}${st.count>1?t('milestone.card.bulk',{n:st.count}):''}</div></div><button data-claim-milestone="${row.id}" ${st.ready?'':'disabled'}>${t(st.ready?'milestone.card.claim':'milestone.card.inProgress')}</button></article>`;}).join('');
    $$('[data-claim-milestone]').forEach(button=>button.onclick=()=>MilestoneSystem.claim(campaign,button.dataset.claimMilestone));
  },
};

