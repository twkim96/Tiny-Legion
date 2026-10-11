import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, ENEMIES } from '../dist/src/data.js';
import { createBattle, stepBattle, summonUnit, fireCannon, calculateIdleReward } from '../dist/src/engine.js';
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

test('ordinary modes and speedrun cap at 90; speedrun preserves authored waves within the limit', () => {
  for (const stage of STAGES) for (const mode of ['idle', 'challenge']) {
    assert.equal(createBattle({ mode, stageId: stage.id }).duration, 90);
    for (const duration of [120, 900, Infinity, NaN]) {
      const state = createBattle({ mode, stageId: stage.id, duration, sequence: [] });
      assert.equal(state.duration, 90);
      // Remove attacks solely to isolate the timer's terminal condition.
      state._spawnSchedule = [];
      stepBattle(state, 200);
      assert.equal(state.time, 90);
      assert.equal(state.finished, true);
      assert.equal(state.result.won, mode === 'idle');
    }
    assert.equal(createBattle({ mode, duration: 30 }).duration, 30);
  }
  const speedrun = createBattle({ mode: 'speedrun', stageId: 1 });
  assert.equal(speedrun.duration, 90);
  assert.ok(speedrun._spawnSchedule.some(spawn => spawn.time > 85));
  assert.ok(speedrun._spawnSchedule.every(spawn => spawn.time <= 89));
  for (const stage of STAGES) {
    const battle = createBattle({ mode: 'speedrun', stageId: stage.id });
    assert.equal(battle.duration, 90);
    assert.equal(battle._spawnSchedule.length, createBattle({ mode: 'speedrun', stageId: stage.id, duration: 120 })._spawnSchedule.length);
    assert.ok(battle._spawnSchedule.every(spawn => spawn.time <= 89));
  }
  for (const phase of ['intro', 'first-battle', 'retry-battle']) {
    assert.equal(createBattle({ mode: 'challenge', onboardingPhase: phase, duration: 900 }).duration,
      { intro: 45, 'first-battle': 60, 'retry-battle': 90 }[phase]);
  }
});

test('90-second full completion preserves base reward and shorter failures have lower reward per second', () => {
  for (const stage of STAGES) {
    const full = calculateIdleReward(stage.id, 90, 1);
    assert.equal(full, stage.baseReward);
    assert.equal(calculateIdleReward(stage.id, 120, 1), full);
    for (const seconds of [15, 30, 45, 60, 89]) {
      assert.ok(calculateIdleReward(stage.id, seconds, 0) / seconds < full / 90);
    }
    const state = createBattle({ mode: 'idle', stageId: stage.id, sequence: [] });
    assert.ok(state._spawnSchedule.every(spawn => spawn.time < state.duration));
    const groups = stage.waves.flatMap(wave => wave.enemies);
    assert.equal(state._spawnSchedule.length, groups.reduce((count, group) => count + (group.count ?? 1), 0));
  }
});

test('region relief, gem baseline and ordinary growth work inside 90 seconds with real combat', () => {
  const previous = play(10, 35).state;
  assert.equal(previous.result.won, true);
  assert.ok(previous.time < 90);
  const oldIdle = play(10, 35, 'idle').state;
  const entry = play(11, 35, 'idle').state;
  assert.equal(entry.result.won, true);
  assert.equal(entry.time, 90);
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
  assert.ok(equipGem(account, 0, 0, gem.uid));
  for (const state of [play(12, 35, 'challenge', STARTERS, gemModifiers(account, 'challenge')).state,
    play(12, 50).state, play(12, 35, 'challenge', ['sheep', 'teapot', 'rabbit']).state]) {
    assert.equal(state.result.won, true);
    assert.equal(state.enemyHp, 0);
    assert.ok(state.time < 90);
  }
  assert.equal(play(12, 50, 'idle').state.result.won, true);
});

test('each milestone giant appears and is defeated before the 90-second castle deadline', () => {
  for (const [stageId, level] of [[5, 4], [10, 35], [15, 100], [20, 100]]) {
    const { state, bosses } = play(stageId, level);
    assert.equal(state.result.won, true, `stage ${stageId}`);
    assert.ok(state.time < 90);
    assert.ok(bosses.length > 0);
    assert.ok(bosses.every(boss => boss.dead && boss.hp === 0));
  }
});
