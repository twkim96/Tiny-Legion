const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Record pricing version; changing growth prices or the offline limit does not reprice records.
export const ECONOMY_VERSION = "long-economy-22";
const IDLE_ACORNS = 12;
const IDLE_DIAMONDS = 0.025;
export const IDLE_REWARD_SECONDS = 90;
export const OFFLINE_LIMIT_SECONDS = 12 * 3600;
const healthFactor = hpRatio => 0.1 + 0.9 * clamp(finite(hpRatio, 0), 0, 1) ** 2;
export const STAGE_GROWTH = 1.1;
const stageFactor = stageId => STAGE_GROWTH ** (Math.max(1, finite(stageId, 1)) - 1);

export function idleFullReward(stageId) {
  return IDLE_ACORNS * stageFactor(stageId);
}

export function idleRewardFactor(survival, duration, hpRatio) {
  const period = finite(duration, 0);
  if (period <= 0) return 0;
  const ratio = clamp(finite(survival, 0) / period, 0, 1);
  return (period / IDLE_REWARD_SECONDS) * ratio ** 2 * healthFactor(hpRatio) * (ratio >= 1 ? 1 : 0.8);
}

export function idleDiamondReward(stageId, survival, duration, hpRatio) {
  return Math.round(IDLE_DIAMONDS * stageFactor(stageId) * idleRewardFactor(survival, duration, hpRatio) * 1000) / 1000;
}

// L is the level being purchased FROM; 100 itself cannot be upgraded.
// The quadratic opening funds tactical allocation; the tail prices long progression.
export function levelUpgradeCost(level) {
  const current = clamp(Math.floor(finite(level, 1)), 1, 100);
  const n = current - 1;
  return Math.ceil((100 + 32 * n + 5 * n ** 2) * 1.1955 ** Math.max(0, current - 15));
}

export function idleAcornReward(stageId, survival, duration, hpRatio) {
  return idleFullReward(stageId) * idleRewardFactor(survival, duration, hpRatio);
}

export function hasStageMission(stageId) {
  return Number.isInteger(stageId) && stageId >= 2 &&
    (stageId <= 20 || stageId % 10 === 5 || stageId % 10 === 0);
}
export function missionRewardRounds(stageId) {
  const stage = Math.max(1, Math.floor(finite(stageId, 1)));
  // Keep the authored first two regions' mission budgets unchanged.
  if (stage <= 20) return Math.max(1, Math.min(9 * stage - 8, 1.5 * stage + 67));
  return 97 + 4 * (stage - 20);
}
export function stageMissionReward(stageId) {
  return { gold: Math.ceil(idleFullReward(stageId) * missionRewardRounds(stageId)), diamonds: 30 };
}
export function contentUnlockReward(stageId) {
  return { gold: Math.ceil(idleFullReward(stageId) * 30), diamonds: 30 };
}
