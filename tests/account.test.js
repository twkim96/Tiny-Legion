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
  combatPower,
  battleLevels,
  gemModifiers,
  ownsUnit,
  advanceOnboardingBattle,
  recruitOnboardingCompanion,
  finishOnboarding,
  isOnboarding,
  saveAccount,
  loadAccount,
} from "../dist/src/account.js";
import { createBattle, summonUnit } from "../dist/src/engine.js";
import { STARTER_UNIT_IDS, UNITS } from "../dist/src/data.js";
const now = Date.UTC(2026, 9, 11, 3);
function completedAccount() {
  const account = newAccount(now);
  account.onboarding.phase = "complete";
  for (const id of STARTER_UNIT_IDS) account.owned[id] = true;
  account.sequence = [...STARTER_UNIT_IDS];
  return account;
}
test("combat power follows summoned stats after growth and combat gems", () => {
  const a = completedAccount();
  const baseline = combatPower(a);
  growUnit(a, "sheep");
  a.special.rabbit = 3;
  for (const gem of [null, "attack", "hp"]) {
    a.equippedGem = gem;
    const battle = createBattle({
      levels: battleLevels(a),
      modifiers: gemModifiers(a),
    });
    let expected = 0;
    for (const definition of UNITS.filter((u) => ownsUnit(a, u.id))) {
      battle.gold = 1000;
      assert.ok(summonUnit(battle, definition.id));
      const unit = battle.units.at(-1);
      expected += unit.maxHp + (10 * unit.attack) / unit.attackInterval;
    }
    assert.equal(combatPower(a), Math.round(expected));
    assert.ok(combatPower(a) > baseline);
  }
});
test("combat power ignores currency, economic gems and repeated summon slots", () => {
  const a = newAccount(now);
  const power = combatPower(a);
  a.equippedGem = "gold";
  a.gold += 100000;
  a.diamonds += 100000;
  a.sequence = Array(5).fill("sheep");
  assert.equal(combatPower(a), power);
});
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
  const a = completedAccount();
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
  const a = completedAccount();
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

test("onboarding battles, guaranteed companion and idle completion survive reload", () => {
  const account = newAccount(now);
  assert.deepEqual(account.onboarding, { phase: "intro" });
  assert.equal(Object.values(account.owned).filter(Boolean).length, 1);
  assert.deepEqual(account.sequence, Array(5).fill("sheep"));
  assert.equal(advanceOnboardingBattle(account, false), false);
  assert.equal(advanceOnboardingBattle(account, true), true);
  assert.equal(account.onboarding.phase, "first-battle");
  assert.equal(advanceOnboardingBattle(account, true), false);
  assert.equal(advanceOnboardingBattle(account, false), true);
  assert.equal(account.onboarding.phase, "recruit");

  const recruitmentBefore = structuredClone(account.recruitment);
  const balances = [account.gold, account.diamonds, account.tickets];
  const result = recruitOnboardingCompanion(account);
  assert.equal(result.unit.id, "squirrel");
  assert.equal(result.isNew, true);
  assert.equal(result.fragments, 0);
  assert.equal(result.guaranteed, true);
  assert.deepEqual(account.recruitment, recruitmentBefore);
  assert.deepEqual([account.gold, account.diamonds, account.tickets], balances);
  assert.deepEqual(account.sequence, ["sheep", "squirrel", "sheep", "squirrel", "sheep"]);
  assert.equal(recruitOnboardingCompanion(account), null);

  let saved;
  const storage = {
    setItem: (_, value) => (saved = value),
    getItem: () => saved,
  };
  saveAccount(account, storage);
  const restored = loadAccount(storage, now).account;
  assert.equal(restored.onboarding.phase, "retry-battle");
  const rewardBefore = [restored.gold, restored.diamonds];
  assert.equal(advanceOnboardingBattle(restored, false), false);
  assert.equal(advanceOnboardingBattle(restored, true), true);
  assert.equal(restored.onboarding.phase, "idle-guide");
  assert.deepEqual(restored.challengeRewards, [1]);
  assert.equal(advanceOnboardingBattle(restored, true), false);
  assert.equal(restored.challengeRewards.length, 1);
  assert.ok(restored.gold > rewardBefore[0]);
  assert.ok(restored.diamonds > rewardBefore[1]);
  assert.equal(finishOnboarding(restored), true);
  assert.equal(restored.onboarding.phase, "complete");
  assert.equal(restored.idleStage, 1);
  assert.equal(finishOnboarding(restored), false);
  assert.equal(isOnboarding(restored), false);
});

test("onboarding normalization repairs phases and preserves its owned roster", () => {
  const malformed = normalizeAccount(
    { ...newAccount(now), owned: { sheep: true, squirrel: true }, onboarding: { phase: "recruit" } },
    now,
  );
  assert.equal(malformed.onboarding.phase, "retry-battle");
  assert.deepEqual(malformed.sequence, ["sheep", "squirrel", "sheep", "squirrel", "sheep"]);
  const missingCompanion = normalizeAccount(
    { ...newAccount(now), onboarding: { phase: "idle-guide" } },
    now,
  );
  assert.equal(missingCompanion.onboarding.phase, "recruit");
  assert.deepEqual(missingCompanion.sequence, Array(5).fill("sheep"));
  assert.deepEqual(normalizeAccount(malformed, now), malformed);
});
