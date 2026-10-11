import { UNITS, STAGES, RARITIES, STARTER_UNIT_IDS, bannerById, bannerPool, bannerRarities } from "./data.js";
import { UNIT_LEVEL_GROWTH } from "./engine.js";
export const SAVE_KEY = "tiny-legion.save.v1";
const ONBOARDING_PHASES = new Set([
  "intro",
  "first-battle",
  "recruit",
  "retry-battle",
  "idle-guide",
  "complete",
]);
export const GEMS = [
  {
    id: "attack",
    name: "용기",
    description: "모든 동료의 공격력이 10% 증가합니다.",
    color: "#c49172",
  },
  {
    id: "hp",
    name: "온기",
    description: "모든 동료의 체력이 15% 증가합니다.",
    color: "#90a877",
  },
  {
    id: "gold",
    name: "풍요",
    description: "새로 기록하는 방치 도토리 수익이 15% 증가합니다.",
    color: "#b7a25d",
  },
];
const cap = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
export function dailyKey(now = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}
export function newAccount(now = Date.now()) {
  return {
    version: 1,
    gold: 600,
    diamonds: 60,
    tickets: 0,
    levels: Object.fromEntries(UNITS.map((u) => [u.id, 1])),
    fragments: Object.fromEntries(UNITS.map((u) => [u.id, 0])),
    special: Object.fromEntries(UNITS.map((u) => [u.id, 0])),
    owned: Object.fromEntries(UNITS.map((u) => [u.id, u.id === "sheep"])),
    recruitment: {
      total: 0,
      sinceRare: 0,
      sinceEpic: 0,
      welcomeClaimed: false,
    },
    sequence: ["sheep", ...Array(9).fill(null)],
    onboarding: { phase: "intro" },
    highestCleared: 0,
    records: {},
    idleStage: 1,
    lastSettled: now,
    gems: { attack: 0, hp: 0, gold: 0 },
    equippedGem: null,
    daily: { key: dailyKey(now), best: null, practice: null, claimed: false },
    settings: { sound: false, speed: 1 },
    challengeRewards: [],
  };
}
export function normalizeAccount(raw, now = Date.now()) {
  const a = newAccount(now);
  if (!raw || raw.version !== 1) return a;
  const hasOnboarding = Object.hasOwn(raw, "onboarding");
  const rawPhase = raw.onboarding?.phase;
  a.onboarding = {
    phase: ONBOARDING_PHASES.has(rawPhase) ? rawPhase : hasOnboarding ? "intro" : "complete",
  };
  for (const k of ["gold", "diamonds", "tickets"]) a[k] = cap(raw[k], 0, 1e12);
  for (const u of UNITS) {
    a.owned[u.id] =
      u.id === "sheep" ||
      (!hasOnboarding && STARTER_UNIT_IDS.includes(u.id)) ||
      raw.owned?.[u.id] === true;
    a.levels[u.id] = Math.floor(cap(raw.levels?.[u.id] ?? 1, 1, 100));
    a.fragments[u.id] = Math.floor(cap(raw.fragments?.[u.id], 0, 1e6));
    a.special[u.id] = Math.floor(cap(raw.special?.[u.id], 0, 20));
  }
  const sequence = Array.isArray(raw.sequence)
    ? raw.sequence.slice(0, 10).map((id) => ownsUnit(a, id) ? id : null)
    : hasOnboarding ? ["sheep"] : [...STARTER_UNIT_IDS];
  if (!sequence.some((id) => ownsUnit(a, id))) sequence[0] = "sheep";
  a.sequence = [...sequence, ...Array(10).fill(null)].slice(0, 10);
  if (a.onboarding.phase === "recruit" && ownsUnit(a, "squirrel")) {
    a.onboarding.phase = "retry-battle";
    a.sequence = ["sheep", "squirrel", ...Array(8).fill(null)];
  } else if (
    ["retry-battle", "idle-guide"].includes(a.onboarding.phase) &&
    !ownsUnit(a, "squirrel")
  ) {
    a.onboarding.phase = "recruit";
  }
  a.recruitment = {
    total: Math.floor(cap(raw.recruitment?.total, 0, 1e9)),
    sinceRare: Math.floor(cap(raw.recruitment?.sinceRare, 0, 9)),
    sinceEpic: Math.floor(cap(raw.recruitment?.sinceEpic, 0, 49)),
    welcomeClaimed: raw.recruitment?.welcomeClaimed === true,
  };
  a.highestCleared = Math.floor(cap(raw.highestCleared, 0, STAGES.length));
  a.idleStage = Math.floor(
    cap(raw.idleStage ?? 1, 1, Math.min(STAGES.length, a.highestCleared + 1)),
  );
  for (const s of STAGES) {
    const r = raw.records?.[s.id];
    if (
      r &&
      Number.isFinite(r.gold) &&
      r.gold >= 0 &&
      r.gold <= s.baseReward * 2 &&
      Number.isFinite(r.diamonds) &&
      r.diamonds >= 0 &&
      r.diamonds <= 2
    ) {
      a.records[s.id] = { ...r, gold: r.gold, diamonds: r.diamonds };
    }
  }
  for (const g of GEMS)
    a.gems[g.id] = Math.floor(cap(raw.gems?.[g.id], 0, 1e6));
  a.equippedGem =
    GEMS.some((g) => g.id === raw.equippedGem) && a.gems[raw.equippedGem] > 0
      ? raw.equippedGem
      : null;
  a.lastSettled = cap(raw.lastSettled ?? now, 0, now);
  if (raw.daily?.key === a.daily.key) {
    a.daily.best =
      Number.isFinite(raw.daily.best) && raw.daily.best > 0
        ? raw.daily.best
        : null;
    a.daily.practice =
      Number.isFinite(raw.daily.practice) && raw.daily.practice > 0
        ? raw.daily.practice
        : null;
    a.daily.claimed = raw.daily.claimed === true;
  }
  a.settings.sound = raw.settings?.sound === true;
  a.settings.speed = [1, 2].includes(raw.settings?.speed)
    ? raw.settings.speed
    : 1;
  a.challengeRewards = Array.isArray(raw.challengeRewards)
    ? [
        ...new Set(
          raw.challengeRewards.filter(
            (id) => Number.isInteger(id) && id >= 1 && id <= a.highestCleared,
          ),
        ),
      ]
    : [];
  return a;
}
export function levelCost(level) {
  return Math.floor(60 + level * 25 + level * level * 5);
}
export function accrue(a, now = Date.now()) {
  const seconds = cap((now - a.lastSettled) / 1000, 0, 8 * 3600),
    r = a.records[a.idleStage];
  let gold = 0,
    diamonds = 0;
  if (r) {
    gold = (r.gold * seconds) / 120;
    diamonds = (r.diamonds * seconds) / 120;
    a.gold += gold;
    a.diamonds += diamonds;
  }
  a.lastSettled = Math.max(a.lastSettled, now);
  if (a.daily.key !== dailyKey(now))
    a.daily = {
      key: dailyKey(now),
      best: null,
      practice: null,
      claimed: false,
    };
  return { gold, diamonds, seconds };
}
export function growUnit(a, id) {
  if (isOnboarding(a)) return false;
  if (!ownsUnit(a, id) || a.levels[id] >= 100) return false;
  const cost = levelCost(a.levels[id]);
  if (a.gold < cost) return false;
  a.gold -= cost;
  a.levels[id]++;
  return true;
}
export function enhanceUnit(a, id) {
  if (isOnboarding(a)) return false;
  if (!ownsUnit(a, id) || (a.fragments[id] ?? 0) < 3 || a.special[id] >= 20)
    return false;
  a.fragments[id] -= 3;
  a.special[id]++;
  return true;
}
export function refundLevels(a, now = Date.now()) {
  if (isOnboarding(a)) return 0;
  accrue(a, now);
  let refunded = 0;
  for (const u of UNITS) {
    for (let l = 1; l < a.levels[u.id]; l++) refunded += levelCost(l);
    a.levels[u.id] = 1;
  }
  a.gold += refunded;
  a.records = {};
  return refunded;
}
export function battleLevels(a) {
  return Object.fromEntries(
    UNITS.map((u) => [u.id, a.levels[u.id] + a.special[u.id]]),
  );
}
export function gemModifiers(a) {
  return {
    attack: a.equippedGem === "attack" ? 1.1 : 1,
    hp: a.equippedGem === "hp" ? 1.15 : 1,
  };
}
export function combatPower(a) {
  const levels = battleLevels(a),
    modifiers = gemModifiers(a);
  return Math.round(
    UNITS.reduce((total, unit) => {
      if (!ownsUnit(a, unit.id)) return total;
      const scale = 1 + (levels[unit.id] - 1) * UNIT_LEVEL_GROWTH;
      const hp = Math.round(unit.hp * scale * modifiers.hp);
      const attack = Math.max(
        1,
        Math.round(unit.attack * scale * modifiers.attack),
      );
      return total + hp + (10 * attack) / unit.attackInterval;
    }, 0),
  );
}
export function recordIdle(a, result, snapshot, now = Date.now()) {
  accrue(a, now);
  const rateBonus = snapshot.gem === "gold" ? 1.15 : 1;
  const r = {
    gold: Math.floor(result.reward * rateBonus),
    diamonds:
      Math.round(
        (0.1 + snapshot.stageId * 0.025) * (result.survival / 120) ** 2 * 1000,
      ) / 1000,
    hpRatio: result.hpRatio,
    survival: result.survival,
    snapshot,
    version: 1,
    recordedAt: now,
  };
  const old = a.records[snapshot.stageId];
  if (!old || r.gold > old.gold) {
    a.records[snapshot.stageId] = r;
    return true;
  }
  return false;
}
export function completeChallenge(a, stageId) {
  a.highestCleared = Math.max(a.highestCleared, stageId);
  if (a.challengeRewards.includes(stageId)) return { gold: 0, diamonds: 0 };
  a.challengeRewards.push(stageId);
  const gold = STAGES[stageId - 1].baseReward * 2,
    diamonds = 10;
  a.gold += gold;
  a.diamonds += diamonds;
  return { gold, diamonds };
}
export function recordSpeedrun(a, time, now = Date.now()) {
  accrue(a, now);
  if (a.daily.claimed)
    a.daily.practice =
      a.daily.practice === null ? time : Math.min(time, a.daily.practice);
  else
    a.daily.best = a.daily.best === null ? time : Math.min(time, a.daily.best);
}
export function speedrunReward(a) {
  return a.daily.best === null
    ? 0
    : Math.max(1, Math.min(10, Math.ceil((120 - a.daily.best) / 12)));
}
export function claimSpeedrun(a, now = Date.now()) {
  accrue(a, now);
  if (a.daily.claimed || a.daily.best === null) return 0;
  const reward = speedrunReward(a);
  a.tickets += reward;
  a.daily.claimed = true;
  return reward;
}
export const RECRUIT_COSTS = { 1: 30, 10: 270 };
export function ownsUnit(a, id) {
  return UNITS.some((unit) => unit.id === id) && a.owned?.[id] === true;
}
export function isOnboarding(a) {
  return (
    ONBOARDING_PHASES.has(a?.onboarding?.phase) &&
    a.onboarding.phase !== "complete"
  );
}
export function advanceOnboardingBattle(a, won) {
  const phase = a?.onboarding?.phase;
  if (phase === "intro" && won) {
    a.onboarding.phase = "first-battle";
    return true;
  }
  if (phase === "first-battle" && !won) {
    a.onboarding.phase = "recruit";
    return true;
  }
  if (phase === "retry-battle" && won) {
    completeChallenge(a, 1);
    a.onboarding.phase = "idle-guide";
    return true;
  }
  return false;
}
export function recruitOnboardingCompanion(a) {
  if (a?.onboarding?.phase !== "recruit" || ownsUnit(a, "squirrel")) return null;
  const unit = UNITS.find((entry) => entry.id === "squirrel");
  if (!unit) return null;
  a.owned.squirrel = true;
  a.onboarding.phase = "retry-battle";
  a.sequence = ["sheep", "squirrel", ...Array(8).fill(null)];
  return { unit, isNew: true, fragments: 0, guaranteed: true };
}
export function finishOnboarding(a) {
  if (a?.onboarding?.phase !== "idle-guide") return false;
  a.onboarding.phase = "complete";
  a.idleStage = 1;
  return true;
}
const randomValue = (random) => {
  const value = random();
  if (!Number.isFinite(value)) throw new Error("Invalid random value");
  return Math.max(0, Math.min(1 - Number.EPSILON, value));
};
export function recruitUnits(
  a,
  count = 1,
  { free = false, random = Math.random, banner = "forest" } = {},
) {
  if (isOnboarding(a)) return null;
  if (![1, 10].includes(count)) return null;
  const selectedBanner = bannerById(banner);
  if (!selectedBanner || a.highestCleared < selectedBanner.unlock) return null;
  const rarities = bannerRarities(banner);
  const available = bannerPool(banner);
  if (free && (count !== 10 || a.recruitment.welcomeClaimed)) return null;
  const cost = free ? 0 : RECRUIT_COSTS[count];
  if (a.diamonds < cost) return null;
  // Prepare the entire batch before charging or granting. The reveal is presentation only.
  const owned = { ...a.owned },
    fragments = { ...a.fragments };
  const recruitment = { ...a.recruitment };
  const results = [];
  for (let index = 0; index < count; index++) {
    const roll = randomValue(random);
    let cumulative = 0;
    let tier =
      rarities.find((rarity) => {
        cumulative += rarity.rate;
        return roll < cumulative;
      }) ?? rarities.at(-1);
    let guaranteed = false;
    if (
      recruitment.sinceEpic >= 49 &&
      !["epic", "legendary"].includes(tier.id)
    ) {
      tier = RARITIES.find((rarity) => rarity.id === "epic");
      guaranteed = true;
    } else if (recruitment.sinceRare >= 9 && tier.id === "common") {
      tier = RARITIES.find((rarity) => rarity.id === "rare");
      guaranteed = true;
    }
    const pool = available.filter((unit) => unit.rarity === tier.id);
    if (!pool.length) throw new Error("Empty recruit pool");
    const unit = pool[Math.floor(randomValue(random) * pool.length)];
    const isNew = !owned[unit.id];
    owned[unit.id] = true;
    if (!isNew) fragments[unit.id] = (fragments[unit.id] ?? 0) + 1;
    recruitment.total++;
    recruitment.sinceRare =
      tier.id === "common" ? recruitment.sinceRare + 1 : 0;
    recruitment.sinceEpic = ["epic", "legendary"].includes(tier.id)
      ? 0
      : recruitment.sinceEpic + 1;
    results.push({ unit, isNew, fragments: isNew ? 0 : 1, guaranteed });
  }
  if (free) recruitment.welcomeClaimed = true;
  a.diamonds -= cost;
  a.owned = owned;
  a.fragments = fragments;
  a.recruitment = recruitment;
  return results;
}
export function recruitUnit(a, random = Math.random) {
  return recruitUnits(a, 1, { random })?.[0].unit ?? null;
}
export function recruitGem(a, payment = "tickets", random = Math.random) {
  if (isOnboarding(a)) return null;
  if (a.highestCleared < 3) return null;
  const cost = payment === "tickets" ? 5 : 30;
  if (!["tickets", "diamonds"].includes(payment) || a[payment] < cost)
    return null;
  a[payment] -= cost;
  const g = GEMS[Math.min(GEMS.length - 1, Math.floor(random() * GEMS.length))];
  a.gems[g.id]++;
  if (!a.equippedGem) a.equippedGem = g.id;
  return g;
}
export function loadAccount(storage = localStorage, now = Date.now()) {
  try {
    return {
      account: normalizeAccount(JSON.parse(storage.getItem(SAVE_KEY)), now),
      error: false,
    };
  } catch {
    return { account: newAccount(now), error: true };
  }
}
export function saveAccount(a, storage = localStorage) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(a));
    return true;
  } catch {
    return false;
  }
}
export function resetAccount(storage = localStorage, now = Date.now()) {
  const fresh = newAccount(now);
  return saveAccount(fresh, storage) ? fresh : null;
}

export function canUseUnit(account, id) {
  return ownsUnit(account, id) && (account.highestCleared >= 10 || bannerPool("forest").some((unit) => unit.id === id));
}

export function playableSequence(account) {
  const sequence = account.sequence.map((id) => canUseUnit(account, id) ? id : null);
  if (!sequence.some(Boolean)) sequence[0] = "sheep";
  return sequence;
}
