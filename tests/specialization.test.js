import { applyEffect, remainingEffect, activeEffects } from '../dist/src/combat-effects.js';
import { effect } from '../dist/src/effects.js';
import test from "node:test";
import assert from "node:assert/strict";
import { createBattle, summonUnit, stepBattle } from "../dist/src/engine.js";
import {
  resolveDamage,
  specializationBonus,
} from "../dist/src/combat-rules.js";
import { STAGES, ENEMIES } from "../dist/src/data.js";

const tick = 1 / 30;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function duel(allyId, enemyId, overrides = {}) {
  const state = createBattle({ mode: "challenge", sequence: [] });
  state._spawnSchedule = [{ time: 0, id: enemyId, x: 600, overrides }];
  stepBattle(state, tick);
  state.gold = 1000;
  summonUnit(state, allyId);
  const enemy = state.units.find((u) => u.team === "enemy");
  const ally = state.units.find((u) => u.team === "player");
  ally.x = 500;
  enemy.x = ally.x + Math.min(40, ally.range);
  enemy.attackTimer = 1000;
  enemy.speed = 0;
  enemy.action = null;
  return { state, ally, enemy };
}
function attackOnce(state, attacker) {
  for (let i = 0; i < 60; i++) {
    stepBattle(state, tick);
    if (
      state.events.some((e) => e.type === "attack" && e.uid === attacker.uid)
    ) {
      attacker.attackTimer = 1000;
      while (state.projectiles.length) stepBattle(state, tick);
      return;
    }
  }
  assert.fail("attack was not released");
}

test("forest specialization raises damage only against wild and has no penalty elsewhere", () => {
  const outcomes = [];
  for (const attribute of ["wild", "machine"]) {
    const { state, ally, enemy } = duel("rabbit", "beetle", { attribute });
    const before = enemy.hp;
    attackOnce(state, ally);
    outcomes.push(before - enemy.hp);
  }
  assert.ok(outcomes[0] > outcomes[1]);
  for (const attribute of ["wild", "machine", "spirit", "shadow"]) {
    const { state, ally, enemy } = duel("squirrel", "beetle", { attribute });
    const before = enemy.hp;
    attackOnce(state, ally);
    near(before - enemy.hp, ally.attack * (attribute === "wild" ? 1.4 : 1));
  }
});

test("tank effective HP reduces matching incoming hits without raising global HP", () => {
  const outcomes = [];
  for (const attribute of ["wild", "machine"]) {
    const { state, ally, enemy } = duel("sheep", "beetle", { attribute });
    ally.attackTimer = 1000;
    enemy.attackTimer = 0;
    const before = ally.hp;
    attackOnce(state, enemy);
    outcomes.push(before - ally.hp);
    assert.equal(ally.hp + outcomes.at(-1), ally.maxHp);
  }
  near(outcomes[1] / outcomes[0], 1.4);
});

test("splash specialization evaluates each victim, while castle damage stays neutral", () => {
  const { state, ally, enemy } = duel("teapot", "beetle", {
    attribute: "machine",
  });
  const other = { ...enemy, uid: "other", attribute: "wild", x: enemy.x + 30 };
  state.units.push(other);
  const before = enemy.hp;
  attackOnce(state, ally);
  near(before - enemy.hp, ally.attack * 1.4);
  near(before - other.hp, ally.attack);
});

test("shield absorbs ordinary damage and boosted overflow never amplifies HP damage", () => {
  const target = { team: "enemy", attribute: "machine", shield: 50 };
  const plain = resolveDamage(target, 100, { team: "player" });
  assert.deepEqual(plain, { shieldDamage: 50, hpDamage: 50 });
  const boosted = resolveDamage(target, 100, {
    team: "player",
    effects: { shieldDamage: effect("shieldDamage", {bonus:1}) },
  });
  assert.deepEqual(boosted, { shieldDamage: 50, hpDamage: 75 });
  assert.deepEqual(
    resolveDamage({ ...target, shield: 0 }, 100, { effects: { shieldDamage: effect("shieldDamage", {bonus:1}) } }),
    { shieldDamage: 0, hpDamage: 100 },
  );
});

test("ordinary high damage kills a shield enemy without a counter character", () => {
  const { state, ally, enemy } = duel("squirrel", "clock-beetle");
  assert.ok(enemy.shield > 0);
  ally.attack = enemy.hp + enemy.shield + 1;
  attackOnce(state, ally);
  assert.equal(enemy.shield, 0);
  assert.equal(enemy.dead, true);
});

test("cloud shield aura helps nearby allies, does not stack, and ends outside its range", () => {
  const losses = [];
  for (const positions of [[], [490], [490, 480], [100]]) {
    const { state, ally, enemy } = duel("squirrel", "clock-beetle");
    for (const x of positions) {
      state.gold = 1000;
      state.cooldowns.cloud = 0;
      summonUnit(state, "cloud");
      const cloud = state.units.at(-1);
      cloud.x = x;
      cloud.speed = 0;
      cloud.attackTimer = 1000;
    }
    const before = enemy.shield;
    attackOnce(state, ally);
    losses.push(before - enemy.shield);
  }
  near(losses[1], losses[0] * 2);
  near(losses[2], losses[1]);
  near(losses[3], losses[0]);
});

test("support specialty extends control, including projectiles whose caster has died", () => {
  const remaining = [];
  for (const attribute of ["wild", "spirit"]) {
    const { state, ally, enemy } = duel("cloud", "mushroom", { attribute });
    for (let i = 0; i < 30 && !state.projectiles.length; i++)
      stepBattle(state, tick);
    assert.equal(state.projectiles.length, 1);
    ally.dead = true;
    ally.deathTimer = 0.32;
    while (state.projectiles.length) stepBattle(state, tick);
    remaining.push(remainingEffect(enemy, "slow"));
    assert.ok(remainingEffect(enemy, "healingSuppression") > 0);
    const x = enemy.x;
    enemy.speed = 30;
    enemy.attackTimer = 1000;
    enemy.hitStun = 0;
    enemy.action = null;
    state.mode = "idle";
    stepBattle(state, tick);
    assert.ok(x - enemy.x < 30 * tick);
  }
  near(remaining[1] / remaining[0], 1.3);
});

test("regeneration is capped at max HP, suppression lowers recovery and expires", () => {
  const { state, ally, enemy } = duel("squirrel", "spirit-rabbit");
  ally.attackTimer = 1000;
  enemy.hp = 50;
  enemy.periodicTimers.regeneration = tick;
  stepBattle(state, tick);
  const fullRecovery = enemy.hp - 50;
  assert.ok(fullRecovery > 0);
  enemy.hp = 50;
  enemy.periodicTimers.regeneration = tick;
  applyEffect(enemy, effect("healingSuppression", { factor: .5, duration: 1, scope: "regeneration" }));
  stepBattle(state, tick);
  near(enemy.hp - 50, fullRecovery * 0.5);
  activeEffects(enemy,"healingSuppression")[0].remaining = tick;
  enemy.periodicTimers.regeneration = tick;
  enemy.hp = 50;
  stepBattle(state, tick);
  near(enemy.hp - 50, fullRecovery);
  enemy.hp = enemy.maxHp - 1;
  enemy.periodicTimers.regeneration = tick;
  stepBattle(state, tick);
  assert.equal(enemy.hp, enemy.maxHp);
});

test("same-kind attribute bonuses add with a cap; unrelated attributes stay neutral", () => {
  const warrior = {
    team: "player",
    role: "warrior",
    specialties: ["wild"],
    attributeBonuses: { wild: { attack: 0.1, effectiveHp: 20 } },
  };
  near(specializationBonus(warrior, { attribute: "wild" }, "attack"), 0.3);
  near(specializationBonus(warrior, { attribute: "wild" }, "effectiveHp"), 0.4);
  assert.equal(
    specializationBonus(warrior, { attribute: "machine" }, "attack"),
    0,
  );
});

test("idle survival can succeed with a live shield threat and stages contain all four attributes", () => {
  const { state, ally, enemy } = duel("squirrel", "clock-beetle");
  state.mode = "idle";
  state.duration = state.time + 0.5;
  ally.attackTimer = 1000;
  stepBattle(state, 1);
  assert.equal(state.result.won, true);
  assert.ok(enemy.hp > 0 && enemy.shield > 0);
  const attrs = new Set(
    STAGES.flatMap((s) =>
      s.waves.flatMap((w) =>
        w.enemies.map(
          (g) => g.attribute ?? ENEMIES.find((e) => e.id === g.id).attribute,
        ),
      ),
    ),
  );
  assert.equal(attrs.size, 4);
});

test("regeneration remains beatable by ordinary burst and dead enemies never regenerate", () => {
  const { state, ally, enemy } = duel("squirrel", "spirit-rabbit");
  enemy.hp = 1;
  enemy.periodicTimers.regeneration = tick;
  ally.attack = enemy.maxHp + 1;
  attackOnce(state, ally);
  assert.equal(enemy.dead, true);
  const hp = enemy.hp;
  stepBattle(state, 0.2);
  assert.equal(enemy.hp, hp);
});

test("attribute updates preserve version-1 saves and frozen production records", async () => {
  const { newAccount, normalizeAccount, recordIdle, accrue } = await import(
    "../dist/src/account.js"
  );
  const now = Date.UTC(2026, 9, 11, 3);
  const a = newAccount(now);
  const old = {
    gold: 100,
    diamonds: 0.125,
    snapshot: { stageId: 1, gem: null },
    version: 1,
  };
  a.records[1] = old;
  const loaded = normalizeAccount(JSON.parse(JSON.stringify(a)), now);
  assert.deepEqual(loaded.records[1], old);
  recordIdle(
    loaded,
    { reward: 90, survival: 120, hpRatio: 1 },
    { stageId: 1, gem: null, balanceVersion: "attributes-1", duration: 120 },
    now,
  );
  assert.deepEqual(loaded.records[1], old);
  const gold = loaded.gold;
  accrue(loaded, now + 120000);
  assert.equal(loaded.gold - gold, 100);
  recordIdle(
    loaded,
    { reward: 110, survival: 120, hpRatio: 1 },
    { stageId: 1, gem: null, balanceVersion: "attributes-1", duration: 120 },
    now + 120000,
  );
  assert.equal(loaded.records[1].snapshot.balanceVersion, "attributes-1");
});

test("a fully grown forest lineup can clear other regions without mandatory counter companions", () => {
  for (const stage of STAGES) {
    const state = createBattle({
      mode: "challenge",
      stageId: stage.id,
      sequence: [],
      levels: { squirrel: 100 },
    });
    for (let i = 0; i < 3600 && !state.finished; i++) {
      summonUnit(state, "squirrel");
      stepBattle(state, tick);
    }
    assert.equal(state.result?.won, true, `stage ${stage.id}`);
    assert.ok(
      state.units
        .filter((u) => u.team === "player")
        .every((u) => u.id === "squirrel"),
    );
  }
});


test("first region teaches wild counters and second region introduces metal before mixing", () => {
  const definitions = new Map(ENEMIES.map((enemy) => [enemy.id, enemy]));
  for (const stage of STAGES.filter((stage) => stage.region === 1)) {
    for (const wave of stage.waves) for (const group of wave.enemies) {
      assert.equal(group.attribute ?? definitions.get(group.id).attribute, "wild");
      assert.equal(group.effects.shield, false);
      assert.equal(group.effects.regeneration, false);
    }
  }
  const entry = createBattle({ mode: "challenge", stageId: 11, sequence: [] });
  // The gentler region entrance introduces metal in its second wave.
  stepBattle(entry, 28.5);
  assert.ok(entry.units.some((unit) => unit.attribute === "machine"));
  const opening = createBattle({ mode: "challenge", stageId: 1, sequence: [] });
  stepBattle(opening, 16);
  assert.ok(opening.units.filter((unit) => unit.team === "enemy").every((unit) => unit.attribute === "wild" && !unit.effects.regeneration));
});
