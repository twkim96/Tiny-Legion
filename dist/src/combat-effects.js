import { EFFECTS, effect, effectOf, STAT_MINIMUMS, MIN_EFFECT_INTERVAL } from './effects.js';
import { specializationBonus } from './combat-rules.js';

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const nonnegative = value => Math.max(0, finite(value));
const EPSILON = 1e-9;
export const CANNON = Object.freeze({ damage: 110, knockback: Object.freeze(effect('knockback', { distance: 75 })) });
export const COMBAT_TIMING = Object.freeze({ step: MIN_EFFECT_INTERVAL, hitFlash: .18, hitStun: .18, heavyHitStun: .24, heavyHitRatio: .2, stunCooldown: .65, death: .32 });
export const activeEffects = (unit, type) => Object.values(unit?.statusEffects ?? {}).filter(status => status.type === type && status.remaining > 0);
export const remainingEffect = (unit, type) => Math.max(0, ...activeEffects(unit, type).map(status => status.remaining));
export const isImmune = (unit,type) => effectOf(unit,'immunity')?.effect===type;
export const effectFactor = (unit, type, scope = 'all') => Math.min(1, ...activeEffects(unit, type).filter(status => scope === 'regeneration' || status.scope !== 'regeneration').map(status => status.factor));
export const healingAmount = (unit,spec) => nonnegative(spec?.amount) + nonnegative(unit?.maxHp)*nonnegative(spec?.hpRatio);

export function initializeEffects(unit, definition) {
  unit.effects=structuredClone(definition.effects ?? {});
  unit.statusEffects={};
  unit.periodicTimers={};
  const shield=healingAmount(unit,effectOf(unit,'shield'));
  unit.shield=unit.maxShield=Math.round(shield);
  const regeneration=effectOf(unit,'regeneration');
  if(regeneration)unit.periodicTimers.regeneration=regeneration.interval;
  return unit;
}

// A single application API for either team. Strongest control/poison refreshes;
// independently named stat modifiers coexist and refresh only their own ID.
export function applyEffect(unit, spec, context = {}) {
  if(!unit || unit.dead || !spec)return false;
  try { spec=effect(spec.type,spec); } catch { return false; }
  if(isImmune(unit,spec.type))return false;
  unit.statusEffects ??= {};
  if(['slow','healingSuppression'].includes(spec.type)) {
    const durationMultiplier = context.durationMultiplier ?? 1;
    if (!Number.isFinite(durationMultiplier) || durationMultiplier <= 0) return false;
    const key = spec.type === 'healingSuppression' && spec.scope === 'regeneration' ? 'healingSuppression:regeneration' : spec.type;
    const previous=unit.statusEffects[key];
    unit.statusEffects[key]={ ...spec, factor:Math.min(previous?.remaining>0?previous.factor:1,spec.factor), remaining:Math.max(previous?.remaining??0,spec.duration*durationMultiplier) };
  } else if(spec.type==='poison') {
    const previous=unit.statusEffects.poison;
    const damage=nonnegative(context.damage)*spec.ratio;
    const strongest=!previous || damage>=previous.damage;
    const source=structuredClone(context.source??{});
    if(source.effects) for (const [type, entry] of Object.entries(source.effects)) {
      if (EFFECTS[entry?.type]?.trigger === 'hit') delete source.effects[type];
    }
    unit.statusEffects.poison={...spec,remaining:Math.max(previous?.remaining??0,spec.duration),tickRemaining:previous?.tickRemaining??spec.interval,interval:strongest?spec.interval:previous.interval,damage:Math.max(previous?.damage??0,damage),direction:strongest?context.direction:previous.direction,source:strongest?source:previous.source};
  } else if(spec.type==='stat') {
    if(typeof spec.id!=='string' || !spec.id || !Number.isFinite(spec.multiplier??1) || (spec.multiplier??1)<0 || !Number.isFinite(spec.flat??0))return false;
    unit.statusEffects[`stat:${spec.id}`]={...spec,multiplier:spec.multiplier??1,flat:spec.flat??0,remaining:spec.duration};
  } else if(spec.type==='healing') {
    return healUnit(unit,spec)>0;
  } else if(spec.type==='shield') {
    const amount=Math.round(healingAmount(unit,spec));
    unit.shield=Math.max(unit.shield??0,amount);
    unit.maxShield=Math.max(unit.maxShield??0,unit.shield);
  } else if(spec.type==='knockback') {
    if(!Number.isFinite(unit.x) || !Number.isFinite(context.direction))return false;
    unit.x=Math.max(context.minX??0,Math.min(context.maxX??1200,unit.x+Math.sign(context.direction)*spec.distance));
  } else if(spec.type==='hitStun') {
    unit.hitStunDuration=Math.max(unit.hitStun??0,spec.duration);
    unit.hitStun=unit.hitStunDuration;
    unit.moving=false;
  } else if (['regeneration','immunity','shieldDamageAura','areaAttack','castleDamage','shieldDamage'].includes(spec.type)) {
    unit.effects ??= {};
    unit.effects[spec.type] = structuredClone(spec);
    if (spec.type === 'regeneration') {
      unit.periodicTimers ??= {};
      unit.periodicTimers.regeneration = spec.interval;
    }
  } else return false;
  return true;
}
export function advanceEffects(unit,dt) {
  if(!Number.isFinite(dt) || !(dt>0))return;
  for(const [key,status] of Object.entries(unit.statusEffects??{})) {
    if(status.type==='poison')continue; // periodic damage owns its exact final tick
    status.remaining=Math.max(0,status.remaining-dt);
    if(status.remaining<=EPSILON)delete unit.statusEffects[key];
  }
}
export function combatStat(unit,stat) {
  let value=finite(unit?.[stat]);
  const statuses=Object.values(unit?.statusEffects??{}).filter(e=>e.type==='stat' && e.stat===stat && e.remaining>0);
  value+=statuses.reduce((sum,e)=>sum+e.flat,0);
  for(const status of statuses)value*=status.multiplier;
  if(stat==='speed')value*=effectFactor(unit,'slow');
  return Math.max(stat==='hp'?1:stat==='attack'?0:STAT_MINIMUMS[stat]??0,value);
}
export const regenerationFactor = unit => effectFactor(unit, 'healingSuppression', 'regeneration');
export const healingFactor = (unit, spec) => effectFactor(unit, 'healingSuppression', spec?.type === 'regeneration' ? 'regeneration' : 'all');
export function queueHealing(batch,unit,spec) {
  if(!unit || unit.dead)return;
  const amount=healingAmount(unit,spec)*healingFactor(unit,spec);
  batch.healing.set(unit.uid,(batch.healing.get(unit.uid)??0)+amount);
}
export function healUnit(unit,spec) {
  if(!unit || unit.dead)return 0;
  const before=unit.hp;
  unit.hp=Math.min(unit.maxHp,unit.hp+healingAmount(unit,spec)*healingFactor(unit,spec));
  return unit.hp-before;
}
export function tickPeriodicEffects(unit,dt,{heal,damage}) {
  if(unit.dead || !Number.isFinite(dt) || !(dt>0))return;
  const poison=unit.statusEffects?.poison;
  if(poison && isImmune(unit,'poison'))delete unit.statusEffects.poison;
  else if(poison) {
    const active=Math.min(dt,poison.remaining);
    poison.remaining=Math.max(0,poison.remaining-active);
    poison.tickRemaining-=active;
    while(poison.tickRemaining<=EPSILON) { damage(poison.damage,poison.direction,poison.source); poison.tickRemaining+=poison.interval; }
    if(poison.remaining<=EPSILON)delete unit.statusEffects.poison;
  }
  const regeneration=effectOf(unit,'regeneration');
  if(regeneration) {
    unit.periodicTimers ??= {};
    let timer=(unit.periodicTimers.regeneration??regeneration.interval)-dt;
    while(timer<=EPSILON) { heal(regeneration); timer+=regeneration.interval; }
    unit.periodicTimers.regeneration=timer;
  }
}
export function applyHitEffects(target,source,{hpDamage,damage,direction}) {
  const durationMultiplier=1+specializationBonus(source,target,'duration');
  for (const spec of Object.values(source?.effects ?? {})) {
    const contract = EFFECTS[spec?.type];
    if (contract?.trigger === 'hit' && (!contract.requiresHpDamage || hpDamage > 0)) applyEffect(target,spec,{source,damage,direction,durationMultiplier});
  }
}
export function auraBonus(source,units,type) {
  return Math.max(0,...units.filter(u=>u.team===source.team && !u.dead).map(u=>{
    const aura=effectOf(u,type);
    return aura && Math.abs(u.x-source.x)<=aura.range ? aura.bonus : 0;
  }));
}
export function attackSource(unit,units) {
  return {team:unit.team,role:unit.role,attribute:unit.attribute,specialties:[...(unit.specialties??[])],attributeBonuses:structuredClone(unit.attributeBonuses),specialtyUpgradeBonus:structuredClone(unit.specialtyUpgradeBonus),gemAttributeBonuses:structuredClone(unit.gemAttributeBonuses),effects:{...structuredClone(unit.effects??{}),shieldDamage:effect('shieldDamage',{bonus:(effectOf(unit,'shieldDamage')?.bonus??0)+auraBonus(unit,units,'shieldDamageAura')})}};
}
export function supportTarget(source,units,spec) {
  if(!spec)return null;
  return units.filter(u=>u.team===source.team && !u.dead && u.hp<u.maxHp && Math.abs(u.x-source.x)<=spec.range).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp || Math.abs(a.x-source.x)-Math.abs(b.x-source.x) || a.uid.localeCompare(b.uid))[0]??null;
}
export function statusMarks(unit) {
  if(unit.dead)return [];
  return ['regeneration','slow','healingSuppression','poison'].filter(type=>type==='regeneration'?effectOf(unit,type):remainingEffect(unit,type)>0).map(type=>({kind:type,color:EFFECTS[type].color}));
}
