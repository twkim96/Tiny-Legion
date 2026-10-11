import test from "node:test";
import assert from "node:assert/strict";
import {
  newAccount,
  normalizeAccount,
  recruitUnits,
  ownsUnit,
  growUnit,
  enhanceUnit,
  combatPower,
  saveAccount,
  loadAccount,
} from "../dist/src/account.js";
import { UNITS, STARTER_UNIT_IDS } from "../dist/src/data.js";
import { createBattle, summonUnit, stepBattle } from "../dist/src/engine.js";
const now = Date.UTC(2026, 9, 11, 3);
const rolls = (...values) => {
  let index = 0;
  return () => values[index++ % values.length];
};

test("legacy saves preserve progress and starter ownership without granting new companions", () => {
  const legacy = newAccount(now);
  delete legacy.owned;
  delete legacy.recruitment;
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
  assert.equal(account.sequence.length, 5);
  assert.deepEqual(account.sequence.slice(0, 2), ["rabbit", "rabbit"]);
  assert.ok(account.sequence.every((id) => ownsUnit(account, id)));
});

test("first draw unlocks, subsequent duplicate yields one fragment and supports enhancement", () => {
  const account = newAccount(now);
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
    assert.equal(repeat.fragments, 1);
  }
  assert.equal(account.diamonds, 180);
  assert.ok(enhanceUnit(account, first.unit.id));
  assert.equal(account.fragments[first.unit.id], 0);
  assert.equal(account.special[first.unit.id], 1);
});

test("ten draws charge once and apply guarantees across batches and single draws", () => {
  const account = newAccount(now);
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

test("natural higher rarities survive guarantees and all rarity pools are reachable", () => {
  for (const [roll, rarity] of [
    [0, "common"],
    [0.7, "rare"],
    [0.93, "epic"],
    [0.995, "legendary"],
  ]) {
    const pool = UNITS.filter((u) => u.rarity === rarity);
    for (let i = 0; i < pool.length; i++) {
      const account = newAccount(now);
      const result = recruitUnits(account, 1, {
        random: rolls(roll, (i + 0.5) / pool.length),
      })[0];
      assert.equal(result.unit.id, pool[i].id);
    }
  }
  const account = newAccount(now);
  account.recruitment.sinceEpic = 49;
  account.recruitment.sinceRare = 9;
  const result = recruitUnits(account, 1, { random: rolls(0.995, 0) })[0];
  assert.equal(result.unit.rarity, "legendary");
  assert.equal(result.guaranteed, false);
  assert.equal(account.recruitment.sinceEpic, 0);
});

test("insufficient funds, invalid count or interrupted batch never charge or grant", () => {
  const account = newAccount(now);
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
  const account = newAccount(now);
  const result = recruitUnits(account, 10, {
    free: true,
    random: rolls(0.7, 0),
  });
  assert.equal(result.filter((r) => r.isNew).length, 1);
  assert.equal(account.diamonds, 60);
  assert.equal(account.fragments[result[0].unit.id], 9);
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
  const account = newAccount(now);
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
