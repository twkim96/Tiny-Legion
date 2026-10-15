import test from 'node:test';
import assert from 'node:assert/strict';
import { newAccount } from '../dist/src/account.js';
import { STAGES } from '../dist/src/data.js';
import { gameUiState, contentMenuMarkup, toolbarMarkup } from '../dist/src/navigation-ui.js';
import { updateHud, summonHandMarkup } from '../dist/src/hud-ui.js';

function surface() {
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, { hidden: false, disabled: false, style: {}, dataset: {},
      classList: { toggle() {} }, setAttribute(name, value) { this[name] = value; },
      querySelectorAll() { return []; },
    });
    return elements.get(id);
  };
  const account = newAccount(0);
  account.onboarding.phase = 'complete'; account.earlyGuide.phase = 'complete';
  account.highestCleared = 11;
  const props = { account, mode: 'idle', battle: { finished: false, time: 20, gold: 1000, maxGold: 2000,
    duration: 60, units: [], cooldowns: {}, playerHp: 800, playerMaxHp: 1000, enemyHp: 500, enemyMaxHp: 1000 },
    stageId: 4, stage: STAGES[3], paused: false, waiting: false, skillRemaining: 0, width: 844, height: 390 };
  return { $, account, props };
}

test('one HUD preserves profile across idle, manual battle, pause, result, ready and return', () => {
  const { $, props } = surface();
  for (const mode of ['challenge', 'speedrun']) {
    props.mode = 'idle'; updateHud($, props);
    assert.equal($('profile-button').hidden, false);
    assert.equal($('nav-units').hidden, false);
    assert.equal($('income').hidden, false);
    props.mode = mode; updateHud($, props);
    const profile = $('profile-button');
    assert.equal(profile.hidden, false);
    assert.equal(profile.disabled, false);
    assert.equal($('nav-units').hidden, true);
    assert.equal($('leave-battle').hidden, false);
    assert.equal($('income').hidden, true);
    assert.equal($('battle-time').textContent, '00:20');
    props.paused = true; updateHud($, props);
    assert.equal($('profile-button'), profile);
    assert.equal(profile.hidden, false);
    props.battle.finished = true; updateHud($, props);
    assert.equal($('nav-units').hidden, false);
    assert.equal($('pause').hidden, true);
    assert.match(contentMenuMarkup(gameUiState(props)), /data-content-menu="growth"/);
    const battle = props.battle;
    props.battle = null; updateHud($, props);
    assert.equal(profile.hidden, false);
    props.mode = 'idle'; props.battle = battle; props.battle.finished = false;
    props.paused = false; updateHud($, props);
    assert.equal($('profile-button'), profile);
    assert.equal($('battle-time').textContent, '00:40');
  }
});

test('new-player profile remains visible while tutorial and battle controls retain their locks', () => {
  const { $, props } = surface();
  props.account.onboarding.phase = 'intro'; props.mode = 'challenge';
  updateHud($, props);
  assert.equal($('profile-button').hidden, false);
  assert.equal($('profile-button').disabled, true);
  assert.equal($('skill').disabled, true);
  assert.equal($('edit-sequence').disabled, true);
  assert.equal($('mode-select').disabled, true);
});

test('HUD uses actual capacity and authored wave phases instead of fixed duration guesses', () => {
  const { $, props } = surface();
  updateHud($, props);
  assert.equal($('wallet-fill').style.width, '50%');
  assert.equal($('wave-progress').textContent, '2 / 3');
  props.battle.time = 27; updateHud($, props);
  assert.equal($('wave-progress').textContent, '3 / 3');
  assert.equal($('player-health-text').textContent, '800 / 1,000');
});

test('toolbar IDs are unique and all modes share the summon-card structure', () => {
  const html = toolbarMarkup(), ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  const hand = summonHandMarkup(['sheep', null, 'rabbit']);
  assert.equal((hand.match(/class="unit-card(?: |")/g) ?? []).length, 3);
  assert.match(hand, /data-unit="rabbit"/);
  assert.match(hand, /2번 빈 슬롯/);
});
