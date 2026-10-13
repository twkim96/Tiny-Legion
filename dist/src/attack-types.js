// A fixed combat identity, independent of role, reach and visual projectile.
export const ATTACK_TYPES = Object.freeze({
  melee: Object.freeze({ name: "근거리" }),
  ranged: Object.freeze({ name: "원거리" }),
});
export const isAttackType = type => Object.hasOwn(ATTACK_TYPES, type);
export const attackTypeName = type => ATTACK_TYPES[type]?.name ?? "";
