// Shared vocabulary and numeric contracts. Character data owns tuning values.
const number = value => Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
const percent = value => `${number(value * 100)}%`;
const amountText = spec => [spec.amount ? number(spec.amount) : '', spec.hpRatio ? `최대 체력의 ${percent(spec.hpRatio)}` : ''].filter(Boolean).join(' + ');
export const MIN_EFFECT_INTERVAL = 1/30;
// Identity belongs to the granting system, never the caster UID or team.
export const BATTLE_ORIGIN = 'battle';
export function effectOrigin(category, id, option) {
  if (category === BATTLE_ORIGIN) return BATTLE_ORIGIN;
  if (!['gem', 'ability', 'upgrade'].includes(category) || typeof id !== 'string' || !id.trim()) throw new TypeError('Invalid effect origin');
  if (category === 'gem' && (typeof option !== 'string' || !option.trim())) throw new TypeError('Gem option origin required');
  return JSON.stringify(category === 'gem' ? [category, id, option] : [category, id]);
}
export function effectKind(spec) {
  if (spec.type !== 'stat') return spec.type;
  const directions=[Math.sign((spec.multiplier??1)-1),Math.sign(spec.flat??0)].filter(Boolean);
  const direction=directions.every(value=>value>=0) ? 'increase' : directions.every(value=>value<=0) ? 'decrease' : 'mixed';
  return `stat:${spec.stat}:${direction}`;
}
export const effectKey = (origin, spec) => JSON.stringify([origin, effectKind(spec)]);
export const STAT_KEYS = Object.freeze(['hp','attack','speed','range','attackInterval']);
export const STAT_MINIMUMS = Object.freeze({ hp: 1, attack: 1, speed: 0, range: 0, attackInterval: .2 });
export const STAT_NAMES = Object.freeze({ hp: '체력', attack: '공격력', speed: '이동속도', range: '사거리', attackInterval: '공격 간격' });
const catalog = {
  slow: { trigger: 'hit', name: '둔화', color: '#78a9b7', fields: ['factor', 'duration'], describe: e => `이동속도 ${percent(1-e.factor)} 감소 · ${number(e.duration)}초` },
  healingSuppression: { trigger: 'hit', name: '회복 억제', color: '#bb8b81', fields: ['factor', 'duration'], describe: e => `${e.scope === "regeneration" ? "재생 " : ""}회복량 ${percent(1-e.factor)} 감소 · ${number(e.duration)}초` },
  healing: { name: '회복', fields: ['amount', 'hpRatio', 'range'], describe: e => `회복량 ${amountText(e)} · 범위 ${number(e.range)}` },
  regeneration: { name: '재생', color: '#8da574', fields: ['amount', 'hpRatio', 'interval'], describe: e => `${number(e.interval)}초마다 ${amountText(e)} 회복` },
  shield: { name: '방어막', fields: ['amount', 'hpRatio'], describe: e => `${amountText(e)} 흡수` },
  poison: { trigger: 'hit', requiresHpDamage: true, name: '중독', color: '#7b9a45', fields: ['ratio', 'duration', 'interval'], describe: e => `${number(e.duration)}초간 ${number(e.interval)}초마다 공격력 ${percent(e.ratio)} 피해` },
  immunity: { name: '면역', fields: [], describe: e => `${catalog[e.effect]?.name ?? e.effect} 면역` },
  shieldDamageAura: { name: '방어막 공격 지원', fields: ['bonus', 'range'], describe: e => `방어막 추가 피해 +${percent(e.bonus)} · 범위 ${number(e.range)}` },
  areaAttack: { name: '범위 공격', fields: ['radius'], describe: e => `범위 ${number(e.radius)}` },
  castleDamage: { name: '성 추가 피해', fields: ['bonus'], describe: e => `+${percent(e.bonus)}` },
  shieldDamage: { name: '방어막 추가 피해', fields: ['bonus'], describe: e => `+${percent(e.bonus)}` },
  knockback: { trigger: 'hit', name: '밀어내기', fields: ['distance'], describe: e => `거리 ${number(e.distance)}` },
  hitStun: { trigger: 'hit', name: '경직', fields: ['duration'], describe: e => `${number(e.duration)}초` },
  stat: { trigger: 'hit', name: '능력치 변화', fields: ['multiplier', 'flat', 'duration'], describe: e => `${STAT_NAMES[e.stat]} ${[e.flat ? `${e.flat>0?'+':''}${number(e.flat)}` : '', e.multiplier!==1 ? `${number(e.multiplier)}배` : ''].filter(Boolean).join(' · ') || '변화 없음'} · ${number(e.duration)}초` },
};
for (const definition of Object.values(catalog)) { Object.freeze(definition.fields); Object.freeze(definition); }
export const EFFECTS = Object.freeze(catalog);

export function effect(type, values = {}) {
  const definition = EFFECTS[type];
  if (!definition) throw new TypeError(`Unknown effect: ${type}`);
  const result = { ...values, type };
  if (result.origin != null && (typeof result.origin !== 'string' || !result.origin.trim())) throw new TypeError('Invalid effect origin');
  for (const field of definition.fields) {
    if (result[field] == null) continue;
    if (!Number.isFinite(result[field]) || (field !== 'flat' && result[field] < 0)) throw new TypeError(`Invalid ${type}.${field}`);
  }
  if (['slow','healingSuppression'].includes(type) && (!Number.isFinite(result.factor) || result.factor>1 || !(result.duration>0))) throw new TypeError(`Invalid ${type}`);
  if (['poison','regeneration'].includes(type) && !(result.interval>0)) throw new TypeError(`Invalid ${type}.interval`);
  if (type==='poison' && (!(result.duration>0) || !Number.isFinite(result.ratio))) throw new TypeError('Invalid poison');
  if (['healing','regeneration','shield'].includes(type) && !((result.amount??0)>0 || (result.hpRatio??0)>0)) throw new TypeError(`Invalid ${type} amount`);
  if (type==='immunity' && !EFFECTS[result.effect]) throw new TypeError('Invalid immunity');
  if (type==='healingSuppression' && result.scope!=null && !['all','regeneration'].includes(result.scope)) throw new TypeError('Invalid healing scope');
  if (type==='healing' && !Number.isFinite(result.range)) throw new TypeError('Invalid healing range');
  if (['areaAttack','knockback','castleDamage','shieldDamage','shieldDamageAura','hitStun'].includes(type) && definition.fields.some(field=>!Number.isFinite(result[field]))) throw new TypeError(`Invalid ${type}`);
  if (type==='stat') {
    result.multiplier ??= 1;
    result.flat ??= 0;
    if (!STAT_NAMES[result.stat] || result.stat==='hp' || !(result.duration>0)) throw new TypeError('Invalid stat effect');
  }
  if (['poison','regeneration'].includes(type)) result.interval = Math.max(MIN_EFFECT_INTERVAL, result.interval);
  return result;
}
export function normalizeEffects(effects = {}) {
  return Object.fromEntries(Object.entries(effects).map(([type, spec]) => [type, spec === false || spec == null ? false : effect(type, spec)]));
}
export function effectText(spec) {
  if (!spec) return '';
  const definition = EFFECTS[spec.type];
  if (!definition) return '';
  return spec.type==='immunity' ? definition.describe(spec) : `${definition.name} · ${definition.describe(spec)}`;
}
export const effectLines = character => Object.values(character?.effects ?? {}).filter(Boolean).map(effectText).filter(Boolean);
export const effectOf = (character, type) => character?.effects?.[type] || null;
export const EFFECT_OVERRIDE_KEYS = Object.freeze(['attribute', 'effects', 'statMultipliers']);

// Declarative upgrades share the same numeric changes with their descriptions.
export function applyChanges(character, changes, rank = 1) {
  for (const change of changes ?? []) {
    if (change.op==='effect') { character.effects ??= {}; character.effects[change.value.type] = effect(change.value.type, structuredClone(change.value)); continue; }
    if (change.op==='specialty') { character.specialties=[...new Set([...(character.specialties??[]),change.attribute])]; continue; }
    if (change.op==='counter') { character.specialtyUpgradeBonus ??= {}; for(const kind of change.kinds) character.specialtyUpgradeBonus[kind]=(character.specialtyUpgradeBonus[kind]??0)+change.amount*rank; continue; }
    const path = change.path.split('.');
    let owner = character;
    for(const key of path.slice(0,-1)) owner = owner[key] ??= {};
    const key = path.at(-1), amount=change.amount*rank;
    if(change.op==='add') owner[key]=(owner[key]??0)+amount;
    else if(change.op==='multiply') owner[key]*=1+amount;
    else throw new TypeError(`Unknown upgrade operation: ${change.op}`);
    if(change.min!=null) owner[key]=Math.max(change.min,owner[key]);
  }
  return character;
}
export function changeText(change, rank=1) {
  if(change.op==='effect')return effectText(change.value);
  if(change.op==='specialty')return '';
  if(change.op==='counter')return `유효 속성 보너스 +${number(change.amount*rank*100)}%p`;
  const [root,type,field]=change.path.split('.');
  const label=root==='effects' ? `${EFFECTS[type].name} ${({duration:'지속시간',radius:'범위',bonus:'',amount:'회복량',hpRatio:'흡수량'})[field]??field}`.trim() : STAT_NAMES[root];
  const value=change.amount*rank;
  return `${label} ${value>=0?'+':'−'}${change.op==='multiply' || field==='bonus' || field==='hpRatio' ? percent(Math.abs(value)) : number(Math.abs(value))}${root==='attackInterval'||field==='duration'?'초':''}`;
}
export const changesText = (changes,rank=1) => (changes??[]).map(change=>changeText(change,rank)).filter(Boolean).join(' · ');
