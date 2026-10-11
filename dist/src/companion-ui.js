import { UNITS, ATTRIBUTES, ROLE_SPECIALIZATION } from "./data.js";
import { companionStats, levelCost, growthUnlocked, ownsUnit, gemPresetForMode, effectiveUnitLevel, sharedLevel, unitLevelRefund } from "./account.js";
import { unitAbilities, normalizeAbilities, abilityCost, markTypeFor, markName } from "./abilities.js";
import { specializationBonus } from "./combat-rules.js";
import { gemByUid, gemDefinition, gemDescription, gemOptionText } from "./gems.js";
import { portrait, icon } from "./art.js";
import { rarityBadge } from "./recruitment-ui.js";

const fmt = (value) => Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 2 });
const attribute = (id) => {
  const item = ATTRIBUTES.find((a) => a.id === id);
  return `<strong class="attribute-label" style="color:${item?.ink ?? "#757b6a"}">${item?.name ?? "무속성"}특화</strong>`;
};
export function abilityDescription(ability) {
  return ability.effect === "attribute" ? `${attribute(ability.attribute)} 추가` : ability.step;
}
export function appliedAbilityLines(unit, ranks) {
  return unitAbilities(unit).filter((a) => ranks[a.id] > 0).map((a) =>
    a.max === 1 ? abilityDescription(a) :
      a.effect === "range" ? `사거리 +${ranks[a.id] * a.amount}` :
        a.effect === "counter" ? `유효 속성 보너스 +${ranks[a.id]}%p` :
          `${a.effect === "hp" ? "체력" : a.effect === "attack" ? "공격력" : "이동속도"} +${fmt(ranks[a.id] * a.amount * 100)}%`,
  );
}
export function companionPanel(account, id, nativeEffects = [], mode = "idle") {
  const unit = UNITS.find((u) => u.id === id);
  if (!unit || !ownsUnit(account, id)) return "";
  const stats = companionStats(account, id, mode);
  const personalLevel = account.levels?.[id] ?? 1;
  const effectiveLevel = effectiveUnitLevel(account, id);
  const levelLabel = effectiveLevel > personalLevel
    ? `Lv. ${effectiveLevel}<small>공유 Lv. ${sharedLevel(account)} · 개인 Lv. ${personalLevel}</small>`
    : `Lv. ${effectiveLevel}`;
  const levelPrice = levelCost(effectiveLevel);
  const refundableLevelSpend = unitLevelRefund(account, id);
  const ranks = normalizeAbilities(id, account.abilities?.[id]);
  const mark = markTypeFor(unit);
  const bonuses = Object.keys(ROLE_SPECIALIZATION[unit.role] ?? {}).map((kind) =>
    `${kind === "attack" ? "공격력" : kind === "effectiveHp" ? "유효 체력" : "방해 지속시간"} +${fmt(specializationBonus(stats, { attribute: stats.specialties[0] }, kind) * 100)}%`,
  );
  const effects = [
    ...appliedAbilityLines(unit, ranks),
    ...(account.special[id] ? [`이전 특별강화 +${account.special[id]}레벨`] : []),
    ...((account.gemPresets?.[gemPresetForMode(account,mode)] ?? []).map(uid=>gemByUid(account,uid)).filter(Boolean).map(item=>`${gemDefinition(item.type).name} Lv. ${item.level} · ${gemDescription(item)}${item.options.length ? " · "+item.options.map(gemOptionText).join(" · ") : ""}`)),
  ];
  const pairs = [["체력", stats.hp], ["공격력", stats.attack], ["초당 공격력", stats.attack / stats.attackInterval],
    ["사거리", stats.range], ["이동속도", stats.speed], ["공격 간격", `${fmt(stats.attackInterval)}초`],
    ["소환 골드", stats.cost], ["소환 대기", `${fmt(stats.cooldown)}초`]];
  return `<div class="companion-detail"><section class="companion-summary"><div class="companion-heading"><div class="companion-portrait">${portrait(id)}</div><div>${rarityBadge(unit)}<h3>${unit.name}</h3><span>${levelLabel}</span><p>${unit.description}</p></div></div><div class="stat-list">${pairs.map(([label, value]) => `<div class="stat-item">${label}<strong>${typeof value === "number" ? fmt(value) : value}</strong></div>`).join("")}</div><div class="companion-specialties">${stats.specialties.map(attribute).join(" · ")}<p>${bonuses.join(" · ")}</p>${nativeEffects.length ? `<p>${nativeEffects.join("<br>")}</p>` : ""}</div><h4>적용 효과</h4>${effects.length ? `<ul class="companion-effects">${effects.map((effect) => `<li>${effect}</li>`).join("")}</ul>` : '<p class="settings-note">아직 강화한 특수능력이 없어요.</p>'}<button class="primary-button" id="companion-level" ${!growthUnlocked(account) || effectiveLevel >= 100 || account.gold < levelPrice ? "disabled" : ""}>레벨 ${effectiveLevel >= 100 ? "완료" : `올리기 ${icon("acorn")}${fmt(levelPrice)}`}</button></section><section class="companion-upgrades"><div class="companion-upgrade-header"><h4>특수능력</h4><span>${markName(mark)} ${fmt(account.marks?.[mark] ?? 0)}</span></div><div class="ability-list">${unitAbilities(unit).map((ability) => {
    const rank = ranks[ability.id], cost = abilityCost(ability, rank);
    const locked = account.highestCleared < (ability.unlock ?? 0);
    const disabled = !growthUnlocked(account) || locked || !cost || account.gold < cost.gold || (account.marks?.[mark] ?? 0) < cost.marks;
    return `<article class="ability-row"><div><strong>${ability.name}</strong><span>${rank}/${ability.max}</span><p>${abilityDescription(ability)}</p></div><button class="${cost ? "secondary-button" : "ability-complete"}" data-ability="${ability.id}" ${disabled ? "disabled" : ""}>${locked ? "2-1에서 열림" : !cost ? "완료" : `<span>${markName(mark)} ${cost.marks}</span><span>${icon("acorn")}${fmt(cost.gold)}</span>`}</button></article>`;
  }).join("")}</div><p class="settings-note">강화는 다음 전투부터 적용됩니다.</p></section></div><div class="modal-footer"><button class="secondary-button" id="companions-back">동료 목록</button><span class="resource-inline">${icon("acorn")}${fmt(account.gold)}</span><button class="inspect-button" id="companion-refund" ${refundableLevelSpend <= 0 ? "disabled" : ""}>레벨 초기화</button></div>`;
}
