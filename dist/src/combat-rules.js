import {
  ATTRIBUTE_BONUS_CAP,
  ROLE_SPECIALIZATION,
  SHIELD_BONUS_CAP,
} from "./data.js";

const boundedBonus = (value, cap) =>
  Math.min(cap, Math.max(0, Number(value) || 0));

// Each target is evaluated independently, including each victim of a splash hit.
export function specializationBonus(source, target, kind) {
  if (!source?.specialties?.includes(target?.attribute)) return 0;
  const base = ROLE_SPECIALIZATION[source.role]?.[kind] ?? 0;
  const extra = source.attributeBonuses?.[target.attribute]?.[kind] ?? 0;
  return boundedBonus(base + extra, ATTRIBUTE_BONUS_CAP);
}

export function resolveDamage(target, rawDamage, source = {}) {
  let damage = Math.max(0, rawDamage);
  if (source.team === "player" && target.team === "enemy")
    damage *= 1 + specializationBonus(source, target, "attack");
  if (target.team === "player" && source.team === "enemy")
    damage /= 1 + specializationBonus(target, source, "effectiveHp");
  const shieldMultiplier =
    1 + boundedBonus(source.shieldDamageBonus, SHIELD_BONUS_CAP);
  const shield = Math.max(0, target.shield ?? 0);
  const absorbedBase = Math.min(damage, shield / shieldMultiplier);
  return {
    hpDamage: damage - absorbedBase,
    shieldDamage: absorbedBase * shieldMultiplier,
  };
}
