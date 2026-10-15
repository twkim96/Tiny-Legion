import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateIdleReward,
  createBattle,
  fireCannon,
  stepBattle,
  summonUnit,
} from "../dist/src/engine.js";
import { BALANCE_VERSION, ENEMIES, STAGES, UNITS } from "../dist/src/data.js";
import { earlyGuideEncounter } from "../dist/src/onboarding.js";

const FIXED_STEP = 1 / 30;

function playIdle(sequence, phase) {
  const state = createBattle({
    mode: "idle",
    stageId: 2,
    earlyGuidePhase: phase,
    sequence,
  });
  while (!state.finished) stepBattle(state, FIXED_STEP);
  return state;
}

function playChallenge(sequence, phase, cannonCooldown = 25, delay = 0) {
  const state = createBattle({
    mode: "challenge",
    stageId: 2,
    earlyGuidePhase: phase,
    ownedUnits: sequence,
    sequence: [],
  });
  let nextSummon = delay;
  let sequenceIndex = 0;
  let nextCannon = 8;
  const cannonTimes = [];
  const bears = new Map();

  while (!state.finished) {
    assert.ok(state.time < 600, "encounter must resolve before test safety horizon");
    if (state.time + 1e-8 >= nextSummon) {
      const unitId = sequence[sequenceIndex];
      if (summonUnit(state, unitId)) {
        sequenceIndex = (sequenceIndex + 1) % sequence.length;
      }
      nextSummon = state.time + 2;
    }
    if (
      cannonCooldown !== null &&
      state.time + 1e-8 >= nextCannon &&
      state.units.some((unit) => unit.team === "enemy" && !unit.dead) &&
      fireCannon(state)
    ) {
      cannonTimes.push(state.time);
      nextCannon = state.time + cannonCooldown;
    }
    stepBattle(state, FIXED_STEP);
    for (const unit of state.units) if (unit.id === "grove-bear") bears.set(unit.uid, unit);
  }

  return { state, cannonTimes, bears: [...bears.values()] };
}

test("1-2 idle guide phases reuse stage 2 and distinguish rabbit defense pressure", () => {
  const phases = ["idle-defense", "remove-rabbit", "idle-retry"];
  const cleanSequence = ["sheep", "squirrel"];
  const rabbitSequence = ["sheep", "squirrel", "rabbit"];
  const clean = phases.map((phase) => playIdle(cleanSequence, phase));
  const rabbit = phases.map((phase) => playIdle(rabbitSequence, phase));

  for (const state of [...clean, ...rabbit]) {
    assert.equal(state.duration, 40);
    assert.equal(state._baseReward, STAGES.find((stage) => stage.id === 2).baseReward);
    assert.equal(
      state.result.reward,
      calculateIdleReward(2, state.result.survival, state.result.hpRatio),
    );
    assert.deepEqual(state._spawnSchedule, clean[0]._spawnSchedule);
  }
  assert.ok(clean.every((state) => state.result.won && state.playerHp > 0));
  assert.ok(rabbit.every((state) => !state.result.won && state.playerHp === 0));
  assert.equal(earlyGuideEncounter("growth", "idle"), null);
  assert.strictEqual(
    earlyGuideEncounter("idle-defense", "idle"),
    earlyGuideEncounter("remove-rabbit", "idle"),
  );
  assert.strictEqual(
    earlyGuideEncounter("remove-rabbit", "idle"),
    earlyGuideEncounter("idle-retry", "idle"),
  );
  assert.equal(earlyGuideEncounter("idle-defense", "challenge"), null);
  assert.equal(clean[0]._spawnSchedule[0].x, 1132);

  const normal = createBattle({ mode: "idle", stageId: 2, sequence: cleanSequence });
  assert.deepEqual(normal._spawnSchedule, clean[0]._spawnSchedule);
  assert.equal(normal._baseReward, clean[0]._baseReward);
});

test("wall tutorial loses without rabbit and wins naturally at the real cannon cooldown", () => {
  const first = playChallenge(["sheep", "squirrel"], "wall-battle");
  const retry = playChallenge(["sheep", "squirrel", "rabbit"], "wall-retry");
  const noCannonFirst = playChallenge(["sheep", "squirrel"], "wall-battle", null);
  const noCannonRetry = playChallenge(["sheep", "squirrel", "rabbit"], "wall-retry", null);

  assert.equal(first.state.duration, null);
  assert.equal(first.state.result.won, false);
  assert.ok(first.state.time > 42);
  assert.equal(first.state.playerHp, 0);
  assert.equal(first.bears.length, 1);
  assert.ok(first.state.events.some(event => event.type === "castle-hit" && event.team === "player" && event.amount === first.bears[0].attack));
  assert.ok(first.state.enemyHp > 0);
  assert.ok(
    first.cannonTimes.every(
      (time, index) => index === 0 || time - first.cannonTimes[index - 1] >= 25,
    ),
  );

  assert.equal(retry.state.result.won, true);
  assert.equal(retry.state.enemyHp, 0);
  assert.ok(retry.state.time < 40);
  assert.ok(
    retry.cannonTimes.every(
      (time, index) => index === 0 || time - retry.cannonTimes[index - 1] >= 25,
    ),
  );

  assert.equal(noCannonFirst.state.result.won, false);
  assert.ok(noCannonFirst.state.time > 42);
  assert.equal(noCannonFirst.state.playerHp, 0);
  assert.ok(noCannonFirst.state.enemyHp > 0);
  assert.deepEqual(noCannonFirst.cannonTimes, []);
  assert.equal(noCannonRetry.state.result.won, true);
  assert.equal(noCannonRetry.state.enemyHp, 0);
  assert.ok(noCannonRetry.state.time < 40);
  assert.deepEqual(noCannonRetry.cannonTimes, []);
  assert.equal(earlyGuideEncounter("rabbit-recruit", "challenge").enemyHp, first.state.enemyMaxHp);
  assert.equal(earlyGuideEncounter("idle-retry", "challenge"), null);
  assert.equal(first.state._spawnSchedule[0].x, 1132);
  assert.strictEqual(
    earlyGuideEncounter("wall-battle", "challenge"),
    earlyGuideEncounter("rabbit-recruit", "challenge"),
  );
  assert.strictEqual(
    earlyGuideEncounter("rabbit-recruit", "challenge"),
    earlyGuideEncounter("wall-retry", "challenge"),
  );

  const normal = createBattle({ mode: "challenge", stageId: 2 });
  const progressed = createBattle({
    mode: "challenge",
    stageId: 2,
    earlyGuidePhase: "growth",
  });
  assert.equal(normal.enemyMaxHp, STAGES.find((stage) => stage.id === 2).challenge.enemyHp);
  assert.deepEqual(progressed._spawnSchedule, normal._spawnSchedule);
  assert.equal(progressed.enemyMaxHp, normal.enemyMaxHp);
  assert.equal(normal.duration, null);
});

test("the same hidden bear punishes a delayed rabbit push through ordinary combat", () => {
  const encounter = earlyGuideEncounter("wall-battle", "challenge");
  assert.strictEqual(encounter, earlyGuideEncounter("wall-retry", "challenge"));
  const reinforcement = encounter.waves.find(wave => wave.enemies.some(group => group.id === 'grove-bear'));
  assert.ok(reinforcement.time > 40);
  assert.equal(reinforcement.repeatEvery, undefined);
  const delayed = playChallenge(["sheep", "squirrel", "rabbit"], "wall-retry", 25, 35);
  assert.equal(delayed.state.result.won, false);
  assert.equal(delayed.state.playerHp, 0);
  assert.equal(delayed.bears.length, 1);
  assert.ok(delayed.bears[0].attack > ENEMIES.find(enemy => enemy.id === 'grove-bear').attack);
  assert.ok(delayed.state.events.some(event => event.type === 'castle-hit' && event.team === 'player' && event.amount === delayed.bears[0].attack));
  for (const stage of STAGES) {
    for (const wave of stage.challenge?.waves ?? []) {
      if (wave.repeatEvery) assert.ok(wave.enemies.every(group => !ENEMIES.find(enemy => enemy.id === group.id)?.boss));
    }
  }
});

test("castle specialist bonus applies only to player unit hits on the enemy castle", () => {
  assert.equal(UNITS.find((unit) => unit.id === "rabbit").name, "속공 토끼");
  assert.equal(UNITS.find((unit) => unit.id === "rabbit").effects.castleDamage.bonus, 2);
  assert.equal(BALANCE_VERSION, "sustained-challenge-encounters-25");

  const state = createBattle({ mode: "challenge", stageId: 1, sequence: [] });
  state._spawnSchedule = [];
  state.gold = 1000;
  assert.equal(summonUnit(state, "rabbit"), true);
  const rabbit = state.units[0];
  rabbit.x = 1073;
  stepBattle(state, 0.2);
  assert.equal(state.enemyMaxHp - state.enemyHp, rabbit.attack * 3);

  const unitTarget = createBattle({ mode: "challenge", stageId: 1, sequence: [] });
  unitTarget._spawnSchedule = [];
  unitTarget.gold = 1000;
  assert.equal(summonUnit(unitTarget, "rabbit"), true);
  const attacker = unitTarget.units[0];
  attacker.x = 500;
  attacker.speed = 0;
  const beetle = ENEMIES.find((unit) => unit.id === "beetle");
  const target = {
    ...beetle,
    uid: "e-castle-bonus-target",
    team: "enemy",
    attribute: "normal",
    x: 547,
    hp: beetle.hp,
    maxHp: beetle.hp,
    shield: 0,
    maxShield: 0,
    effects: {},
    statusEffects: {},
    periodicTimers: {},
    attackTimer: 1000,
    action: null,
    hitFlash: 0,
    attackFlash: 0,
    moving: false,
    hitStun: 0,
    hitStunDuration: 0.18,
    hitDirection: 1,
    stunCooldown: 1000,
    deathTimer: 0,
    dead: false,
    speed: 0,
  };
  unitTarget.units.push(target);
  for (let tick = 0; tick < 10 && target.hp === target.maxHp; tick += 1)
    stepBattle(unitTarget, FIXED_STEP);
  assert.equal(target.maxHp - target.hp, attacker.attack);

  const enemyCastleHp = unitTarget.enemyHp;
  fireCannon(unitTarget);
  assert.equal(target.maxHp - target.hp, attacker.attack + 110);
  assert.equal(unitTarget.enemyHp, enemyCastleHp);

  const cannon = createBattle({ mode: "challenge", stageId: 1, sequence: [] });
  cannon._spawnSchedule = [{ time: 0, id: "beetle", overrides: {}, x: 1070, order: 0 }];
  stepBattle(cannon, FIXED_STEP);
  const enemy = cannon.units[0];
  enemy.hp = enemy.maxHp = 1000;
  enemy.x = 1110;
  fireCannon(cannon);
  assert.equal(enemy.maxHp - enemy.hp, 110);

  const enemyStrike = createBattle({ mode: "challenge", stageId: 1, sequence: [] });
  enemyStrike._spawnSchedule = [{ time: 0, id: "beetle", overrides: {}, x: 122, order: 0 }];
  stepBattle(enemyStrike, 0.3);
  assert.equal(enemyStrike.playerMaxHp - enemyStrike.playerHp, 24);
});

test('new wild enemies appear progressively with distinct combat roles',()=>{
  for(const [id,first,role] of [['bear',4,'heavy'],['badger',6,'melee'],['porcupine',8,'ranged']]){
    const enemy=ENEMIES.find(e=>e.id===id);
    assert.equal(enemy.role,role);
    assert.equal(enemy.attribute,'wild');
    assert.equal(STAGES.find(s=>s.waves.some(w=>w.enemies.some(g=>g.id===id))).id,first);
    const battle=createBattle({mode:'challenge',stageId:first,sequence:[]});
    const arrival=battle._spawnSchedule.find(g=>g.id===id);
    assert.ok(arrival);
    while(battle.time<arrival.time+1&&!battle.finished)stepBattle(battle,FIXED_STEP);
    assert.ok(battle.units.some(u=>u.id===id&&u.team==='enemy'));
  }
  assert.ok(ENEMIES.find(e=>e.id==='bear').hp>ENEMIES.find(e=>e.id==='boar').hp);
  assert.ok(ENEMIES.find(e=>e.id==='badger').speed>ENEMIES.find(e=>e.id==='beetle').speed);
  assert.ok(ENEMIES.find(e=>e.id==='porcupine').projectile);
});
