import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateIdleReward,
  createBattle,
  fireCannon,
  stepBattle,
  summonUnit,
} from "../dist/src/engine.js";
import { ENEMIES, STAGES, UNITS } from "../dist/src/data.js";

const FIXED_STEP = 1 / 30;

test("opening waves enter from the enemy castle and walk left in every mode", () => {
  for (const mode of ["idle", "challenge", "speedrun"]) {
    for (const stage of STAGES) {
      const state = createBattle({ mode, stageId: stage.id, sequence: [] });
      const wave = stage.waves[0];
      const group = wave.enemies[0];
      assert.equal(state.time, 0);
      assert.equal(state.units.length, 0);
      stepBattle(state, wave.time - FIXED_STEP);
      assert.equal(state.units.length, 0);

      stepBattle(state, FIXED_STEP + (group.count - 1) * group.interval + 0.1);
      const spawns = state.events.filter((event) => event.type === "spawn");
      assert.equal(spawns.length, group.count, `${mode} stage ${stage.id}`);
      assert.ok(spawns.every((event) => event.x >= 1000 && event.x < 1120));
      assert.ok(state.units.every((enemy) => enemy.team === "enemy"));
      for (let index = 0; index < spawns.length; index++) {
        assert.ok(state.units[index].x < spawns[index].x);
      }
    }
  }
});

test("first journey wins stage zero, loses with shields and wins with a ranged ally", () => {
  function play(phase, sequence) {
    const state = createBattle({ mode: "challenge", onboardingPhase: phase, ownedUnits: sequence });
    let index = 0;
    while (!state.finished) {
      if (summonUnit(state, sequence[index])) index = (index + 1) % sequence.length;
      stepBattle(state, FIXED_STEP);
    }
    return state;
  }
  const intro = play("intro", ["sheep"]);
  assert.equal(intro.stageId, 0);
  assert.equal(intro.result.won, true);
  assert.equal(intro.result.reward, 0);
  const first = play("first-battle", ["sheep"]);
  assert.equal(first.stageId, 1);
  assert.equal(first.result.won, false);
  assert.ok(first.enemyHp > 0);
  const retry = play("retry-battle", ["sheep", "squirrel"]);
  assert.equal(retry.result.won, true);
  assert.equal(retry.enemyHp, 0);
  // Intro settings cannot alter ordinary encounters or idle production.
  const idle = createBattle({ mode: "idle", onboardingPhase: "intro", stageId: 1 });
  const normal = createBattle({ mode: "challenge", stageId: 1 });
  assert.equal(idle.stageId, 1);
  assert.equal(idle.duration, 120);
  assert.equal(normal.enemyMaxHp, STAGES[0].enemyHp);
});

test("every companion can be afforded by saving and spends its full price", () => {
  for (const unit of UNITS) {
    const state = createBattle({ mode: "challenge", sequence: [] });
    state._spawnSchedule = [];
    assert.ok(unit.cost <= state.maxGold);
    assert.equal(summonUnit(state, unit.id), false);
    assert.equal(state.units.length, 0);
    state.gold = unit.cost - 1;
    assert.equal(summonUnit(state, unit.id), false);
    stepBattle(state, FIXED_STEP);
    const available = state.gold;
    assert.equal(summonUnit(state, unit.id), true);
    assert.equal(state.gold, available - unit.cost);
    assert.equal(state.units[0].id, unit.id);
  }
});

test("an expensive idle queue entry waits for its price and then advances once", () => {
  const unit = UNITS.find((unit) => unit.id === "teapot");
  const state = createBattle({ mode: "idle", sequence: [unit.id, "sheep"] });
  state._spawnSchedule = [];
  state.gold = unit.cost - 2;
  stepBattle(state, FIXED_STEP);
  assert.equal(state.waitingReason, "gold");
  assert.equal(state.sequenceIndex, 0);
  assert.equal(state.units.length, 0);
  stepBattle(state, FIXED_STEP);
  assert.equal(state.units.filter((ally) => ally.id === unit.id).length, 1);
  assert.equal(state.sequenceIndex, 1);
  assert.ok(state.gold < 1);
});

test("equipped gem modifiers affect newly summoned allies without strengthening enemies", () => {
  const normal = createBattle({ mode: "challenge" });
  const enhanced = createBattle({
    mode: "challenge",
    modifiers: { hp: 1.15, attack: 1.1 },
  });
  normal.gold = enhanced.gold = 1000;
  assert.equal(summonUnit(normal, "sheep"), true);
  assert.equal(summonUnit(enhanced, "sheep"), true);
  assert.ok(enhanced.units[0].maxHp > normal.units[0].maxHp);
  assert.ok(enhanced.units[0].attack > normal.units[0].attack);
  stepBattle(normal, 1);
  stepBattle(enhanced, 1);
  const normalEnemy = normal.units.find((unit) => unit.team === "enemy");
  const enhancedEnemy = enhanced.units.find((unit) => unit.team === "enemy");
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
  // Run through combat even when the opening wave starts at the distant castle.
  for (let frame = 0; frame < 3600 && !left.finished; frame += 1) {
    stepBattle(left, FIXED_STEP);
    stepBattle(right, FIXED_STEP);
    sawCombat ||= left.events.some((event) => event.type === "attack");
  }

  assert.deepEqual(left, right);
  assert.equal(sawCombat, true);
  assert.equal(left.finished, true);
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
  state.gold = 1000;
  const startingGold = state.gold;

  assert.equal(summonUnit(state, "sheep"), true);
  assert.equal(
    state.gold,
    startingGold - UNITS.find((unit) => unit.id === "sheep").cost,
  );
  assert.equal(state.cooldowns.sheep, 3.4);
  assert.equal(summonUnit(state, "sheep"), false);
});

test("challenge can win by destroying the enemy castle", () => {
  const state = createBattle({ mode: "challenge", sequence: [] });
  state.gold = 1000;
  state.enemyHp = 20;
  assert.equal(summonUnit(state, "squirrel"), true);
  const attacker = state.units.find((unit) => unit.id === "squirrel");
  attacker.x = 1000;

  stepBattle(state, FIXED_STEP);
  assert.equal(state.finished, false);
  assert.equal(state.enemyHp, 20);
  stepBattle(state, 0.5);

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
  assert.equal(state.finished, false);
  assert.equal(state.playerHp, 20);
  stepBattle(state, 0.4);

  assert.equal(state.finished, true);
  assert.equal(state.result.won, false);
  assert.equal(state.playerHp, 0);
});

function isolatedFight(allyId = "sheep", enemyId = "beetle", distance = 40) {
  const state = createBattle({ mode: "challenge", sequence: [] });
  state._spawnSchedule = [];
  state.gold = 1000;
  assert.equal(summonUnit(state, allyId), true);
  const ally = state.units[0];
  ally.x = 500;
  const definition = ENEMIES.find((enemy) => enemy.id === enemyId);
  const enemy = {
    ...definition,
    uid: "e-test",
    team: "enemy",
    x: ally.x + distance,
    maxHp: definition.hp,
    attackTimer: 1000,
    action: null,
    hitStun: 0,
    hitFlash: 0,
    attackFlash: 0,
    stunCooldown: 0,
    speed: 0,
  };
  state.units.push(enemy);
  return { state, ally, enemy };
}

function releaseAttack(state, attacker) {
  for (let tick = 0; tick < 60; tick++) {
    stepBattle(state, FIXED_STEP);
    if (
      state.events.some(
        (event) => event.type === "attack" && event.uid === attacker.uid,
      )
    )
      return;
  }
  assert.fail("Attack did not leave preparation");
}

function landShot(state) {
  for (let tick = 0; tick < 60 && state.projectiles.length; tick++)
    stepBattle(state, FIXED_STEP);
  assert.equal(state.projectiles.length, 0);
}

test("melee damage waits for anticipation and is applied once during recovery", () => {
  const { state, ally, enemy } = isolatedFight();
  const hp = enemy.hp;
  stepBattle(state, FIXED_STEP);
  assert.equal(ally.action.phase, "windup");
  assert.equal(enemy.hp, hp);
  stepBattle(state, FIXED_STEP);
  assert.equal(enemy.hp, hp);
  releaseAttack(state, ally);
  assert.equal(ally.action.phase, "recovery");
  assert.equal(enemy.hp, hp - ally.attack);
  assert.equal(
    state.events.filter((event) => event.type === "impact").length,
    1,
  );
  stepBattle(state, FIXED_STEP * 2);
  assert.equal(enemy.hp, hp - ally.attack);
});

for (const [attackerId, kind, team] of [
  ["squirrel", "seed", "player"],
  ["teapot", "water", "player"],
  ["cloud", "bolt", "player"],
  ["mushroom", "spore", "enemy"],
]) {
  test(`${team} ${kind} projectile deals damage on arrival rather than launch`, () => {
    const { state, ally, enemy } = isolatedFight(
      team === "player" ? attackerId : "sheep",
      team === "enemy" ? attackerId : "beetle",
      100,
    );
    const attacker = team === "player" ? ally : enemy;
    const target = team === "player" ? enemy : ally;
    target.attackTimer = 1000;
    target.speed = 0;
    attacker.attackTimer = 0;
    const hp = target.hp;
    releaseAttack(state, attacker);
    assert.equal(state.projectiles.length, 1);
    assert.equal(state.projectiles[0].kind, kind);
    assert.equal(state.projectiles[0].team, team);
    assert.equal(state.projectiles[0].target.uid, target.uid);
    assert.equal(target.hp, hp);
    stepBattle(state, FIXED_STEP);
    assert.ok(state.projectiles[0].elapsed > 0);
    assert.equal(target.hp, hp);
    landShot(state);
    assert.equal(target.hp, hp - attacker.attack);
    assert.equal(
      state.events.filter((event) => event.type === "impact").length,
      1,
    );
    stepBattle(state, FIXED_STEP);
    assert.equal(target.hp, hp - attacker.attack);
  });
}

test("a released projectile survives its shooter and follows its original moving target", () => {
  const { state, ally, enemy } = isolatedFight("squirrel", "beetle", 180);
  releaseAttack(state, ally);
  const hp = enemy.hp;
  ally.dead = true;
  ally.deathTimer = 0.32;
  enemy.x += 30;
  stepBattle(state, FIXED_STEP);
  assert.equal(state.projectiles[0].targetX, enemy.x);
  landShot(state);
  assert.equal(enemy.hp, hp - ally.attack);
});

test("a single-target projectile cannot redirect to another unit after its target dies", () => {
  const { state, ally, enemy } = isolatedFight("squirrel", "beetle", 150);
  releaseAttack(state, ally);
  const other = { ...enemy, uid: "e-other", x: enemy.x + 10 };
  state.units.push(other);
  enemy.dead = true;
  enemy.deathTimer = 0.32;
  const hp = other.hp;
  landShot(state);
  assert.equal(other.hp, hp);
  assert.equal(
    state.events.find((event) => event.type === "impact").hit,
    false,
  );
});

test("water splashes around its landing point even if the original target has died", () => {
  const { state, ally, enemy } = isolatedFight("teapot", "beetle", 150);
  const nearby = { ...enemy, uid: "e-near", x: enemy.x + 50 };
  const distant = { ...enemy, uid: "e-far", x: enemy.x + 140 };
  state.units.push(nearby, distant);
  releaseAttack(state, ally);
  const hp = nearby.hp;
  enemy.dead = true;
  enemy.deathTimer = 0.32;
  landShot(state);
  assert.equal(nearby.hp, hp - ally.attack);
  assert.equal(distant.hp, hp);
});

test("cloud support heals once at release and does not repeat on projectile impact", () => {
  const { state, ally, enemy } = isolatedFight("cloud", "beetle", 150);
  state.gold = 1000;
  summonUnit(state, "sheep");
  const patient = state.units.find((unit) => unit.id === "sheep");
  patient.x = ally.x - 10;
  patient.hp = 100;
  patient.speed = 0;
  patient.attackTimer = 1000;
  stepBattle(state, FIXED_STEP);
  assert.equal(patient.hp, 100);
  releaseAttack(state, ally);
  const healedHp = patient.hp;
  assert.ok(healedHp > 100);
  assert.ok(state.events.some((event) => event.type === "heal"));
  landShot(state);
  assert.equal(patient.hp, healedHp);
  assert.equal(enemy.hp, enemy.maxHp - ally.attack);
});

test("hit stun suspends enemy movement and preparation; repeated hits cannot perpetually renew it", () => {
  const { state, ally, enemy } = isolatedFight("sheep", "boar");
  ally.attackTimer = 1000;
  enemy.attackTimer = 0;
  stepBattle(state, FIXED_STEP);
  assert.equal(enemy.action.phase, "windup");
  fireCannon(state);
  const x = enemy.x;
  const prepared = enemy.action.elapsed;
  assert.ok(enemy.hitStun > 0);
  stepBattle(state, FIXED_STEP);
  assert.equal(enemy.x, x);
  assert.equal(enemy.action.elapsed, prepared);
  const remainingStun = enemy.hitStun;
  const hp = enemy.hp;
  fireCannon(state);
  assert.equal(enemy.hp, hp - 110);
  assert.equal(enemy.hitStun, remainingStun);
  stepBattle(state, 0.3);
  assert.equal(enemy.hitStun, 0);
  assert.ok(enemy.action.elapsed > prepared);
  fireCannon(state);
  assert.equal(enemy.hitStun, 0);
});

test("allied hit stun blocks movement and a heavy hit gives a longer recoil", () => {
  const { state, ally, enemy } = isolatedFight("rabbit", "boar", 40);
  ally.attackTimer = 1000;
  enemy.attackTimer = 0;
  releaseAttack(state, enemy);
  assert.ok(ally.hitStun > 0);
  assert.ok(ally.hitStunDuration > 0.18);
  enemy.x += 200;
  const x = ally.x;
  stepBattle(state, FIXED_STEP);
  assert.equal(ally.x, x);
  stepBattle(state, 0.3);
  assert.ok(ally.x > x);
});

test("both committed melee hits resolve together even when they are lethal", () => {
  const { state, ally, enemy } = isolatedFight();
  for (const [unit, target] of [
    [ally, enemy],
    [enemy, ally],
  ]) {
    unit.hp = 1;
    unit.action = {
      phase: "windup",
      elapsed: 0,
      duration: FIXED_STEP,
      kind: "melee",
      target: { kind: "unit", uid: target.uid, x: target.x, team: target.team },
    };
  }
  stepBattle(state, FIXED_STEP);
  assert.equal(ally.dead, true);
  assert.equal(enemy.dead, true);
  assert.equal(
    state.events.filter((event) => event.type === "death").length,
    2,
  );
});

test("a multi-step update retains release and impact events and cannon respects mode limits", () => {
  const { state, ally, enemy } = isolatedFight("squirrel", "beetle", 150);
  const hp = enemy.hp;
  stepBattle(state, 0.8);
  assert.ok(
    state.events.some(
      (event) => event.type === "attack" && event.uid === ally.uid,
    ),
  );
  assert.ok(state.events.some((event) => event.type === "impact"));
  assert.equal(enemy.hp, hp - ally.attack);
  assert.equal(fireCannon(createBattle({ mode: "idle" })), false);
  state.finished = true;
  assert.equal(fireCannon(state), false);
});

test("a prepared melee hit misses a target pushed beyond its reach", () => {
  const { state, ally, enemy } = isolatedFight();
  const hp = enemy.hp;
  stepBattle(state, FIXED_STEP);
  enemy.x += 100;
  releaseAttack(state, ally);
  assert.equal(enemy.hp, hp);
  assert.equal(
    state.events.find((event) => event.type === "impact").hit,
    false,
  );
});

test("water impact can damage a nearby castle while single-target shots only hit their target", () => {
  for (const allyId of ["teapot", "squirrel"]) {
    const { state, ally, enemy } = isolatedFight(allyId, "beetle", 150);
    ally.x = 900;
    enemy.x = 1070;
    const hp = state.enemyHp;
    releaseAttack(state, ally);
    landShot(state);
    assert.equal(state.enemyHp, allyId === "teapot" ? hp - ally.attack : hp);
  }
});

test("batched fixed ticks preserve the same attack, projectile and stun outcomes", () => {
  const { state } = isolatedFight("teapot", "mushroom", 150);
  state.units[1].attackTimer = 0;
  const batched = structuredClone(state);
  for (let tick = 0; tick < 60; tick++) stepBattle(state, FIXED_STEP);
  stepBattle(batched, 2);
  assert.deepEqual(batched.units, state.units);
  assert.deepEqual(batched.projectiles, state.projectiles);
  assert.equal(batched.playerHp, state.playerHp);
  assert.equal(batched.enemyHp, state.enemyHp);
});
