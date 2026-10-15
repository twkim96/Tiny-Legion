// Temporary compatibility for pre-feature test saves. Keep new migrations out of
// gameplay modules; remove this module and its load-time calls when old saves retire.
import { UNITS, STAGES, STARTER_UNIT_IDS } from "./data.js";
import { DUPLICATE_MARKS, markTypeFor } from "./abilities.js";
import { ECONOMY_VERSION, hasStageMission, idleAcornReward, idleDiamondReward, idleFullReward, levelUpgradeCost } from "./economy.js";

const LEGACY_GROWTH_ANCHORS = [
  { level: 1, stage: 1, rounds: 1 },
  { level: 7, stage: 6, rounds: 2 },
  { level: 35, stage: 10, rounds: 14 },
  { level: 50, stage: 12, rounds: 18 },
  { level: 100, stage: 20, rounds: 24 },
];
const LEGACY_STAGE_GROWTH = 1 / (0.1 + 0.9 * 0.9 ** 2);
const LEGACY_IDLE_ACORNS = 500;

function legacyLevelCost(level) {
  const current = Math.max(1, Math.min(100, Math.floor(Number(level) || 1)));
  const index = Math.max(1, LEGACY_GROWTH_ANCHORS.findIndex(anchor => anchor.level >= current));
  const start = LEGACY_GROWTH_ANCHORS[index - 1], end = LEGACY_GROWTH_ANCHORS[index];
  const progress = (current - start.level) / (end.level - start.level);
  const stage = start.stage + (end.stage - start.stage) * progress;
  const rounds = start.rounds + (end.rounds - start.rounds) * progress;
  return Math.ceil(LEGACY_IDLE_ACORNS * LEGACY_STAGE_GROWTH ** (stage - 1) * rounds / 5);
}

export function legacyLevelInvestmentLimit(level) {
  let spent = 0;
  const targetLevel = Math.max(1, Math.min(100, Math.floor(Number(level) || 1)));
  for (let purchasedLevel = 1; purchasedLevel < targetLevel; purchasedLevel++) {
    spent += legacyLevelCost(purchasedLevel);
  }
  return spent;
}

export function levelInvestmentLimit(level) {
  let spent = 0;
  const targetLevel = Math.max(1, Math.min(100, Math.floor(Number(level) || 1)));
  for (let purchasedLevel = 1; purchasedLevel < targetLevel; purchasedLevel++) {
    spent += Math.max(legacyLevelCost(purchasedLevel), levelUpgradeCost(purchasedLevel));
  }
  return spent;
}

// Convert only records not already priced by the current economy. Keep this
// independent of account/engine modules so normalization has no import cycle.
export function repriceLegacyIdleRecords(records) {
  if (!records || typeof records !== "object" || Array.isArray(records)) return records;
  const repriced = { ...records };
  for (const [stageKey, record] of Object.entries(records)) {
    const stageId = Number(stageKey);
    // The unscaled short-cycle test records require remeasurement in both
    // local normalization and direct server settlement.
    if (record?.snapshot?.balanceVersion === "idle-economy-15" &&
        Number.isFinite(record.productionSeconds) && record.productionSeconds > 0 && record.productionSeconds < 90) {
      delete repriced[stageKey];
      continue;
    }
    if (
      !Number.isInteger(stageId) || stageId < 1 || stageId > STAGES.length ||
      !record || typeof record !== "object" || record.economyVersion === ECONOMY_VERSION ||
      !Number.isFinite(record.gold) || record.gold < 0 ||
      !Number.isFinite(record.diamonds) || record.diamonds < 0
    ) continue;

    const productionSeconds = Number.isFinite(record.productionSeconds) && record.productionSeconds > 0
      ? record.productionSeconds
      : 120;
    const hasMeasurement = Number.isFinite(record.survival) && record.survival >= 0 &&
      Number.isFinite(record.hpRatio) && record.hpRatio >= 0 && record.hpRatio <= 1;
    let gold, diamonds;
    if (hasMeasurement) {
      const acornBonus = Number.isFinite(record.snapshot?.gemEffects?.acorn)
        ? record.snapshot.gemEffects.acorn
        : record.snapshot?.gem === "gold" ? 1.15 : 1;
      gold = idleAcornReward(stageId, record.survival, productionSeconds, record.hpRatio) * acornBonus;
      diamonds = idleDiamondReward(stageId, record.survival, productionSeconds, record.hpRatio);
    } else {
      const oldStageFactor = LEGACY_STAGE_GROWTH ** (stageId - 1);
      const oldFullReward = LEGACY_IDLE_ACORNS * oldStageFactor;
      const goldScale = idleFullReward(stageId) / oldFullReward;
      const newStageFactor = idleFullReward(stageId) / idleFullReward(1);
      gold = record.gold * goldScale;
      diamonds = record.diamonds * newStageFactor / oldStageFactor;
    }
    repriced[stageKey] = { ...record, gold, diamonds, economyVersion: ECONOMY_VERSION };
  }
  return repriced;
}

export function legacyStarterSave(raw) {
  if (Object.hasOwn(raw, "onboarding")) return raw;
  return {
    ...raw,
    onboarding: { phase: "complete" },
    owned: { ...raw.owned, ...Object.fromEntries(STARTER_UNIT_IDS.map(id => [id, true])) },
    sequence: Array.isArray(raw.sequence) ? raw.sequence : [...STARTER_UNIT_IDS],
  };
}

// Called after current fields are validated, before lineups are initialized.
export function restoreLegacyProgress(a, raw, hasValidGuidePhase) {
  if (!Object.hasOwn(raw, "marks")) {
    // Convert only unused legacy fragments once; already purchased levels stay intact.
    for (const unit of UNITS) {
      a.marks[markTypeFor(unit)] += a.fragments[unit.id] * DUPLICATE_MARKS[unit.rarity];
      a.fragments[unit.id] = 0;
    }
  }
  if (!Object.hasOwn(raw, "missions")) {
    a.missions = { idleCompleted: false, claimed: [] };
    if (a.onboarding.phase === "complete") {
      if (a.highestCleared >= 2) {
        a.missions.idleCompleted = true;
        a.missions.claimed = [
          "idle-intro",
          ...STAGES.slice(1, a.highestCleared).filter((stage) => hasStageMission(stage.id)).map((stage) => `challenge-${stage.id}`),
        ];
      } else if (a.highestCleared === 1) {
        const introRecord = a.records[1];
        if (
          Number.isFinite(introRecord?.survival) &&
          introRecord.survival >= (introRecord.productionSeconds ?? 120) &&
          Number.isFinite(introRecord?.hpRatio) &&
          introRecord.hpRatio > 0
        ) {
          a.missions.idleCompleted = true;
        }
      }
    }
  }
  if (!hasValidGuidePhase) {
    const progressed = a.highestCleared >= 2 || UNITS.some(u => a.levels[u.id] > 1 || a.special[u.id] > 0);
    if (progressed) a.earlyGuide = { phase: "complete", legacy: true };
  }
  // Earlier tutorial saves removed the castle specialist from the shared lineup.
  if (!Array.isArray(raw.sequencePresets?.challenge) && !a.earlyGuide.legacy &&
      ["remove-rabbit", "idle-retry", "growth", "complete"].includes(a.earlyGuide.phase) && a.owned.rabbit === true) {
    const sequence = a.sequencePresets.challenge;
    const slot = sequence.indexOf(null);
    if (!sequence.includes("rabbit")) sequence[slot < 0 ? 9 : slot] = "rabbit";
  }
}

export function restoreLegacyGems(raw, state, { count, nextUid }) {
  if (Object.hasOwn(raw, "gemItems")) return false;
  for (const type of ["attack", "hp", "gold"]) {
    const owned = count(Number(raw.gems?.[type]));
    if (!owned) continue;
    const allocation = nextUid(state.gemItems, state.nextGemUid);
    state.nextGemUid = allocation.next;
    state.gemItems.push({ uid: allocation.uid, type, level: 1, optionTier: 'normal', options: [] });
    state.gemReserves[type] = owned - 1;
    if (raw.equippedGem === type) state.gemEquipment[type] = allocation.uid;
  }
  return true;
}
