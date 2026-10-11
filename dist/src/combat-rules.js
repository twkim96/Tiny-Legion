import { effectOf } from './effects.js';
import {
  ATTRIBUTE_BONUS_CAP,
  ROLE_SPECIALIZATION,
  SHIELD_BONUS_CAP,
} from "./characters.js";

const boundedBonus = (value, cap) =>
  Math.min(cap, Math.max(0, Number(value) || 0));

// Each target is evaluated independently, including each victim of a splash hit.
export function specializationBonus(source, target, kind) {
  const rawGemBonus = source?.gemAttributeBonuses?.[target?.attribute]?.[kind];
  const gemBonus = Number.isFinite(rawGemBonus) ? Math.max(0, rawGemBonus) : 0;
  if (!source?.specialties?.includes(target?.attribute)) return gemBonus;
  const base = ROLE_SPECIALIZATION[source.role]?.[kind] ?? 0;
  const extra = source.attributeBonuses?.[target.attribute]?.[kind] ?? 0;
  return boundedBonus(base + extra, ATTRIBUTE_BONUS_CAP) + boundedBonus(source.specialtyUpgradeBonus?.[kind], .1) + gemBonus;
}

export function resolveDamage(target, rawDamage, source = {}) {
  let damage = Math.max(0, rawDamage);
  if (source.team === "player" && target.team === "enemy")
    damage *= 1 + specializationBonus(source, target, "attack");
  if (target.team === "player" && source.team === "enemy")
    damage /= 1 + specializationBonus(target, source, "effectiveHp");
  const shieldMultiplier =
    1 + boundedBonus(effectOf(source, "shieldDamage")?.bonus, SHIELD_BONUS_CAP);
  const shield = Math.max(0, target.shield ?? 0);
  const absorbedBase = Math.min(damage, shield / shieldMultiplier);
  return {
    hpDamage: damage - absorbedBase,
    shieldDamage: absorbedBase * shieldMultiplier,
  };
}
