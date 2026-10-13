import { matchesEffectTarget } from './effect-targets.js';
import { EFFECTS, COMBAT_TRAITS, effect, effectOf, effectKey, BATTLE_ORIGIN, STAT_MINIMUMS, MIN_EFFECT_INTERVAL } from './effects.js';
import { blocksAttack } from './combat-rules.js';

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const nonnegative = value => Math.max(0, finite(value));
const EPSILON = 1e-9;
export const CANNON = Object.freeze({ damage: 110, knockback: Object.freeze(effect('knockback', { distance: 75 })) });
export const COMBAT_TIMING = Object.freeze({ step: MIN_EFFECT_INTERVAL, hitFlash: .18, hitStun: .18, heavyHitStun: .24, heavyHitRatio: .2, stunCooldown: .65, death: .32 });
export const activeEffects = (unit, type) => Object.values(unit?.statusEffects ?? {}).filter(status => status.type === type && status.remaining > 0);
export const remainingEffect = (unit, type) => Math.max(0, ...activeEffects(unit, type).map(status => status.remaining));
export const isImmune = (unit,type,source=unit) => { const spec=effectOf(unit,'immunity'); return spec?.effect===type && matchesEffectTarget(spec,source); };
export const effectFactor = (unit, type, scope = 'all') => activeEffects(unit, type).filter(status => scope === 'regeneration' || status.scope !== 'regeneration').reduce((factor, status) => factor * status.factor, 1);
export const healingAmount = (unit,spec) => nonnegative(spec?.amount) + nonnegative(unit?.maxHp)*nonnegative(spec?.hpRatio);

export function initializeEffects(unit, definition) {
  unit.effects=structuredClone(definition.effects ?? {});
  unit.statusEffects={};
  unit.periodicTimers={};
  const shieldSpec=effectOf(unit,'shield');
  const shield=matchesEffectTarget(shieldSpec,unit)?healingAmount(unit,shieldSpec):0;
  unit.shield=unit.maxShield=Math.round(shield);
  const regeneration=effectOf(unit,'regeneration');
  if(regeneration && matchesEffectTarget(regeneration,unit))unit.periodicTimers.regeneration=regeneration.interval;
  const repulsion=effectOf(unit,'repelPulse');
  if(repulsion)unit.periodicTimers.repelPulse=repulsion.interval;
  return unit;
}

// Last application replaces every value for the same origin and effect kind.
// Different origins coexist; team and caster identity do not enter the key.
export function applyEffect(unit, spec, context = {}) {
  if(!unit || unit.dead || !spec)return false;
  try { spec=effect(spec.type,spec); } catch { return false; }
  const installed=[...Object.keys(COMBAT_TRAITS),'immunity','attackImmunity','repelPulse','areaAttack','shieldDamageAura','castleDamage','shieldDamage'];
  if(!installed.includes(spec.type) && !matchesEffectTarget(spec,unit))return false;
  if(isImmune(unit,spec.type,context.source??unit))return false;
  const origin = context.origin ?? spec.origin ?? context.source?.origin ?? BATTLE_ORIGIN;
  if (typeof origin !== 'string' || !origin.trim()) return false;
  const key = effectKey(origin, spec);
  const durationMultiplier = context.durationMultiplier ?? 1;
  if (!Number.isFinite(durationMultiplier) || durationMultiplier <= 0) return false;
  unit.statusEffects ??= {};
  if(['slow','healingSuppression'].includes(spec.type)) {
    unit.statusEffects[key]={ ...spec, origin, remaining:spec.duration*durationMultiplier };
  } else if(spec.type==='poison') {
    const previous=unit.statusEffects[key];
    const damage=nonnegative(context.damage)*spec.ratio;
    const source=structuredClone(context.source??{});
    if(source.effects) for (const [type, entry] of Object.entries(source.effects)) {
      if (EFFECTS[entry?.type]?.trigger === 'hit') delete source.effects[type];
    }
    // Preserve the next tick's progress so frequent refreshes cannot suppress poison.
    const tickRemaining=previous?.remaining>0 ? Math.min(previous.tickRemaining,spec.interval) : spec.interval;
    unit.statusEffects[key]={...spec,origin,remaining:spec.duration*durationMultiplier,tickRemaining,damage,direction:context.direction,source};
  } else if(spec.type==='stat') {
    unit.statusEffects[key]={...spec,origin,remaining:spec.duration*durationMultiplier};
  } else if(spec.type==='healing') {
    return healUnit(unit,spec)>0;
  } else if(spec.type==='shield') {
    const amount=Math.round(healingAmount(unit,spec));
    unit.shield=Math.max(unit.shield??0,amount);
    unit.maxShield=Math.max(unit.maxShield??0,unit.shield);
  } else if(spec.type==='knockback') {
    if(!Number.isFinite(unit.x) || !Number.isFinite(context.direction))return false;
    const before=unit.x;
    unit.x=Math.max(context.minX??0,Math.min(context.maxX??1200,unit.x+Math.sign(context.direction)*spec.distance));
    if(unit.x!==before && context.cancelWindup && unit.action?.phase==='windup')unit.action=null;
    if(unit.x!==before)unit.moving=false;
  } else if(spec.type==='hitStun') {
    unit.statusEffects[key]={...spec,origin,remaining:spec.duration*durationMultiplier};
    syncHitStun(unit);
    unit.moving=false;
  } else if (installed.includes(spec.type) || spec.type === 'regeneration') {
    unit.effects ??= {};
    unit.effects[spec.type] = structuredClone(spec);
    if (spec.type === 'regeneration') {
      unit.periodicTimers ??= {};
      unit.periodicTimers.regeneration = spec.interval;
    }
    if(spec.type==='repelPulse') {
      unit.periodicTimers ??= {};
      unit.periodicTimers.repelPulse=spec.interval;
    }
  } else return false;
  return true;
}
export function advanceEffects(unit,dt) {
  if(!Number.isFinite(dt) || !(dt>0))return;
  const managedStun=activeEffects(unit,'hitStun').length>0;
  for(const [key,status] of Object.entries(unit.statusEffects??{})) {
    if(status.type==='poison')continue; // periodic damage owns its exact final tick
    status.remaining=Math.max(0,status.remaining-dt);
    if(status.remaining<=EPSILON)delete unit.statusEffects[key];
  }
  if(managedStun)syncHitStun(unit);
  else unit.hitStun=Math.max(0,(unit.hitStun??0)-dt);
}
function syncHitStun(unit) {
  const longest=activeEffects(unit,'hitStun').sort((a,b)=>b.remaining-a.remaining)[0];
  unit.hitStun=longest?.remaining??0;
  unit.hitStunDuration=longest ? longest.duration : unit.hitStunDuration;
}
export function combatStat(unit,stat) {
  let value=finite(unit?.[stat]);
  const statuses=Object.values(unit?.statusEffects??{}).filter(e=>e.type==='stat' && e.stat===stat && e.remaining>0 && matchesEffectTarget(e,unit));
  value+=statuses.reduce((sum,e)=>sum+e.flat,0);
  for(const status of statuses)value*=status.multiplier;
  if(stat==='speed')value*=effectFactor(unit,'slow');
  return Math.max(stat==='hp'?1:stat==='attack'?0:STAT_MINIMUMS[stat]??0,value);
}
export const regenerationFactor = unit => effectFactor(unit, 'healingSuppression', 'regeneration');
export const healingFactor = (unit, spec) => effectFactor(unit, 'healingSuppression', spec?.type === 'regeneration' ? 'regeneration' : 'all');
export function queueHealing(batch,unit,spec) {
  if(!unit || unit.dead || !matchesEffectTarget(spec,unit))return;
  const amount=healingAmount(unit,spec)*healingFactor(unit,spec);
  batch.healing.set(unit.uid,(batch.healing.get(unit.uid)??0)+amount);
}
export function healUnit(unit,spec) {
  if(!unit || unit.dead || !matchesEffectTarget(spec,unit))return 0;
  const before=unit.hp;
  unit.hp=Math.min(unit.maxHp,unit.hp+healingAmount(unit,spec)*healingFactor(unit,spec));
  return unit.hp-before;
}
export function tickPeriodicEffects(unit,dt,{heal,damage}) {
  if(unit.dead || !Number.isFinite(dt) || !(dt>0))return;
  for(const [key,poison] of Object.entries(unit.statusEffects??{})) {
    if(poison.type!=='poison')continue;
    if(isImmune(unit,'poison',poison.source)) { delete unit.statusEffects[key]; continue; }
    const active=Math.min(dt,poison.remaining);
    poison.remaining=Math.max(0,poison.remaining-active);
    poison.tickRemaining-=active;
    while(poison.tickRemaining<=EPSILON) { damage(poison.damage,poison.direction,poison.source); poison.tickRemaining+=poison.interval; }
    if(poison.remaining<=EPSILON)delete unit.statusEffects[key];
  }
  const regeneration=effectOf(unit,'regeneration');
  if(regeneration && matchesEffectTarget(regeneration,unit)) {
    unit.periodicTimers ??= {};
    let timer=(unit.periodicTimers.regeneration??regeneration.interval)-dt;
    while(timer<=EPSILON) { heal(regeneration); timer+=regeneration.interval; }
    unit.periodicTimers.regeneration=timer;
  }
}
export function applyHitEffects(target,source,{hpDamage,damage,direction}) {
  if(blocksAttack(target,source))return;
  for (const spec of Object.values(source?.effects ?? {})) {
    const contract = EFFECTS[spec?.type];
    if (contract?.trigger === 'hit' && (!contract.requiresHpDamage || hpDamage > 0)) applyEffect(target,spec,{source,damage,direction});
  }
}
// Team-independent periodic control: each recipient must match all target axes.
export function tickRepulsion(unit,dt,units,{warning,pulse} = {}) {
  const spec=effectOf(unit,'repelPulse');
  if(!spec || unit.dead || !Number.isFinite(dt) || !(dt>0))return;
  unit.periodicTimers ??= {};
  const before=unit.periodicTimers.repelPulse ?? spec.interval;
  let remaining=before-dt;
  if(spec.warning>0 && before>spec.warning && remaining<=spec.warning)warning?.(spec);
  while(remaining<=EPSILON) {
    for(const target of units) {
      if(target.dead || target.team===unit.team || !matchesEffectTarget(spec,target) || Math.abs(target.x-unit.x)>spec.range)continue;
      applyEffect(target,effect('knockback',{distance:spec.distance}),{direction:Math.sign(target.x-unit.x)||(unit.team==='enemy'?-1:1),cancelWindup:true,source:unit});
    }
    pulse?.(spec);
    remaining+=spec.interval;
  }
  unit.periodicTimers.repelPulse=remaining;
}
export function auraBonus(source,units,type) {
  const origins=new Map();
  // Units are kept in spawn order: the latest eligible supporter refreshes its origin.
  for(const unit of units) {
    if(unit.team!==source.team || unit.dead)continue;
    const aura=effectOf(unit,type);
    if(aura && matchesEffectTarget(aura,source) && Math.abs(unit.x-source.x)<=aura.range)origins.set(aura.origin??BATTLE_ORIGIN,aura.bonus);
  }
  return [...origins.values()].reduce((sum,bonus)=>sum+bonus,0);
}
export function attackSource(unit,units) {
  const nativeShieldDamage = effectOf(unit,'shieldDamage');
  const supportBonus = auraBonus(unit,units,'shieldDamageAura');
  return {
    origin:unit.origin??BATTLE_ORIGIN, team:unit.team, attackType:unit.attackType,
    family:unit.family, role:unit.role, attribute:unit.attribute,
    specialties:[...(unit.specialties??[])], gemAttributeBonuses:structuredClone(unit.gemAttributeBonuses),
    // Native bonuses select the victim; the aura has already selected its recipient.
    shieldDamageSupportBonus:supportBonus,
    effects:{...structuredClone(unit.effects??{}),shieldDamage:effect('shieldDamage',{
      ...structuredClone(nativeShieldDamage??{}), bonus:(nativeShieldDamage?.bonus??0)+supportBonus,
    })},
  };
}
export function supportTarget(source,units,spec) {
  if(!spec)return null;
  return units.filter(u=>u.team===source.team && !u.dead && matchesEffectTarget(spec,u) && u.hp<u.maxHp && Math.abs(u.x-source.x)<=spec.range).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp || Math.abs(a.x-source.x)-Math.abs(b.x-source.x) || a.uid.localeCompare(b.uid))[0]??null;
}
export function statusMarks(unit) {
  if(unit.dead)return [];
  return ['regeneration','slow','healingSuppression','poison'].filter(type=>type==='regeneration'?(effectOf(unit,type) && matchesEffectTarget(effectOf(unit,type),unit)):remainingEffect(unit,type)>0).map(type=>({kind:type,color:EFFECTS[type].color}));
}
