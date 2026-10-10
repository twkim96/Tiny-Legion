import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateIdleReward,
  createBattle,
  stepBattle,
  summonUnit,
} from "../dist/src/engine.js";

const FIXED_STEP = 1 / 30;

test("equipped gem modifiers affect newly summoned allies without strengthening enemies", () => {
  const normal = createBattle({ mode: "challenge" });
  const enhanced = createBattle({ mode: "challenge", modifiers: { hp: 1.15, attack: 1.1 } });
  summonUnit(normal, "sheep");
  summonUnit(enhanced, "sheep");
  assert.ok(enhanced.units[0].maxHp > normal.units[0].maxHp);
  assert.ok(enhanced.units[0].attack > normal.units[0].attack);
  stepBattle(normal, 1);
  stepBattle(enhanced, 1);
  const normalEnemy = normal.units.find(unit => unit.team === "enemy");
  const enhancedEnemy = enhanced.units.find(unit => unit.team === "enemy");
  assert.ok(normalEnemy && enhancedEnemy);
  assert.equal(enhancedEnemy.maxHp, normalEnemy.maxHp);
  assert.equal(enhancedEnemy.attack, normalEnemy.attack);
});

test("idle queue checks gold before cooldown and holds its current entry", () => {
  const state = createBattle({ mode: "idle", sequence: ["sheep"] });
  state.gold = 0;
  state.cooldowns.sheep = 1;

  stepBattle(state, FIXED_STEP);

  assert.equal(state.waitingReason, "gold");
  assert.equal(state.sequenceIndex, 0);
  assert.equal(
    state.units.some((unit) => unit.team === "player"),
    false,
  );
});

test("idle queue skips a cooling unit and duplicate entries share one cooldown", () => {
  const skipped = createBattle({ mode: "idle", sequence: ["sheep", "rabbit"] });
  skipped.gold = 1000;
  skipped.cooldowns.sheep = 1;
  stepBattle(skipped, FIXED_STEP);
  assert.equal(skipped.units.filter((unit) => unit.id === "rabbit").length, 1);
  assert.equal(skipped.sequenceIndex, 0);

  const duplicate = createBattle({
    mode: "idle",
    sequence: ["sheep", "sheep"],
  });
  duplicate.gold = 1000;
  stepBattle(duplicate, FIXED_STEP);
  assert.equal(duplicate.units.filter((unit) => unit.id === "sheep").length, 1);
  assert.ok(duplicate.cooldowns.sheep > 0);
  assert.equal(duplicate.sequenceIndex, 0);
});

test("idle queue with only cooling units completes one traversal and returns", () => {
  const state = createBattle({
    mode: "idle",
    sequence: ["sheep", "rabbit", "cloud"],
  });
  state.gold = 1000;
  state.cooldowns.sheep = 5;
  state.cooldowns.rabbit = 5;
  state.cooldowns.cloud = 5;

  stepBattle(state, FIXED_STEP);

  assert.equal(state.waitingReason, "cooldown");
  assert.equal(state.sequenceIndex, 0);
  assert.equal(
    state.units.some((unit) => unit.team === "player"),
    false,
  );
});

test("same inputs produce identical deterministic battles", () => {
  const left = createBattle({ mode: "idle", stageId: 1 });
  const right = createBattle({ mode: "idle", stageId: 1 });
  let sawCombat = false;
  for (let frame = 0; frame < 300; frame += 1) {
    stepBattle(left, FIXED_STEP);
    stepBattle(right, FIXED_STEP);
    sawCombat ||= left.events.some((event) => event.type === "attack");
  }

  assert.deepEqual(left, right);
  assert.equal(sawCombat, true);
});

test("idle survival completes with normalized raw HP and integer reward", () => {
  const state = createBattle({
    mode: "idle",
    stageId: 1,
    sequence: [],
    duration: 3,
  });
  state.playerHp = 500;

  stepBattle(state, 3);

  assert.equal(state.finished, true);
  assert.equal(state.result.won, true);
  assert.ok(Math.abs(state.result.survival - 3) < 1e-9);
  assert.equal(state.result.hpRatio, 0.5);
  assert.equal(state.result.reward, calculateIdleReward(1, 3, 0.5));
  assert.equal(Number.isInteger(state.result.reward), true);
  assert.equal(calculateIdleReward(1, 120, 1), 100);
});

test("challenge summons spend gold and apply a shared cooldown", () => {
  const state = createBattle({ mode: "challenge", sequence: [] });
  const startingGold = state.gold;

  assert.equal(summonUnit(state, "sheep"), true);
  assert.equal(state.gold, startingGold - 85);
  assert.equal(state.cooldowns.sheep, 3.4);
  assert.equal(summonUnit(state, "sheep"), false);
});

test("challenge can win by destroying the enemy castle", () => {
  const state = createBattle({ mode: "challenge", sequence: [] });
  state.enemyHp = 20;
  assert.equal(summonUnit(state, "squirrel"), true);
  const attacker = state.units.find((unit) => unit.id === "squirrel");
  attacker.x = 1000;

  stepBattle(state, FIXED_STEP);

  assert.equal(state.finished, true);
  assert.equal(state.result.won, true);
  assert.equal(state.enemyHp, 0);
});

test("challenge loses when an enemy destroys the player castle", () => {
  const state = createBattle({ mode: "challenge", sequence: [] });
  state.playerHp = 20;
  state.units.push({
    uid: "test-enemy",
    id: "beetle",
    team: "enemy",
    x: 100,
    hp: 100,
    maxHp: 100,
    attack: 24,
    range: 42,
    speed: 36,
    attackTimer: 0,
    attackInterval: 1.35,
  });

  stepBattle(state, FIXED_STEP);

  assert.equal(state.finished, true);
  assert.equal(state.result.won, false);
  assert.equal(state.playerHp, 0);
});
