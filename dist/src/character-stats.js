import { getCharacter, UNIT_LEVEL_GROWTH } from "./characters.js";
import { applyUnitAbilities } from "./abilities.js";

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const factor = value => Math.max(0, finite(value, 1));
const scalable = ["hp", "attack", "speed", "range", "attackInterval"];

export function combineStatMultipliers(...sources) {
  return Object.fromEntries(scalable.map(stat => [stat,
    sources.reduce((product, source) => product * factor(source?.[stat]), 1),
  ]));
}

// Detached spawn/detail snapshot. Overrides are encounter mechanics, multipliers
// are encounter strength, modifiers are equipment/team effects; none change base data.
export function characterStats(character, { team = "player", level = 1, abilities = {}, modifiers = {}, multipliers = {}, overrides = {} } = {}) {
  const base = typeof character === "string" ? getCharacter(character, team) : character;
  if (!base) return null;
  const definition = structuredClone(base);
  for (const key of ["attribute", "shield", "regeneration"]) {
    if (Object.hasOwn(overrides, key)) definition[key] = structuredClone(overrides[key]);
  }
  const result = team === "player" ? applyUnitAbilities(definition, abilities) : definition;
  const strength = combineStatMultipliers(multipliers, overrides.statMultipliers ?? definition.statMultipliers);
  const scale = team === "player" ? 1 + (Math.max(1, Math.min(120, Math.floor(finite(level, 1)))) - 1) * UNIT_LEVEL_GROWTH : 1;
  for (const stat of scalable) {
    const growth = stat === "hp" || stat === "attack" ? scale : 1;
    result[stat] *= growth * factor(modifiers[stat]) * strength[stat];
  }
  result.hp = Math.max(1, Math.round(result.hp));
  result.attack = Math.max(1, Math.round(result.attack));
  result.attackInterval = Math.max(.2, result.attackInterval);
  result.gemAttributeBonuses = structuredClone(modifiers.attributeBonuses ?? {});
  return result;
}
export const unitCombatStats = (unit, level = 1, modifiers = {}, ranks = {}) =>
  characterStats(unit, { team: "player", level, modifiers, abilities: ranks });
export const enemyCombatStats = (id, multipliers = {}, overrides = {}, modifiers = {}) =>
  characterStats(id, { team: "enemy", multipliers, overrides, modifiers });

// Dynamic status effects operate on spawn stats, so expiration never needs to
// reconstruct a character or undo compounded changes. Shared by both teams.
export function combatStat(unit, stat) {
  let value = finite(unit?.[stat], 0);
  const effects = (unit?.statEffects ?? []).filter(effect => effect.remaining > 0 && effect.stat === stat);
  value += effects.reduce((sum, effect) => sum + finite(effect.flat, 0), 0);
  for (const effect of effects) value *= factor(effect.multiplier);
  if (stat === "speed" && unit?.slowRemaining > 0) value *= factor(unit.slowFactor);
  return Math.max(stat === "attackInterval" ? .2 : 0, value);
}
export function applyStatEffect(unit, { id, stat, multiplier = 1, flat = 0, duration } = {}) {
  if (!unit || unit.dead || typeof id !== "string" || !["attack", "speed", "range", "attackInterval"].includes(stat) || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(multiplier) || multiplier < 0 || !Number.isFinite(flat)) return false;
  const effect = { id, stat, multiplier, flat, remaining: duration };
  unit.statEffects ??= [];
  const index = unit.statEffects.findIndex(entry => entry.id === id);
  if (index < 0) unit.statEffects.push(effect);
  else unit.statEffects[index] = effect;
  return true;
}
export function advanceStatEffects(unit, dt) {
  unit.statEffects = (unit.statEffects ?? []).map(effect => ({ ...effect, remaining: Math.max(0, effect.remaining - dt) })).filter(effect => effect.remaining > 0);
}
export const regenerationFactor = unit => unit?.regenSuppressionRemaining > 0 ? factor(unit.regenSuppressionFactor) : 1;
