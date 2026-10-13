import { matchesEffectTarget } from './effect-targets.js';
import { effectOf, COMBAT_TRAITS } from './effects.js';
import { SHIELD_BONUS_CAP } from "./characters.js";

const boundedBonus = (value, cap) =>
  Math.min(cap, Math.max(0, Number(value) || 0));

// Each target is evaluated independently, including each victim of a splash hit.
export const traitBonus = (source, target, field) => Math.max(0, ...Object.values(source?.effects ?? {})
  .filter(spec => Object.hasOwn(COMBAT_TRAITS[spec?.type] ?? {}, field) && matchesEffectTarget(spec, target))
  .map(spec => boundedBonus(spec[field], field === 'damageReduction' ? 1 : Infinity)));
const gemBonus = (source, target, kind) => boundedBonus(source?.gemAttributeBonuses?.[target?.attribute]?.[kind], Infinity);

export function resolveDamage(target, rawDamage, source = {}) {
  if (blocksAttack(target, source)) return { hpDamage: 0, shieldDamage: 0, blocked: true };
  let damage = Math.max(0, rawDamage);
  damage *= 1 + gemBonus(source, target, 'attack');
  damage /= 1 + gemBonus(target, source, 'effectiveHp');
  // Final trait multipliers follow attack buffs, equipment and other damage bonuses.
  damage *= 1 + traitBonus(source, target, 'bonus');
  damage *= 1 - traitBonus(target, source, 'damageReduction');
  const shieldBonus=effectOf(source,"shieldDamage");
  const shieldMultiplier = 1 + boundedBonus((matchesEffectTarget(shieldBonus,target)?shieldBonus?.bonus??0:source.shieldDamageSupportBonus??0), SHIELD_BONUS_CAP);
  const shield = Math.max(0, target.shield ?? 0);
  const absorbedBase = Math.min(damage, shield / shieldMultiplier);
  return {
    hpDamage: damage - absorbedBase,
    shieldDamage: absorbedBase * shieldMultiplier,
  };
}
export const blocksAttack = (target, source = {}) => {
  const immunity = effectOf(target, 'attackImmunity');
  return !!immunity && matchesEffectTarget(immunity,source);
};
