import { STAGES } from "./data.js";

// Introductory encounters use normal movement, attacks and victory conditions.
// They do not replace the regular stage's waves or existing production records.
const INTRO = {
  id: 0,
  name: "첫 출정",
  enemyHp: 24,
  enemyAttack: 1,
  baseReward: 0,
  duration: null,
  waves: [{ time: 0.6, enemies: [{ id: "beetle", count: 1 }] }],
};
const FIRST = {
  id: 1,
  name: "첫 숲길",
  enemyHp: 220,
  enemyAttack: 2,
  baseReward: 0,
  duration: null,
  waves: [{ time: .6, repeatEvery: 4, enemies: [{ id: "beetle", count: 1 }] }],
};
export function onboardingEncounter(phase) {
  if (phase === "intro") return INTRO;
  if (phase === "first-battle") return FIRST;
  if (phase === "retry-battle") return FIRST;
  return null;
}
const STAGE_TWO = STAGES.find((stage) => stage.id === 2);

const WALL_BATTLE = {
  id: 2,
  name: "튼튼한 성벽",
  enemyHp: 1200,
  enemyAttack: 0.7,
  baseReward: STAGE_TWO.baseReward,
  duration: null,
  waves: [
    { time: 0.6, enemies: [{ id: "beetle", count: 2, interval: 1.3 }] },
    // Hidden reinforcement: the same ordinary boss arrives in both attempts.
    { time: 42, enemies: [{ id: "grove-bear", count: 1, statMultipliers: { hp: 20, attack: 20, speed: 2 } }] },
  ],
};

const IDLE_PRESSURE = {
  ...STAGE_TWO,
  duration: 40,
};

const CHALLENGE_GUIDE_PHASES = new Set([
  "wall-battle",
  "rabbit-recruit",
  "wall-retry",
]);
const IDLE_GUIDE_PHASES = new Set([
  "idle-defense",
  "remove-rabbit",
  "idle-retry",
]);

export function earlyGuideEncounter(phase, mode) {
  if (mode === "challenge" && CHALLENGE_GUIDE_PHASES.has(phase))
    return WALL_BATTLE;
  if (mode === "idle" && IDLE_GUIDE_PHASES.has(phase))
    return IDLE_PRESSURE;
  return null;
}
