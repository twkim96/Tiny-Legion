import { UNITS, ROLE_SPECIALIZATION } from "./data.js";
export const UNIT_LEVEL_GROWTH = .12;

export const MARK_TYPES = [
  { id: "wild", name: "숲의 징표", color: "#3f852e" },
  { id: "machine", name: "공방의 징표", color: "#667487" },
  { id: "spirit", name: "별빛의 징표", color: "#287f9e" },
  { id: "shadow", name: "그늘의 징표", color: "#7845ab" },
];
export const DUPLICATE_MARKS = { common: 2, rare: 5, epic: 12, legendary: 30 };
export const markTypeFor = (unit) => unit?.specialties?.[0] ?? "wild";
export const markName = (id) => MARK_TYPES.find((mark) => mark.id === id)?.name ?? "숲의 징표";

const basic = [
  { id: "hp", name: "체력", max: 10, step: "체력 +1%", effect: "hp", amount: .01 },
  { id: "attack", name: "공격력", max: 10, step: "공격력 +1%", effect: "attack", amount: .01 },
  { id: "move", name: "가벼운 발걸음", max: 5, step: "이동속도 +2%", effect: "move", amount: .02 },
  { id: "range", name: "긴 사거리", max: 5, step: "사거리 +4", effect: "range", amount: 4 },
  { id: "counter", name: "속성 숙련", max: 10, step: "유효 속성 보너스 +1%p", effect: "counter", amount: .01 },
];
const signature = {
  sheep: { name: "독에 강한 양털", step: "중독 면역", effect: "poisonImmune" },
  rabbit: { name: "성 파괴", step: "적 성 추가 피해 +50%p", effect: "castle", amount: .5 },
  squirrel: { name: "빠른 씨앗", step: "공격 간격 −0.1초", effect: "interval", amount: .1 },
  fox: { name: "등불의 온기", step: "2초마다 최대 체력 1% 회복", effect: "regen" },
  chick: { name: "큰 폭탄", step: "폭발 범위 +24", effect: "splash", amount: 24 },
  deer: { name: "잎사귀 갑옷", step: "최대 체력 15%의 방어막", effect: "shield", amount: .15 },
  teapot: { name: "끓는 물", step: "방어막 추가 피해 +100%", effect: "shieldDamage", amount: 1 },
  hedgehog: { name: "밀폐 갑옷", step: "중독 면역", effect: "poisonImmune" },
  owl: { name: "빠른 태엽", step: "공격 간격 −0.1초", effect: "interval", amount: .1 },
  turtle: { name: "튼튼한 등껍질", step: "중독 면역", effect: "poisonImmune" },
  cloud: { name: "차가운 번개", step: "둔화 시간 +1초", effect: "slowDuration", amount: 1 },
  otter: { name: "넉넉한 물방울", step: "회복량 +20%", effect: "heal", amount: .2 },
  "mushroom-witch": { name: "독버섯 물약", step: "3초간 초당 공격력 8%의 중독 피해", effect: "poison" },
  penguin: { name: "얼음 발자국", step: "공격 시 2초간 이동속도 20% 감소", effect: "slow" },
  whale: { name: "넓은 물결", step: "공격 범위 +45", effect: "splash", amount: 45 },
};
const extraAttributes = {
  sheep: "machine", rabbit: "machine", squirrel: "machine", fox: "shadow", chick: "machine", deer: "spirit",
  teapot: "wild", hedgehog: "wild", owl: "wild", turtle: "spirit",
  cloud: "machine", otter: "shadow", "mushroom-witch": "shadow", penguin: "shadow", whale: "wild",
};
export function unitAbilities(unitOrId) {
  const unit = typeof unitOrId === "string" ? UNITS.find((u) => u.id === unitOrId) : unitOrId;
  if (!unit) return [];
  return [...basic, ...(signature[unit.id] ? [{ id: "signature", max: 1, ...signature[unit.id] }] : []),
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
  result.speed *= 1 + ranks.move * .02;
  result.range += ranks.range * 4;
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
export function unitCombatStats(unit, level = 1, modifiers = {}, ranks = {}) {
  const result = applyUnitAbilities(unit, ranks);
  const scale = 1 + (level - 1) * UNIT_LEVEL_GROWTH;
  result.speed *= modifiers.speed ?? 1;
  result.gemAttributeBonuses = structuredClone(modifiers.attributeBonuses ?? {});
  result.hp = Math.round(result.hp * scale * (modifiers.hp ?? 1));
  result.attack = Math.max(1, Math.round(result.attack * scale * (modifiers.attack ?? 1)));
  return result;
}
