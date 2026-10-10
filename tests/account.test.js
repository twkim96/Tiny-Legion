import test from "node:test";
import assert from "node:assert/strict";
import {
  newAccount,
  accrue,
  recordIdle,
  claimSpeedrun,
  recordSpeedrun,
  refundLevels,
  growUnit,
  normalizeAccount,
  completeChallenge,
  recruitGem,
} from "../dist/src/account.js";
const now = Date.UTC(2026, 9, 11, 3);
test("production uses elapsed time once and does not double pay on repeated calls", () => {
  const a = newAccount(now);
  a.records[1] = { gold: 100, diamonds: 0.125 };
  accrue(a, now + 120000);
  assert.equal(a.gold, 700);
  assert.equal(a.diamonds, 60.125);
  accrue(a, now + 120000);
  assert.equal(a.gold, 700);
});
test("offline accrual is capped at eight hours and backward time yields no income", () => {
  const a = newAccount(now);
  a.records[1] = { gold: 100, diamonds: 0.125 };
  accrue(a, now + 24 * 3600000);
  assert.equal(a.gold, 24600);
  const gold = a.gold;
  accrue(a, now);
  assert.equal(a.gold, gold);
});
test("a new record settles the old rate and freezes its verified gold bonus", () => {
  const a = newAccount(now);
  a.records[1] = { gold: 100, diamonds: 0.125 };
  recordIdle(
    a,
    { reward: 120, survival: 120, hpRatio: 1 },
    { stageId: 1, gem: "gold" },
    now + 120000,
  );
  assert.equal(a.gold, 700);
  assert.equal(a.records[1].gold, 138);
  a.equippedGem = "attack";
  accrue(a, now + 240000);
  assert.equal(a.gold, 838);
});
test("level refund restores spent gold and invalidates production records", () => {
  const a = newAccount(now);
  const start = a.gold;
  assert.ok(growUnit(a, "sheep"));
  assert.ok(growUnit(a, "sheep"));
  a.records[1] = { gold: 100, diamonds: 0.125 };
  refundLevels(a, now);
  assert.equal(a.gold, start);
  assert.equal(a.levels.sheep, 1);
  assert.deepEqual(a.records, {});
});
test("best speedrun is preserved, daily claim is once, and practice gives no extra currency", () => {
  const a = newAccount(now);
  recordSpeedrun(a, 60, now);
  recordSpeedrun(a, 80, now);
  assert.equal(a.daily.best, 60);
  assert.equal(claimSpeedrun(a, now), 5);
  recordSpeedrun(a, 30, now);
  assert.equal(a.daily.practice, 30);
  assert.equal(claimSpeedrun(a, now), 0);
  assert.equal(a.tickets, 5);
});
test("Korean daily boundary resets records and reward state", () => {
  const before = Date.UTC(2026, 9, 11, 14, 59, 59);
  const a = newAccount(before);
  recordSpeedrun(a, 60, before);
  claimSpeedrun(a, before);
  accrue(a, before + 2000);
  assert.equal(a.daily.claimed, false);
  assert.equal(a.daily.best, null);
  assert.equal(a.tickets, 5);
});
test("first challenge reward is not paid twice and gem draw consumes the right currency", () => {
  const a = newAccount(now);
  completeChallenge(a, 1);
  const gold = a.gold;
  completeChallenge(a, 1);
  assert.equal(a.gold, gold);
  assert.equal(recruitGem(a, "diamonds"), null);
  completeChallenge(a, 3);
  const diamonds = a.diamonds;
  assert.ok(recruitGem(a, "diamonds", () => 0));
  assert.equal(a.diamonds, diamonds - 30);
  assert.equal(a.gems.attack, 1);
  assert.equal(a.equippedGem, "attack");
});
test("damaged saves cannot introduce negative balances, invalid sequence or unknown equipment", () => {
  const a = normalizeAccount(
    {
      version: 1,
      gold: -100,
      diamonds: NaN,
      sequence: ["unknown"],
      equippedGem: "unknown",
      levels: { sheep: 1e10 },
    },
    now,
  );
  assert.equal(a.gold, 0);
  assert.equal(a.levels.sheep, 100);
  assert.equal(a.sequence.length, 5);
  assert.equal(a.equippedGem, null);
});
test("a truncated imported sequence restores five usable summon slots and preserves duplicates", () => {
  const a = normalizeAccount(
    { ...newAccount(now), sequence: ["sheep", "sheep"] },
    now,
  );
  assert.equal(a.sequence.length, 5);
  assert.deepEqual(a.sequence.slice(0, 2), ["sheep", "sheep"]);
  assert.ok(a.sequence.every((id) => Object.hasOwn(a.levels, id)));
});
