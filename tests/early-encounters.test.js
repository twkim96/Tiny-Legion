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
import { newAccount, claimMission, completeChallenge, currentMission, growUnit } from "../dist/src/account.js";

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

function playChallenge(sequence, phase, cannonCooldown = 25) {
  const state = createBattle({
    mode: "challenge",
    stageId: 2,
    earlyGuidePhase: phase,
    ownedUnits: sequence,
    sequence: [],
  });
  let nextSummon = 0;
  let sequenceIndex = 0;
  let nextCannon = 8;
  const cannonTimes = [];

  while (!state.finished) {
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
  }

  return { state, cannonTimes };
}

test("1-2 idle guide phases reuse stage 2 and distinguish rabbit defense pressure", () => {
  const phases = ["idle-defense", "remove-rabbit", "idle-retry"];
  const cleanSequence = ["sheep", "squirrel"];
  const rabbitSequence = ["sheep", "squirrel", "rabbit"];
  const clean = phases.map((phase) => playIdle(cleanSequence, phase));
  const rabbit = phases.map((phase) => playIdle(rabbitSequence, phase));

  for (const state of [...clean, ...rabbit]) {
    assert.equal(state.duration, 90);
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
  assert.equal(clean[0]._spawnSchedule[0].x, 1080);

  const normal = createBattle({ mode: "idle", stageId: 2, sequence: cleanSequence });
  assert.deepEqual(normal._spawnSchedule, clean[0]._spawnSchedule);
  assert.equal(normal._baseReward, clean[0]._baseReward);
});

test("wall tutorial loses without rabbit and wins naturally at the real cannon cooldown", () => {
  const first = playChallenge(["sheep", "squirrel"], "wall-battle");
  const retry = playChallenge(["sheep", "squirrel", "rabbit"], "wall-retry");
  const noCannonFirst = playChallenge(["sheep", "squirrel"], "wall-battle", null);
  const noCannonRetry = playChallenge(["sheep", "squirrel", "rabbit"], "wall-retry", null);

  assert.equal(first.state.duration, 90);
  assert.equal(first.state.result.won, false);
  assert.equal(first.state.time, 90);
  assert.ok(first.state.enemyHp > 0);
  assert.ok(
    first.cannonTimes.every(
      (time, index) => index === 0 || time - first.cannonTimes[index - 1] >= 25,
    ),
  );

  assert.equal(retry.state.result.won, true);
  assert.equal(retry.state.enemyHp, 0);
  assert.ok(retry.state.time < 90);
  assert.ok(
    retry.cannonTimes.every(
      (time, index) => index === 0 || time - retry.cannonTimes[index - 1] >= 25,
    ),
  );

  assert.equal(noCannonFirst.state.result.won, false);
  assert.equal(noCannonFirst.state.time, 90);
  assert.ok(noCannonFirst.state.enemyHp > 0);
  assert.deepEqual(noCannonFirst.cannonTimes, []);
  assert.equal(noCannonRetry.state.result.won, true);
  assert.equal(noCannonRetry.state.enemyHp, 0);
  assert.ok(noCannonRetry.state.time < 90);
  assert.deepEqual(noCannonRetry.cannonTimes, []);
  assert.equal(earlyGuideEncounter("rabbit-recruit", "challenge").enemyHp, first.state.enemyMaxHp);
  assert.equal(earlyGuideEncounter("idle-retry", "challenge"), null);
  assert.equal(first.state._spawnSchedule[0].x, 1080);
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
  assert.equal(normal.enemyMaxHp, STAGES.find((stage) => stage.id === 2).enemyHp);
  assert.deepEqual(progressed._spawnSchedule, normal._spawnSchedule);
  assert.equal(progressed.enemyMaxHp, normal.enemyMaxHp);
  assert.equal(normal.duration, 90);
});

test("castle specialist bonus applies only to player unit hits on the enemy castle", () => {
  assert.equal(UNITS.find((unit) => unit.id === "rabbit").name, "속공 토끼");
  assert.equal(UNITS.find((unit) => unit.id === "rabbit").castleDamageBonus, 4);
  assert.equal(BALANCE_VERSION, "ninety-seconds-7");

  const state = createBattle({ mode: "challenge", stageId: 1, sequence: [] });
  state._spawnSchedule = [];
  state.gold = 1000;
  assert.equal(summonUnit(state, "rabbit"), true);
  const rabbit = state.units[0];
  rabbit.x = 1073;
  stepBattle(state, 0.2);
  assert.equal(state.enemyMaxHp - state.enemyHp, rabbit.attack * 5);

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
    regeneration: null,
    regenTimer: 0,
    slowRemaining: 0,
    slowFactor: 1,
    regenSuppressionRemaining: 0,
    regenSuppressionFactor: 1,
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
  enemy.x = 1110;
  fireCannon(cannon);
  assert.equal(enemy.maxHp - enemy.hp, 110);

  const enemyStrike = createBattle({ mode: "challenge", stageId: 1, sequence: [] });
  enemyStrike._spawnSchedule = [{ time: 0, id: "beetle", overrides: {}, x: 122, order: 0 }];
  stepBattle(enemyStrike, 0.3);
  assert.equal(enemyStrike.playerMaxHp - enemyStrike.playerHp, 24);
});

// Use the same manual summon/cannon policy before and after account growth.
function playMilestone(stageId, levels) {
  const state=createBattle({mode:'challenge',stageId,levels,sequence:[]});
  const lineup=['sheep','squirrel','rabbit'];
  let summonAt=0, index=0, cannonAt=8;
  while(!state.finished){
    if(state.time>=summonAt){
      if(summonUnit(state,lineup[index])) index=(index+1)%lineup.length;
      summonAt=state.time+1;
    }
    if(state.time>=cannonAt&&fireCannon(state)) cannonAt=state.time+25;
    stepBattle(state,FIXED_STEP);
  }
  return state;
}
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
test('earned early mission rewards fund a growth route through the new enemies without repeated payouts',()=>{
  const account=newAccount();
  account.onboarding.phase='complete'; account.earlyGuide.phase='complete';
  account.highestCleared=2; account.gold=0;
  account.owned.squirrel=true; account.owned.rabbit=true;
  account.missions.claimed=['idle-intro','challenge-2','idle-second','growth-intro'];
  for(const id of ['sheep','squirrel','rabbit'])account.levels[id]=2;
  assert.equal(playMilestone(3,account.levels).result.won,true);
  completeChallenge(account,3);
  claimMission(account);
  assert.equal(playMilestone(4,account.levels).result.won,false);
  for(const id of ['sheep','squirrel','rabbit'])while(account.levels[id]<4)assert.equal(growUnit(account,id),true);
  assert.equal(playMilestone(4,account.levels).result.won,true);
  completeChallenge(account,4); claimMission(account);
  assert.equal(playMilestone(5,account.levels).result.won,true);
  completeChallenge(account,5); claimMission(account);
  assert.equal(playMilestone(6,account.levels).result.won,false);
  for(const id of ['sheep','squirrel','rabbit'])while(account.levels[id]<7)assert.equal(growUnit(account,id),true);
  assert.equal(playMilestone(6,account.levels).result.won,true);
  completeChallenge(account,6); claimMission(account);
  const gold=account.gold, diamonds=account.diamonds;
  assert.equal(claimMission(account),null);
  assert.deepEqual(completeChallenge(account,6),{gold:0,diamonds:0});
  assert.equal(account.gold,gold); assert.equal(account.diamonds,diamonds);
  assert.equal(currentMission(account).gold,STAGES[6].baseReward);
  assert.equal(currentMission(account).diamonds,10);
  assert.equal(STAGES[12].missionReward,undefined);
});
