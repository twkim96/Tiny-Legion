import test from 'node:test';
import assert from 'node:assert/strict';
import { newAccount } from '../dist/src/account.js';
import { createBattle, stepBattle, summonUnit } from '../dist/src/engine.js';
import { startBattle, finishBattle } from '../server/battle.js';
import { applyCommand } from '../server/commands.js';

// A server-authored stationary defender isolates long-fight replay from balance.
function longEncounter() {
  const account = newAccount(0);
  const run = startBattle(account, { mode: 'challenge', stageId: 0 }, 0);
  run.options.enemyModifiers = { speed: 0 };
  run.options.levels = { sheep: 100 };
  const state = createBattle(run.options), actions = [];
  let tick = 0;
  while (!state.finished && tick < 7200) {
    if (tick >= 3900 && summonUnit(state, 'sheep')) actions.push({ step: tick, type: 'summon', id: 'sheep' });
    stepBattle(state, 1 / 30); tick++;
  }
  assert.equal(state.result?.won, true);
  assert.ok(state.time > 130);
  return { account, run, state, args: { battleId: run.battleId, actions, endStep: tick } };
}

test('long challenge verifies across JSON stored checkpoints and awards only on completion', () => {
  const { account, run, state, args } = longEncounter();
  const now = Math.ceil(state.time * 1000);
  const first = applyCommand(account, run, 'battle.finish', args, now);
  assert.deepEqual(first.result, { pending: true });
  assert.equal(account.onboarding.phase, 'intro');
  assert.ok(first.battle);
  const stored = JSON.parse(JSON.stringify(first.battle));
  assert.throws(() => finishBattle(account, stored, { ...args, actions: [] }, now), /replay_input_mismatch/);
  const done = applyCommand(account, stored, 'battle.finish', args, now);
  assert.equal(done.result.battleResult.won, true);
  assert.equal(done.result.battleResult.time, state.time);
  assert.equal(done.battle, null);
  assert.equal(account.onboarding.phase, 'first-battle');
});

test('challenge replay rejects forged early or unfinished terminal ticks without advancing progression', () => {
  const { account, run, args } = longEncounter();
  assert.throws(() => finishBattle(account, run, args, 1000), /battle_too_early/);
  assert.throws(() => finishBattle(account, run, { ...args, endStep: undefined }, 200000), /invalid_actions/);
  assert.throws(() => finishBattle(account, run, { ...args, actions: [], endStep: 1 }, 200000), /invalid_actions/);
  assert.throws(() => finishBattle(account, run, { ...args, endStep: Infinity }, 200000), /invalid_actions/);
  assert.equal(account.onboarding.phase, 'intro');
  assert.equal(run.replay, undefined);
});
