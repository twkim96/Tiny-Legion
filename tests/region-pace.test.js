import test from "node:test";
import assert from "node:assert/strict";
import { ENEMIES, STAGES } from "../dist/src/data.js";
import { createBattle, fireCannon, stepBattle, summonUnit } from "../dist/src/engine.js";

const STARTERS = ["sheep", "squirrel", "rabbit"];
const enemyById = new Map(ENEMIES.map((enemy) => [enemy.id, enemy]));
const stageById = new Map(STAGES.map((stage) => [stage.id, stage]));

// Ordinary owned-unit levels only: no evolution, modifiers, forced result or
// encounter overrides. Manual inputs match the existing early-mission policy.
function play(stageId, level, mode = "challenge", lineup = STARTERS) {
  const state = createBattle({
    stageId, mode, ownedUnits: lineup,
    levels: Object.fromEntries(lineup.map((id) => [id, level])),
    sequence: mode === "idle" ? lineup : [],
  });
  const bosses = new Map();
  let summonAt = 0, index = 0, cannonAt = 8;
  while (!state.finished) {
    if (mode === "challenge" && state.time >= summonAt) {
      if (summonUnit(state, lineup[index])) index = (index + 1) % lineup.length;
      summonAt = state.time + 1;
    }
    if (mode === "challenge" && state.time >= cannonAt && fireCannon(state)) cannonAt = state.time + 25;
    stepBattle(state, 1 / 30);
    for (const unit of state.units) {
      if (unit.team === "enemy" && enemyById.get(unit.id)?.boss) bosses.set(unit.uid, unit);
    }
  }
  return { state, bosses: [...bosses.values()] };
}

function pressure(stageId) {
  const stage = stageById.get(stageId);
  let hp = 0, dps = 0;
  for (const wave of stage.waves) for (const group of wave.enemies) {
    const enemy = enemyById.get(group.id);
    const shield = group.shield === false ? 0 : (group.shield ?? enemy.shield)?.hpRatio ?? 0;
    hp += enemy.hp * (1 + shield) * (group.count ?? 1);
    dps += enemy.attack * stage.enemyAttack / enemy.attackInterval * (group.count ?? 1);
  }
  return { hp, dps };
}

test("region entry cuts total enemy pressure and pays more for the preceding boss winner", () => {
  const previous = play(10, 35).state;
  assert.equal(previous.result.won, true);
  assert.equal(previous.enemyHp, 0);
  const oldIdle = play(10, 35, "idle").state;
  const entry = play(11, 35, "idle").state;
  assert.equal(entry.result.won, true);
  assert.equal(entry.result.survival, 90);
  assert.ok(entry.result.hpRatio >= 0.9);
  assert.ok(entry.result.reward >= stageById.get(11).baseReward * 0.9);
  assert.ok(entry.result.reward > oldIdle.result.reward);
  const oldPressure = pressure(10), entryPressure = pressure(11);
  assert.ok(entryPressure.hp < oldPressure.hp * 0.35);
  assert.ok(entryPressure.dps < oldPressure.dps * 0.35);
  assert.ok(stageById.get(11).enemyHp < stageById.get(10).enemyHp);
});

test("2-2 sharply raises pressure, and ordinary growth or a machine counter can overcome it", () => {
  const entryPressure = pressure(11), jumpPressure = pressure(12);
  assert.ok(jumpPressure.hp > entryPressure.hp * 3);
  assert.ok(jumpPressure.dps > entryPressure.dps * 3);
  const entry = play(11, 35, "idle").state;
  const blockedIdle = play(12, 35, "idle").state;
  const blockedChallenge = play(12, 35).state;
  assert.equal(blockedIdle.result.won, false);
  assert.ok(blockedIdle.result.reward < entry.result.reward * 0.5);
  assert.equal(blockedChallenge.result.won, false);
  assert.ok(blockedChallenge.enemyHp > 0);
  // Keeping the same three forest companions and raising normal levels works.
  assert.equal(play(12, 50).state.result.won, true);
  assert.equal(play(12, 50, "idle").state.result.won, true);
  // This alternative uses a recruited machine specialist at the original level.
  assert.equal(play(12, 35, "challenge", ["sheep", "teapot", "rabbit"]).state.result.won, true);
});

test("every fifth and tenth stage fields a large boss that can be defeated normally within 90 seconds", () => {
  for (const [stageId, level] of [[5, 4], [10, 35], [15, 100], [20, 100]]) {
    const stage = stageById.get(stageId);
    const groups = stage.waves.flatMap((wave) => wave.enemies);
    const bossGroups = groups.filter((group) => enemyById.get(group.id)?.boss);
    assert.ok(bossGroups.length > 0, `boss missing at ${stageId}`);
    for (const group of bossGroups) {
      const boss = enemyById.get(group.id), original = enemyById.get(boss.artId);
      assert.ok(boss.sizeScale >= 1.5 && boss.sizeScale <= 2);
      assert.ok(boss.hp > original.hp);
      assert.ok(boss.attack * stage.enemyAttack > original.attack);
    }
    const { state, bosses } = play(stageId, level);
    assert.equal(state.result.won, true, `stage ${stageId} at level ${level}`);
    assert.equal(state.enemyHp, 0);
    assert.ok(state.time < 90);
    assert.ok(bosses.length > 0);
    assert.ok(bosses.every((boss) => boss.dead && boss.hp === 0), `boss bypassed at ${stageId}`);
  }
  // A second forest formation without the castle specialist also beats the
  // machine boss: neither one specific unit nor its counter element is required.
  assert.equal(play(20, 100, "challenge", ["sheep", "squirrel", "fox"]).state.result.won, true);
});

test("wave definitions stay within the supported interface and region one remains all wild", () => {
  const supported = new Set(["id", "count", "interval", "x", "attribute", "shield", "regeneration"]);
  for (const stage of STAGES) for (const wave of stage.waves) for (const group of wave.enemies) {
    assert.ok(enemyById.has(group.id), `unknown enemy ${group.id}`);
    for (const key of Object.keys(group)) assert.ok(supported.has(key), `unsupported ${key}`);
    if (stage.region === 1) {
      assert.equal(group.attribute ?? enemyById.get(group.id).attribute, "wild");
      assert.equal(group.shield, false);
      assert.equal(group.regeneration, false);
    }
  }
});
