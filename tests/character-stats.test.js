import test from 'node:test';
import assert from 'node:assert/strict';
import { getUnit, getEnemy, getCharacter, UNITS, ENEMIES } from '../dist/src/characters.js';
import { STAGES } from '../dist/src/data.js';
import { characterStats, unitCombatStats, enemyCombatStats, combatStat, applyStatEffect, advanceStatEffects } from '../dist/src/character-stats.js';
import { createBattle, summonUnit, stepBattle } from '../dist/src/engine.js';
import { portrait } from '../dist/src/art.js';
const tick = 1 / 30;

test('registry definitions and nested mechanics cannot be changed by callers; combat snapshots are independent', () => {
  assert.strictEqual(getCharacter('sheep', 'player'), UNITS.find(u => u.id === 'sheep'));
  assert.strictEqual(getCharacter('mushroom', 'enemy'), ENEMIES.find(u => u.id === 'mushroom'));
  assert.equal(getEnemy('missing'), null);
  assert.throws(() => { getEnemy('mushroom').attribute = 'spirit'; }, TypeError);
  assert.throws(() => { getEnemy('spirit-rabbit').regeneration.hpRatio = 1; }, TypeError);
  const snapshot = enemyCombatStats('spirit-rabbit');
  snapshot.regeneration.hpRatio = 1;
  assert.equal(getEnemy('spirit-rabbit').regeneration.hpRatio, .025);
});

test('wild rabbit identity matches its portrait and opening encounters, while the later spirit variant owns regeneration', () => {
  const rabbit = getEnemy('mushroom');
  assert.equal(rabbit.attribute, 'wild');
  assert.equal(rabbit.regeneration, undefined);
  assert.match(portrait(rabbit.id), /stroke="#3f852e"/);
  for (const stage of STAGES.slice(0, 13)) {
    for (const wave of stage.waves) for (const group of wave.enemies) {
      assert.equal(group.attribute, undefined);
      if (group.id === rabbit.id) assert.equal(enemyCombatStats(group.id, {}, group).attribute, rabbit.attribute);
    }
  }
  const later = STAGES.find(stage => stage.id === 14);
  assert.ok(later.waves.some(wave => wave.enemies.some(group => group.id === 'spirit-rabbit')));
  const state = createBattle({ stageId: 14, mode: 'challenge', sequence: [] });
  state._spawnSchedule = [{ id: 'spirit-rabbit', time: 0, x: 1080, overrides: {} }];
  stepBattle(state, tick);
  assert.equal(state.units[0].attribute, getEnemy('spirit-rabbit').attribute);
  assert.deepEqual(state.units[0].regeneration, getEnemy('spirit-rabbit').regeneration);
});

test('enemy spawn combines stage, battle and per-group multipliers without changing its identity or base definition', () => {
  const before = structuredClone(getEnemy('clock-beetle'));
  const state = createBattle({ mode: 'challenge', stageId: 1, sequence: [], enemyModifiers: { hp: 2, attack: .5, speed: .8 } });
  state._spawnSchedule = [{ id: 'clock-beetle', time: 0, x: 1080, overrides: { statMultipliers: { hp: 1.5, attack: 3 }, regeneration: false } }];
  stepBattle(state, tick);
  const enemy = state.units[0], base = getEnemy('clock-beetle');
  const expected = enemyCombatStats(base.id, state._enemyModifiers, state._spawnSchedule[0].overrides);
  for (const key of ['attack','speed','range','attackInterval']) assert.equal(enemy[key], expected[key]);
  assert.equal(enemy.maxHp, expected.hp);
  assert.equal(enemy.maxHp, Math.round(base.hp * 3));
  assert.equal(enemy.attack, Math.max(1, Math.round(base.attack * STAGES[0].enemyAttack * .5 * 3)));
  assert.equal(enemy.speed, base.speed * .8);
  assert.equal(enemy.maxShield, Math.round(enemy.maxHp * base.shield.hpRatio));
  assert.equal(enemy.attribute, base.attribute);
  assert.equal(enemy.regeneration, null);
  assert.notEqual(enemy.definition, base);
  assert.deepEqual(getEnemy('clock-beetle'), before);
});

test('ally spawn and detail use the same level, ability and equipment calculation including debuffs below one', () => {
  const modifiers = { hp: 1.15, attack: .75, speed: .8, range: 1.1, attackInterval: .9, attributeBonuses: {wild:{attack:.1}} };
  const ranks = { hp: 5, attack: 3, signature: 1 };
  const expected = unitCombatStats(getUnit('deer'), 4, modifiers, ranks);
  const state = createBattle({ mode: 'challenge', sequence: [], levels: {deer:4}, abilities: {deer:ranks}, modifiers });
  state.gold = 1000;
  assert.equal(summonUnit(state, 'deer'), true);
  const unit = state.units[0];
  for (const key of ['attack','speed','range','attackInterval']) assert.equal(unit[key], expected[key]);
  assert.equal(unit.maxHp, expected.hp);
  assert.equal(unit.shield, Math.round(expected.hp * expected.shield.hpRatio));
  assert.deepEqual(unit.gemAttributeBonuses, expected.gemAttributeBonuses);
  assert.equal(characterStats('missing'), null);
});

test('timed buffs and debuffs refresh by ID, combine with slow, expire and leave spawn stats intact for either team', () => {
  for (const team of ['player','enemy']) {
    const unit = {team, attack:100, speed:50, range:60, attackInterval:1, slowRemaining:1, slowFactor:.5};
    assert.equal(applyStatEffect(unit,{id:'rage',stat:'attack',multiplier:1.2,duration:2}), true);
    assert.equal(applyStatEffect(unit,{id:'weakness',stat:'attack',multiplier:.5,duration:1}), true);
    assert.equal(combatStat(unit,'attack'), 60);
    applyStatEffect(unit,{id:'rage',stat:'attack',multiplier:1.5,duration:2});
    assert.equal(unit.statEffects.length, 2);
    assert.equal(combatStat(unit,'attack'), 75);
    applyStatEffect(unit,{id:'boots',stat:'speed',multiplier:2,duration:2});
    assert.equal(combatStat(unit,'speed'), 50);
    advanceStatEffects(unit,1);
    assert.equal(combatStat(unit,'attack'),150);
    advanceStatEffects(unit,1);
    assert.equal(combatStat(unit,'attack'),100);
    assert.equal(unit.attack,100);
    assert.equal(unit.speed,50);
    assert.equal(applyStatEffect(unit,{id:'bad',stat:'attack',multiplier:NaN,duration:2}),false);
  }
});

test('battle damage uses current attack effects and returns to original damage after they expire', () => {
  for (const team of ['player','enemy']) {
    const state = createBattle({mode:'challenge',sequence:[]});
    state._spawnSchedule = [{id:'beetle',time:0,x:540,overrides:{attribute:'normal'}}];
    stepBattle(state,tick);
    state.gold=1000; summonUnit(state,'sheep');
    const attacker=state.units.find(u=>u.team===team), target=state.units.find(u=>u.team!==team);
    attacker.x=team==='player'?500:540; attacker.speed=0;
    target.x=team==='player'?540:500; target.speed=0; target.attackTimer=1000;
    target.hp=target.maxHp=1000;
    applyStatEffect(attacker,{id:'weakness',stat:'attack',multiplier:.5,duration:.8});
    let before=target.hp;
    while(target.hp===before && state.time<3)stepBattle(state,tick);
    assert.equal(before-target.hp,attacker.attack*.5);
    before=target.hp;
    while(target.hp===before && state.time<4)stepBattle(state,tick);
    assert.equal(before-target.hp,attacker.attack);
  }
});
