const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const IDLE_ACORNS = 500;
const IDLE_DIAMONDS = 0.025;
const healthFactor = hpRatio => 0.1 + 0.9 * clamp(finite(hpRatio, 0), 0, 1) ** 2;
// A full defense at 90% castle health on the next stage equals this stage's 100%.
const STAGE_GROWTH = 1 / healthFactor(0.9);
const stageFactor = stageId => STAGE_GROWTH ** (Math.max(1, finite(stageId, 1)) - 1);

export function idleFullReward(stageId) {
  return IDLE_ACORNS * stageFactor(stageId);
}

export function idleRewardFactor(survival, duration, hpRatio) {
  const period = finite(duration, 0);
  if (period <= 0) return 0;
  const ratio = clamp(finite(survival, 0) / period, 0, 1);
  return ratio ** 2 * healthFactor(hpRatio) * (ratio >= 1 ? 1 : 0.8);
}

export function idleDiamondReward(stageId, survival, duration, hpRatio) {
  return Math.round(IDLE_DIAMONDS * stageFactor(stageId) * idleRewardFactor(survival, duration, hpRatio) * 1000) / 1000;
}

// Five directly leveled companions are one shared-growth step. Between these
// milestones, interpolate the reference stage and required full-defense rounds.
export const GROWTH_ANCHORS = [
  { level: 1, stage: 1, rounds: 1 },
  { level: 7, stage: 6, rounds: 2 },
  { level: 35, stage: 10, rounds: 14 },
  { level: 50, stage: 12, rounds: 18 },
  { level: 100, stage: 20, rounds: 24 },
];

export function levelUpgradeCost(level) {
  const current = clamp(Math.floor(finite(level, 1)), 1, 100);
  const index = Math.max(1, GROWTH_ANCHORS.findIndex(anchor => anchor.level >= current));
  const start = GROWTH_ANCHORS[index - 1], end = GROWTH_ANCHORS[index];
  const progress = (current - start.level) / (end.level - start.level);
  const stage = start.stage + (end.stage - start.stage) * progress;
  const rounds = start.rounds + (end.rounds - start.rounds) * progress;
  return Math.ceil(idleFullReward(stage) * rounds / 5);
}
