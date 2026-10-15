import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, ENEMIES, battleDuration } from '../dist/src/data.js';
import { SPEEDRUN_STAGES } from '../dist/src/speedrun.js';
import { createBattle, stepBattle, summonUnit, fireCannon, calculateIdleReward } from '../dist/src/engine.js';
import { idleDiamondReward, idleFullReward } from '../dist/src/economy.js';
import { newAccount, gemModifiers } from '../dist/src/account.js';
import { drawGem, equipGem } from '../dist/src/gems.js';

const STARTERS = ['sheep', 'squirrel', 'rabbit'];
function play(stageId, level, mode = 'challenge', lineup = STARTERS, modifiers = {}) {
  const state = createBattle({ stageId, mode, sequence: mode === 'idle' ? lineup : [],
    ownedUnits: lineup, levels: Object.fromEntries(lineup.map(id => [id, level])), modifiers });
  let next = 0, index = 0, cannon = 8;
  const bosses = new Map();
  while (!state.finished) {
    if (mode === 'challenge' && state.time >= next) {
      if (summonUnit(state, lineup[index])) index = (index + 1) % lineup.length;
      next = state.time + 1;
    }
    if (mode === 'challenge' && state.time >= cannon && fireCannon(state)) cannon = state.time + 25;
    stepBattle(state, 1 / 30);
    for (const unit of state.units) {
      if (unit.team === 'enemy' && ENEMIES.find(enemy => enemy.id === unit.id)?.boss) bosses.set(unit.uid, unit);
    }
  }
  return { state, bosses: [...bosses.values()] };
}

test('ordinary battles use stage limits; speedrun stays at 90 seconds with authored waves', () => {
  for (const stage of STAGES) for (const mode of ['idle', 'challenge']) {
    const limit = battleDuration(stage.id, mode);
    assert.equal(createBattle({ mode, stageId: stage.id }).duration, limit);
    for (const duration of [120, 900, Infinity, NaN]) {
      const state = createBattle({ mode, stageId: stage.id, duration, sequence: [] });
      assert.equal(state.duration, limit);
      // Remove attacks solely to isolate the timer's terminal condition.
      state._spawnSchedule = [];
      stepBattle(state, 200);
      assert.equal(state.time, limit);
      assert.equal(state.finished, true);
      assert.equal(state.result.won, mode === 'idle');
    }
    assert.equal(createBattle({ mode, stageId: stage.id, duration: 30 }).duration, 30);
  }
  for (const stageId of [1, 2, 3, 4, 10, 11, 20]) {
    assert.equal(battleDuration(stageId, 'idle'), stageId <= 3 ? 40 : stageId <= 10 ? 60 : 90);
    assert.equal(battleDuration(stageId, 'challenge'), stageId <= 2 ? 40 : stageId <= 10 ? 60 : 90);
  }
  const speedrun = createBattle({ mode: 'speedrun', stageId: 1 });
  assert.equal(speedrun.duration, 90);
  assert.ok(speedrun._spawnSchedule.some(spawn => spawn.time > 60));
  assert.ok(speedrun._spawnSchedule.every(spawn => spawn.time <= 89));
  for (const stage of SPEEDRUN_STAGES) {
    const battle = createBattle({ mode: 'speedrun', stageId: stage.id });
    assert.equal(battle.duration, 90);
    assert.equal(battle._spawnSchedule.length, createBattle({ mode: 'speedrun', stageId: stage.id, duration: 120 })._spawnSchedule.length);
    assert.ok(battle._spawnSchedule.every(spawn => spawn.time <= 89));
  }
  for (const phase of ['intro', 'first-battle', 'retry-battle']) {
    assert.equal(createBattle({ mode: 'challenge', onboardingPhase: phase, duration: 900 }).duration,
      40);
  }
});

test('idle full rewards scale with duration and shorter failures earn less per cycle', () => {
  for (const stage of STAGES) {
    const period = battleDuration(stage.id);
    const full = calculateIdleReward(stage.id, period, 1, period);
    assert.equal(full, Math.round(idleFullReward(stage.id) * period / 90));
    for (const duration of [40, 60, 90]) {
      assert.ok(Math.abs(calculateIdleReward(stage.id, duration, 1, duration) / duration - idleFullReward(stage.id) / 90) <= 0.5 / duration);
      assert.ok(Math.abs(idleDiamondReward(stage.id, duration, duration, 1) / duration - idleDiamondReward(stage.id, 90, 90, 1) / 90) <= 0.0005 / duration + 0.0005 / 90);
    }
    assert.equal(calculateIdleReward(stage.id, 120, 1, period), full);
    for (const seconds of [period / 6, period / 3, period / 2, period - 1]) {
      assert.ok(calculateIdleReward(stage.id, seconds, 0, period) / period < full / period);
    }
    const state = createBattle({ mode: 'idle', stageId: stage.id, sequence: [] });
    assert.ok(state._spawnSchedule.every(spawn => spawn.time < state.duration));
    const groups = stage.waves.flatMap(wave => wave.enemies);
    assert.equal(state._spawnSchedule.length, groups.reduce((count, group) => count + (group.count ?? 1), 0));
  }
});

test('previous 100% and next 90% defenses have equal hourly income across 40/60/90-second boundaries', () => {
  for (let index = 0; index < STAGES.length - 1; index++) {
    const previous = STAGES[index];
    const next = STAGES[index + 1];
    const previousDuration = battleDuration(previous.id, 'idle');
    const nextDuration = battleDuration(next.id, 'idle');
    const previousGold = calculateIdleReward(previous.id, previousDuration, 1, previousDuration);
    const nextGold = calculateIdleReward(next.id, nextDuration, 0.9, nextDuration);
    assert.ok(Math.abs(previousGold / previousDuration - nextGold / nextDuration) <= 0.5 / previousDuration + 0.5 / nextDuration, `stages ${previous.id}/${next.id} acorns per second`);

    const previousDiamonds = idleDiamondReward(previous.id, previousDuration, previousDuration, 1);
    const nextDiamonds = idleDiamondReward(next.id, nextDuration, nextDuration, 0.9);
    assert.ok(Math.abs(previousDiamonds / previousDuration - nextDiamonds / nextDuration) <= 0.0005 / previousDuration + 0.0005 / nextDuration, `stages ${previous.id}/${next.id} diamonds per second`);
  }
});

test('region relief, gem baseline and ordinary growth retain their combat outcomes', () => {
  const previous = play(10, 35).state;
  assert.equal(previous.result.won, true);
  assert.ok(previous.time < battleDuration(10, 'challenge'));
  const oldIdle = play(10, 35, 'idle').state;
  const entry = play(11, 35, 'idle').state;
  assert.equal(entry.result.won, true);
  assert.equal(entry.time, battleDuration(11, 'idle'));
  assert.ok(entry.result.hpRatio >= .9);
  assert.ok(entry.result.reward > oldIdle.result.reward);
  const blocked = play(12, 35).state;
  assert.equal(blocked.result.won, false);
  assert.ok(blocked.enemyHp > 0);
  const blockedIdle = play(12, 35, 'idle').state;
  assert.equal(blockedIdle.result.won, false);
  assert.ok(blockedIdle.result.reward < entry.result.reward * .5);
  const account = newAccount();
  account.onboarding.phase = 'complete'; account.earlyGuide.phase = 'complete'; account.highestCleared = 11;
  const gem = drawGem(account, { free: true, random: () => 0 });
  assert.ok(equipGem(account, gem.uid));
  for (const state of [play(12, 35, 'challenge', STARTERS, gemModifiers(account, 'challenge')).state,
    play(12, 50).state, play(12, 35, 'challenge', ['sheep', 'teapot', 'rabbit']).state]) {
    assert.equal(state.result.won, true);
    assert.equal(state.enemyHp, 0);
    assert.ok(state.time < battleDuration(12, 'challenge'));
  }
  assert.equal(play(12, 50, 'idle').state.result.won, true);
});

test('each milestone giant appears and is defeated before its stage deadline', () => {
  for (const [stageId, level] of [[5, 35], [10, 35], [15, 100], [20, 100]]) {
    const { state, bosses } = play(stageId, level);
    assert.equal(state.result.won, true, `stage ${stageId}`);
    assert.ok(state.time < battleDuration(stageId, 'challenge'));
    assert.ok(bosses.length > 0);
    assert.ok(bosses.every(boss => boss.dead && boss.hp === 0));
  }
});
