import test from "node:test";
import assert from "node:assert/strict";
import {
  newAccount,
  accrue,
  recordIdle,
  claimSpeedrun,
  recordSpeedrun,
  speedrunStageRecord,
  speedrunProgress,
  sequenceForMode,
  setSequence,
  playableSequence,
  refundUnitLevels,
  unitLevelRefund,
  levelCost,
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
  SAVE_KEY,
} from "../dist/src/account.js";
import { saveAccount, loadAccount, resetAccount } from "../dist/src/account-storage.js";
import { calculateIdleReward, createBattle, summonUnit } from "../dist/src/engine.js";
import { STARTER_UNIT_IDS, STAGES, UNITS, battleDuration } from "../dist/src/data.js";
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
    a.gemItems = gem ? [{uid:gem,type:gem,level:1,options:[]}] : [];
    a.gemEquipment = gem ? {[gem]:gem} : {};
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
  a.gemItems = [{uid:"harvest",type:"harvest",level:1,options:[]}];
  a.gemEquipment = {harvest:"harvest"};
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
    { reward: 500, survival: 120, hpRatio: 1 },
    { stageId: 1, gem: "gold", duration: 120 },
    now + 120000,
  );
  assert.equal(a.gold, 700);
  assert.equal(a.records[1].gold, 575);
  assert.equal(a.records[1].productionSeconds, 120);
  assert.equal(a.records[1].diamonds, 0.033);
  a.gemItems = [{uid:"attack",type:"attack",level:1,options:[]}];
  a.gemEquipment = {attack:"attack"};
  accrue(a, now + 240000);
  assert.equal(a.gold, 1275);
});
test("short cycles earn proportionally less and have the same hourly income within rounding", () => {
  const hourlyIncome = [];
  for (const duration of [40, 60, 90]) {
    const a = newAccount(now);
    recordIdle(
      a,
      { reward: calculateIdleReward(1, duration, 1, duration), survival: duration, hpRatio: 1 },
      { stageId: 1, duration },
      now,
    );
    assert.equal(a.records[1].gold, Math.round(500 * duration / 90));
    assert.equal(a.records[1].productionSeconds, duration);
    assert.equal(a.records[1].diamonds, Math.round(0.025 * duration / 90 * 1000) / 1000);
    hourlyIncome.push(accrue(a, now + 3600000));
  }
  for (const income of hourlyIncome) {
    assert.ok(Math.abs(income.gold - 20000) <= 30);
    assert.ok(Math.abs(income.diamonds - 1) <= 0.03);
  }
});
test("only the unscaled test balance records require remeasurement", () => {
  const a = newAccount(now);
  a.records = {
    1: { gold: 500, diamonds: 0.025, productionSeconds: 40, snapshot: { balanceVersion: "idle-economy-15" } },
    2: { gold: 100, diamonds: 0.1, productionSeconds: 120, snapshot: { balanceVersion: "castle-entry-14" } },
    3: { gold: 323, diamonds: 0.016, productionSeconds: 40, snapshot: { balanceVersion: "idle-time-scaled-16" } },
    4: { gold: 878, diamonds: 0.044, productionSeconds: 60, snapshot: { balanceVersion: "idle-economy-15" } },
    5: { gold: 1059, diamonds: 0.053, productionSeconds: 90, snapshot: { balanceVersion: "idle-economy-15" } },
  };
  const restored = normalizeAccount(a, now);
  assert.equal(restored.records[1], undefined);
  assert.deepEqual(restored.records[2], a.records[2]);
  assert.deepEqual(restored.records[3], a.records[3]);
  assert.equal(restored.records[4], undefined);
  assert.deepEqual(restored.records[5], a.records[5]);
  assert.equal(restored.gold, a.gold);
  assert.equal(restored.diamonds, a.diamonds);
  assert.deepEqual(normalizeAccount(restored, now).records, restored.records);
  const result = {reward: calculateIdleReward(1, 40, 1, 40), survival: 40, hpRatio: 1};
  assert.equal(recordIdle(restored, result, {stageId: 1, duration: 40, balanceVersion: "idle-time-scaled-16"}, now), true);
  assert.equal(restored.records[1].gold, 222);
});
test("short failed idle cycles keep their full cycle duration in the accrual rate", () => {
  const full = newAccount(now);
  recordIdle(
    full,
    { reward: calculateIdleReward(1, 90, 1, 90), survival: 90, hpRatio: 1 },
    { stageId: 1, duration: 90 },
    now,
  );

  const failed = newAccount(now);
  recordIdle(
    failed,
    { reward: calculateIdleReward(1, 30, 0.9, 90), survival: 30, hpRatio: 0.9 },
    { stageId: 1, duration: 90 },
    now,
  );
  assert.equal(failed.records[1].productionSeconds, 90);
  assert.ok(failed.records[1].gold / 90 < full.records[1].gold / 90);
  assert.ok(failed.records[1].diamonds / 90 < full.records[1].diamonds / 90);
  assert.ok(accrue(failed, now + 3600000).gold < accrue(full, now + 3600000).gold);
});
test("record normalization keeps old valid rewards and accepts the larger economy cap", () => {
  const oldRecord = { gold: 400, diamonds: 0.4, productionSeconds: 120 };
  const old = normalizeAccount({ ...newAccount(now), records: { 1: oldRecord } }, now);
  assert.deepEqual(old.records[1], oldRecord);

  const currentRecord = { gold: 500, diamonds: 0.025, productionSeconds: 40 };
  const current = normalizeAccount({ ...newAccount(now), records: { 1: currentRecord } }, now);
  assert.deepEqual(current.records[1], currentRecord);

  const overCap = { ...currentRecord, gold: 2001 };
  const rejected = normalizeAccount({ ...newAccount(now), records: { 1: overCap } }, now);
  assert.equal(rejected.records[1], undefined);
});
test("level refund restores spent gold and invalidates production records", () => {
  const a = completedAccount();
  const start = a.gold;
  assert.ok(growUnit(a, "sheep"));
  assert.ok(growUnit(a, "sheep"));
  a.records[1] = { gold: 100, diamonds: 0.125 };
  refundUnitLevels(a, "sheep", now);
  assert.equal(a.gold, start);
  assert.equal(a.levels.sheep, 1);
  assert.deepEqual(a.records, {});
});
test("best speedrun is preserved, daily claim is once, and practice gives no extra currency", () => {
  const a = completedAccount();
  a.highestCleared = 11;
  recordSpeedrun(a, 1, 60, now);
  recordSpeedrun(a, 1, 80, now);
  assert.equal(speedrunStageRecord(a, 1).best, 60);
  assert.equal(claimSpeedrun(a, 1, now), 10);
  recordSpeedrun(a, 1, 30, now);
  assert.equal(speedrunStageRecord(a, 1).best, 60);
  assert.equal(speedrunStageRecord(a, 1).practice, 30);
  assert.equal(claimSpeedrun(a, 1, now), 0);
  assert.equal(a.tickets, 10);
  assert.equal(speedrunProgress(a), 2);
});
test("Korean daily boundary resets records and reward state", () => {
  const before = Date.UTC(2026, 9, 11, 14, 59, 59);
  const a = completedAccount();
  a.lastSettled = before;
  a.highestCleared = 11;
  recordSpeedrun(a, 1, 60, before);
  claimSpeedrun(a, 1, before);
  accrue(a, before + 2000);
  assert.deepEqual(a.daily.stages, {});
  assert.equal(a.speedrunUnlocked, 2);
  assert.equal(speedrunProgress(a), 2);
  assert.equal(a.tickets, 10);
});
test("first challenge reward is not paid twice and gem draw consumes the right currency", () => {
  const a = completedAccount();
  completeChallenge(a, 1);
  const gold = a.gold;
  completeChallenge(a, 1);
  assert.equal(a.gold, gold);
  assert.equal(recruitGem(a, "diamonds"), null);
  completeChallenge(a, 3);
  assert.equal(recruitGem(a, "diamonds"), null);
  completeChallenge(a, 11);
  const diamonds = a.diamonds;
  assert.ok(recruitGem(a, "diamonds", () => 0));
  assert.equal(a.diamonds, diamonds - 30);
  assert.equal(a.gemItems[0].type, "income");
  assert.deepEqual(a.gemEquipment, {});
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
  assert.deepEqual(a.gemEquipment, {});
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
  assert.deepEqual(account.sequencePresets.challenge, account.sequence);
  assert.deepEqual(account.sequencePresets.speedrun, account.sequence);
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
    gold: 240,
    diamonds: 30,
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
    gold: 1000,
    diamonds: 30,
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

test("hidden idle-result stages normalize uniquely while audio and speed persist", () => {
  const account = normalizeAccount(
    {
      ...newAccount(now),
      settings: {
        audio: { musicEnabled: false, sfxEnabled: true, musicVolume: 0.25, sfxVolume: 0.6 },
        speed: 2,
        hiddenIdleResults: [1, 1, 0, 2, 20, 21, -1, "3", 1.5],
      },
    },
    now,
  );
  assert.deepEqual(account.settings, {
    audio: { musicEnabled: false, sfxEnabled: true, musicVolume: 0.25, sfxVolume: 0.6 },
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


test("individual level refunds settle earned production and preserve other growth and progress", () => {
  const a=completedAccount();
  a.owned.squirrel=true;
  a.gold=10000;
  growUnit(a,"sheep"); growUnit(a,"sheep"); growUnit(a,"squirrel");
  a.special.sheep=2; a.fragments.sheep=7;
  a.highestCleared=3;
  a.records[1]={gold:120,diamonds:.5};
  a.idleStage=1;
  const before=JSON.parse(JSON.stringify(a));
  const refund=levelCost(1)+levelCost(2);
  assert.equal(unitLevelRefund(a,"sheep"),refund);
  assert.equal(refundUnitLevels(a,"sheep",now+120000),refund);
  assert.equal(a.gold,before.gold+120+refund);
  assert.equal(a.diamonds,before.diamonds+.5);
  assert.equal(a.levels.sheep,1);
  assert.equal(a.levels.squirrel,2);
  for(const key of ["special","fragments","owned","sequence","sequencePresets","highestCleared","daily","missions","earlyGuide"]) assert.deepEqual(a[key],before[key]);
  assert.deepEqual(a.records,{});
  const after=JSON.stringify(a);
  for(const id of ["sheep","missing","rabbit",undefined]) assert.equal(refundUnitLevels(a,id,now+240000),0);
  assert.equal(JSON.stringify(a),after);
  const restored=normalizeAccount(JSON.parse(after),now+120000);
  assert.equal(restored.levels.sheep,1);
  assert.equal(restored.levels.squirrel,2);
  assert.equal(restored.special.sheep,2);
});

test("stored legacy level spending is refunded as recorded and oversized ledgers stay capped", () => {
  const legacy = completedAccount();
  legacy.levels.sheep = 4;
  legacy.levelSpent.sheep = 400;
  const restored = normalizeAccount(legacy, now);
  assert.equal(restored.levelSpent.sheep, 400);
  assert.equal(unitLevelRefund(restored, "sheep"), 400);
  const balance = restored.gold;
  assert.equal(refundUnitLevels(restored, "sheep", now), 400);
  assert.equal(restored.gold, balance + 400);

  const malicious = completedAccount();
  malicious.levels.sheep = 2;
  malicious.levelSpent.sheep = 1e12;
  const capped = normalizeAccount(malicious, now);
  assert.equal(capped.levelSpent.sheep, levelCost(1));
  assert.equal(unitLevelRefund(capped, "sheep"), levelCost(1));
});


test("idle, challenge and speedrun presets persist independently and only idle advances the defense lesson",()=>{
  const a=completedAccount();
  a.earlyGuide={phase:'remove-rabbit',legacy:false};
  a.sequence=['sheep','squirrel','rabbit',...Array(7).fill(null)];
  a.sequencePresets={challenge:[...a.sequence],speedrun:[...a.sequence]};
  const clean=['sheep','squirrel',...Array(8).fill(null)];
  assert.equal(setSequence(a,clean,'challenge'),true);
  assert.equal(a.earlyGuide.phase,'remove-rabbit');
  assert.ok(a.sequence.includes('rabbit'));
  assert.equal(setSequence(a,clean,'idle'),true);
  assert.equal(a.earlyGuide.phase,'idle-retry');
  assert.ok(sequenceForMode(a,'speedrun').includes('rabbit'));
  const loaded=normalizeAccount(JSON.parse(JSON.stringify(a)),now);
  assert.deepEqual(loaded.sequence,clean);
  assert.deepEqual(loaded.sequencePresets.challenge,clean);
  assert.ok(loaded.sequencePresets.speedrun.includes('rabbit'));
  assert.deepEqual(playableSequence(loaded,'idle'),clean);
  assert.deepEqual(playableSequence(loaded,'speedrun'),loaded.sequencePresets.speedrun);
  loaded.sequencePresets.challenge[0]='rabbit';
  assert.equal(loaded.sequence[0],'sheep');
  assert.equal(loaded.sequencePresets.speedrun[0],'sheep');
  const snapshot=JSON.stringify(loaded);
  assert.equal(setSequence(loaded,Array(10).fill(null),'idle'),false);
  assert.equal(setSequence(loaded,['missing',...Array(9).fill(null)],'challenge'),false);
  assert.equal(setSequence(loaded,clean,'unknown'),false);
  assert.equal(JSON.stringify(loaded),snapshot);
});
test("shared legacy lineups migrate without aliasing, and tutorial rabbit returns only to challenge",()=>{
  for(const tutorial of [false,true]) {
    const raw=completedAccount();
    delete raw.sequencePresets;
    raw.earlyGuide={phase:tutorial?'growth':'complete',legacy:!tutorial};
    raw.sequence=['sheep',null,'squirrel','sheep',...Array(6).fill(null)];
    raw.records[1]={gold:100,diamonds:.1};
    const a=normalizeAccount(raw,now);
    assert.deepEqual(a.sequence,raw.sequence);
    assert.deepEqual(a.sequencePresets.speedrun,raw.sequence);
    assert.equal(a.sequencePresets.challenge.includes('rabbit'),tutorial);
    assert.deepEqual(a.records,raw.records);
    const migrated=normalizeAccount(JSON.parse(JSON.stringify(a)),now);
    assert.deepEqual(migrated.sequencePresets,a.sequencePresets);
    a.sequencePresets.speedrun[0]='rabbit';
    assert.equal(a.sequence[0],'sheep');
    assert.equal(a.sequencePresets.challenge[0],'sheep');
  }
});
