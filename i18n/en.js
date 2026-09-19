/* ===== i18n/en.js — English =====
   번역 파일. 각 줄 위 주석이 ko 원문이다.
   값만 채우면 된다. 키(따옴표 왼쪽)와 {중괄호} 자리표시자는 그대로 둔다.
   빈 값은 ko 로 대신 나온다 — 번역이 끝날 때까지 화면이 비지 않는다.
   키가 늘거나 줄면  node tools/i18n.mjs sync en  로 맞춘다. */
I18N.register("en", "English", {
  /* ── app ── */
  // 슬래그마 · 용광로의 수호자
  "app.title": "Slagma · Guardians of the Forge",

  /* ── common ── */
  // 닫기
  "common.close": "Close",
  // 계속하기
  "common.continue": "Continue",
  // Lv.{n}
  "common.level": "Lv.{n}",
  // 미보유
  "common.notOwned": "Not owned",
  // 확인
  "common.confirm": "OK",

  /* ── lobby ── */
  // 행동력 {n} 충전
  "lobby.stamina.chargeAria": "Recharge {n} stamina",
  // 행동력 충전 완료
  "lobby.stamina.full": "Stamina full",
  // +1 회복 {time}
  "lobby.stamina.timer": "+1 in {time}",
  // 충전 {n}회
  "lobby.stamina.chargeCount": "{n} recharges",
  // 행동력 회복 중 <small>{current} / {need}</small>
  "lobby.prepare.waiting": "Stamina recovering <small>{current} / {need}</small>",
  // {sword} 전투 준비 <small>{energy} {cost}</small>
  "lobby.prepare.ready": "{sword} Prepare <small>{energy} {cost}</small>",
  // 모험 · {id}
  "lobby.stage.eyebrow": "Journey · {id}",
  // {waves} 웨이브 · 클리어 <b>+{gold}</b> 골드
  "lobby.stage.meta": "{waves} waves · Clear <b>+{gold}</b> gold",
  // 출전 부대
  "lobby.party.title": "Squad",
  // 편성 변경 ›
  "lobby.party.change": "Edit squad ›",
  // {name} 레벨 {level} 상세
  "lobby.party.memberAria": "{name}, level {level}, details",
  // 평균 공격력
  "lobby.party.avgAtk": "Avg. attack",
  // 총 체력
  "lobby.party.totalHp": "Total HP",
  // 장착 스킬
  "lobby.skills.equipped": "Equipped skills",
  // 클리어하면 다음 지역이 열립니다
  "lobby.footnote": "Clear the stage to unlock the next region",
  // 로비 메뉴
  "lobby.nav.aria": "Lobby menu",
  // 모험
  "lobby.nav.home": "Journey",
  // 수호자
  "lobby.nav.characters": "Guardians",
  // 스킬
  "lobby.nav.skills": "Skills",
  // 강화
  "lobby.nav.upgrade": "Upgrade",

  /* ── character ── */
  // GUARDIANS
  "character.eyebrow": "GUARDIANS",
  // 수호자
  "character.title": "Guardians",
  // {owned} / {total} 보유
  "character.count": "{owned} / {total} owned",
  // 캐릭터 상세 닫기
  "character.modal.closeAria": "Close guardian details",
  // 출전 부대
  "character.formation.title": "Squad",
  // 슬롯을 눌러 수호자 교체
  "character.formation.hint": "Tap a slot to swap",
  // {module} 편성 {name} 레벨 {level}
  "character.formation.slotAria": "{module} slot, {name}, level {level}",
  // 체력
  "character.formation.hp": "HP",
  // 방어
  "character.formation.def": "DEF",
  // 평균 공격
  "character.formation.atk": "Avg. ATK",
  // 특화 미사일 필터
  "character.filter.aria": "Filter by missile",
  // 전체
  "character.filter.all": "All",
  // 보유 우선 · 높은 등급순
  "character.roster.sort": "Owned first · Highest rarity",
  // 보유만 보기
  "character.roster.ownedOnly": "Owned only",
  // {name} {rarity} {state} 상세
  "character.roster.aria": "{name}, {rarity}, {state}, details",
  // 레벨 {level}
  "character.roster.levelState": "level {level}",
  // 출전
  "character.roster.deployed": "Active",
  // 성장 가능
  "character.roster.growable": "Can grow",
  // {module} 특화
  "character.detail.specialty": "{module} specialist",
  // 공격력
  "character.detail.statAtk": "Attack",
  // 방어력
  "character.detail.statDef": "Defense",
  // 체력
  "character.detail.statHp": "HP",
  // 승급 시 {value}
  "character.detail.rankUpStat": "{value} at next star",
  // 기본 능력치
  "character.detail.baseStat": "Base stat",
  // 성급 패시브 · {n}성 해금
  "character.detail.starPassive": "Star passive · unlocks at {n}★",
  // 고정 패시브
  "character.detail.innatePassive": "Innate passive",
  // 레벨은 {module} 공용 레벨을 따릅니다 · 강화에서 올립니다
  "character.detail.sharedLevel": "Level follows the shared {module} track · raise it in Upgrade",
  // 보유 별불
  "character.detail.starfire": "Starfire held",
  // {module} 공용 레벨 {level}에서 해금됩니다.
  "character.detail.unlockHint": "Unlocks at shared {module} level {level}.",
  // 성급 올리기
  "character.detail.rankUp": "Star up",
  // 별불 {n}
  "character.detail.rankCost": "{n} starfire",
  // 최대 성급
  "character.detail.rankMax": "Max star",
  // {module} 슬롯 출전 중
  "character.detail.deployed": "In {module} slot",
  // 출전 부대에 편성
  "character.detail.deploy": "Add to squad",
  // 강화하러 가기
  "character.detail.goUpgrade": "Go to Upgrade",
  // {name} 성장 완료
  "character.toast.grown": "{name} grew stronger",
  // {name} · {module} 편성 완료
  "character.toast.deployed": "{name} · {module} slot set",

  /* ── passive ── */
  // 전체
  "passive.scopeAll": "All",
  // {scope} {stat} +{pct}%
  "passive.factor": "{scope} {stat} +{pct}%",
  // 적중 시 {chance}% 확률로 {status} {duration}초
  "passive.statusOnHit": "{chance}% chance on hit to apply {status} for {duration}s",
  // {status} 상태의 적에게 피해 +{pct}%
  "passive.damageVsStatus": "+{pct}% damage to {status} enemies",
  // {tag} {count}명 편성 시 {scope} {stat} +{pct}%
  "passive.formation": "With {count} {tag} in the squad: {scope} {stat} +{pct}%",
  // 남은 연결 횟수당 첫 대상 피해 +{pct}%
  "passive.rule.unusedTargetBonus": "+{pct}% first-target damage per unused chain jump",
  // 중앙 탄환 피해 +{pct}%
  "passive.rule.centerDamageBonus": "+{pct}% center pellet damage",
  // 처치 시 2차 폭발 · 피해 {damage}% / 반경 {radius}%
  "passive.rule.secondary": "Secondary blast on kill · {damage}% damage / {radius}% radius",
  // {chance}% 확률로 강화 레이저 · 피해 +{damage}% / 폭 +{width}%
  "passive.rule.empowered": "{chance}% chance of an empowered laser · +{damage}% damage / +{width}% width",
  // 광선에 적이 1기만 걸리면 그 대상 피해 +{damage}%
  "passive.rule.focused": "+{damage}% damage when the beam hits only one enemy",

  /* ── skill ── */
  // TACTICAL SKILLS
  "skill.eyebrow": "TACTICAL SKILLS",
  // 전투 스킬
  "skill.title": "Combat Skills",
  // {owned} / {total} 보유
  "skill.count": "{owned} / {total} owned",
  // 스킬 상세 닫기
  "skill.modal.closeAria": "Close skill details",
  // 장착 스킬 · 전투 능력치에 합산
  "skill.equipped.title": "Equipped skills · added to combat stats",
  // {index}. {name}
  "skill.slotName": "{index}. {name}",
  // Lv.{level} · {effect}
  "skill.slotLine": "Lv.{level} · {effect}",
  // 스킬 슬롯 레벨로 해금
  "skill.card.locked": "Unlocked by skill slot level",
  // 미장착
  "skill.card.unequipped": "Not equipped",
  // 액티브 효과
  "skill.detail.active": "Active effect",
  // 쿨타임 {sec}초 · {growth}
  "skill.detail.cooldown": "Cooldown {sec}s · {growth}",
  // 성급 상승 시 지속 +{sec}초
  "skill.detail.growthDuration": "+{sec}s duration per star",
  // 성급 상승 시 효과 성장
  "skill.detail.growthEffect": "Effect grows per star",
  // Lv.{level} / {max}
  "skill.detail.levelOfMax": "Lv.{level} / {max}",
  // 장착 능력치
  "skill.detail.stats": "Equip stats",
  // 공격
  "skill.detail.statAtk": "ATK",
  // 방어
  "skill.detail.statDef": "DEF",
  // 체력
  "skill.detail.statHp": "HP",
  // 다음 레벨 +{value}
  "skill.detail.nextStat": "Next level +{value}",
  // 현재 최대
  "skill.detail.maxStat": "At max",
  // 레벨은 {n}번 스킬 슬롯의 공용 레벨을 따릅니다 · 강화에서 올립니다
  "skill.detail.sharedLevel": "Level follows shared skill slot {n} · raise it in Upgrade",
  // 장착하면 그 슬롯의 공용 레벨을 그대로 씁니다
  "skill.detail.unequippedLevel": "Equip it to use that slot's shared level",
  // 보유 별불
  "skill.detail.starfire": "Starfire held",
  // 두 스킬 슬롯 레벨 합계가 {need}가 되면 미보유 스킬 중 하나가 무작위로 열립니다. 현재 {current}
  "skill.detail.unlockHint": "At a combined skill slot level of {need}, one unowned skill unlocks at random. Currently {current}",
  // 스킬을 모두 모았습니다.
  "skill.detail.unlockDone": "Every combat skill is collected.",
  // 성급 올리기
  "skill.detail.rankUp": "Star up",
  // 별불 {n}
  "skill.detail.rankCost": "{n} starfire",
  // 최대 성급
  "skill.detail.rankMax": "Max star",
  // {n}번 장착 중
  "skill.detail.slotEquipped": "In slot {n}",
  // {n}번 슬롯 장착
  "skill.detail.slotEquip": "Equip to slot {n}",
  // 공격력의 {pct}%
  "skill.effect.damage": "{pct}% of attack",
  // {damage} · {control}
  "skill.effect.withControl": "{damage} · {control}",
  // 스턴 {sec}초
  "skill.effect.stun": "Stun {sec}s",
  // 이동·공격속도 -{pct}% {sec}초
  "skill.effect.slow": "Move/attack speed -{pct}% for {sec}s",
  // 밀어내기 {px}
  "skill.effect.knockback": "Knockback {px}",
  // 피해 {pct}% 감소 · {sec}초
  "skill.effect.damageReduction": "Damage -{pct}% · {sec}s",
  // 최대 HP {pct}% 회복
  "skill.effect.heal": "Heal {pct}% of max HP",
  // 에너지 {n} 즉시 획득
  "skill.effect.energy": "Gain {n} energy instantly",
  // 일반 공격력 +{pct}% · {sec}초
  "skill.effect.attackBuff": "Normal attack +{pct}% · {sec}s",
  // 방어력 +{pct}% · {sec}초
  "skill.effect.defenseBuff": "Defense +{pct}% · {sec}s",
  // 초당 최대 HP {pct}% · {sec}초 (총 {total}%)
  "skill.effect.regen": "{pct}% max HP per second · {sec}s ({total}% total)",
  // 공격 +{atk} · 방어 +{def} · 체력 +{hp}
  "skill.statsLine": "ATK +{atk} · DEF +{def} · HP +{hp}",
  // 분쇄창
  "skill.strong_single.name": "Crushing Lance",
  // 가장 강한 적에게 고화력 투사체를 발사합니다.
  "skill.strong_single.desc": "Fires a high-power projectile at the strongest enemy.",
  // 낙뢰 폭격
  "skill.aoe.name": "Thunder Barrage",
  // 현재 전장의 모든 적을 동시에 공격합니다.
  "skill.aoe.desc": "Strikes every enemy on the field at once.",
  // 용광 방벽
  "skill.defense.name": "Forge Bulwark",
  // 일정 시간 용광로 핵이 받는 피해를 줄입니다.
  "skill.defense.desc": "Reduces damage taken by the forge core for a time.",
  // 재생 불씨
  "skill.heal.name": "Regrowth Ember",
  // 용광로 핵의 최대 체력 일부를 회복합니다.
  "skill.heal.desc": "Restores part of the forge core's max HP.",
  // 불씨 충전
  "skill.energy_surge.name": "Ember Charge",
  // 에너지를 즉시 얻습니다.
  "skill.energy_surge.desc": "Gain energy instantly.",
  // 달군 칼날
  "skill.attack_buff.name": "Honed Edge",
  // 일정 시간 일반 공격력(기본 공격·미사일)을 높입니다. 스킬 피해에는 적용되지 않습니다.
  "skill.attack_buff.desc": "Raises normal attack power (basic attacks and missiles) for a time. Does not apply to skill damage.",
  // 강철 외피
  "skill.defense_buff.name": "Steel Hide",
  // 일정 시간 수호자들의 방어력을 높입니다.
  "skill.defense_buff.desc": "Raises the guardians' defense for a time.",
  // 굉음 충격
  "skill.stun.name": "Thunderclap",
  // 모든 적에게 피해를 주고 잠시 기절시킵니다.
  "skill.stun.desc": "Damages every enemy and briefly stuns them.",
  // 슬래그 늪
  "skill.slow.name": "Slag Mire",
  // 모든 적에게 피해를 주고 이동속도와 공격속도를 낮춥니다.
  "skill.slow.desc": "Damages every enemy and lowers their move and attack speed.",
  // 열풍 분출
  "skill.knockback.name": "Heat Blast",
  // 모든 적에게 피해를 주고 용광로 핵에서 멀리 밀어냅니다.
  "skill.knockback.desc": "Damages every enemy and pushes them away from the forge core.",
  // 치유 잔불
  "skill.regen.name": "Healing Embers",
  // 일정 시간 매초 용광로 핵의 최대 체력 일부를 회복합니다.
  "skill.regen.desc": "Restores part of the forge core's max HP every second for a time.",

  /* ── milestone ── */
  // 마일스톤 미션
  "milestone.title": "Milestones",
  // 마일스톤 닫기
  "milestone.closeAria": "Close milestones",
  // 마일스톤 미션 · {text} {sub}
  "milestone.strip.aria": "Milestones · {text} {sub}",
  // 보상 받기
  "milestone.strip.claim": "Claim rewards",
  // {n}개
  "milestone.strip.count": "{n}",
  // 진행 중인 목표 없음
  "milestone.strip.none": "No goal in progress",
  // {current} / {need}
  "milestone.strip.progress": "{current} / {need}",
  // {n}단계
  "milestone.tier": "Tier {n}",
  // {currency} 보상
  "milestone.group": "{currency} rewards",
  // {description} · {current} / {need}
  "milestone.card.progress": "{description} · {current} / {need}",
  // {currency} +{amount}
  "milestone.card.reward": "{currency} +{amount}",
  //  · {n}단계 한꺼번에
  "milestone.card.bulk": " · {n} tiers at once",
  // 받기
  "milestone.card.claim": "Claim",
  // 진행 중
  "milestone.card.inProgress": "In progress",
  // {currency} +{amount} 획득
  "milestone.toast.claimed": "{currency} +{amount} received",
  // 불씨 전선 돌파
  "milestone.stage_clear.name": "Breaking the Front",
  // 새로운 최고 스테이지 클리어
  "milestone.stage_clear.desc": "Clear a new highest stage",
  // 전선 유지
  "milestone.waves.name": "Holding the Line",
  // WAVE 통과
  "milestone.waves.desc": "Waves cleared",
  // 강적 사냥
  "milestone.bosses.name": "Boss Hunter",
  // 보스 처치
  "milestone.bosses.desc": "Bosses defeated",
  // 전술 운용
  "milestone.skills_used.name": "Tactician",
  // 스킬 사용
  "milestone.skills_used.desc": "Skills used",
  // 숙련된 제작자
  "milestone.orders.name": "Master Crafter",
  // 주문서 완료
  "milestone.orders.desc": "Orders completed",
  // 융합의 손길
  "milestone.merges.name": "Fusion Touch",
  // 머지 성공
  "milestone.merges.desc": "Merges made",
  // 최전선 갱신
  "milestone.best_wave.name": "New High Water Mark",
  // 최고 WAVE 기록
  "milestone.best_wave.desc": "Best wave reached",
  // 화력 정비
  "milestone.module_levels.name": "Ordnance Upkeep",
  // 미사일 레벨 올린 횟수
  "milestone.module_levels.desc": "Missile track level-ups",
  // 전술 연마
  "milestone.skill_levels.name": "Drill Practice",
  // 스킬 슬롯 레벨 올린 횟수
  "milestone.skill_levels.desc": "Skill slot level-ups",
  // 별의 결정
  "milestone.stars.name": "Crystalized Stars",
  // 수호자 성급 돌파
  "milestone.stars.desc": "Guardian star breakthroughs",
  // 불씨의 동료
  "milestone.guardians.name": "Comrades of the Ember",
  // 새 수호자 해금
  "milestone.guardians.desc": "New guardians unlocked",
  // 전술 수집
  "milestone.owned_skills.name": "Tactics Collected",
  // 새 전투 스킬 해금
  "milestone.owned_skills.desc": "New combat skills unlocked",

  /* ── upgrade (공용 레벨업 6종) ── */
  // UPGRADE FORGE
  "upgrade.eyebrow": "UPGRADE FORGE",
  // 공용 강화
  "upgrade.title": "Shared Upgrade",
  // 수호자 {owned} / {total}
  "upgrade.count": "Guardians {owned} / {total}",
  // 레벨은 수호자가 아니라 슬롯이 가집니다. 누구를 편성해도 그 슬롯의 레벨을 그대로 쓰고, 슬롯을 올리면 새 전력이 열립니다.
  "upgrade.intro": "Levels belong to the slot, not the guardian. Whoever you deploy uses that slot's level, and raising a slot unlocks new power.",
  // 편성 공격력 {from} → {to}
  "upgrade.gain.atk": "Deployed attack {from} → {to}",
  // 장착 {stat} +{from} → +{to}
  "upgrade.gain.skillStat": "Equipped {stat} +{from} → +{to}",
  // 골드 {n} 부족
  "upgrade.short": "{n} gold short",
  // 슬롯 {n}
  "upgrade.track.slot": "Slot {n}",
  // 올리기
  "upgrade.levelUp": "Raise",
  // 골드 {amount}
  "upgrade.cost": "{amount} gold",
  // 레벨 상한
  "upgrade.levelMax": "Max level",
  // Lv.{level} · {rarity} 수호자 해금
  "upgrade.unlock.module": "Lv.{level} · unlocks a {rarity} guardian",
  // 이 미사일의 수호자를 모두 모았습니다
  "upgrade.unlock.moduleDone": "Every guardian of this missile is collected",
  // 슬롯 합계 {need}에서 스킬 1종 무작위 · 현재 {current}
  "upgrade.unlock.skill": "Random skill at combined {need} · now {current}",
  // 전투 스킬을 모두 모았습니다
  "upgrade.unlock.skillDone": "Every combat skill is collected",
  // 해금 현황
  "upgrade.details": "Unlock progress",
  // 보유 현황
  "upgrade.progress.title": "Collection",
  // 전투 스킬
  "upgrade.progress.skills": "Combat skills",

  /* ── reveal (해금 공개 연출) ── */
  // 새로운 전력 해금
  "reveal.title": "New Power Unlocked",
  // 카드 공개
  "reveal.cardAria": "Reveal card",
  // {name} · {label}
  "reveal.revealedAria": "{name} · {label}",
  // 카드를 눌러 공개하세요.
  "reveal.hint": "Tap the card to reveal it.",
  // 공개하기
  "reveal.open": "Reveal",
  // 다음 공개 ({n})
  "reveal.nextOne": "Next reveal ({n})",
  // NEW
  "reveal.badge.new": "NEW",
  // 전투 스킬
  "reveal.label.skill": "Combat skill",
  // {module} · {rarity} 수호자
  "reveal.label.character": "{module} · {rarity} guardian",

  /* ── prepare ── */
  // 로비로 돌아가기
  "prepare.backAria": "Back to lobby",
  // 출전 준비
  "prepare.title": "Prepare",
  // 장착 스킬
  "prepare.skills": "Equipped skills",
  // 로비에서 장착 변경
  "prepare.changeSkills": "Change loadout in lobby",
  // 전투 시작 · 행동력 {cost}
  "prepare.start": "Start battle · {cost} stamina",
  // 스테이지 {id}
  "prepare.brief.kicker": "Stage {id}",
  // {n} 웨이브
  "prepare.brief.waves": "{n} waves",
  // 클리어 +{gold} 골드
  "prepare.brief.clearGold": "Clear +{gold} gold",
  // 핵 체력
  "prepare.brief.coreHp": "Core HP",
  // 팀 방어
  "prepare.brief.teamDef": "Team DEF",
  // Lv.{level} · {effect}<br>쿨타임 {sec}초
  "prepare.skillSlot": "Lv.{level} · {effect}<br>Cooldown {sec}s",

  /* ── battle ── */
  // WAVE {n} / {total}
  "battle.waveLabel": "WAVE {n} / {total}",
  // WAVE
  "battle.waveCaption": "WAVE",
  // CLEAR
  "battle.waveCaptionClear": "CLEAR",
  // 현재 WAVE 종류
  "battle.waveTypeAria": "Current wave type",
  // 런 시간과 누적 점수
  "battle.metricsAria": "Run time and total score",
  // 시간
  "battle.time": "Time",
  // 점수
  "battle.score": "Score",
  // 용광로 핵 · {current} / {max}
  "battle.coreHp": "Forge core · {current} / {max}",
  // 보유 에너지
  "battle.energyAria": "Energy held",
  // 에너지
  "battle.energyLabel": "Energy",
  // 전투 스킬
  "battle.skillRowAria": "Combat skills",
  // CRIT 
  "battle.critPrefix": "CRIT ",
  // 관통 {damage}
  "battle.pierce": "pierce {damage}",
  // 피스 생성
  "battle.generator.initial": "Make piece",
  // 생성 <small>−{cost}</small>
  "battle.generator.label": "Make <small>−{cost}</small>",
  // 공간 부족
  "battle.generator.full": "No space",
  // 처치 점수가 {points}점 쌓일 때마다 에너지 {energy}을 지급합니다
  "battle.generator.tooltip": "Every {points} kill score grants {energy} energy",
  // {name} Lv.{level} · {cost}
  "battle.skill.tooltip": "{name} Lv.{level} · {cost}",
  // 에너지 {n}
  "battle.skill.costEnergy": "{n} energy",
  // 에너지 소모 없음
  "battle.skill.costFree": "No energy cost",
  // 에너지 +{n}
  "battle.skill.energyGain": "Energy +{n}",
  // {name} 소환
  "battle.hero.summon": "{name} summoned",
  // 강화 +{n}
  "battle.hero.upgrade": "Upgrade +{n}",
  // 크리티컬 머지!
  "battle.merge.critical": "Critical merge!",
  // WARNING
  "battle.boss.warningKicker": "WARNING",
  // FINAL WAVE
  "battle.boss.finalKicker": "FINAL WAVE",
  // 중간보스 출현
  "battle.boss.midTitle": "Midboss incoming",
  // 강적이 전장에 진입합니다
  "battle.boss.midSub": "A strong enemy enters the field",
  // 최종보스 출현
  "battle.boss.finalTitle": "Final boss incoming",
  // 마지막 전투를 준비하세요
  "battle.boss.finalSub": "Brace for the last fight",
  // FINAL STRIKE
  "battle.end.clearKicker": "FINAL STRIKE",
  // 승리
  "battle.end.clearTitle": "Victory",
  // 최종보스를 처치했습니다
  "battle.end.clearSub": "The final boss has fallen",
  // SYSTEM DOWN
  "battle.end.defeatKicker": "SYSTEM DOWN",
  // 패배
  "battle.end.defeatTitle": "Defeat",
  // 방어선이 붕괴되었습니다
  "battle.end.defeatSub": "The defense line has collapsed",
  // 터치해서 결과 보기
  "battle.end.touch": "Tap to see results",

  /* ── board ── */
  // {piece} {tier}티어
  "board.cellAria": "{piece} tier {tier}",
  // 빈 보드 칸
  "board.cellEmptyAria": "Empty board cell",

  /* ── order ── */
  // 주문서 상태
  "order.statusAria": "Order status",
  // 주문서 생성 게이지
  "order.gaugeTitle": "Order charge gauge",
  // 보유 주문서
  "order.stockTitle": "Orders held",
  // 대기
  "order.stockLabel": "Queued",
  // 주문서 상세
  "order.detailAria": "Order details",
  // 🗑 이 주문서 폐기
  "order.discard": "🗑 Discard this order",
  // 주문서 대기
  "order.empty.title": "Awaiting order",
  // 게이지를 채우세요
  "order.empty.hint": "Fill the gauge",
  // {module}: {stat}
  "order.kindLabel": "{module}: {stat}",
  // 공격력
  "order.stat.damage": "Attack",
  // 공격속도
  "order.stat.speed": "Attack speed",
  // 강화
  "order.action.enhance": "Upgrade",
  // 소환
  "order.action.summon": "Summon",
  // {kind} {state}
  "order.applyAria": "{kind} {state}",
  // 레벨 {level} {action}
  "order.applyReady": "level {level} {action}",
  // 재료 부족
  "order.applyShort": "Missing pieces",
  // {kind} 상세 · 폐기
  "order.infoAria": "{kind} details and discard",
  // {color} 보유 티어
  "order.chipAria": "{color} tier held",
  // {kind} Lv.{level}
  "order.completion": "{kind} Lv.{level}",
  // {colors} 피스를 각각 1개 소모합니다.
  "order.detail.requirements": "Consumes one {colors} piece each.",
  // 가장 높은 티어부터 자동 선택 · 강화 Lv.{min}~{max}
  "order.detail.levelRange": "Highest tiers chosen first · upgrade Lv.{min}–{max}",
  // 소환된 영웅을 강화합니다.
  "order.detail.enhance": "Upgrades the summoned hero.",
  // 편성한 영웅을 소환하고 미사일을 활성화합니다.
  "order.detail.summon": "Summons your hero and activates the missile.",
  // 전투는 계속 진행됩니다.
  "order.detail.note": "The battle continues.",

  /* ── result ── */
  // 클리어!
  "result.clear": "Cleared!",
  // 패배
  "result.defeat": "Defeat",
  // 스테이지 {stage} · {waves} WAVE 클리어
  "result.subClear": "Stage {stage} · {waves} waves cleared",
  // 스테이지 {stage} · WAVE {wave}에서 종료
  "result.subDefeat": "Stage {stage} · ended on wave {wave}",
  // 도달 웨이브
  "result.stat.wave": "Wave reached",
  // 경과 시간
  "result.stat.time": "Time",
  // 누적 점수
  "result.stat.score": "Total score",
  // 완료 주문서
  "result.stat.orders": "Orders done",
  // 머지
  "result.stat.merges": "Merges",
  // 스킬 사용
  "result.stat.skills": "Skills used",
  // 누적 피해
  "result.stat.damage": "Total damage",
  // 치명타 적중
  "result.stat.crit": "Critical hits",
  // 관통 피해
  "result.stat.pierce": "Pierce damage",
  // 세부 전투 기록
  "result.details": "Battle details",
  // 로비로 돌아가기
  "result.retry": "Back to lobby",
  // 획득 골드
  "result.reward.gold": "Gold earned",
  // 웨이브 통과
  "result.reward.waves": "Waves cleared",
  // 클리어 보너스
  "result.reward.bonus": "Clear bonus",
  // 스테이지 {stage}이 열렸습니다
  "result.reward.unlocked": "Stage {stage} unlocked",
  // 수호자와 스킬을 성장시키고 다시 도전하세요
  "result.reward.retryHint": "Grow your guardians and skills, then try again",
  // 보상 지급 완료
  "result.reward.done": "Rewards granted",
  // 보상을 저장하지 못했습니다.
  "result.reward.failed": "Could not save the rewards.",
  // 보상 저장 재시도
  "result.reward.retrySave": "Retry saving rewards",
  // 로비 마일스톤에서 보상 {n}개를 받을 수 있습니다.
  "result.milestoneHint": "{n} milestone rewards are ready in the lobby.",
  // 새 스테이지를 처음 클리어했습니다 — 마일스톤에서 별불을 받으세요.
  "result.starfireHint": "First clear of a new stage — claim your starfire from milestones.",

  /* ── tools ── */
  // 설정 및 도구
  "tools.toggleTitle": "Settings and tools",
  // 도구 메뉴 열기
  "tools.openAria": "Open tool menu",
  // 도구 메뉴 닫기
  "tools.closeAria": "Close tool menu",
  // 효과음
  "tools.soundAria": "Sound effects",
  // 효과음 켜기
  "tools.soundOn": "Turn sound on",
  // 효과음 끄기
  "tools.soundOff": "Turn sound off",
  // 전투 종료
  "tools.quitTitle": "End battle",

  /* ── options ── */
  // 옵션
  "options.title": "Options",
  // 언어
  "options.language.title": "Language",
  // 전투 중에는 바꿀 수 없습니다.
  "options.language.note": "Cannot be changed during battle.",
  // 게임 설명서
  "options.manual": "Game guide",
  // 데이터 초기화
  "options.reset": "Reset data",
  // 로비에서만 초기화할 수 있습니다.
  "options.reset.note": "Only available in the lobby.",

  /* ── notice ── */
  // 진행 데이터를 읽지 못했습니다. 브라우저 저장 설정을 확인한 뒤 새로고침해 주세요.
  "notice.read.error": "Could not read your progress. Check your browser storage settings and reload.",
  // 저장하지 못했습니다. 브라우저 저장 공간을 확인한 뒤 다시 시도해 주세요.
  "notice.write.error": "Could not save. Check your browser storage space and try again.",
  // 이전 전투가 종료되어 통과 보상 {gold} 골드를 받았습니다.
  "notice.settle.previous": "The previous battle ended — you received {gold} gold for the waves cleared.",
  // 이전 전투 보상을 저장하지 못했습니다. 저장 공간을 확인한 뒤 새로고침해 주세요.
  "notice.settle.previousFailed": "Could not save the previous battle's rewards. Check your storage space and reload.",
  // 전투를 종료할까요? 통과한 WAVE의 골드는 지급되며 행동력은 환급되지 않습니다.
  "notice.quit.confirm": "End this battle? Gold for the waves you cleared is paid out, but stamina is not refunded.",
  // 다른 창에서 진행이 변경되어 이 전투를 종료했습니다.
  "notice.storage.changed": "Progress changed in another window, so this battle was ended.",
  // 현재 진행을 초기화할까요? 골드·별불·캐릭터·스킬·마일스톤·전투 기록이 초기화됩니다.
  "notice.reset.confirm": "Reset your progress? Gold, starfire, guardians, skills, milestones and battle records will all be cleared.",
  // 데이터를 초기화했습니다. 스테이지 1 입장 시 튜토리얼이 다시 표시됩니다.
  "notice.reset.done": "Data reset. The tutorial will show again when you enter stage 1.",
  // 행동력 +{gained} 충전 · 누적 {total}회
  "notice.stamina.charged": "Stamina +{gained} · {total} recharges total",
  // 진행 저장에 실패해 전투를 중단했습니다. 저장 공간을 확인한 뒤 새로고침하면 마지막 저장 WAVE까지 정산합니다.
  "notice.progressSaveFailed": "The battle stopped because progress could not be saved. Check your storage space; reloading settles up to the last saved wave.",

  /* ── tutorial ── */
  // 건너뛰기
  "tutorial.skip": "Skip",
  // 튜토리얼 {index}
  "tutorial.step": "Tutorial {index}",
  // 에너지로 피스를 만드세요
  "tutorial.energy.title": "Make pieces with energy",
  // 생성기를 누르면 에너지 {cost}을 사용해 피스가 생성됩니다.\n적을 처치해 {points}점을 채우면 에너지 {energy}을 받습니다.
  "tutorial.energy.body": "Tap the generator to spend {cost} energy and make a piece.\nDefeat enemies to reach {points} score and receive {energy} energy.",
  // 주문서에 필요한 피스를 모으세요
  "tutorial.order.title": "Gather the pieces the order needs",
  // 주문서에 표시된 색의 피스를 보드에 준비하세요.\n같은 색과 같은 티어의 피스는 합칠 수 있습니다.
  "tutorial.order.body": "Prepare pieces on the board in the colors the order shows.\nPieces of the same color and tier can be merged.",
  // 주문서를 완성하세요
  "tutorial.ready.title": "Complete the order",
  // 조건이 충족되었습니다.\n빛나는 주문서를 누르면 영웅이 소환됩니다.\n같은 미사일의 다음 주문서는 영웅을 강화합니다.
  "tutorial.ready.body": "The requirements are met.\nTap the glowing order to summon your hero.\nThe next order for the same missile upgrades that hero.",
  // 스킬은 에너지를 쓰고 쿨타임이 흐릅니다
  "tutorial.skill.title": "Skills cost energy and have cooldowns",
  // 로비에서 장착한 스킬입니다. 버튼에 표시된 에너지를 소모하며, 같은 스킬을 쓸수록 비용이 {step}씩 올라갑니다.
  "tutorial.skill.body": "These are the skills you equipped in the lobby. Each use spends the energy shown on the button, and the cost rises by {step} every time you use that skill.",

  /* ── color ── */
  // 빨강
  "color.red": "Red",
  // 파랑
  "color.blue": "Blue",
  // 초록
  "color.green": "Green",
  // 노랑
  "color.yellow": "Yellow",
  // 보라
  "color.purple": "Purple",

  /* ── currency ── */
  // 골드
  "currency.gold": "Gold",
  // 별불
  "currency.starfire": "Starfire",

  /* ── enemy ── */
  // 근접
  "enemy.type.melee": "Melee",
  // 원거리
  "enemy.type.ranged": "Ranged",
  // 탱커
  "enemy.type.tank": "Tank",

  /* ── factor ── */
  // 공격력
  "factor.attackPct.short": "Attack",
  // 공격력 증가율
  "factor.attackPct.long": "Attack bonus",
  // 피해량
  "factor.damagePct.short": "Damage",
  // 피해량 증가율
  "factor.damagePct.long": "Damage bonus",
  // 치명타율
  "factor.critChance.short": "Crit rate",
  // 치명타율
  "factor.critChance.long": "Critical rate",
  // 치명타 피해
  "factor.critDamagePct.short": "Crit damage",
  // 치명타 피해량
  "factor.critDamagePct.long": "Critical damage",
  // 방어 무시율
  "factor.defenseIgnore.short": "Def ignore",
  // 방어 무시율
  "factor.defenseIgnore.long": "Defense ignore",
  // 관통 피해율
  "factor.pierceRate.short": "Pierce rate",
  // 관통 피해율
  "factor.pierceRate.long": "Pierce damage rate",
  // 공격속도
  "factor.attackSpeedPct.short": "Atk speed",
  // 공격속도 증가율
  "factor.attackSpeedPct.long": "Attack speed bonus",
  // 보스 피해
  "factor.bossDamagePct.short": "Boss damage",
  // 보스 피해 증가율
  "factor.bossDamagePct.long": "Boss damage bonus",

  /* ── guardian ── */
  // 아델
  "guardian.adel.name": "Adel",
  // 리시아
  "guardian.ricia.name": "Ricia",
  // 브론
  "guardian.bron.name": "Bron",
  // 타르크
  "guardian.tarq.name": "Tark",
  // 벨카
  "guardian.belka.name": "Belka",
  // 카일
  "guardian.kyle.name": "Kyle",
  // 세리아
  "guardian.seria.name": "Seria",
  // 도르만
  "guardian.dorman.name": "Dorman",
  // 로칸
  "guardian.rokan.name": "Rokan",
  // 아즈라
  "guardian.azra.name": "Azra",
  // 유나
  "guardian.yuna.name": "Yuna",
  // 엘리온
  "guardian.elion.name": "Elion",
  // 그림
  "guardian.grim.name": "Grim",
  // 테온
  "guardian.teon.name": "Teon",
  // 니아
  "guardian.nia.name": "Nia",
  // 미렌
  "guardian.miren.name": "Miren",
  // 아스텔
  "guardian.astel.name": "Astel",
  // 볼칸
  "guardian.volkan.name": "Volkan",
  // 키라
  "guardian.kira.name": "Kira",
  // 세라프
  "guardian.seraph.name": "Seraph",
  // 루헨
  "guardian.ruhen.name": "Ruhen",
  // 모르가
  "guardian.morga.name": "Morga",
  // 샨
  "guardian.shan.name": "Shan",
  // 오르넬
  "guardian.ornel.name": "Ornel",

  /* ── identity ── */
  // 기사
  "identity.knight": "Knight",
  // 귀족
  "identity.noble": "Noble",
  // 기술자
  "identity.engineer": "Engineer",
  // 용병
  "identity.mercenary": "Mercenary",
  // 추방자
  "identity.exile": "Exile",

  /* ── missile ── */
  // 연쇄
  "missile.chain.label": "Chain",
  // 추가 타깃
  "missile.chain.stat": "Extra targets",
  // 폭발
  "missile.explosion.label": "Blast",
  // 폭발 범위
  "missile.explosion.stat": "Blast radius",
  // 산탄
  "missile.scatter.label": "Scatter",
  // 발사 수
  "missile.scatter.stat": "Pellets",
  // 레이저
  "missile.laser.label": "Laser",
  // 광선 폭
  "missile.laser.stat": "Beam width",

  /* ── passive ── */
  // 전류 개방
  "passive.adel.name": "Current Release",
  // 과전 폭연
  "passive.ricia.name": "Overcharge Burst",
  // 정비 숙련
  "passive.bron.name": "Maintenance Mastery",
  // 야성 조준
  "passive.tarq.name": "Feral Aim",
  // 무법 결속
  "passive.belka.name": "Outlaw Bond",
  // 인간 전술
  "passive.kyle.name": "Human Tactics",
  // 용융 탄환
  "passive.seria.name": "Molten Rounds",
  // 용융 절단
  "passive.dorman.name": "Molten Cut",
  // 추적 전류
  "passive.rokan.name": "Tracking Current",
  // 무법자의 연대
  "passive.rokanStar.name": "Outlaws' Solidarity",
  // 열충격
  "passive.azra.name": "Thermal Shock",
  // 마족 공명
  "passive.azraStar.name": "Demon Resonance",
  // 표식 산개
  "passive.yuna.name": "Marked Spread",
  // 귀족 지휘
  "passive.yunaStar.name": "Noble Command",
  // 용융 관통
  "passive.elion.name": "Molten Pierce",
  // 엘프 정밀
  "passive.elionStar.name": "Elven Precision",
  // 용해 전류
  "passive.grim.name": "Melting Current",
  // 용병 연대
  "passive.grimStar.name": "Mercenary Bond",
  // 열파 증폭
  "passive.teon.name": "Heatwave Amp",
  // 정비 라인
  "passive.teonStar.name": "Assembly Line",
  // 감전 산탄
  "passive.nia.name": "Shock Shot",
  // 기사 서약
  "passive.niaStar.name": "Knight's Oath",
  // 전도 절단
  "passive.miren.name": "Conductive Cut",
  // 인류 연합
  "passive.mirenStar.name": "Human Alliance",
  // 고전압 증폭
  "passive.astel.name": "High Voltage Amp",
  // 엘프 결계
  "passive.astelStar.name": "Elven Ward",
  // 작열 각인
  "passive.volkan.name": "Searing Brand",
  // 드워프 제련
  "passive.volkanStar.name": "Dwarven Forging",
  // 관통 산개
  "passive.kira.name": "Piercing Spread",
  // 귀족 대열
  "passive.kiraStar.name": "Noble Ranks",
  // 초점 수렴
  "passive.seraph.name": "Focus Convergence",
  // 마족 강림
  "passive.seraphStar.name": "Demon Descent",
  // 잔류 방전
  "passive.ruhen.name": "Residual Discharge",
  // 용융 잔류
  "passive.ruhenStar.name": "Molten Residue",
  // 연쇄 붕괴
  "passive.morga.name": "Chain Collapse",
  // 용융 붕괴
  "passive.morgaStar.name": "Molten Collapse",
  // 정조준
  "passive.shan.name": "Precision Aim",
  // 감전 정밀
  "passive.shanStar.name": "Shock Precision",
  // 임계 출력
  "passive.ornel.name": "Critical Output",
  // 임계 감전
  "passive.ornelStar.name": "Critical Shock",

  /* ── race ── */
  // 인간
  "race.human": "Human",
  // 엘프
  "race.elf": "Elf",
  // 드워프
  "race.dwarf": "Dwarf",
  // 야수인
  "race.beast": "Beastkin",
  // 마족
  "race.demon": "Demon",

  /* ── rarity ── */
  // 노말
  "rarity.normal.name": "Normal",
  // N
  "rarity.normal.short": "N",
  // 매직
  "rarity.magic.name": "Magic",
  // M
  "rarity.magic.short": "M",
  // 레어
  "rarity.rare.name": "Rare",
  // R
  "rarity.rare.short": "R",
  // 영웅
  "rarity.epic.name": "Epic",
  // E
  "rarity.epic.short": "E",
  // 전설
  "rarity.legend.name": "Legend",
  // L
  "rarity.legend.short": "L",

  /* ── stage ── */
  // 불씨의 길
  "stage.1": "Ember Road",
  // 잿빛 외곽
  "stage.2": "Ashen Outskirts",
  // 용광로 입구
  "stage.3": "Forge Gate",
  // 끓는 심장
  "stage.4": "Boiling Heart",
  // 슬래그마 심층
  "stage.5": "Slagma Depths",
  // 끝없는 심층
  "stage.endless": "Endless Depths",

  /* ── status ── */
  // 감전
  "status.shocked": "Shocked",
  // 융해
  "status.melted": "Molten",

  /* ── wave ── */
  // 탱커
  "wave.fortress.short": "Tank",
  // 탱커전
  "wave.fortress.label": "Tank wave",
  // 돌격
  "wave.rush.short": "Rush",
  // 돌격전
  "wave.rush.label": "Rush wave",
  // 원거리
  "wave.siege.short": "Ranged",
  // 원거리 압박
  "wave.siege.label": "Ranged pressure",
  // 물량
  "wave.horde.short": "Horde",
  // 물량전
  "wave.horde.label": "Horde wave",
  // 혼성
  "wave.standard.short": "Mixed",
  // 혼성
  "wave.standard.label": "Mixed",
  // 보스
  "wave.midboss.short": "Boss",
  // 보스전
  "wave.midboss.label": "Boss wave",
  // 최종보스
  "wave.finalboss.short": "Final",
  // 최종보스전
  "wave.finalboss.label": "Final boss wave",

  /* ── growth ── */
  // 패시브 해금
  "growth.passiveUnlocked": "PASSIVE UNLOCKED",
  // NEW BEST
  "growth.newBest": "NEW BEST",

  /* ── rotate ── */
  // 화면을 세로로 돌려주세요
  "rotate.title": "Please turn your screen upright",
  // 이 게임은 세로 화면에 맞춰져 있습니다.
  "rotate.body": "This game is built for a portrait screen.",
});
