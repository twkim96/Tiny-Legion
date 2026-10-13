import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEffect } from '../dist/src/combat-effects.js';
import { ENEMIES, UNITS } from '../dist/src/data.js';
import { effect, effectInfo, effectText, traitFields } from '../dist/src/effects.js';
import { resolveDamage, traitBonus } from '../dist/src/combat-rules.js';
import { createBattle, summonUnit, stepBattle } from '../dist/src/engine.js';

test('combat trait templates provide defaults, common selectors, and validated tuned descriptions', () => {
  assert.deepEqual(effect('sturdy'), {
    type: 'sturdy', effectiveHp: .5,
    attackType: 'all', family: 'all', attribute: 'all',
  });
  assert.deepEqual(effect('strong'), {
    type: 'strong', effectiveHp: .3, bonus: .2,
    attackType: 'all', family: 'all', attribute: 'all',
  });
  assert.deepEqual(effect('devastating'), {
    type: 'devastating', bonus: .5,
    attackType: 'all', family: 'all', attribute: 'all',
  });
  assert.equal(effectInfo(effect('devastating')).label, '매서움');
  assert.throws(() => effect('sturdy', { effectiveHp: -.01 }));
  assert.throws(() => effect('strong', { effectiveHp: NaN }));
  assert.throws(() => effect('strong', { effectiveHp: Infinity }));
  assert.throws(() => effect('devastating', { bonus: -.01 }));
  assert.throws(() => effect('strong', { bonus: Infinity }));
  assert.equal(effect('sturdy', { effectiveHp: 2 }).effectiveHp, 2);
  assert.equal(effect('devastating', { bonus: 2 }).bonus, 2);

  const tuned = effect('strong', {
    effectiveHp: .45, bonus: .17,
    attackType: 'melee', family: 'forest', attribute: ['wild', 'machine'],
  });
  assert.equal(tuned.attackType, 'melee');
  assert.equal(tuned.family, 'forest');
  assert.deepEqual(tuned.attribute, ['machine', 'wild']);
  assert.match(effectText(tuned), /45%/);
  assert.match(effectText(tuned), /17%/);
  assert.match(effectInfo(tuned).details, /45%/);
  assert.match(effectInfo(tuned).details, /17%/);
});

test('native unit traits are explicit and scoped to each unit original specialties', () => {
  const expected = {
    hedgehog: 'sturdy', turtle: 'sturdy',
    fox: 'strong', deer: 'strong', cloud: 'strong', otter: 'strong',
    rabbit: 'devastating', teapot: 'devastating',
    chick: 'devastating', owl: 'devastating', 'mushroom-witch': 'devastating',
    penguin: 'devastating', whale: 'devastating',
  };
  for (const [id, type] of Object.entries(expected)) {
    const unit = UNITS.find((entry) => entry.id === id);
    assert.ok(unit, `missing unit ${id}`);
    assert.equal(unit.effects[type]?.type, type, `${id} native trait`);
    assert.deepEqual(
      [...unit.effects[type].attribute].sort(),
      [...unit.specialties].sort(),
      `${id} trait scope`,
    );
  }
  for (const id of ['sheep', 'squirrel']) {
    const unit = UNITS.find((entry) => entry.id === id);
    assert.deepEqual(unit.specialties, []);
    assert.equal(Object.values(unit.effects ?? {}).some((value) => ['sturdy', 'strong', 'devastating'].includes(value.type)), false);
  }
  assert.equal(UNITS.find((entry) => entry.id === 'sheep').hp, 540);
  assert.equal(UNITS.find((entry) => entry.id === 'squirrel').attack, 51);
  assert.equal(traitFields(UNITS.find((entry) => entry.id === 'sheep')).length, 0);
  assert.equal(traitFields(UNITS.find((entry) => entry.id === 'squirrel')).length, 0);
  const allTraits = {
    effects: {
      sturdy: effect('sturdy'),
      strong: effect('strong'),
      devastating: effect('devastating'),
    },
  };
  assert.deepEqual(traitFields(allTraits), ['effectiveHp', 'bonus']);
  assert.deepEqual(traitFields({ effects: { sturdy: false, slow: effect('slow', { factor: .5, duration: 1 }) } }), []);
});

test('traitBonus selects the strongest eligible value without stacking trait types', () => {
  const source = {
    effects: {
      sturdy: effect('sturdy'),
      strong: effect('strong'),
      devastating: effect('devastating'),
    },
  };
  const target = { attackType: 'melee', family: 'forest', attribute: 'wild' };
  assert.equal(traitBonus(source, target, 'bonus'), .5);
  assert.equal(traitBonus(source, target, 'effectiveHp'), .5);

  const futureTarget = { attackType: 'beam', family: 'new-family', attribute: 'new-attribute' };
  assert.equal(traitBonus({ effects: { devastating: effect('devastating') } }, futureTarget, 'bonus'), .5);
});

test('resolveDamage applies strong versus sturdy as 80 damage for either team direction', () => {
  for (const [sourceTeam, targetTeam] of [['player', 'enemy'], ['enemy', 'player']]) {
    const result = resolveDamage({
      team: targetTeam,
      effects: { sturdy: effect('sturdy') },
    }, 100, {
      team: sourceTeam,
      effects: { strong: effect('strong') },
    });
    assert.deepEqual(result, { hpDamage: 80, shieldDamage: 0 });
  }
});

test('outgoing selectors match the victim and incoming selectors match the attacker', () => {
  const attacker = {
    team: 'player', attackType: 'ranged', family: 'forest', attribute: 'shadow',
    effects: {
      devastating: effect('devastating', {
        attackType: 'melee', family: 'forest', attribute: ['wild', 'machine'],
      }),
    },
  };
  const matchingVictim = {
    team: 'enemy', attackType: 'melee', family: 'forest', attribute: 'wild', effects: {},
  };
  assert.equal(resolveDamage(matchingVictim, 100, attacker).hpDamage, 150);
  assert.equal(resolveDamage({ ...matchingVictim, attribute: 'spirit' }, 100, attacker).hpDamage, 100);
  assert.equal(resolveDamage({ ...matchingVictim, family: 'starlight' }, 100, attacker).hpDamage, 100);

  const defender = {
    team: 'enemy', effects: {
      sturdy: effect('sturdy', {
        attackType: 'ranged', family: 'forest', attribute: 'machine',
      }),
    },
  };
  const matchingAttacker = {
    team: 'player', attackType: 'ranged', family: 'forest', attribute: 'machine', effects: {},
  };
  assert.equal(resolveDamage(defender, 100, matchingAttacker).hpDamage, 100 / 1.5);
  assert.equal(resolveDamage(defender, 100, { ...matchingAttacker, attackType: 'melee' }).hpDamage, 100);
  assert.equal(resolveDamage(defender, 100, { ...matchingAttacker, attribute: 'wild' }).hpDamage, 100);
});

test('attack buffs, attribute gems, and traits resolve in the final damage order', () => {
  for (const [sourceTeam, targetTeam] of [['player', 'enemy'], ['enemy', 'player']]) {
    const result = resolveDamage({
      team: targetTeam,
      attribute: 'wild',
      gemAttributeBonuses: { machine: { effectiveHp: .2 } },
      effects: { strong: effect('strong') },
    }, 120, {
      team: sourceTeam,
      attribute: 'machine',
      gemAttributeBonuses: { wild: { attack: .25 } },
      effects: { devastating: effect('devastating') },
    });
    // 120 buffed attack * 1.25 gem / 1.2 defense gem * 1.5 trait / 1.3 trait.
    assert.ok(Math.abs(result.hpDamage - 144.23076923076923) < 1e-10);
  }
});

test('effective HP divides damage and shield overflow without an upper limit', () => {
  const futureSturdy = effect('sturdy', { effectiveHp: 2 });
  assert.deepEqual(resolveDamage({
    team: 'enemy', effects: { sturdy: futureSturdy },
  }, 100, { team: 'player' }), { hpDamage: 100 / 3, shieldDamage: 0 });
  const result = resolveDamage({
    team: 'enemy', shield: 40, effects: { sturdy: futureSturdy },
  }, 100, {
    team: 'player', effects: { devastating: effect('devastating') },
  });
  assert.deepEqual(result, { hpDamage: 10, shieldDamage: 40 });
});

test('applyEffect installs a reusable trait even when its target selector excludes the bearer', () => {
  const bearer = { team: 'player', attribute: 'wild', effects: {}, statusEffects: {} };
  assert.equal(applyEffect(bearer, effect('sturdy', { attribute: 'machine' })), true);
  assert.equal(traitBonus(bearer, { attribute: 'machine' }, 'effectiveHp'), .5);
  assert.equal(traitBonus(bearer, { attribute: 'wild' }, 'effectiveHp'), 0);
});

test('native trait values do not change when a character role is reclassified', () => {
  const rabbit = UNITS.find((unit) => unit.id === 'rabbit');
  const target = { team: 'enemy', attribute: 'wild', effects: {} };
  const original = resolveDamage(target, 100, { ...rabbit, team: 'player' });
  const reclassified = resolveDamage(target, 100, { ...rabbit, role: 'support', team: 'player' });
  assert.deepEqual(original, { hpDamage: 150, shieldDamage: 0 });
  assert.deepEqual(reclassified, original);

  const attacker = { team: 'enemy', attribute: 'wild', attackType: 'melee', family: 'forest', effects: {} };
  const hedgehog = UNITS.find((unit) => unit.id === 'hedgehog');
  const sturdyTarget = { ...hedgehog, team: 'player', attribute: 'machine' };
  assert.equal(resolveDamage(sturdyTarget, 100, attacker).hpDamage, 100);
  assert.equal(resolveDamage({ ...sturdyTarget, role: 'ranged' }, 100, attacker).hpDamage, 100);
  assert.equal(resolveDamage(sturdyTarget, 100, { ...attacker, attribute: 'machine' }).hpDamage, 100 / 1.5);
});

test('released specialized projectile keeps its trait snapshot after the shooter dies', () => {
  const state = createBattle({ mode: 'challenge', stageId: 1, sequence: [] });
  state._spawnSchedule = [{
    id: 'beetle', time: 0, x: 650,
    overrides: { attribute: 'machine', effects: { shield: false, regeneration: false } },
  }];
  stepBattle(state, 1 / 30);
  state.gold = 1000;
  assert.equal(summonUnit(state, 'teapot'), true);
  const shooter = state.units.find((unit) => unit.team === 'player');
  const target = state.units.find((unit) => unit.team === 'enemy');
  shooter.x = 400;
  shooter.speed = 0;
  target.x = 550;
  target.speed = 0;
  target.hp = target.maxHp = 1000;
  target.attackTimer = 1000;

  for (let i = 0; i < 90 && !state.projectiles.length; i++) stepBattle(state, 1 / 30);
  assert.equal(state.projectiles.length, 1);
  assert.equal(state.projectiles[0].source.effects.devastating.bonus, .5);
  shooter.dead = true;
  shooter.hp = 0;
  shooter.deathTimer = .32;
  while (state.projectiles.length) stepBattle(state, 1 / 30);
  assert.equal(target.hp, 1000 - shooter.attack * 1.5);
});
