import test from "node:test";
import assert from "node:assert/strict";
import { ATTACK_TYPES, attackTypeName } from "../dist/src/attack-types.js";
import { ENEMIES, UNITS, getEnemy, getUnit } from "../dist/src/characters.js";
import { effect, effectLines, effectText } from "../dist/src/effects.js";
import { characterStats, unitCombatStats, enemyCombatStats } from "../dist/src/character-stats.js";
import { initializeEffects, applyEffect, activeEffects, combatStat, tickRepulsion } from "../dist/src/combat-effects.js";
import { resolveDamage } from "../dist/src/combat-rules.js";
import { createBattle, fireCannon, stepBattle, summonUnit } from "../dist/src/engine.js";

const TICK = 1 / 30;
const MELEE = "melee";
const RANGED = "ranged";
const bossIds = ["grove-bear", "workshop-bear"];

function battleWithEnemies(enemies, stageId = 5) {
  const state = createBattle({ mode: "challenge", stageId, sequence: [] });
  state._spawnSchedule = enemies.map(({ id, x, overrides = {} }) => ({
    id, time: 0, x, overrides,
  }));
  stepBattle(state, TICK);
  for (const unit of state.units) {
    if (unit.team !== "enemy") continue;
    const scheduled = enemies.find((entry) => entry.id === unit.id);
    unit.x = scheduled?.x ?? unit.x;
    unit.speed = 0;
    unit.attackTimer = 1000;
    unit.action = null;
  }
  return state;
}

function summonNear(state, id, x = 400) {
  state.gold = 10000;
  assert.equal(summonUnit(state, id), true);
  const unit = state.units.find((entry) => entry.team === "player" && entry.id === id);
  unit.x = x;
  return unit;
}

function advanceUntil(state, predicate, ticks = 90) {
  for (let i = 0; i < ticks && !predicate(); i += 1) stepBattle(state, TICK);
  assert.ok(predicate(), "battle did not reach the expected combat event");
}

test("attack type is explicit across the character registry and selects snapshot modifiers", () => {
  assert.deepEqual(Object.keys(ATTACK_TYPES), [MELEE, RANGED]);
  assert.equal(attackTypeName(MELEE), "근거리");
  assert.equal(attackTypeName(RANGED), "원거리");
  for (const character of [...UNITS, ...ENEMIES]) {
    assert.ok(Object.hasOwn(ATTACK_TYPES, character.attackType), `${character.id} needs a fixed attack type`);
    assert.ok(attackTypeName(character.attackType));
  }

  const modifiers = { attackTypes: { melee: { attack: 2 }, ranged: { attack: 3 } } };
  const rabbit = unitCombatStats(getUnit("rabbit"), 1, modifiers);
  const squirrel = unitCombatStats(getUnit("squirrel"), 1, modifiers);
  const beetle = enemyCombatStats("beetle", {}, {}, modifiers);
  const porcupine = enemyCombatStats("porcupine", {}, {}, modifiers);
  assert.equal(rabbit.attackType, MELEE);
  assert.equal(rabbit.attack, getUnit("rabbit").attack * 2);
  assert.equal(squirrel.attackType, RANGED);
  assert.equal(squirrel.attack, getUnit("squirrel").attack * 3);
  assert.equal(beetle.attackType, MELEE);
  assert.equal(beetle.attack, getEnemy("beetle").attack * 2);
  assert.equal(porcupine.attackType, RANGED);
  assert.equal(porcupine.attack, getEnemy("porcupine").attack * 3);

  // A definition's attack type remains authoritative when its role, distance,
  // and projectile fields point the other way.
  const explicitMelee = characterStats({
    ...getUnit("rabbit"), role: "ranged", range: 300,
    projectile: getUnit("squirrel").projectile,
  }, { modifiers });
  const explicitRanged = characterStats({
    ...getUnit("squirrel"), role: "fast", range: 42,
    projectile: undefined,
  }, { modifiers });
  assert.equal(explicitMelee.attackType, MELEE);
  assert.equal(explicitMelee.attack, getUnit("rabbit").attack * 2);
  assert.equal(explicitRanged.attackType, RANGED);
  assert.equal(explicitRanged.attack, getUnit("squirrel").attack * 3);
});

test("attack-type stat effects apply only to matching attacks and keep separate origins by scope", () => {
  for (const attackType of [MELEE, RANGED]) {
    const unit = initializeEffects({
      uid: attackType, team: "player", attackType,
      hp: 100, maxHp: 100, attack: 80, speed: 40, range: 50, attackInterval: 1,
    }, {});
    const scoped = effect("stat", { stat: "attack", multiplier: 1.5, duration: 4, attackType: "melee" });
    assert.equal(applyEffect(unit, scoped), attackType === MELEE);
    assert.equal(combatStat(unit, "attack"), attackType === MELEE ? 120 : 80);
    const unscoped = effect("stat", { stat: "attack", multiplier: 1.2, duration: 4 });
    assert.equal(applyEffect(unit, unscoped), true);
    assert.equal(combatStat(unit, "attack"), attackType === MELEE ? 144 : 96);
    assert.equal(activeEffects(unit, "stat").length, attackType === MELEE ? 2 : 1);
  }
});

test("ranged immunity blocks damage, while a melee hit remains ordinary", () => {
  const boss = getEnemy("grove-bear");
  assert.deepEqual(resolveDamage(boss, 100, { team: "player", attackType: "ranged" }), {
    hpDamage: 0, shieldDamage: 0, blocked: true,
  });
  assert.deepEqual(resolveDamage(boss, 100, { team: "player", attackType: "melee" }), {
    hpDamage: 100, shieldDamage: 0,
  });
});

test("released projectiles retain ranged type, immunity blocks cloud debuffs, and splash can hit nearby enemies", () => {
  const cloudBattle = battleWithEnemies([{ id: "grove-bear", x: 600 }]);
  const boss = cloudBattle.units.find((unit) => unit.id === "grove-bear");
  const cloud = summonNear(cloudBattle, "cloud", 400);
  advanceUntil(cloudBattle, () => cloudBattle.projectiles.length > 0);
  const released = cloudBattle.projectiles[0];
  assert.equal(released.source.attackType, RANGED);
  cloud.attackType = MELEE;
  assert.equal(released.source.attackType, RANGED);
  while (cloudBattle.projectiles.length) stepBattle(cloudBattle, TICK);
  assert.equal(boss.hp, boss.maxHp);
  assert.equal(activeEffects(boss, "slow").length, 0);
  assert.equal(activeEffects(boss, "healingSuppression").length, 0);

  const splashBattle = battleWithEnemies([
    { id: "grove-bear", x: 600 },
    { id: "beetle", x: 650 },
  ]);
  const immuneBoss = splashBattle.units.find((unit) => unit.id === "grove-bear");
  const nearby = splashBattle.units.find((unit) => unit.id === "beetle");
  summonNear(splashBattle, "teapot", 500);
  advanceUntil(splashBattle, () => splashBattle.projectiles.length > 0);
  while (splashBattle.projectiles.length) stepBattle(splashBattle, TICK);
  assert.equal(immuneBoss.hp, immuneBoss.maxHp);
  assert.ok(nearby.hp < nearby.maxHp, "the same ranged splash should still damage a non-immune neighbor");
});

test("cannon damage and displacement are both blocked by boss ranged immunity", () => {
  for (const id of bossIds) {
    const state = battleWithEnemies([{ id, x: 600 }]);
    const boss = state.units.find((unit) => unit.id === id);
    const before = { hp: boss.hp, shield: boss.shield, x: boss.x };
    assert.equal(fireCannon(state), true);
    assert.equal(boss.hp, before.hp, `${id} HP`);
    assert.equal(boss.shield, before.shield, `${id} shield`);
    assert.equal(boss.x, before.x, `${id} position`);
  }
});

test("repulsion warns and pulses on its own timer, displacing only eligible melee enemies", () => {
  const definition = getEnemy("grove-bear");
  const source = initializeEffects({
    uid: "repeller", team: "enemy", attackType: definition.attackType,
    x: 500, hp: definition.hp, maxHp: definition.hp, attackTimer: 1000,
    action: { phase: "windup", elapsed: 0, duration: 1 },
  }, definition);
  const target = (uid, team, attackType, x, effects = {}) => initializeEffects({
    uid, team, attackType, x, hp: 100, maxHp: 100, dead: false,
    action: { phase: "windup", elapsed: 0, duration: 1 },
  }, { effects });
  const melee = target("melee", "player", "melee", 450);
  const friendly = target("friendly", "enemy", "melee", 460);
  const ranged = target("ranged", "player", "ranged", 470);
  const outside = target("outside", "player", "melee", 300);
  const dead = target("dead", "player", "melee", 480);
  dead.dead = true;
  const immune = target("immune", "player", "melee", 490, {
    immunity: effect("immunity", { effect: "knockback" }),
  });
  const units = [source, melee, friendly, ranged, outside, dead, immune];
  const skipped = [friendly, ranged, outside, dead, immune].map(unit => ({
    unit, x: unit.x, action: unit.action,
  }));
  const warnings = [], pulses = [];
  const callbacks = {
    warning: spec => warnings.push(spec),
    pulse: spec => pulses.push(spec),
  };

  tickRepulsion(source, 2.5, units, callbacks);
  assert.equal(warnings.length, 1);
  assert.equal(pulses.length, 0);
  assert.equal(melee.x, 450, "warning leaves units in place");
  tickRepulsion(source, 0.3, units, callbacks);

  assert.equal(pulses.length, 1);
  assert.equal(melee.x, 330);
  assert.equal(melee.action, null, "a displaced windup is cancelled");
  for (const before of skipped) {
    assert.equal(before.unit.x, before.x);
    assert.strictEqual(before.unit.action, before.action);
  }
  assert.ok(units.every(unit => unit.hp === (unit === source ? definition.hp : 100)));
  assert.ok(source.attackTimer > 0, "the pulse does not depend on a standard attack");
});

test("a fast melee companion reaches the boss before the pulse, while a slow melee companion is pushed back", () => {
  function shortFight(unitId) {
    const state = battleWithEnemies([{ id: "grove-bear", x: 600 }]);
    const boss = state.units.find((unit) => unit.id === "grove-bear");
    const initialHp = boss.hp;
    const ally = summonNear(state, unitId, 400);
    for (let i = 0; i < 96; i += 1) stepBattle(state, TICK);
    return { boss, initialHp, ally };
  }
  const fast = shortFight("rabbit");
  const slow = shortFight("sheep");
  assert.ok(fast.boss.hp < fast.initialHp, "the fast melee unit should land a real hit before repulsion");
  assert.equal(slow.boss.hp, slow.initialHp, "the slow melee unit should not reach attack range before repulsion");
  assert.ok(Math.abs(slow.ally.x - slow.boss.x) > slow.ally.range);
});

test("both early bosses expose readable ranged immunity and repulsion effects", () => {
  const expectedHp = { "grove-bear": 420, "workshop-bear": 900 };
  for (const id of bossIds) {
    const boss = getEnemy(id);
    assert.equal(boss.hp, expectedHp[id]);
    const immunity = effectText(boss.effects.attackImmunity);
    const repulsion = effectText(boss.effects.repelPulse);
    assert.match(immunity, /원거리/);
    assert.match(immunity, /공격 무효/);
    assert.match(repulsion, /밀쳐내기/);
    assert.ok(effectLines(boss).every(line => line && !/undefined|NaN/.test(line)));
  }
});


test("stage and wave attack-type multipliers compose for spawned enemies without mutating definitions", () => {
  const baseline = createBattle({ mode: "challenge", stageId: 1, sequence: [] });
  const state = createBattle({ mode: "challenge", stageId: 1, sequence: [],
    enemyModifiers: { attackTypes: { melee: { attack: 2 }, ranged: { attack: 3 } } },
  });
  const schedule = ["beetle", "mushroom"].map(id => ({id, time: 0,
    overrides: { statMultipliers: { attackTypes: { melee: { attack: 1.5 }, ranged: { attack: 2 } } } },
  }));
  baseline._spawnSchedule = schedule.map(({id,time}) => ({id,time,overrides:{}}));
  state._spawnSchedule = schedule;
  stepBattle(baseline, TICK); stepBattle(state, TICK);
  assert.equal(state.units.length, 2);
  assert.equal(baseline.units.length, 2);
  for (const enemy of state.units) {
    const original = baseline.units.find(unit => unit.id === enemy.id);
    const multiplier = enemy.attackType === "melee" ? 3 : 6;
    assert.equal(enemy.attack, Math.round(getEnemy(enemy.id).attack * baseline._enemyModifiers.attack * multiplier));
    assert.equal(original.attack, Math.round(getEnemy(enemy.id).attack * baseline._enemyModifiers.attack));
  }
});
