import { STAT_NAMES } from './effects.js';
import { restoreLegacyGems } from "./save-compat.js";
// Account-owned instances; all effects returned here are detached snapshots.
export const GEM_TYPES = [
  { id: 'income', name: '햇살', color: '#c3ad78', effect: 'goldIncome', base: .10, description: '초당 전투 골드' },
  { id: 'capacity', name: '주머니', color: '#91a7b0', effect: 'goldCapacity', base: .15, description: '전투 골드 최대량' },
  { id: 'harvest', name: '도토리', color: '#a68e72', effect: 'acorn', base: .15, description: '방치 도토리 수익' },
  { id: 'bounty', name: '발자국', color: '#a395b4', effect: 'killGold', base: .20, description: '적 처치 전투 골드' },
  { id: 'attack', name: '용기', color: '#c49172', effect: 'attack', base: .10, description: '모든 동료 공격력', legacy: true },
  { id: 'hp', name: '온기', color: '#90a877', effect: 'hp', base: .15, description: '모든 동료 체력', legacy: true },
  { id: 'gold', name: '풍요', color: '#b7a25d', effect: 'acorn', base: .15, description: '방치 도토리 수익', legacy: true },
];
export const GEM_BANNERS = [{ id: 'treasure', name: '숲의 보물', description: '햇살·주머니·도토리·발자국을 같은 확률로 만납니다.', types: ['income', 'capacity', 'harvest', 'bounty'] }];
export const GEM_OPTIONS = [
  { id: 'attack', name: STAT_NAMES.attack, min: .01, max: .03 },
  { id: 'hp', name: STAT_NAMES.hp, min: .01, max: .03 },
  { id: 'speed', name: STAT_NAMES.speed, min: .01, max: .03 },
  { id: 'wildAttack', name: '야생 상대 공격력', min: .05, max: .10 },
  { id: 'machineAttack', name: '기계 상대 공격력', min: .05, max: .10 },
  { id: 'spiritAttack', name: '정령 상대 공격력', min: .05, max: .10 },
  { id: 'shadowAttack', name: '그림자 상대 공격력', min: .05, max: .10 },
  { id: 'wildDefense', name: '야생 상대 유효 체력', min: .05, max: .10 },
  { id: 'goldIncome', name: '초당 전투 골드', min: .01, max: .03 },
  { id: 'acorn', name: '방치 도토리 수익', min: .01, max: .03 },
];
export const GEM_OPTION_LIMIT = 3;
export const GEM_OPTION_TIERS = [
  { id: 'normal', name: '일반', lines: 1, cost: 100, promotionChance: .10 },
  { id: 'rare', name: '레어', lines: 1, cost: 300, promotionChance: .07 },
  { id: 'epic', name: '에픽', lines: 2, cost: 1000, promotionChance: .04 },
  { id: 'unique', name: '유니크', lines: 3, cost: 3000, promotionChance: .02 },
  { id: 'legendary', name: '레전더리', lines: 3, cost: 10000, promotionChance: 0 },
];
export function gemOptionTier(item) {
  return GEM_OPTION_TIERS.find(t => t.id === item?.optionTier)
    ?? GEM_OPTION_TIERS[item?.options?.length >= 3 ? 3 : item?.options?.length === 2 ? 2 : 0];
}
export const gemRerollCost = item => gemDefinition(item?.type) && rank(item?.level) ? gemOptionTier(item).cost : null;
function checkedRoll(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('Invalid gem RNG');
  return value;
}
function rollOptions(lines, random) {
  return Array.from({ length: lines }, () => {
    const def = GEM_OPTIONS[Math.floor(checkedRoll(random) * GEM_OPTIONS.length)];
    const min = Math.round(def.min * 100), max = Math.round(def.max * 100);
    return { id: def.id, value: (min + Math.floor(checkedRoll(random) * (max - min + 1))) / 100 };
  });
}
const legacyTypes = ['attack', 'hp', 'gold'];
const safeUid = uid => typeof uid === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(uid);
const rank = level => Number.isInteger(level) && level >= 1 && level <= 10;
const count = value => Number.isFinite(value) ? Math.floor(Math.max(0, Math.min(1e6, value))) : 0;
const unlocked = a => a?.onboarding?.phase === 'complete' && a.highestCleared >= 11;
const affordable = (a, key, cost) => Number.isFinite(a[key]) && a[key] >= cost;
export const gemDefinition = type => GEM_TYPES.find(g => g.id === type) ?? null;
export const gemByUid = (a, uid) => typeof uid === 'string' ? a?.gemItems?.find(g => g.uid === uid) ?? null : null;
export function initialGemState() {
  return { gemItems: [], gemEquipment: {}, gemReserves: { attack: 0, hp: 0, gold: 0 }, nextGemUid: 1, gemWelcomeClaimed: false };
}
function nextUid(items, counter) {
  let next = Number.isSafeInteger(counter) && counter > 0 && counter < Number.MAX_SAFE_INTEGER ? counter : 1;
  const used = new Set(items.map(g => g.uid));
  while (used.has(`gem-${next}`)) next = next + 1 < Number.MAX_SAFE_INTEGER ? next + 1 : 1;
  return { uid: `gem-${next}`, next: next + 1 };
}
export function normalizeGemState(raw) {
  const state = initialGemState();
  if (!raw || typeof raw !== 'object') return state;
  state.nextGemUid = Number.isSafeInteger(raw.nextGemUid) && raw.nextGemUid > 0 && raw.nextGemUid < Number.MAX_SAFE_INTEGER ? raw.nextGemUid : 1;
  state.gemWelcomeClaimed = raw.gemWelcomeClaimed === true;
  if (restoreLegacyGems(raw, state, { count, nextUid })) return state;
  const items = Array.isArray(raw.gemItems) ? raw.gemItems : [];
  // Reserve original IDs before repairing duplicates so a repair cannot steal a later ID.
  const reserved = items.filter(g => g && safeUid(g.uid)).map(g => ({ uid: g.uid }));
  const originalIds = new Set(items.filter(g => g && gemDefinition(g.type) && safeUid(g.uid)).map(g => g.uid));
  const seen = new Set();
  for (const item of items) {
    if (!item || !gemDefinition(item.type)) continue;
    let uid = item.uid;
    if (!safeUid(uid) || seen.has(uid)) {
      const allocation = nextUid([...reserved, ...state.gemItems], state.nextGemUid);
      uid = allocation.uid;
      state.nextGemUid = allocation.next;
    }
    seen.add(uid);
    const level = Number.isFinite(item.level) ? Math.max(1, Math.min(10, Math.floor(item.level))) : 1;
    const options = [];
    for (const option of Array.isArray(item.options) ? item.options : []) {
      const def = GEM_OPTIONS.find(d => d.id === option?.id);
      if (!def || !Number.isFinite(option.value)) continue;
      options.push({ id: def.id, value: Math.max(def.min, Math.min(def.max, Math.round(option.value * 100) / 100)) });
      if (options.length === 3) break;
    }
    const tier = gemOptionTier({ ...item, options });
    state.gemItems.push({ uid, type: item.type, level, optionTier: tier.id, options: options.slice(0, tier.lines) });
  }
  for (const type of legacyTypes) state.gemReserves[type] = count(Number(raw.gemReserves?.[type]));
  // Equipment selects additional options only, once per kind and up to the limit.
  for (const def of GEM_TYPES) {
    const uid = raw.gemEquipment?.[def.id];
    const item = gemByUid(state, uid);
    if (Object.keys(state.gemEquipment).length < GEM_OPTION_LIMIT && originalIds.has(uid) && item?.type === def.id) state.gemEquipment[def.id] = uid;
  }
  state.nextGemUid = nextUid(state.gemItems, state.nextGemUid).next - 1;
  return state;
}
export function gemOptionText(option) {
  const def = GEM_OPTIONS.find(d => d.id === option?.id);
  return def && Number.isFinite(option.value) ? `${def.name} +${Number((option.value * 100).toFixed(2))}%` : '';
}
export function gemDescription(item) {
  const def = gemDefinition(item?.type);
  return def && rank(item.level) ? `${def.description} +${Number((def.base * (1 + .25 * (item.level - 1)) * 100).toFixed(2))}%` : '';
}
export function gemUpgradeCost(item) {
  return rank(item?.level) && item.level < 10 ? { copies: 2 ** (item.level - 1), gold: 300 * item.level ** 2 } : null;
}
export function drawGem(a, { payment = 'diamonds', free = false, random = Math.random, banner = 'treasure' } = {}) {
  const pool = GEM_BANNERS.find(b => b.id === banner);
  if (!unlocked(a) || !pool || !Array.isArray(a.gemItems) || !['tickets', 'diamonds'].includes(payment)) return null;
  const cost = payment === 'tickets' ? 5 : 30;
  if (free ? a.gemWelcomeClaimed : !affordable(a, payment, cost)) return null;
  let item, allocation;
  try {
    const type = free ? 'income' : pool.types[Math.floor(checkedRoll(random) * pool.types.length)];
    const options = rollOptions(1, random);
    allocation = nextUid(a.gemItems, a.nextGemUid);
    item = { uid: allocation.uid, type, level: 1, optionTier: 'normal', options };
  } catch { return null; }
  a.gemItems.push(item);
  a.nextGemUid = allocation.next;
  if (free) a.gemWelcomeClaimed = true;
  else a[payment] -= cost;
  if (a.gemGuide && typeof a.gemGuide === 'object') a.gemGuide.drawn = true;
  return item;
}
export const isGemEquipped = (a, uid) => {
  const item = gemByUid(a, uid);
  return !!item && a.gemEquipment?.[item.type] === uid;
};
export function gemUpgradeMaterials(a, uid) {
  const target = gemByUid(a, uid);
  return target ? a.gemItems.filter(g => g.uid !== uid && g.type === target.type && g.level === 1 && !isGemEquipped(a, g.uid)) : [];
}
export function upgradeGem(a, uid, materialUids = []) {
  const target = gemByUid(a, uid), cost = gemUpgradeCost(target);
  if (!unlocked(a) || !cost || !affordable(a, 'gold', cost.gold) || !Array.isArray(materialUids)) return false;
  const selected = new Set(materialUids), eligible = new Set(gemUpgradeMaterials(a, uid).map(g => g.uid));
  if (selected.size !== materialUids.length || selected.size > cost.copies || materialUids.some(id => !eligible.has(id))) return false;
  const gap = cost.copies - selected.size;
  const reserve = count(a.gemReserves?.[target.type]);
  if (reserve < gap) return false;
  a.gemItems = a.gemItems.filter(g => !selected.has(g.uid));
  if (gap) a.gemReserves[target.type] -= gap;
  a.gold -= cost.gold;
  target.level++;
  return true;
}
export function rerollGem(a, uid, { random = Math.random } = {}) {
  const item = gemByUid(a, uid), cost = gemRerollCost(item);
  if (!unlocked(a) || !item || !cost || !affordable(a, 'gold', cost)) return null;
  let tier = gemOptionTier(item), options;
  try {
    if (tier.promotionChance && checkedRoll(random) < tier.promotionChance) {
      tier = GEM_OPTION_TIERS[GEM_OPTION_TIERS.indexOf(tier) + 1];
    }
    options = rollOptions(tier.lines, random);
  } catch { return null; }
  a.gold -= cost;
  item.optionTier = tier.id;
  item.options = options;
  return item;
}
export function equippedGemItems(a) {
  return GEM_TYPES.map(def => {
    const item = gemByUid(a, a?.gemEquipment?.[def.id]);
    return item?.type === def.id && rank(item.level) ? item : null;
  }).filter(Boolean).slice(0, GEM_OPTION_LIMIT);
}
export function ownedGemBasics(a) {
  return GEM_TYPES.map(def => (a?.gemItems ?? []).filter(item => item.type === def.id && rank(item.level))
    .reduce((best, item) => !best || item.level > best.level ? item : best, null)).filter(Boolean);
}
export function equipGem(a, uid, replaceType = null) {
  const item = gemByUid(a, uid);
  if (!unlocked(a) || !item || !gemDefinition(item.type) || !rank(item.level) || !a.gemEquipment) return false;
  const equipped = equippedGemItems(a);
  if (replaceType !== null && !equipped.some(g => g.type === replaceType)) return false;
  const next = Object.fromEntries(equipped.map(g => [g.type, g.uid]));
  if (replaceType !== null && replaceType !== item.type) delete next[replaceType];
  if (!next[item.type] && Object.keys(next).length >= GEM_OPTION_LIMIT) return false;
  next[item.type] = uid;
  a.gemEquipment = next;
  if (a.gemGuide && typeof a.gemGuide === 'object') a.gemGuide.equipped = true;
  return true;
}
export function unequipGem(a, type) {
  if (!unlocked(a) || !gemDefinition(type) || !a.gemEquipment?.[type]) return false;
  delete a.gemEquipment[type];
  return true;
}
export function gemEffects(a) {
  const effects = { attack: 1, hp: 1, speed: 1, goldIncome: 1, goldCapacity: 1, killGold: 1, acorn: 1, attributeBonuses: Object.fromEntries(['wild', 'machine', 'spirit', 'shadow'].map(id => [id, { attack: 0, effectiveHp: 0 }])) };
  for (const item of ownedGemBasics(a)) {
    const def = gemDefinition(item.type);
    effects[def.effect] += def.base * (1 + .25 * (item.level - 1));
  }
  for (const item of equippedGemItems(a)) {
    for (const option of (item.options ?? []).slice(0, gemOptionTier(item).lines)) {
      const optionDef = GEM_OPTIONS.find(d => d.id === option?.id);
      if (!optionDef || !Number.isFinite(option.value) || option.value < optionDef.min || option.value > optionDef.max) continue;
      if (option.id.endsWith('Attack')) effects.attributeBonuses[option.id.slice(0, -6)].attack += option.value;
      else if (option.id === 'wildDefense') effects.attributeBonuses.wild.effectiveHp += option.value;
      else effects[option.id] += option.value;
    }
  }
  return effects;
}
