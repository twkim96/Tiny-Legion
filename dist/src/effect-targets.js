import { ATTACK_TYPES, attackTypeName } from './attack-types.js';
import { ATTRIBUTES, NEUTRAL_ATTRIBUTE, FAMILIES, familyName, attributeLabel } from './character-tags.js';
const registries = { attackType: Object.keys(ATTACK_TYPES), family: Object.keys(FAMILIES), attribute: [...ATTRIBUTES, NEUTRAL_ATTRIBUTE].map(item => item.id) };
export function normalizeEffectTargets(values) {
  const result = {};
  for (const [axis, ids] of Object.entries(registries)) {
    const selection = values[axis] ?? 'all';
    if (selection === 'all') result[axis] = 'all';
    else {
      const list = Array.isArray(selection) ? [...new Set(selection)].sort() : [selection];
      if (!list.length || list.some(id => !ids.includes(id))) throw new TypeError(`Invalid effect target.${axis}`);
      result[axis] = Array.isArray(selection) ? list : selection;
    }
  }
  return result;
}
// AND across axes, OR within an axis. 'all' is open-ended and includes future tags.
export function matchesEffectTarget(spec, subject) {
  return Object.keys(registries).every(axis => {
    const selection = spec?.[axis] ?? 'all';
    return selection === 'all' || (Array.isArray(selection) ? selection.includes(subject?.[axis]) : selection === subject?.[axis]);
  });
}
export const attackTargetName = selection => selection === 'all' || selection == null ? '모든 공격' : (Array.isArray(selection) ? selection : [selection]).map(attackTypeName).join('·');
export function effectTargetText(spec, { all = false, includeAttackType = true } = {}) {
  const parts = [];
  if (includeAttackType && (all || (spec.attackType && spec.attackType !== 'all'))) parts.push(`대상 ${attackTargetName(spec.attackType)}`);
  for (const [axis, name, label] of [['family', '종족', familyName], ['attribute', '속성', attributeLabel]]) {
    const selection = spec[axis] ?? 'all';
    if (selection === 'all') { if (all) parts.push(`모든 ${name}`); }
    else parts.push(`${name} ${(Array.isArray(selection) ? selection : [selection]).map(label).join('·')}`);
  }
  return parts.join(' · ');
}
