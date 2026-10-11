// Introductory encounters use normal movement, attacks and victory conditions.
// They do not replace the regular stage's waves or existing production records.
const INTRO = {
  id: 0,
  name: "첫 출정",
  enemyHp: 24,
  enemyAttack: 1,
  baseReward: 0,
  duration: 45,
  waves: [{ time: 0.6, enemies: [{ id: "beetle", count: 1, x: 1080 }] }],
};
const FIRST = {
  id: 1,
  name: "첫 숲길",
  enemyHp: 600,
  enemyAttack: 1,
  baseReward: 0,
  duration: 60,
  waves: [
    { time: 0.6, enemies: [{ id: "beetle", count: 1, x: 1080 }] },
    { time: 8, enemies: [{ id: "mushroom", count: 4, interval: 4, x: 1080, attribute: "wild", regeneration: false }] },
  ],
};
export function onboardingEncounter(phase) {
  if (phase === "intro") return INTRO;
  if (phase === "first-battle") return FIRST;
  if (phase === "retry-battle") return { ...FIRST, duration: 90 };
  return null;
}
