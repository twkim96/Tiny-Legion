import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceSpeedrun,
  claimSpeedrun,
  dailyKey,
  newAccount,
  normalizeAccount,
  recordSpeedrun,
  speedrunProgress,
  speedrunReward,
  speedrunStageRecord,
} from "../dist/src/account.js";
import { createBattle, fireCannon, stepBattle, summonUnit } from "../dist/src/engine.js";
import { UNITS, STAGES } from "../dist/src/data.js";
import { getEnemy } from "../dist/src/characters.js";
import { SPEEDRUN_LIMIT_SECONDS, SPEEDRUN_MAX_REWARD, SPEEDRUN_TARGET_SECONDS, SPEEDRUN_STAGES, speedrunStageReward } from "../dist/src/speedrun.js";
import { finishBattle, startBattle } from "../server/battle.js";

const now = Date.UTC(2026, 9, 12, 3);

function advancedAccount(at = now) {
  const account = newAccount(at);
  account.onboarding.phase = "complete";
  account.earlyGuide.phase = "complete";
  account.highestCleared = 11;
  account.speedrunUnlocked = 1;
  for (const unit of UNITS) {
    account.owned[unit.id] = true;
    account.levels[unit.id] = 100;
  }
  return account;
}

function play(run, { delay = 0, unitOrder } = {}) {
  const state = createBattle(run.options);
  const actions = [];
  const order = unitOrder ?? [...UNITS]
    .sort((a, b) => b.attack / b.cost - a.attack / a.cost)
    .map((unit) => unit.id);
  let cannonStep = -750;
  for (let step = 0; step <= Math.ceil(state.duration * 30) && !state.finished; step++) {
    if (step >= delay * 30) {
      for (const id of order) {
        if (summonUnit(state, id)) {
          actions.push({ step, type: "summon", id });
          break;
        }
      }
      if (step - cannonStep >= 750 && state.units.some((unit) => unit.team === "enemy" && !unit.dead) && fireCannon(state)) {
        actions.push({ step, type: "cannon" });
        cannonStep = step;
      }
    }
    stepBattle(state, 1 / 30);
  }
  return { state, actions };
}

function finishVerified(account, run, replay, at) {
  return finishBattle(account, run, {
    battleId: run.battleId,
    actions: replay.actions,
    result: { won: false, time: -1, reward: 1e12 },
  }, at);
}

test("speedrun limits, partial rewards, and daily records normalize only current stages", () => {
  assert.equal(SPEEDRUN_LIMIT_SECONDS, 90);
  assert.equal(SPEEDRUN_TARGET_SECONDS, 60);
  assert.equal(speedrunStageReward(60), SPEEDRUN_MAX_REWARD);
  assert.equal(speedrunStageReward(61), 9);
  assert.equal(speedrunStageReward(90), 1);
  assert.equal(speedrunStageReward(90.01), 0);

  const fresh = newAccount(now);
  assert.deepEqual(fresh.daily, { key: dailyKey(now), stages: {} });
  const advanced = advancedAccount();
  advanced.speedrunUnlocked = 0;
  assert.equal(normalizeAccount(advanced, now).speedrunUnlocked, 1);
  const raw = {
    ...fresh,
    daily: {
      key: dailyKey(now),
      best: 30,
      practice: 20,
      claimed: true,
      stages: {
        1: { best: 91, practice: 91, claimed: false },
        2: { best: 61, practice: 89, claimed: true },
        21: { best: 30, practice: null, claimed: false },
      },
    },
  };
  const normalized = normalizeAccount(raw, now);
  assert.deepEqual(normalized.daily.stages, {
    2: { best: 61, practice: 89, claimed: true },
  });
  assert.equal("best" in normalized.daily, false);
  assert.equal("claimed" in normalized.daily, false);

  raw.daily.key = dailyKey(now - 24 * 60 * 60 * 1000);
  assert.deepEqual(normalizeAccount(raw, now).daily, { key: dailyKey(now), stages: {} });
});

test("each unlocked stage has its own once-per-day claim", () => {
  const account = advancedAccount();
  assert.equal(recordSpeedrun(account, 1, SPEEDRUN_TARGET_SECONDS, now), true);
  assert.equal(claimSpeedrun(account, 1, now), SPEEDRUN_MAX_REWARD);
  assert.equal(recordSpeedrun(account, 2, SPEEDRUN_LIMIT_SECONDS, now), true);
  assert.equal(claimSpeedrun(account, 2, now), 1);
  assert.equal(claimSpeedrun(account, 1, now), 0);
  assert.equal(claimSpeedrun(account, 2, now), 0);
  assert.deepEqual(Object.keys(account.daily.stages).sort(), ["1", "2"]);
  assert.equal(account.tickets, SPEEDRUN_MAX_REWARD + 1);
});

test("server replay awards partial reward once, then allows a target practice to unlock the next stage", () => {
  const account = advancedAccount();
  const first = startBattle(account, { mode: "speedrun", stageId: 1 }, now);
  const delayed = play(first, {
    // The independent opening rush reaches an undefended castle before 40s.
    // A 30s delayed response still survives and produces a genuine partial win.
    delay: 30,
    unitOrder: ["teapot", "sheep", "rabbit", "fox", "squirrel", "owl", "chick", "mushroom-witch", "whale"],
  });
  assert.equal(delayed.state.result.won, true);
  assert.ok(delayed.state.result.time > SPEEDRUN_TARGET_SECONDS);
  assert.ok(delayed.state.result.time <= SPEEDRUN_LIMIT_SECONDS);
  const partialFinishAt = now + Math.ceil(delayed.state.result.time * 1000);
  const partial = finishVerified(account, first, delayed, partialFinishAt);
  assert.equal(partial.battleResult.won, true);
  assert.equal(speedrunProgress(account), 1);
  assert.equal(speedrunStageRecord(account, 1).best, partial.battleResult.time);

  const partialReward = speedrunReward(account, 1);
  assert.ok(partialReward >= 1 && partialReward <= 9);
  assert.equal(claimSpeedrun(account, 1, partialFinishAt), partialReward);
  assert.equal(claimSpeedrun(account, 1, partialFinishAt), 0);
  assert.equal(account.tickets, partialReward);

  const secondStart = partialFinishAt + 1000;
  const practiceRun = startBattle(account, { mode: "speedrun", stageId: 1 }, secondStart);
  const fast = play(practiceRun);
  assert.equal(fast.state.result.won, true);
  assert.ok(fast.state.result.time <= SPEEDRUN_TARGET_SECONDS);
  const practiceFinishAt = secondStart + Math.ceil(fast.state.result.time * 1000);
  const target = finishVerified(account, practiceRun, fast, practiceFinishAt);
  assert.equal(target.battleResult.won, true);
  assert.equal(speedrunProgress(account), 2);
  assert.equal(speedrunStageRecord(account, 1).best, partial.battleResult.time);
  assert.ok(speedrunStageRecord(account, 1).practice <= SPEEDRUN_TARGET_SECONDS);
  assert.equal(claimSpeedrun(account, 1, practiceFinishAt), 0);
  assert.equal(account.tickets, partialReward);
  assert.doesNotThrow(() => startBattle(account, { mode: "speedrun", stageId: 2 }, practiceFinishAt));
});

test("a verified target win crossing midnight unlocks progression without creating a daily record", () => {
  const beforeMidnight = Date.UTC(2026, 9, 12, 14, 59, 0);
  const account = advancedAccount(beforeMidnight);
  const run = startBattle(account, { mode: "speedrun", stageId: 1 }, beforeMidnight);
  const replay = play(run);
  assert.equal(replay.state.result.won, true);
  assert.ok(replay.state.result.time <= SPEEDRUN_TARGET_SECONDS);
  const afterMidnight = beforeMidnight + 60_000;
  const outcome = finishVerified(account, run, replay, afterMidnight);
  assert.equal(outcome.battleResult.won, true);
  assert.equal(account.daily.key, dailyKey(afterMidnight));
  assert.deepEqual(account.daily.stages, {});
  assert.equal(speedrunProgress(account), 2);
  assert.equal(account.tickets, 0);
});

test("advanced content gates speedrun mutation, while unlocked speedrun stages ignore challenge stage number", () => {
  const locked = newAccount(now);
  locked.onboarding.phase = "complete";
  locked.highestCleared = 10;
  locked.speedrunUnlocked = 15;
  assert.throws(() => startBattle(locked, { mode: "speedrun", stageId: 15 }, now), { message: "battle_locked" });
  assert.equal(recordSpeedrun(locked, 15, 30, now), false);
  assert.equal(advanceSpeedrun(locked, 15, 30), false);
  assert.equal(claimSpeedrun(locked, 15, now), 0);

  const advanced = advancedAccount();
  advanced.speedrunUnlocked = 13;
  assert.doesNotThrow(() => startBattle(advanced, { mode: "speedrun", stageId: 13 }, now));
  assert.throws(() => startBattle(advanced, { mode: "speedrun", stageId: 14 }, now), { message: "battle_locked" });
});


test("speedrun encounters use independent castles, waves, and known character definitions", () => {
  for (const stage of SPEEDRUN_STAGES) {
    const normal = STAGES.find(candidate => candidate.id === stage.id);
    const sprint = createBattle({ mode: "speedrun", stageId: stage.id });
    const challenge = createBattle({ mode: "challenge", stageId: stage.id });
    const idle = createBattle({ mode: "idle", stageId: stage.id });
    assert.notEqual(stage, normal);
    assert.notEqual(stage.waves, normal.waves);
    assert.notDeepEqual(sprint._spawnSchedule, challenge._spawnSchedule);
    assert.equal(sprint.enemyMaxHp, stage.enemyHp);
    assert.equal(challenge.enemyMaxHp, normal.enemyHp);
    assert.deepEqual(idle._spawnSchedule, challenge._spawnSchedule);
    assert.equal(sprint.scene, stage.scene);
    assert.equal(challenge.scene, null);
    const authored = stage.waves.flatMap(wave => wave.enemies.flatMap(group => {
      assert.ok(getEnemy(group.id), group.id);
      return Array.from({ length: group.count }, (_, index) => ({ id: group.id, time: wave.time + group.interval * index }));
    })).sort((a, b) => a.time - b.time);
    assert.deepEqual(sprint._spawnSchedule.map(({ id, time }) => ({ id, time })), authored);
    assert.ok(authored.every(spawn => spawn.time < SPEEDRUN_LIMIT_SECONDS));
    assert.ok(new Set(authored.map(spawn => spawn.id)).size >= 3);
  }
});

test("the independent opening is approachable at content unlock; every encounter supports a real win", () => {
  const entry = advancedAccount();
  for (const id of Object.keys(entry.levels)) entry.levels[id] = 35;
  const opening = play(startBattle(entry, { mode: "speedrun", stageId: 1 }, now), {
    unitOrder: ["sheep", "squirrel", "rabbit"],
  });
  assert.equal(opening.state.result.won, true);
  assert.ok(opening.state.result.time <= SPEEDRUN_TARGET_SECONDS);
  const advanced = advancedAccount();
  advanced.speedrunUnlocked = SPEEDRUN_STAGES.length;
  for (const stage of SPEEDRUN_STAGES) {
    const replay = play(startBattle(advanced, { mode: "speedrun", stageId: stage.id }, now));
    assert.equal(replay.state.result.won, true, stage.name);
    assert.ok(replay.state.result.time <= SPEEDRUN_LIMIT_SECONDS, stage.name);
  }
});
