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
  currentMission,
  recordMissionBattle,
  claimMission,
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
  resetAccount,
  SAVE_KEY,
} from "../dist/src/account.js";
import { createBattle, summonUnit } from "../dist/src/engine.js";
import { STARTER_UNIT_IDS, STAGES, UNITS } from "../dist/src/data.js";
const now = Date.UTC(2026, 9, 11, 3);
test("account reset persists only a fresh intro account and preserves saves on write failure", () => {
  const previous = newAccount(now);
  previous.owned.squirrel = true;
  previous.highestCleared = 5;
  previous.records[1] = { gold: 100, diamonds: 1 };
  previous.onboarding.phase = "complete";
  const values = new Map([[SAVE_KEY, JSON.stringify(previous)], ["other-setting", "keep"]]);
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  const fresh = resetAccount(storage, now);
  assert.equal(fresh.onboarding.phase, "intro");
  assert.equal(fresh.highestCleared, 0);
  assert.deepEqual(fresh.records, {});
  assert.deepEqual(UNITS.filter((u) => fresh.owned[u.id]).map((u) => u.id), ["sheep"]);
  assert.deepEqual(loadAccount(storage, now).account, fresh);
  assert.equal(values.get("other-setting"), "keep");
  const saved = values.get(SAVE_KEY);
  assert.equal(resetAccount({ ...storage, setItem() { throw new Error("quota"); } }, now), null);
  assert.equal(values.get(SAVE_KEY), saved);
});
function completedAccount() {
  const account = newAccount(now);
  account.onboarding.phase = "complete";
  account.earlyGuide = { phase: "complete", legacy: true };
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
  assert.equal(a.sequence.length, 10);
  assert.equal(a.equippedGem, null);
});
test("a truncated imported sequence preserves duplicates and pads ten slots without extra summons", () => {
  const a = normalizeAccount(
    { ...newAccount(now), sequence: ["sheep", "sheep"] },
    now,
  );
  assert.equal(a.sequence.length, 10);
  assert.deepEqual(a.sequence.slice(0, 2), ["sheep", "sheep"]);
  assert.ok(a.sequence.every((id) => id === null || Object.hasOwn(a.levels, id)));
  assert.deepEqual(a.sequence.slice(2), Array(8).fill(null));
});

test("all ten sequence positions survive reload, including interior empty slots", () => {
  const raw = newAccount(now);
  raw.owned.squirrel = true;
  raw.sequence = ["sheep", null, "squirrel", null, null, "sheep", null, null, null, "squirrel"];
  const restored = normalizeAccount(raw, now);
  assert.deepEqual(restored.sequence, raw.sequence);
  assert.deepEqual(normalizeAccount(restored, now).sequence, raw.sequence);
});

test("onboarding battles, guaranteed companion and idle completion survive reload", () => {
  const account = newAccount(now);
  assert.deepEqual(account.onboarding, { phase: "intro" });
  assert.equal(Object.values(account.owned).filter(Boolean).length, 1);
  assert.deepEqual(account.sequence, ["sheep", ...Array(9).fill(null)]);
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
  assert.deepEqual(account.sequence, ["sheep", "squirrel", ...Array(8).fill(null)]);
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
  assert.deepEqual(malformed.sequence, ["sheep", "squirrel", ...Array(8).fill(null)]);
  const missingCompanion = normalizeAccount(
    { ...newAccount(now), onboarding: { phase: "idle-guide" } },
    now,
  );
  assert.equal(missingCompanion.onboarding.phase, "recruit");
  assert.deepEqual(missingCompanion.sequence, ["sheep", ...Array(9).fill(null)]);
  assert.deepEqual(normalizeAccount(malformed, now), malformed);
});

test("idle mission requires a stage-one idle win and ignores losses or other battles", () => {
  const account = completedAccount();
  assert.deepEqual(currentMission(account), {
    id: "idle-intro",
    kind: "idle",
    stageId: 1,
    title: "1-1 방치 클리어",
    gold: 120,
    diamonds: 10,
    completed: false,
  });
  for (const result of [
    { mode: "idle", stageId: 1, won: false },
    { mode: "challenge", stageId: 1, won: true },
    { mode: "idle", stageId: 2, won: true },
  ]) {
    recordMissionBattle(account, result);
    assert.equal(currentMission(account).completed, false);
  }
  recordMissionBattle(account, { mode: "idle", stageId: 1, won: true });
  assert.equal(currentMission(account).completed, true);
  recordMissionBattle(account, { mode: "idle", stageId: 1, won: true });
  assert.equal(currentMission(account).completed, true);
  assert.equal(currentMission(newAccount(now)), null);
});

test("missions claim sequentially once, survive reload, and remain separate from first-clear rewards", () => {
  const account = completedAccount();
  recordMissionBattle(account, { mode: "idle", stageId: 1, won: true });
  assert.deepEqual(claimMission(account), { id: "idle-intro", gold: 120, diamonds: 10 });
  assert.equal(claimMission(account), null);

  assert.deepEqual(currentMission(account), {
    id: "challenge-2",
    kind: "challenge",
    stageId: 2,
    title: "도전 1-2 클리어",
    gold: STAGES[1].baseReward,
    diamonds: 10,
    completed: false,
  });
  recordMissionBattle(account, { mode: "challenge", stageId: 2, won: true });
  assert.equal(currentMission(account).completed, false);

  const goldBeforeFirstClear = account.gold;
  const diamondsBeforeFirstClear = account.diamonds;
  assert.deepEqual(completeChallenge(account, 2), {
    gold: STAGES[1].baseReward * 2,
    diamonds: 10,
  });
  assert.equal(currentMission(account).completed, true);
  const goldBeforeMission = account.gold;
  const diamondsBeforeMission = account.diamonds;
  assert.deepEqual(claimMission(account), {
    id: "challenge-2",
    gold: STAGES[1].baseReward,
    diamonds: 10,
  });
  assert.equal(account.gold - goldBeforeMission, STAGES[1].baseReward);
  assert.equal(account.diamonds - diamondsBeforeMission, 10);
  assert.equal(account.gold - goldBeforeFirstClear, STAGES[1].baseReward * 3);
  assert.equal(account.diamonds - diamondsBeforeFirstClear, 20);
  assert.deepEqual(completeChallenge(account, 2), { gold: 0, diamonds: 0 });
  assert.equal(claimMission(account), null);

  let saved;
  const storage = {
    getItem: () => saved,
    setItem: (_, value) => (saved = value),
  };
  assert.equal(saveAccount(account, storage), true);
  let restored = loadAccount(storage, now).account;
  assert.deepEqual(restored.missions, {
    idleCompleted: true,
    claimed: ["idle-intro", "challenge-2"],
  });
  assert.equal(currentMission(restored).id, "challenge-3");
  assert.equal(claimMission(restored), null);

  completeChallenge(restored, 3);
  assert.deepEqual(claimMission(restored), {
    id: "challenge-3",
    gold: STAGES[2].baseReward,
    diamonds: 10,
  });
  saveAccount(restored, storage);
  restored = loadAccount(storage, now).account;
  assert.equal(currentMission(restored).id, "challenge-4");
  assert.deepEqual(restored.missions.claimed, [
    "idle-intro",
    "challenge-2",
    "challenge-3",
  ]);
});

test("legacy mission migration avoids retroactive rewards and respects onboarding", () => {
  const legacyCleared = {
    ...newAccount(now),
    highestCleared: 5,
    onboarding: { phase: "complete" },
  };
  delete legacyCleared.missions;
  delete legacyCleared.earlyGuide;
  const migratedCleared = normalizeAccount(legacyCleared, now);
  assert.deepEqual(migratedCleared.missions, {
    idleCompleted: true,
    claimed: [
      "idle-intro",
      "challenge-2",
      "challenge-3",
      "challenge-4",
      "challenge-5",
    ],
  });
  assert.deepEqual(currentMission(migratedCleared), {
    id: "challenge-6",
    kind: "challenge",
    stageId: 6,
    title: "도전 1-6 클리어",
    gold: STAGES[5].baseReward,
    diamonds: 10,
    completed: false,
  });

  const legacyIdle = {
    ...newAccount(now),
    highestCleared: 1,
    onboarding: { phase: "complete" },
    records: { 1: { gold: 100, diamonds: 1, survival: 120, hpRatio: 0.25 } },
  };
  delete legacyIdle.missions;
  const migratedIdle = normalizeAccount(legacyIdle, now);
  assert.deepEqual(migratedIdle.missions, { idleCompleted: true, claimed: [] });
  assert.equal(currentMission(migratedIdle).id, "idle-intro");
  assert.equal(currentMission(migratedIdle).completed, true);

  for (const record of [
    { gold: 100, diamonds: 1, survival: 119, hpRatio: 0.25 },
    { gold: 100, diamonds: 1, survival: 120, hpRatio: 0 },
  ]) {
    const incompleteLegacy = {
      ...legacyIdle,
      records: { 1: record },
    };
    delete incompleteLegacy.missions;
    assert.equal(normalizeAccount(incompleteLegacy, now).missions.idleCompleted, false);
  }

  const onboarding = {
    ...newAccount(now),
    highestCleared: 1,
    records: { 1: { gold: 100, diamonds: 1, survival: 120, hpRatio: 0.25 } },
  };
  delete onboarding.missions;
  const migratedOnboarding = normalizeAccount(onboarding, now);
  assert.equal(migratedOnboarding.missions.idleCompleted, false);
  assert.equal(currentMission(migratedOnboarding), null);
  migratedOnboarding.onboarding.phase = "complete";
  assert.equal(currentMission(migratedOnboarding).completed, false);

  const explicit = normalizeAccount(
    {
      ...legacyCleared,
      missions: {
        idleCompleted: false,
        claimed: ["challenge-2", "invalid", "challenge-2", "challenge-99"],
      },
    },
    now,
  );
  assert.deepEqual(explicit.missions, {
    idleCompleted: false,
    claimed: ["challenge-2"],
  });
  assert.equal(currentMission(explicit).id, "idle-intro");
  assert.equal(currentMission(explicit).completed, false);
});

test("hidden idle-result stages normalize uniquely while sound and speed persist", () => {
  const account = normalizeAccount(
    {
      ...newAccount(now),
      settings: {
        sound: true,
        speed: 2,
        hiddenIdleResults: [1, 1, 0, 2, 20, 21, -1, "3", 1.5],
      },
    },
    now,
  );
  assert.deepEqual(account.settings, {
    sound: true,
    speed: 2,
    hiddenIdleResults: [1, 2, 20],
  });
  assert.deepEqual(normalizeAccount(account, now).settings, account.settings);
  let saved;
  const storage = {
    getItem: () => saved,
    setItem: (_, value) => (saved = value),
  };
  assert.equal(saveAccount(account, storage), true);
  assert.deepEqual(loadAccount(storage, now).account.settings, account.settings);
});
