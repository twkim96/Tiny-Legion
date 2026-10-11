import assert from "node:assert/strict";
import test from "node:test";
import { UNITS } from "../dist/src/data.js";
import { companionPanel } from "../dist/src/companion-ui.js";
import {
  accrue,
  baseLevelRoster,
  battleLevels,
  companionStats,
  effectiveUnitLevel,
  growUnit,
  levelCost,
  newAccount,
  normalizeAccount,
  recordIdle,
  refundUnitLevels,
  sharedLevel,
  unitLevelRefund,
} from "../dist/src/account.js";

const now = Date.UTC(2026, 9, 11);
const completedAccount = () => {
  const account = newAccount(now);
  account.onboarding.phase = "complete";
  account.earlyGuide = { phase: "complete", legacy: true };
  return account;
};

test("the shared level uses the deterministic top five owned personal levels", () => {
  const account = completedAccount();
  const ids = UNITS.slice(0, 6).map(({ id }) => id);
  for (const id of ids) account.owned[id] = true;
  [10, 9, 8, 7, 6, 5].forEach((level, index) => {
    account.levels[ids[index]] = level;
  });

  assert.deepEqual(baseLevelRoster(account), ids.slice(0, 5));
  assert.equal(sharedLevel(account), 6);
  assert.equal(effectiveUnitLevel(account, ids[5]), 6);
  assert.equal(battleLevels(account)[ids[5]], 6);
  const followerStats = companionStats(account, ids[5]);
  const sameLevelAccount = completedAccount();
  sameLevelAccount.owned[ids[5]] = true;
  sameLevelAccount.levels[ids[5]] = 6;
  assert.deepEqual(followerStats, companionStats(sameLevelAccount, ids[5]));
  assert.equal(effectiveUnitLevel(account, "unowned"), 1);

  account.levels[ids[5]] = 8;
  assert.deepEqual(baseLevelRoster(account), [ids[0], ids[1], ids[2], ids[5], ids[3]]);
  assert.equal(sharedLevel(account), 7);

  const fewer = completedAccount();
  for (const id of ids.slice(0, 4)) fewer.owned[id] = true;
  fewer.levels[ids[0]] = 20;
  assert.equal(baseLevelRoster(fewer).length, 4);
  assert.equal(sharedLevel(fewer), 1);
  assert.equal(effectiveUnitLevel(fewer, ids[1]), 1);
});

test("a synced follower pays from effective level and reset refunds only paid acorns", () => {
  const account = completedAccount();
  const ids = UNITS.slice(0, 6).map(({ id }) => id);
  for (const id of ids) account.owned[id] = true;
  for (const id of ids.slice(0, 5)) account.levels[id] = 2;
  account.gold = 100_000;
  const follower = ids[5];
  const cost = levelCost(2);

  assert.equal(effectiveUnitLevel(account, follower), 2);
  assert.equal(unitLevelRefund(account, follower), 0);
  assert.equal(refundUnitLevels(account, follower, now), 0);
  assert.equal(growUnit(account, follower), true);
  assert.equal(account.levels[follower], 3);
  assert.equal(account.levelSpent[follower], cost);
  assert.equal(account.gold, 100_000 - cost);

  assert.equal(refundUnitLevels(account, follower, now), cost);
  assert.equal(account.levels[follower], 1);
  assert.equal(account.levelSpent[follower], 0);
  assert.equal(account.gold, 100_000);
  assert.equal(refundUnitLevels(account, follower, now), 0);
  assert.equal(account.gold, 100_000);

  const panel = companionPanel(account, follower);
  assert.match(panel, /공유 Lv\. 2 · 개인 Lv\. 1/);
  assert.ok(panel.includes(`>${cost.toLocaleString("ko-KR")}</button>`));
  assert.match(panel, /id="companion-refund" disabled/);
});

test("legacy personal levels migrate their exact spend once and old callers remain safe", () => {
  const legacy = completedAccount();
  legacy.owned.squirrel = true;
  legacy.levels.sheep = 4;
  legacy.levels.squirrel = 3;
  delete legacy.levelSpent;

  const migrated = normalizeAccount(legacy, now);
  const sheepSpend = levelCost(1) + levelCost(2) + levelCost(3);
  const squirrelSpend = levelCost(1) + levelCost(2);
  assert.equal(migrated.levelSpent.sheep, sheepSpend);
  assert.equal(migrated.levelSpent.squirrel, squirrelSpend);
  const reloaded = normalizeAccount(JSON.parse(JSON.stringify(migrated)), now);
  assert.equal(reloaded.levelSpent.sheep, sheepSpend);
  assert.equal(unitLevelRefund(reloaded, "sheep"), sheepSpend);
  assert.equal(refundUnitLevels(reloaded, "sheep", now), sheepSpend);
  assert.equal(reloaded.levelSpent.sheep, 0);

  const directLegacy = completedAccount();
  directLegacy.levels.sheep = 3;
  delete directLegacy.levelSpent;
  assert.equal(unitLevelRefund(directLegacy, "sheep"), levelCost(1) + levelCost(2));
  assert.equal(refundUnitLevels(directLegacy, "sheep", now), levelCost(1) + levelCost(2));
  assert.ok(Object.values(directLegacy.levelSpent).every((spent) => spent === 0));
});

test("production keeps legacy 120-second rates and stores new 90-second snapshots", () => {
  const oldRecord = { gold: 120, diamonds: 0.4, snapshot: { levels: { sheep: 2 } } };
  const account = normalizeAccount({
    ...completedAccount(),
    records: { 1: oldRecord },
    lastSettled: now,
  }, now);
  assert.deepEqual(account.records[1], oldRecord);
  const income = accrue(account, now + 120_000);
  assert.equal(income.gold, 120);
  assert.equal(income.diamonds, 0.4);

  const saved90SecondRecord = { ...oldRecord, productionSeconds: 90 };
  const normalized90SecondRecord = normalizeAccount({
    ...completedAccount(),
    records: { 1: saved90SecondRecord },
  }, now);
  assert.deepEqual(normalized90SecondRecord.records[1], saved90SecondRecord);

  const next = completedAccount();
  const snapshot = { stageId: 1, duration: 90, levels: { sheep: 7 }, abilities: { sheep: { guard: 1 } } };
  assert.equal(recordIdle(next, { reward: 90, survival: 90, hpRatio: 1 }, snapshot, now), true);
  assert.equal(next.records[1].productionSeconds, 90);
  assert.deepEqual(next.records[1].snapshot, snapshot);
  assert.equal(accrue(next, now + 90_000).gold, 90);

  const best = completedAccount();
  best.records[1] = { ...oldRecord, productionSeconds: 120 };
  assert.equal(recordIdle(best, { reward: 90, survival: 90, hpRatio: 1 }, snapshot, now), false);
  assert.equal(best.records[1].productionSeconds, 120);
});

test("legacy mission migration recognizes a completed 90-second idle record", () => {
  const legacy = {
    ...completedAccount(),
    highestCleared: 1,
    records: {
      1: { gold: 100, diamonds: 0.1, survival: 90, hpRatio: 0.5, productionSeconds: 90 },
    },
  };
  delete legacy.missions;
  assert.equal(normalizeAccount(legacy, now).missions.idleCompleted, true);

  const oldPeriod = {
    ...legacy,
    records: { 1: { ...legacy.records[1], productionSeconds: 120 } },
  };
  assert.equal(normalizeAccount(oldPeriod, now).missions.idleCompleted, false);
});
