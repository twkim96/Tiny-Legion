import { EFFECT_OVERRIDE_KEYS, STAT_KEYS, STAT_MINIMUMS, normalizeEffects } from './effects.js';
import { applyEffect, advanceEffects } from './combat-effects.js';
export { combatStat, regenerationFactor } from './combat-effects.js';
import { getCharacter, UNIT_LEVEL_GROWTH } from "./characters.js";
import { applyUnitAbilities } from "./abilities.js";

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const factor = value => Math.max(0, finite(value, 1));
const scalable = STAT_KEYS;

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
  for (const key of EFFECT_OVERRIDE_KEYS.filter(key => key !== "statMultipliers")) {
    if (Object.hasOwn(overrides, key)) definition[key] = key === "effects" ? { ...(definition.effects ?? {}), ...structuredClone(overrides.effects) } : structuredClone(overrides[key]);
  }
  const result = team === "player" ? applyUnitAbilities(definition, abilities) : definition;
  result.effects = normalizeEffects(result.effects);
  const strength = combineStatMultipliers(multipliers, overrides.statMultipliers ?? definition.statMultipliers);
  const scale = team === "player" ? 1 + (Math.max(1, Math.min(120, Math.floor(finite(level, 1)))) - 1) * UNIT_LEVEL_GROWTH : 1;
  for (const stat of scalable) {
    const growth = stat === "hp" || stat === "attack" ? scale : 1;
    result[stat] *= growth * factor(modifiers[stat]) * strength[stat];
  }
  result.hp = Math.max(STAT_MINIMUMS.hp, Math.round(result.hp));
  result.attack = Math.max(STAT_MINIMUMS.attack, Math.round(result.attack));
  result.attackInterval = Math.max(STAT_MINIMUMS.attackInterval, result.attackInterval);
  result.gemAttributeBonuses = structuredClone(modifiers.attributeBonuses ?? {});
  return result;
}
export const unitCombatStats = (unit, level = 1, modifiers = {}, ranks = {}) =>
  characterStats(unit, { team: "player", level, modifiers, abilities: ranks });
export const enemyCombatStats = (id, multipliers = {}, overrides = {}, modifiers = {}) =>
  characterStats(id, { team: "enemy", multipliers, overrides, modifiers });

// Public convenience wrapper; all active effects use the same state/application.
export const applyStatEffect = (unit, values, context) => applyEffect(unit, { type: "stat", ...values }, context);
export const advanceStatEffects = advanceEffects;
