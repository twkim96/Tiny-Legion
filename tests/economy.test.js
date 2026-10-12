import test from "node:test";
import assert from "node:assert/strict";
import {
  GROWTH_ANCHORS,
  idleDiamondReward,
  idleFullReward,
  idleRewardFactor,
  levelUpgradeCost,
} from "../dist/src/economy.js";
import { levelCost } from "../dist/src/account.js";

const oldLevelCost = level => 60 + 25 * level + 5 * level ** 2;

test("idle economy uses 500 acorns and the settled stage growth and reward factors", () => {
  const growth = 1 / (0.1 + 0.9 * 0.9 ** 2);
  assert.equal(idleFullReward(1), 500);
  for (const stageId of [1, 2, 6, 10, 20]) {
    assert.ok(Math.abs(idleFullReward(stageId) - 500 * growth ** (stageId - 1)) < 1e-9);
  }

  assert.equal(idleRewardFactor(90, 90, 1), 1);
  assert.equal(idleRewardFactor(45, 90, 1), 0.2);
  assert.ok(Math.abs(idleRewardFactor(90, 90, 0.5) - 0.325) < 1e-12);
  assert.ok(Math.abs(idleRewardFactor(90, 90, 0.9) - 0.829) < 1e-12);
  assert.ok(Math.abs(idleRewardFactor(90, 90, 0.9) - 1 / growth) < 1e-12);
  assert.equal(idleDiamondReward(1, 90, 90, 1), 0.025);
  assert.equal(idleDiamondReward(1, 90, 90, 0.5), 0.008);
});

test("growth cost anchors, account delegation, and legacy price floor are retained", () => {
  assert.deepEqual(GROWTH_ANCHORS, [
    { level: 1, stage: 1, rounds: 1 },
    { level: 7, stage: 6, rounds: 2 },
    { level: 35, stage: 10, rounds: 14 },
    { level: 50, stage: 12, rounds: 18 },
    { level: 100, stage: 20, rounds: 24 },
  ]);

  for (let level = 1; level <= 100; level++) {
    const cost = levelUpgradeCost(level);
    assert.equal(levelCost(level), cost);
    assert.ok(Number.isInteger(cost) && cost > 0);
    assert.ok(cost >= oldLevelCost(level), `level ${level}`);
    if (level > 1) assert.ok(cost >= levelUpgradeCost(level - 1), `level ${level} is monotonic`);
  }

  for (const { level, stage, rounds } of GROWTH_ANCHORS) {
    const fiveLevelIncome = idleFullReward(stage) * rounds;
    const cost = levelUpgradeCost(level);
    assert.equal(cost, Math.ceil(fiveLevelIncome / 5));
    assert.ok(Math.abs(cost * 5 - fiveLevelIncome) <= 5, `level ${level}`);
  }

  for (const [level, stage, rounds] of [[4, 3.5, 1.5], [21, 8, 8], [42, 10 + 14 / 15, 14 + 28 / 15], [75, 16, 21]]) {
    assert.equal(levelUpgradeCost(level), Math.ceil(idleFullReward(stage) * rounds / 5));
  }
});
