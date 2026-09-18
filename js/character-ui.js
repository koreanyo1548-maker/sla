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
      return {passiveId:pid,name:PassiveTable[pid]?.nameKey?t(PassiveTable[pid].nameKey):'',text:this.passiveText(pid),open,need};
    });
  },
  passiveText(id){
    const labels=Object.fromEntries(COMBAT_FACTOR_KEYS.map(key=>[key,t(COMBAT_FACTOR_LABELS[key].shortKey)]));
    return PassiveEffectTable.filter(e=>e.passiveId===id).map(e=>{
      const pct=v=>Math.round((Number(v)||0)*100);
      if(e.kind==='factor')return t('passive.factor',{scope:e.scope==='global'?t('passive.scopeAll'):t(MISSILE_DEFS[e.targetId].labelKey),stat:labels[e.factorKey]||e.factorKey,pct:pct(e.value)});
      if(e.kind==='status_on_hit')return t('passive.statusOnHit',{chance:pct(e.chance),status:t(StatusEffectTable[e.statusId].nameKey),duration:StatusEffectTable[e.statusId].duration});
      if(e.kind==='damage_vs_status')return t('passive.damageVsStatus',{status:t(StatusEffectTable[e.statusId].nameKey),pct:pct(e.value)});
      if(e.kind==='module_rule'){
        const q=e.params||{};
        if(e.ruleId==='unusedTargetBonus')return t('passive.rule.unusedTargetBonus',{pct:pct(q.value)});
        if(e.ruleId==='centerDamageBonus')return t('passive.rule.centerDamageBonus',{pct:pct(q.value)});
        if(e.ruleId==='secondary')return t('passive.rule.secondary',{damage:pct(q.damagePct),radius:pct(q.radiusPct)});
        if(e.ruleId==='empowered')return t('passive.rule.empowered',{chance:pct(q.chance),damage:pct(q.damagePct),width:pct(q.widthPct)});
        if(e.ruleId==='focused')return t('passive.rule.focused',{damage:pct(q.damagePct)});
      }
      const c=e.condition,tagKey=c.tagType==='race'?RaceTable[c.tagId]:c.tagType==='identity'?IdentityTable[c.tagId]:MISSILE_DEFS[c.tagId]?.labelKey;
      return t('passive.formation',{tag:tagKey?t(tagKey):'',count:c.count,scope:e.scope==='module'?t(MISSILE_DEFS[e.targetId].labelKey):t('passive.scopeAll'),stat:labels[e.factorKey],pct:pct(e.value)});
    }).join(' / ');
  },
  init(campaign){
    if(this.bound)return;this.bound=true;
    const modal=$('#character-modal');
    modal.addEventListener('click',event=>{
      if(event.target.closest('[data-character-close]')){this.close();return;}
      if(event.target.closest('[data-go-recruit]')){this.close();campaign.navigate('upgrade');return;}
      if(event.target.closest('[data-character-action]')&&this.modalCharacterId){
        const id=this.modalCharacterId;
        // rankUp이 성공하면 그 안에서 campaign.render()가 돌아 모달이 새로 그려진다.
        // 연출은 새 DOM에 얹어야 하므로 거래 전 값을 먼저 찍어 둔다. [연출 세션 B]
        const owned=CharacterGrowthSystem.view(campaign.state,id);
        const before={stats:CharacterGrowthSystem.stats(id,owned),star:Number(owned?.star)||1};
        if(CharacterGrowthSystem.rankUp(campaign,id)){
          this.playGrowthFx(campaign,id,before);
          GameFeedback.toast(t('character.toast.grown',{name:t(CharacterTable[id].nameKey)}));
        }
        else campaign.render();return;
      }
      if(event.target.closest('[data-character-deploy]')&&this.modalCharacterId){
        const id=this.modalCharacterId,c=CharacterTable[id];
        if(CharacterGrowthSystem.assign(campaign,id)){
          GameAudio.play('up');this.close();
          GameFeedback.toast(t('character.toast.deployed',{name:t(c.nameKey),module:t(MISSILE_DEFS[c.specialtyMissileId].labelKey)}));
          // [연출 세션 B · B-6] 홈 파티 요약의 해당 슬롯이 바뀐 것을 알린다.
          GameFeedback.burst($(`[data-home-hero="${id}"]`));
        }
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
  /* [연출 세션 B · B-2] 승급과 패시브 해금을 눈으로 구분한다. 별이 하나씩 채워지고
     초상에 등급색 링이 퍼진다. 이번 승급으로 성급 패시브가 열렸으면 카드가 따로
     올라온다 — 해금 단계는 PassiveUnlockTable에서 읽는다.
     [2026-09-18] 레벨업은 공용 레벨 창으로 옮겨가 여기에는 승급만 남았다. */
  playGrowthFx(campaign,id,before){
    const content=$('#character-modal-content');
    const owned=CharacterGrowthSystem.view(campaign.state,id);
    const after=CharacterGrowthSystem.stats(id,owned);
    $$('[data-stat]',content).forEach(el=>{
      const key=el.dataset.stat;
      GameFeedback.countUp(el,after[key],{from:before.stats[key]});
    });
    GameFeedback.starUp({
      stars:$('.character-stars',content),
      hero:$('.character-modal-hero',content),
      color:RarityTable[CharacterTable[id].rarityId].color,
    });
    const opened=PassiveUnlockTable.find(u=>u.characterId===id&&u.unlockType==='star'
      &&u.unlockValue>before.star&&u.unlockValue<=(Number(owned?.star)||1));
    if(!opened) return;
    // 승급 연출이 끝난 뒤에 올린다 — 겹치면 둘 다 안 보인다.
    setTimeout(()=>GameFeedback.passiveReveal({
      name:t(PassiveTable[opened.passiveId].nameKey),
      lines:this.passiveText(opened.passiveId).split(' / '),
    }),700);
  },
  // [2026-09-18] 수호자가 개인으로 올릴 수 있는 것은 승급뿐이다 — 레벨은 공용 레벨 창에서 올린다.
  canGrow(campaign,id){const x=campaign.state.characterInventory.characters[id];return CharacterGrowthSystem.allowed(x)&&CharacterGrowthSystem.payable(campaign.state,id,x);},
  renderFormation(party){
    return `<div class="formation-panel"><strong>${t('character.formation.title')} <small>${t('character.formation.hint')}</small></strong><div class="formation-grid">${party.members.map(m=>`<button class="formation-slot ${this.filter===m.specialtyMissileId?'active':''}" data-formation-module="${m.specialtyMissileId}" aria-label="${t('character.formation.slotAria',{module:t(MISSILE_DEFS[m.specialtyMissileId].labelKey),name:t(m.nameKey),level:m.level})}">${GameArt.portrait(m.characterId)}${GameArt.module(m.specialtyMissileId,'formation-module')}<b>${t(m.nameKey)}</b><em>${t('common.level',{n:m.level})}</em></button>`).join('')}</div><div class="formation-total"><span>${t('character.formation.hp')} <b>${I18N.num(party.stats.hp)}</b></span><span>${t('character.formation.def')} <b>${party.stats.def}</b></span><span>${t('character.formation.atk')} <b>${I18N.num(Math.round(party.stats.atk))}</b></span></div></div>`;
  },
  renderFilters(){
    return `<div class="character-filters" aria-label="${t('character.filter.aria')}">${['all',...CONFIG.moduleKeys].map(id=>`<button class="character-filter ${this.filter===id?'active':''}" data-character-filter="${id}" aria-pressed="${this.filter===id}">${id==='all'?t('character.filter.all'):GameArt.module(id)+t(MISSILE_DEFS[id].labelKey)}</button>`).join('')}</div>`;
  },
  renderRoster(campaign){
    const inv=campaign.state.characterInventory;
    const list=CharacterRepository.list().filter(c=>(this.filter==='all'||c.specialtyMissileId===this.filter)&&(!this.ownedOnly||inv.characters[c.characterId].owned))
      .sort((a,b)=>Number(inv.characters[b.characterId].owned)-Number(inv.characters[a.characterId].owned)||(RarityTable[b.rarityId].order-RarityTable[a.rarityId].order)||a.sortOrder-b.sortOrder);
    return `<div class="roster-toolbar"><span>${t('character.roster.sort')}</span><button data-owned-toggle aria-pressed="${this.ownedOnly}">${this.ownedOnly?'☑':'☐'} ${t('character.roster.ownedOnly')}</button></div><div class="character-roster">${list.map(c=>{
      const x=CharacterGrowthSystem.view(campaign.state,c.characterId),deployed=inv.formation[c.specialtyMissileId]===c.characterId,r=RarityTable[c.rarityId];
      return `<button data-character-id="${c.characterId}" class="${deployed?'chosen':''}${x.owned?'':' locked'}" style="--character-color:${r.color}" aria-label="${t('character.roster.aria',{name:t(c.nameKey),rarity:t(r.nameKey),state:x.owned?t('character.roster.levelState',{level:x.level}):t('common.notOwned')})}"><span class="roster-art-wrap">${GameArt.portrait(c.characterId)}<span class="roster-rarity">${t(r.shortKey)}</span>${deployed?`<span class="deployed-badge">${t('character.roster.deployed')}</span>`:''}${x.owned&&this.canGrow(campaign,c.characterId)?`<span class="growth-ready" aria-label="${t('character.roster.growable')}">↑</span>`:''}</span><div class="roster-copy"><b>${t(c.nameKey)}</b><small>${x.owned?`${starMarkup(x.star)} <span>${t('common.level',{n:x.level})}</span>`:t('common.notOwned')} </small>${GameArt.module(c.specialtyMissileId,'module-mini')}</div></button>`;
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
    // [2026-09-18] 레벨은 전속 미사일 트랙에서 온다(view). 이 창에서 올릴 수 있는 것은 승급뿐이다.
    const inv=campaign.state.characterInventory,x=CharacterGrowthSystem.view(campaign.state,id),stats=CharacterGrowthSystem.stats(id,x);
    // [2026-09-15] 성급 배율이 생겼으므로 승급 상승폭을 미리 보여준다.
    const canRank=CharacterGrowthSystem.allowed(x),rankNext=canRank?CharacterGrowthSystem.stats(id,{...x,star:x.star+1}):null;
    // 미보유 수호자는 자기 미사일 트랙이 몇 레벨에 닿아야 열리는지를 알린다.
    const unlockLevel=UnlockSystem.moduleUnlockLevel(UnlockSystem.roster(c.specialtyMissileId).indexOf(c));
    const passives=this.passiveLines(c,x);
    const r=RarityTable[c.rarityId],def=MISSILE_DEFS[c.specialtyMissileId],assigned=inv.formation[c.specialtyMissileId]===id,locked=campaign.broken||!!campaign.state.active;
    const rankButton=()=>{
      const payable=CharacterGrowthSystem.payable(campaign.state,id,x);
      const detail=canRank?t('character.detail.rankCost',{n:I18N.num(CharacterGrowthSystem.starfireCost(id,x))}):t('character.detail.rankMax');
      return `<button class="primary" data-character-action="rankUp" ${locked||!canRank||!payable?'disabled':''}>${t('character.detail.rankUp')}<small>${detail}</small></button>`;
    };
    const starfire=WalletSystem.balance(campaign.state,CONFIG.meta.growth.starfireCurrencyId);
    $('#character-modal-content').innerHTML=`<div class="character-modal-scroll"><div class="character-modal-hero">${GameArt.portrait(id)}<div class="character-hero-name"><span class="rarity-chip" style="--rarity-color:${r.color}">${t(r.nameKey)}</span><h2 id="character-modal-title">${t(c.nameKey)}</h2><span class="character-stars">${starMarkup(x.star)}</span></div></div><div class="character-modal-body"><div class="character-tags"><span>${t(IdentityTable[c.identityId])}</span><span>${t(RaceTable[c.raceId])}</span><span style="color:${def.color}">${t('character.detail.specialty',{module:t(def.labelKey)})}</span></div><div class="character-level-bar"><b>${x.owned?t('common.level',{n:x.level}):t('common.notOwned')}</b><div class="level-track"><span style="width:${x.level/CharacterGrowthRules.maxLevel*100}%"></span></div><span>${CharacterGrowthRules.maxLevel}</span></div><small class="meta-note">${t('character.detail.sharedLevel',{module:t(def.labelKey)})}</small><div class="character-stats">${[['atk','character.detail.statAtk'],['def','character.detail.statDef'],['hp','character.detail.statHp']].map(([k,labelKey])=>`<div><small>${t(labelKey)}</small><b data-stat="${k}">${I18N.num(stats[k])}</b><small>${canRank?t('character.detail.rankUpStat',{value:rankNext[k]}):t('character.detail.baseStat')}</small></div>`).join('')}</div>${passives.map(pv=>`<div class="character-modal-section character-modal-passive${pv.open?'':' passive-locked'}"><strong>${pv.need?t('character.detail.starPassive',{n:pv.need}):t('character.detail.innatePassive')}</strong><b>${pv.name}${pv.open?'':' 🔒'}</b><ul class="passive-lines">${pv.text.split(' / ').map(line=>`<li>${line}</li>`).join('')}</ul></div>`).join('')}${x.owned?`<div class="shard-line"><span>${t('character.detail.starfire')}</span><b>${I18N.num(starfire)}${canRank?' / '+I18N.num(CharacterGrowthSystem.starfireCost(id,x)):''}</b></div>`:`<p class="meta-note">${t('character.detail.unlockHint',{module:t(def.labelKey),level:unlockLevel})}</p>`}</div></div><div class="character-modal-footer">${x.owned?`<div class="character-actions">${rankButton()}</div><button class="secondary character-deploy-button" data-character-deploy ${locked||assigned?'disabled':''}>${assigned?t('character.detail.deployed',{module:t(def.labelKey)}):t('character.detail.deploy')}</button>`:`<button class="primary character-deploy-button" data-go-recruit>${t('character.detail.goUpgrade')}</button>`}</div>`;
  },
};

// [2026-09-16] 확정(인철): 마일스톤은 한 번으로 끝나지 않고 반복한다. 목표·보상 수치는 CONFIG.meta.milestones.
// [2026-09-18 세션 3B] 이름·설명은 문자열 키다. 표시 시점에 t()로 바꾼다.
// [2026-09-18] 확정(인철): 별불이 성급 전용 재화가 되면서 6줄에서 12줄로 분화했다.
// 앞 6줄이 별불, 뒤 6줄이 골드다. 새로 들어온 여섯 줄(최고 웨이브·미사일 레벨 합계·스킬 레벨 합계·
// 성급 합계·보유 수호자·보유 스킬)은 전부 저장값에서 바로 계산되므로 전투 쪽에 집계를 새로 심지 않았다.
const MILESTONE_TABLE=[
  {id:'stage_clear',  icon:'⚑',nameKey:'milestone.stage_clear.name',  descKey:'milestone.stage_clear.desc',  metric:'stagesCleared',   currencyId:'starfire'},
  {id:'best_wave',    icon:'▲',nameKey:'milestone.best_wave.name',    descKey:'milestone.best_wave.desc',    metric:'bestWave',        currencyId:'starfire'},
  {id:'module_levels',icon:'⬢',nameKey:'milestone.module_levels.name',descKey:'milestone.module_levels.desc',metric:'moduleLevels',    currencyId:'starfire'},
  {id:'skill_levels', icon:'✧',nameKey:'milestone.skill_levels.name', descKey:'milestone.skill_levels.desc', metric:'skillLevels',     currencyId:'starfire'},
  {id:'stars',        icon:'★',nameKey:'milestone.stars.name',        descKey:'milestone.stars.desc',        metric:'starTotal',       currencyId:'starfire'},
  {id:'guardians',    icon:'☗',nameKey:'milestone.guardians.name',    descKey:'milestone.guardians.desc',    metric:'ownedCharacters', currencyId:'starfire'},
  {id:'waves',        icon:'〽',nameKey:'milestone.waves.name',        descKey:'milestone.waves.desc',        metric:'waves',           currencyId:'gold'},
  {id:'bosses',       icon:'♛',nameKey:'milestone.bosses.name',       descKey:'milestone.bosses.desc',       metric:'bosses',          currencyId:'gold'},
  {id:'skills_used',  icon:'✦',nameKey:'milestone.skills_used.name',  descKey:'milestone.skills_used.desc',  metric:'skillsUsed',      currencyId:'gold'},
  {id:'orders',       icon:'▤',nameKey:'milestone.orders.name',       descKey:'milestone.orders.desc',       metric:'orders',          currencyId:'gold'},
  {id:'merges',       icon:'◆',nameKey:'milestone.merges.name',       descKey:'milestone.merges.desc',       metric:'merges',          currencyId:'gold'},
  {id:'owned_skills', icon:'❖',nameKey:'milestone.owned_skills.name', descKey:'milestone.owned_skills.desc', metric:'ownedSkills',     currencyId:'gold'},
];
// [2026-09-16] 확정(인철): 반복이 안 되는 수집·승급 목표는 목록에서 빼고 판정 팩터만 남긴다.
// [2026-09-18] 스킬 보유(ownedSkills)는 골드 줄로 승격했고, 스킬 최고 성급만 예약으로 남는다.
const MILESTONE_RESERVED_METRICS=['highestSkillStar'];
const MilestoneSystem={
  conf(row){return CONFIG.meta.milestones[row.id];},
  // [2026-09-18] 모든 지표는 시작값이 0이어야 한다 — 초기 지급분(노말 4인·기본 스킬 2종·
  // 전 트랙 Lv.1)을 그대로 세면 첫 화면에서 이미 몇 단계가 달성돼, 마일스톤이 목표가 아니라
  // 정산 창으로 열린다. 그래서 보유·레벨 계열은 지급분을 뺀 "플레이로 늘린 만큼"을 센다.
  progress(state,row){
    if(row.metric==='ownedSkills')return SKILL_KEYS.filter(key=>state.skillInventory.skills[key].owned).length-DEFAULT_EQUIPPED_SKILLS.length;
    if(row.metric==='highestSkillStar')return Math.max(...SKILL_KEYS.map(key=>state.skillInventory.skills[key].star));
    // 서로 다른 클리어 스테이지 수. 로비는 최고 스테이지만 입장하므로 새 스테이지를 깰 때만 오른다.
    if(row.metric==='stagesCleared')return Array.isArray(state.cleared)?new Set(state.cleared).size:0;
    if(row.metric==='bestWave')return Number(state.best?.wave)||0;
    // 트랙은 Lv.1에서 시작하므로 트랙 수만큼 빼면 그대로 "올린 횟수"가 된다.
    if(row.metric==='moduleLevels')return LevelTrackSystem.moduleLevelTotal(state)-MISSILE_KEYS.length;
    if(row.metric==='skillLevels')return LevelTrackSystem.skillLevelTotal(state)-LEVEL_TRACKS.filter(track=>track.kind==='skill').length;
    // 처음부터 주는 노말 4인은 빼고, 트랙 레벨로 새로 연 수호자만 센다.
    if(row.metric==='ownedCharacters')return CharacterRepository.list().filter(c=>state.characterInventory.characters[c.characterId]?.owned&&c.rarityId!==CharacterGrowthRules.freeRarityId).length;
    // 승급 횟수 합계. 1성은 해금 시 기본값이라 0으로 세어, 해금이 이 줄을 밀어 올리지 않게 한다.
    if(row.metric==='starTotal')return CharacterRepository.list().reduce((sum,c)=>{const x=state.characterInventory.characters[c.characterId];return sum+(x?.owned?Math.max(0,(Number(x.star)||1)-1):0);},0);
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
    campaign.render();MilestoneUI.render(campaign);
    // [연출 세션 B · B-4] 수령한 행을 접고, 헤더 재화는 CampaignView.wallet의 countUp이 받는다.
    $(`[data-claim-milestone="${id}"]`)?.closest('.milestone-card')?.classList.add('fx-claimed');
    GameFeedback.toast(t('milestone.toast.claimed',{currency:t(CurrencyTable[row.currencyId].nameKey),amount:st.total}));return true;
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
    return t(def.descKey);
  },
  statsText(key,x){const s=SkillGrowthSystem.stats(key,x);return t('skill.statsLine',{atk:s.atk,def:s.def,hp:s.hp});},
  render(campaign){
    const state=campaign.state,inv=state.skillInventory,equipped=inv.equipped;
    $('#skill-count').textContent=t('skill.count',{owned:SKILL_KEYS.filter(key=>inv.skills[key].owned).length,total:SKILL_KEYS.length});
    // [2026-09-18] 레벨은 스킬이 아니라 장착한 슬롯이 갖는다 — 슬롯 카드는 그 트랙 레벨을 낸다.
    const slotHtml=equipped.map((key,index)=>{const x=SkillGrowthSystem.view(state,key),d=CONFIG.skills[key],m=SKILL_DEFS[key];return `<button class="skill-slot" data-skill-open="${key}" style="--skill-accent:${m.color}"><span class="skill-icon">${m.icon}</span><b>${t('skill.slotName',{index:index+1,name:t(d.nameKey)})}</b><small>${t('skill.slotLine',{level:x.level,effect:this.effectText(key,x)})}</small></button>`;}).join('');
    $('#skill-lobby-content').innerHTML=`<div class="skill-equipped-panel"><strong>${t('skill.equipped.title')}</strong><div class="skill-equipped-grid">${slotHtml}</div></div><div class="skill-card-grid">${SKILL_KEYS.map(key=>{const x=inv.skills[key],d=CONFIG.skills[key],m=SKILL_DEFS[key],slot=equipped.indexOf(key);return `<button class="skill-card${x.owned?'':' locked'}${slot>=0?' equipped':''}" data-skill-open="${key}" style="--skill-accent:${m.color}"><span class="skill-level">${!x.owned?t('common.notOwned'):slot>=0?t('common.level',{n:LevelTrackSystem.slotLevel(state,slot)}):t('skill.card.unequipped')}</span><span class="skill-icon">${m.icon}</span><b>${t(d.nameKey)}</b><small>${x.owned?this.effectText(key,x):t('skill.card.locked')}</small><div class="skill-stars">${starMarkup(x.star,CharacterGrowthRules.maxStars)}</div></button>`;}).join('')}</div>`;
    $$('[data-skill-open]').forEach(button=>button.onclick=()=>this.open(campaign,button.dataset.skillOpen,button));
    const ready=SKILL_KEYS.some(key=>{const x=inv.skills[key];return SkillGrowthSystem.allowed(x)&&SkillGrowthSystem.payable(state,x);});
    $('#skill-nav-dot').hidden=!ready;
    $('#home-skill-summary').innerHTML=equipped.map(key=>{const m=SKILL_DEFS[key];return `<span class="hs-skill-icon" style="--skill-accent:${m.color}">${m.icon}<em>${t(CONFIG.skills[key].nameKey)}</em></span>`;}).join('');
    if(this.selectedKey&&!$('#skill-modal').hidden)this.renderModal(campaign,this.selectedKey);
  },
  open(campaign,key,focus){this.selectedKey=key;this.lastFocus=focus||document.activeElement;this.renderModal(campaign,key);$('#skill-modal').hidden=false;$('#skill-modal').setAttribute('aria-hidden','false');},
  close(){this.selectedKey=null;$('#skill-modal').hidden=true;$('#skill-modal').setAttribute('aria-hidden','true');if(this.lastFocus?.isConnected)this.lastFocus.focus();},
  renderModal(campaign,key){
    // [2026-09-18] 레벨은 슬롯 트랙에서 오고(view), 이 창에서 올릴 수 있는 것은 별불 승급뿐이다.
    const state=campaign.state,x=SkillGrowthSystem.view(state,key),d=CONFIG.skills[key],m=SKILL_DEFS[key],stats=SkillGrowthSystem.stats(key,x),equipped=state.skillInventory.equipped;
    const rankAllowed=SkillGrowthSystem.allowed(x),rankCost=SkillGrowthSystem.starfireCost(x),starfire=WalletSystem.balance(state,CONFIG.meta.growth.starfireCurrencyId);
    const slot=equipped.indexOf(key),unlockTotal=UnlockSystem.nextSkillTotal(state);
    $('#skill-modal-content').innerHTML=`<div class="character-modal-scroll"><div class="skill-detail-head" style="--skill-accent:${m.color}"><div class="skill-detail-icon">${m.icon}</div><div><h2 id="skill-modal-title">${t(d.nameKey)}</h2><div class="skill-stars">${starMarkup(x.star,CharacterGrowthRules.maxStars)}</div><small>${x.owned?t('skill.detail.levelOfMax',{level:x.level,max:CharacterGrowthRules.maxLevel}):t('common.notOwned')}</small></div></div><div class="character-modal-section"><strong>${t('skill.detail.active')}</strong><p>${t(m.descKey)}</p><b>${this.effectText(key,x)}</b><small>${t('skill.detail.cooldown',{sec:SkillGrowthSystem.cooldown(key),growth:d.growth==='duration'?t('skill.detail.growthDuration',{sec:d.durationPerStar}):t('skill.detail.growthEffect')})}</small></div><div class="character-modal-section"><strong>${t('skill.detail.stats')}</strong><div class="character-stats">${[['atk','skill.detail.statAtk'],['def','skill.detail.statDef'],['hp','skill.detail.statHp']].map(([s,labelKey])=>`<div><small>${t(labelKey)}</small><b data-stat="${s}">+${stats[s]}</b><small>${t('skill.detail.slotStat')}</small></div>`).join('')}</div><small class="meta-note">${slot>=0?t('skill.detail.sharedLevel',{n:slot+1}):t('skill.detail.unequippedLevel')}</small></div>${x.owned?`<div class="shard-line"><span>${t('skill.detail.starfire')}</span><b>${I18N.num(starfire)}${rankAllowed?' / '+I18N.num(rankCost):''}</b></div>`:`<p class="meta-note">${unlockTotal?t('skill.detail.unlockHint',{need:unlockTotal,current:LevelTrackSystem.skillLevelTotal(state)}):t('skill.detail.unlockDone')}</p>`}</div><div class="character-modal-footer">${x.owned?`<div class="skill-detail-actions"><button class="primary" data-skill-action="rankUp" ${!rankAllowed||starfire<rankCost?'disabled':''}>${t('skill.detail.rankUp')}<small>${rankAllowed?t('skill.detail.rankCost',{n:I18N.num(rankCost)}):t('skill.detail.rankMax')}</small></button></div><div class="skill-equip-actions">${Array.from({length:CONFIG.skillPickCount},(_,i)=>i).map(i=>`<button class="secondary" data-skill-slot="${i}">${equipped[i]===key?t('skill.detail.slotEquipped',{n:i+1}):t('skill.detail.slotEquip',{n:i+1})}</button>`).join('')}</div>`:''}</div>`;
    $$('[data-skill-action]').forEach(button=>button.onclick=()=>{
      // 수호자와 같은 연출을 쓴다 — 스킬에는 패시브가 없어 승급 연출까지만 있다. [연출 세션 B]
      const owned=SkillGrowthSystem.view(campaign.state,key);
      const before=SkillGrowthSystem.stats(key,owned);
      if(!SkillGrowthSystem.rankUp(campaign,key))return;
      this.renderModal(campaign,key);MilestoneUI.render(campaign);
      const content=$('#skill-modal-content'),after=SkillGrowthSystem.stats(key,SkillGrowthSystem.view(campaign.state,key));
      $$('[data-stat]',content).forEach(el=>GameFeedback.countUp(el,after[el.dataset.stat],
        {from:before[el.dataset.stat],format:v=>`+${I18N.num(Math.round(v))}`}));
      GameFeedback.starUp({stars:$('.skill-stars',content),hero:$('.skill-detail-head',content),color:SKILL_DEFS[key].color});
    });
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
      const reward=Object.entries(totals).map(([id,n])=>t('milestone.card.reward',{currency:t(CurrencyTable[id].nameKey),amount:n})).join(' · ');
      return {ready:true,text:t('milestone.strip.claim'),sub:t('milestone.strip.count',{n:ready.length}),pct:100,reward};
    }
    let best=null;
    MILESTONE_TABLE.forEach(row=>{
      const st=MilestoneSystem.status(state,row),pct=st.need>0?st.current/st.need:0;
      if(!best||pct>best.pct)best={row,st,pct};
    });
    if(!best)return {ready:false,text:t('milestone.strip.none'),sub:'',pct:0};
    return {ready:false,text:t(best.row.nameKey),
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
    // 점이 아니라 개수를 낸다 — 몇 개가 밀려 있는지가 보여야 들어간다. [연출 세션 B]
    const dot=$('#milestone-home-dot');
    dot.hidden=!count; dot.textContent=count?I18N.num(count):'';
    this.renderStrip(campaign);
    $('#milestone-list').innerHTML=MILESTONE_TABLE.map(row=>{const st=MilestoneSystem.status(state,row),cur=t(CurrencyTable[row.currencyId].nameKey),pct=Math.min(100,st.current/st.need*100);return `<article class="milestone-card${st.ready?' claimable':''}"><span class="milestone-icon">${row.icon}</span><div class="milestone-copy"><b>${t(row.nameKey)}<em class="milestone-tier">${t('milestone.tier',{n:st.tier+1})}</em></b><small>${t('milestone.card.progress',{description:t(row.descKey),current:st.current,need:st.need})}</small><div class="milestone-progress"><i style="width:${pct}%"></i></div><div class="milestone-reward">${t('milestone.card.reward',{currency:cur,amount:st.ready?st.total:st.reward})}${st.count>1?t('milestone.card.bulk',{n:st.count}):''}</div></div><button data-claim-milestone="${row.id}" ${st.ready?'':'disabled'}>${t(st.ready?'milestone.card.claim':'milestone.card.inProgress')}</button></article>`;}).join('');
    $$('[data-claim-milestone]').forEach(button=>button.onclick=()=>MilestoneSystem.claim(campaign,button.dataset.claimMilestone));
  },
};

