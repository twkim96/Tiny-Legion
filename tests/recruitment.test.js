import test from "node:test";
import assert from "node:assert/strict";
import {
  newAccount,
  canUseUnit,
  playableSequence,
  completeChallenge,
  normalizeAccount,
  recruitUnits,
  ownsUnit,
  growUnit,
  enhanceUnit,
  upgradeUnitAbility,
  combatPower,
  recruitGem,
  refundUnitLevels,
  recruitOnboardingCompanion,
  advanceOnboardingBattle,
  saveAccount,
  loadAccount,
} from "../dist/src/account.js";
import { UNITS, STARTER_UNIT_IDS, RECRUIT_BANNERS, bannerPool, bannerRarities, stageLabel } from "../dist/src/data.js";
import { createBattle, summonUnit, stepBattle } from "../dist/src/engine.js";
const now = Date.UTC(2026, 9, 11, 3);
const rolls = (...values) => {
  let index = 0;
  return () => values[index++ % values.length];
};
function completedAccount() {
  const account = newAccount(now);
  account.onboarding.phase = "complete";
  account.earlyGuide = { phase: "complete", legacy: true };
  for (const id of STARTER_UNIT_IDS) account.owned[id] = true;
  account.sequence = [...STARTER_UNIT_IDS];
  return account;
}

test("legacy saves preserve progress and starter ownership without granting new companions", () => {
  const legacy = newAccount(now);
  delete legacy.owned;
  delete legacy.recruitment;
  delete legacy.onboarding;
  legacy.levels.sheep = 12;
  legacy.fragments.rabbit = 4;
  legacy.special.rabbit = 2;
  legacy.highestCleared = 3;
  legacy.challengeRewards = [1, 2, 3];
  legacy.sequence = ["fox", "rabbit", "rabbit"];
  legacy.records[1] = { gold: 100, diamonds: 0.125 };
  const account = normalizeAccount(legacy, now);
  assert.equal(account.levels.sheep, 12);
  assert.equal(account.fragments.rabbit, 4);
  assert.equal(account.special.rabbit, 2);
  assert.deepEqual(account.records, legacy.records);
  assert.deepEqual(account.challengeRewards, legacy.challengeRewards);
  assert.deepEqual(
    UNITS.filter((u) => ownsUnit(account, u.id)).map((u) => u.id),
    STARTER_UNIT_IDS,
  );
  assert.equal(account.sequence.length, 10);
  assert.deepEqual(account.sequence.slice(0, 3), [null, "rabbit", "rabbit"]);
  assert.ok(account.sequence.every((id) => id === null || ownsUnit(account, id)));
});

test("first draw unlocks, subsequent duplicate yields rarity marks and funds an ability upgrade", () => {
  const account = completedAccount();
  account.diamonds = 300;
  const power = combatPower(account);
  const first = recruitUnits(account, 1, { random: rolls(0.7, 0) })[0];
  assert.equal(first.unit.rarity, "rare");
  assert.equal(first.isNew, true);
  assert.equal(account.fragments[first.unit.id], 0);
  assert.ok(ownsUnit(account, first.unit.id));
  assert.ok(combatPower(account) > power);
  for (let i = 0; i < 3; i++) {
    const repeat = recruitUnits(account, 1, { random: rolls(0.7, 0) })[0];
    assert.equal(repeat.unit.id, first.unit.id);
    assert.equal(repeat.isNew, false);
    assert.equal(repeat.marks, 5);
  }
  assert.equal(account.diamonds, 180);
  assert.equal(account.marks.wild, 15);
  assert.ok(upgradeUnitAbility(account, first.unit.id, 'hp'));
  assert.equal(account.marks.wild, 14);
  assert.equal(account.abilities[first.unit.id].hp, 1);
  assert.equal(account.special[first.unit.id], 0);
});

test("ten draws charge once and apply guarantees across batches and single draws", () => {
  const account = completedAccount();
  account.diamonds = 2000;
  const batch = recruitUnits(account, 10, { random: () => 0 });
  assert.equal(batch.length, 10);
  assert.equal(batch.at(-1).unit.rarity, "rare");
  assert.equal(batch.at(-1).guaranteed, true);
  assert.equal(account.diamonds, 1730);
  assert.equal(account.recruitment.sinceRare, 0);
  for (let i = 0; i < 3; i++) recruitUnits(account, 10, { random: () => 0 });
  for (let i = 0; i < 9; i++) recruitUnits(account, 1, { random: () => 0 });
  const guaranteed = recruitUnits(account, 1, { random: () => 0 })[0];
  assert.equal(guaranteed.unit.rarity, "epic");
  assert.equal(account.recruitment.total, 50);
  assert.equal(account.recruitment.sinceRare, 0);
  assert.equal(account.recruitment.sinceEpic, 0);
});

test("each unlocked banner reaches its own complete pool and preserves natural high rarities", () => {
  for (const banner of RECRUIT_BANNERS) {
    let cumulative = 0;
    for (const rarity of bannerRarities(banner.id)) {
      const roll = cumulative + rarity.rate / 2;
      cumulative += rarity.rate;
      const pool = bannerPool(banner.id).filter((u) => u.rarity === rarity.id);
      for (let i = 0; i < pool.length; i++) {
        const account = completedAccount();
        account.highestCleared = 10;
        const result = recruitUnits(account, 1, {
          banner: banner.id, random: rolls(roll, (i + 0.5) / pool.length),
        })[0];
        assert.equal(result.unit.id, pool[i].id);
      }
    }
  }
  const account = completedAccount();
  account.highestCleared = 10;
  account.recruitment.sinceEpic = 49;
  account.recruitment.sinceRare = 9;
  const result = recruitUnits(account, 1, { banner: "workshop", random: rolls(.995, 0) })[0];
  assert.equal(result.unit.rarity, "legendary");
  assert.equal(result.guaranteed, false);
  assert.equal(account.recruitment.sinceEpic, 0);
});

test("forest-only opening rejects locked banners atomically and 1-10 opens counters", () => {
  const account = completedAccount();
  account.diamonds = 1000;
  account.owned.teapot = true;
  assert.equal(canUseUnit(account, "teapot"), false);
  assert.equal(canUseUnit(account, "sheep"), true);
  const before = JSON.stringify(account);
  for (const banner of ["workshop", "starlight", "unknown"]) {
    assert.equal(recruitUnits(account, 10, { banner, free: true }), null);
    assert.equal(JSON.stringify(account), before);
  }
  const forest = recruitUnits(account, 10, { free: true, random: rolls(.999, 0) });
  assert.ok(forest.every((result) => bannerPool("forest").includes(result.unit)));
  assert.equal(forest[0].unit.rarity, "epic");
  completeChallenge(account, 10);
  assert.equal(stageLabel(account.highestCleared + 1), "2-1");
  assert.equal(canUseUnit(account, "teapot"), true);
  assert.ok(recruitUnits(account, 1, { banner: "workshop", random: () => 0 }));
  const restored = normalizeAccount(account, now);
  assert.equal(restored.highestCleared, 10);
  assert.equal(canUseUnit(restored, "teapot"), true);
  completeChallenge(restored, 11);
  restored.idleStage = 11;
  restored.records[11] = { gold: 100, diamonds: .1 };
  const roundTrip = normalizeAccount(restored, now);
  assert.equal(roundTrip.highestCleared, 11);
  assert.equal(roundTrip.idleStage, 11);
  assert.deepEqual(roundTrip.records[11], restored.records[11]);
});

test("insufficient funds, invalid count or interrupted batch never charge or grant", () => {
  const account = completedAccount();
  const snapshot = JSON.stringify(account);
  assert.equal(recruitUnits(account, 10), null);
  assert.equal(recruitUnits(account, 3), null);
  assert.equal(JSON.stringify(account), snapshot);
  account.diamonds = 1000;
  const funded = JSON.stringify(account);
  let draws = 0;
  assert.throws(() =>
    recruitUnits(account, 10, { random: () => (++draws === 7 ? NaN : 0) }),
  );
  assert.equal(JSON.stringify(account), funded);
});

test("welcome draw and ownership survive storage round trip without a second free grant", () => {
  const account = completedAccount();
  const result = recruitUnits(account, 10, {
    free: true,
    random: rolls(0.7, 0),
  });
  assert.equal(result.filter((r) => r.isNew).length, 1);
  assert.equal(account.diamonds, 60);
  assert.equal(account.marks.wild, 45);
  let saved;
  const storage = {
    setItem: (_, value) => (saved = value),
    getItem: () => saved,
  };
  assert.equal(saveAccount(account, storage), true);
  const restored = loadAccount(storage, now).account;
  assert.deepEqual(restored.owned, account.owned);
  assert.deepEqual(restored.recruitment, account.recruitment);
  const snapshot = JSON.stringify(restored);
  assert.equal(recruitUnits(restored, 10, { free: true }), null);
  assert.equal(JSON.stringify(restored), snapshot);
});

test("unowned companions cannot grow, enhance, summon or affect power", () => {
  const account = completedAccount();
  const locked = UNITS.find((u) => !ownsUnit(account, u.id));
  const power = combatPower(account);
  account.levels[locked.id] = 100;
  account.fragments[locked.id] = 3;
  assert.equal(growUnit(account, locked.id), false);
  assert.equal(enhanceUnit(account, locked.id), false);
  assert.equal(combatPower(account), power);
  const battle = createBattle({
    mode: "challenge",
    ownedUnits: STARTER_UNIT_IDS,
  });
  battle.gold = 1000;
  assert.equal(summonUnit(battle, locked.id), false);
  assert.equal(battle.gold, 1000);
  assert.equal(battle.units.length, 0);
  assert.ok(summonUnit(battle, STARTER_UNIT_IDS[0]));
});

test("idle queue skips a locked entry instead of blocking the usable lineup", () => {
  const locked = UNITS.find((u) => !STARTER_UNIT_IDS.includes(u.id));
  const battle = createBattle({
    ownedUnits: STARTER_UNIT_IDS,
    sequence: [locked.id, "sheep"],
  });
  battle._spawnSchedule = [];
  battle.gold = 300;
  stepBattle(battle, 1 / 30);
  assert.deepEqual(
    battle.units.map((u) => u.id),
    ["sheep"],
  );
});

test("onboarding and early defense guide keep growth locked until 1-2 idle completion", () => {
  const account = newAccount(now);
  account.gold = 10000;
  account.diamonds = 1000;
  account.tickets = 20;
  account.fragments.sheep = 3;
  account.highestCleared = 3;
  const snapshot = JSON.stringify(account);
  assert.equal(recruitUnits(account, 1, { random: () => 0 }), null);
  assert.equal(growUnit(account, "sheep"), false);
  assert.equal(enhanceUnit(account, "sheep"), false);
  assert.equal(refundUnitLevels(account, "sheep", now), 0);
  assert.equal(recruitGem(account, "tickets", () => 0), null);
  assert.equal(JSON.stringify(account), snapshot);
  assert.equal(recruitOnboardingCompanion(account), null);

  account.onboarding.phase = "recruit";
  assert.ok(recruitOnboardingCompanion(account));
  advanceOnboardingBattle(account, true);
  account.onboarding.phase = "idle-guide";
  assert.equal(growUnit(account, "sheep"), false);
  account.onboarding.phase = "complete";
  assert.equal(growUnit(account, "sheep"), false);
  account.earlyGuide.phase = "growth";
  assert.equal(growUnit(account, "sheep"), true);
});

test("complete onboarding saves do not regain the legacy starter roster", () => {
  const account = normalizeAccount(
    { ...newAccount(now), onboarding: { phase: "complete" }, owned: { sheep: true } },
    now,
  );
  assert.deepEqual(
    UNITS.filter((unit) => ownsUnit(account, unit.id)).map((unit) => unit.id),
    ["sheep"],
  );
  assert.deepEqual(account.sequence, ["sheep", ...Array(9).fill(null)]);
});

test("completed new-format save retains exactly its sheep and squirrel owners", () => {
  const source = newAccount(now);
  source.onboarding = { phase: "complete" };
  source.owned.squirrel = true;
  source.sequence = ["sheep", "squirrel", "sheep", "squirrel", "sheep"];
  let saved;
  const storage = {
    setItem: (_, value) => (saved = value),
    getItem: () => saved,
  };
  assert.equal(saveAccount(source, storage), true);
  const restored = loadAccount(storage, now).account;
  assert.deepEqual(
    UNITS.filter((unit) => ownsUnit(restored, unit.id)).map((unit) => unit.id),
    ["sheep", "squirrel"],
  );
  assert.deepEqual(restored.sequence, [...source.sequence, ...Array(5).fill(null)]);
});


test("legacy ownership stays saved while unavailable lineup entries wait for 2-1", () => {
  const legacy = completedAccount();
  legacy.sequence = ["teapot", "cloud", ...Array(8).fill(null)];
  legacy.levels.teapot = 22;
  legacy.special.cloud = 3;
  const original = [...legacy.sequence];
  assert.deepEqual(playableSequence(legacy), ["sheep", ...Array(9).fill(null)]);
  const state = createBattle({ sequence: playableSequence(legacy), ownedUnits: UNITS.filter((unit) => canUseUnit(legacy, unit.id)).map((unit) => unit.id) });
  state.gold = 1000;
  assert.equal(summonUnit(state, "teapot"), false);
  assert.equal(state.gold, 1000);
  assert.ok(summonUnit(state, "sheep"));
  const saved = normalizeAccount(legacy, now);
  assert.deepEqual(saved.sequence, original);
  assert.equal(saved.owned.teapot, true);
  assert.equal(saved.levels.teapot, 22);
  assert.equal(saved.special.cloud, 3);
  completeChallenge(saved, 10);
  assert.deepEqual(playableSequence(saved), original);
});


test("banner companions cover one target except multi-attribute legendary companions", () => {
  for (const banner of RECRUIT_BANNERS) for (const unit of bannerPool(banner.id)) {
    assert.ok(unit.specialties.includes(banner.attribute), `${banner.id}: ${unit.id}`);
    if (unit.rarity === "legendary") assert.ok(unit.specialties.length >= 2 && unit.specialties.length <= 3);
    else assert.deepEqual(unit.specialties, [banner.attribute]);
  }
});
