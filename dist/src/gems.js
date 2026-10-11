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
  { id: 'attack', name: '공격력', min: .01, max: .03 },
  { id: 'hp', name: '체력', min: .01, max: .03 },
  { id: 'speed', name: '이동속도', min: .01, max: .03 },
  { id: 'wildAttack', name: '야생 상대 공격력', min: .05, max: .10 },
  { id: 'machineAttack', name: '기계 상대 공격력', min: .05, max: .10 },
  { id: 'spiritAttack', name: '정령 상대 공격력', min: .05, max: .10 },
  { id: 'shadowAttack', name: '그림자 상대 공격력', min: .05, max: .10 },
  { id: 'wildDefense', name: '야생 상대 유효 체력', min: .05, max: .10 },
  { id: 'goldIncome', name: '초당 전투 골드', min: .01, max: .03 },
  { id: 'acorn', name: '방치 도토리 수익', min: .01, max: .03 },
];
const legacyTypes = ['attack', 'hp', 'gold'];
const safeUid = uid => typeof uid === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(uid);
const rank = level => Number.isInteger(level) && level >= 1 && level <= 10;
const count = value => Number.isFinite(value) ? Math.floor(Math.max(0, Math.min(1e6, value))) : 0;
const unlocked = a => a?.onboarding?.phase === 'complete' && a.highestCleared >= 11;
const index = (value, limit) => Number.isInteger(value) && value >= 0 && value < limit;
const affordable = (a, key, cost) => Number.isFinite(a[key]) && a[key] >= cost;
export const gemDefinition = type => GEM_TYPES.find(g => g.id === type) ?? null;
export const gemByUid = (a, uid) => typeof uid === 'string' ? a?.gemItems?.find(g => g.uid === uid) ?? null : null;
export function initialGemState() {
  return { gemItems: [], gemPresets: Array.from({ length: 10 }, () => Array(3).fill(null)), gemReserves: { attack: 0, hp: 0, gold: 0 }, nextGemUid: 1, gemWelcomeClaimed: false };
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
  if (!Object.hasOwn(raw, 'gemItems')) {
    for (const type of legacyTypes) {
      const owned = count(Number(raw.gems?.[type]));
      if (!owned) continue;
      const allocation = nextUid(state.gemItems, state.nextGemUid);
      state.nextGemUid = allocation.next;
      state.gemItems.push({ uid: allocation.uid, type, level: 1, options: [] });
      state.gemReserves[type] = owned - 1;
      if (raw.equippedGem === type) state.gemPresets[0][0] = allocation.uid;
    }
    return state;
  }
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
    state.gemItems.push({ uid, type: item.type, level, options });
  }
  for (const type of legacyTypes) state.gemReserves[type] = count(Number(raw.gemReserves?.[type]));
  state.gemPresets = state.gemPresets.map((slots, p) => {
    const used = new Set();
    return slots.map((_, s) => {
      const uid = raw.gemPresets?.[p]?.[s];
      if (!originalIds.has(uid) || !seen.has(uid) || used.has(uid)) return null;
      used.add(uid);
      return uid;
    });
  });
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
export const gemTransferCost = source => rank(source?.level) ? 500 * source.level : null;
export function drawGem(a, { payment = 'diamonds', free = false, random = Math.random, banner = 'treasure' } = {}) {
  const pool = GEM_BANNERS.find(b => b.id === banner);
  if (!unlocked(a) || !pool || !Array.isArray(a.gemItems) || !['tickets', 'diamonds'].includes(payment)) return null;
  const cost = payment === 'tickets' ? 5 : 30;
  if (free ? a.gemWelcomeClaimed : !affordable(a, payment, cost)) return null;
  let item, allocation;
  try {
    const roll = () => {
      const value = random();
      if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('Invalid gem RNG');
      return value;
    };
    const type = free ? 'income' : pool.types[Math.floor(roll() * pool.types.length)];
    const options = [];
    const lines = 1 + Math.floor(roll() * 3);
    for (let i = 0; i < lines; i++) {
      const def = GEM_OPTIONS[Math.floor(roll() * GEM_OPTIONS.length)];
      const min = Math.round(def.min * 100), max = Math.round(def.max * 100);
      options.push({ id: def.id, value: (min + Math.floor(roll() * (max - min + 1))) / 100 });
    }
    allocation = nextUid(a.gemItems, a.nextGemUid);
    item = { uid: allocation.uid, type, level: 1, options };
  } catch { return null; }
  a.gemItems.push(item);
  a.nextGemUid = allocation.next;
  if (free) a.gemWelcomeClaimed = true;
  else a[payment] -= cost;
  if (a.gemGuide && typeof a.gemGuide === 'object') a.gemGuide.drawn = true;
  return item;
}
const equipped = (a, uid) => a.gemPresets?.some(slots => slots.includes(uid));
export function gemUpgradeMaterials(a, uid) {
  const target = gemByUid(a, uid);
  return target ? a.gemItems.filter(g => g.uid !== uid && g.type === target.type && g.level === 1 && !equipped(a, g.uid)) : [];
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
export function transferGem(a, sourceUid, targetUid) {
  const source = gemByUid(a, sourceUid), target = gemByUid(a, targetUid);
  if (!unlocked(a) || !source || !target || sourceUid === targetUid || !rank(source.level) || !rank(target.level) || source.level < 2 || source.level <= target.level || !affordable(a, 'gold', gemTransferCost(source))) return false;
  a.gold -= gemTransferCost(source);
  target.level = source.level;
  a.gemItems = a.gemItems.filter(g => g.uid !== sourceUid);
  a.gemPresets = a.gemPresets.map(slots => slots.map(uid => uid === sourceUid ? null : uid));
  return true;
}
export function equipGem(a, presetIndex, slotIndex, uid) {
  if (!unlocked(a) || !index(presetIndex, 10) || !index(slotIndex, 3) || !a.gemPresets?.[presetIndex]) return false;
  const slots = a.gemPresets[presetIndex];
  if (uid !== null && (!gemByUid(a, uid) || slots.some((other, i) => i !== slotIndex && other === uid))) return false;
  slots[slotIndex] = uid;
  if (uid !== null && a.gemGuide && typeof a.gemGuide === 'object') a.gemGuide.equipped = true;
  return true;
}
export function gemEffects(a, presetIndex = 0) {
  const effects = { attack: 1, hp: 1, speed: 1, goldIncome: 1, goldCapacity: 1, killGold: 1, acorn: 1, attributeBonuses: Object.fromEntries(['wild', 'machine', 'spirit', 'shadow'].map(id => [id, { attack: 0, effectiveHp: 0 }])) };
  if (!index(presetIndex, 10)) return effects;
  const seen = new Set();
  for (const uid of a?.gemPresets?.[presetIndex] ?? []) {
    if (seen.has(uid)) continue;
    seen.add(uid);
    const item = gemByUid(a, uid), def = gemDefinition(item?.type);
    if (!def || !rank(item.level)) continue;
    effects[def.effect] += def.base * (1 + .25 * (item.level - 1));
    for (const option of item.options ?? []) {
      const optionDef = GEM_OPTIONS.find(d => d.id === option?.id);
      if (!optionDef || !Number.isFinite(option.value) || option.value < optionDef.min || option.value > optionDef.max) continue;
      if (option.id.endsWith('Attack')) effects.attributeBonuses[option.id.slice(0, -6)].attack += option.value;
      else if (option.id === 'wildDefense') effects.attributeBonuses.wild.effectiveHp += option.value;
      else effects[option.id] += option.value;
    }
  }
  return effects;
}
