import { applyChanges, changesText, traitFields } from './effects.js';
import { getUnit, SIGNATURE_ABILITIES as signature, EXTRA_ATTRIBUTES as extraAttributes, COMMON_ABILITIES as basic, OPTIONAL_ABILITIES as optional, MOVEMENT_ROLES, RANGE_UNIT_IDS } from "./characters.js";
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
  const core = basic.map(ability => ability.id === 'counter' ? {
    ...ability, changes: ability.changes.map(change => ({ ...change, fields: traitFields(unit) })),
  } : ability);
  return [...core, ...options, ...(signature[unit.id] ? [{ id: "signature", max: 1, ...signature[unit.id] }] : []),
    ...(extraAttributes[unit.id] ? [{ id: "extra", name: "새로운 특화", max: 1, changes: [{ op: "specialty", attribute: extraAttributes[unit.id] }], attribute: extraAttributes[unit.id], unlock: 10 }] : [])];
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
export const abilityText = (ability, rank = 1) => changesText(ability.changes, rank);
// Every upgrade is declarative; fixed steps are applied once to a detached base.
export function applyUnitAbilities(unit, raw = {}) {
  const ranks = normalizeAbilities(unit.id, raw);
  const result = structuredClone(unit);
  for (const ability of unitAbilities(unit)) {
    if (ranks[ability.id]) applyChanges(result, ability.changes, ranks[ability.id]);
  }
  return result;
}
