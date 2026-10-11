import { getUnit, ROLE_SPECIALIZATION, SIGNATURE_ABILITIES as signature, EXTRA_ATTRIBUTES as extraAttributes, COMMON_ABILITIES as basic, OPTIONAL_ABILITIES as optional, MOVEMENT_ROLES, RANGE_UNIT_IDS } from "./characters.js";
export { UNIT_LEVEL_GROWTH } from "./characters.js";

export const MARK_TYPES = [
  { id: "wild", name: "숲의 징표", color: "#3f852e" },
  { id: "machine", name: "공방의 징표", color: "#667487" },
  { id: "spirit", name: "별빛의 징표", color: "#287f9e" },
  { id: "shadow", name: "그늘의 징표", color: "#7845ab" },
];
export const DUPLICATE_MARKS = { common: 2, rare: 5, epic: 12, legendary: 30 };
export const markTypeFor = (unit) => unit?.specialties?.[0] ?? "wild";
export const markName = (id) => MARK_TYPES.find((mark) => mark.id === id)?.name ?? "숲의 징표";

export function unitAbilities(unitOrId) {
  const unit = typeof unitOrId === "string" ? getUnit(unitOrId) : unitOrId;
  if (!unit) return [];
  const options = [
    ...(MOVEMENT_ROLES.includes(unit.role) ? [optional.move] : []),
    ...(RANGE_UNIT_IDS.includes(unit.id) && unit.rarity === "legendary" && unit.role === "ranged" && unit.cost >= 900 && unit.cooldown >= 6 ? [optional.range] : []),
  ];
  return [...basic, ...options, ...(signature[unit.id] ? [{ id: "signature", max: 1, ...signature[unit.id] }] : []),
    ...(extraAttributes[unit.id] ? [{ id: "extra", name: "새로운 특화", max: 1, effect: "attribute", attribute: extraAttributes[unit.id], unlock: 10 }] : [])];
}
export function normalizeAbilities(id, raw = {}) {
  return Object.fromEntries(unitAbilities(id).map((ability) => {
    const rank = Number(raw?.[ability.id]);
    return [ability.id, Number.isFinite(rank) ? Math.max(0, Math.min(ability.max, Math.floor(rank))) : 0];
  }));
}
export function abilityCost(ability, rank = 0) {
  if (!ability || rank >= ability.max) return null;
  return ability.max === 1
    ? { marks: 24, gold: 3000 }
    : { marks: 1 + rank, gold: 120 + rank * 80 };
}
// All effects are derived from fixed base values; repeated upgrades do not compound.
export function applyUnitAbilities(unit, raw = {}) {
  const ranks = normalizeAbilities(unit.id, raw);
  const result = structuredClone(unit);
  result.hp *= 1 + ranks.hp * .01;
  result.attack *= 1 + ranks.attack * .01;
  result.speed *= 1 + (ranks.move ?? 0) * .02;
  result.range += (ranks.range ?? 0) * 4;
  result.specialtyUpgradeBonus = Object.fromEntries(
    Object.keys(ROLE_SPECIALIZATION[unit.role] ?? {}).map((kind) => [kind, ranks.counter * .01]),
  );
  if (ranks.extra) result.specialties = [...new Set([...result.specialties, extraAttributes[unit.id]])];
  if (ranks.signature) {
    const { effect, amount } = signature[unit.id];
    if (effect === "poisonImmune") result.poisonImmune = true;
    if (effect === "castle") result.castleDamageBonus = (result.castleDamageBonus ?? 0) + amount;
    if (effect === "interval") result.attackInterval = Math.max(.2, result.attackInterval - amount);
    if (effect === "regen") result.regeneration = { hpRatio: .01, interval: 2 };
    if (effect === "splash") result.splashRadius = (result.splashRadius ?? 0) + amount;
    if (effect === "shield") result.shield = { hpRatio: amount };
    if (effect === "shieldDamage") result.shieldDamageBonus = (result.shieldDamageBonus ?? 0) + amount;
    if (effect === "slowDuration") result.slow = { ...result.slow, duration: result.slow.duration + amount };
    if (effect === "heal") result.heal *= 1 + amount;
    if (effect === "poison") result.poison = { ratio: .08, duration: 3, interval: 1 };
    if (effect === "slow") result.slow = { factor: .8, duration: 2 };
  }
  return result;
}
