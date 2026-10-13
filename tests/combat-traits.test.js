import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEffect } from '../dist/src/combat-effects.js';
import { ENEMIES, UNITS } from '../dist/src/data.js';
import { effect, effectInfo, effectText, traitFields } from '../dist/src/effects.js';
import { resolveDamage, traitBonus } from '../dist/src/combat-rules.js';
import { createBattle, summonUnit, stepBattle } from '../dist/src/engine.js';

test('combat trait templates provide defaults, common selectors, and validated tuned descriptions', () => {
  assert.deepEqual(effect('sturdy'), {
    type: 'sturdy', damageReduction: .3,
    attackType: 'all', family: 'all', attribute: 'all',
  });
  assert.deepEqual(effect('strong'), {
    type: 'strong', damageReduction: .2, bonus: .1,
    attackType: 'all', family: 'all', attribute: 'all',
  });
  assert.deepEqual(effect('devastating'), {
    type: 'devastating', bonus: .3,
    attackType: 'all', family: 'all', attribute: 'all',
  });
  assert.throws(() => effect('sturdy', { damageReduction: 1.01 }));
  assert.throws(() => effect('strong', { damageReduction: 1.01 }));
  assert.throws(() => effect('devastating', { bonus: -.01 }));
  assert.throws(() => effect('strong', { bonus: Infinity }));

  const tuned = effect('strong', {
    damageReduction: .45, bonus: .17,
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
    sheep: 'sturdy', hedgehog: 'sturdy', turtle: 'sturdy',
    fox: 'strong', deer: 'strong', cloud: 'strong', otter: 'strong',
    rabbit: 'devastating', squirrel: 'devastating', teapot: 'devastating',
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
  const allTraits = {
    effects: {
      sturdy: effect('sturdy'),
      strong: effect('strong'),
      devastating: effect('devastating'),
    },
  };
  assert.deepEqual(traitFields(allTraits), ['damageReduction', 'bonus']);
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
  assert.equal(traitBonus(source, target, 'bonus'), .3);
  assert.equal(traitBonus(source, target, 'damageReduction'), .3);

  const futureTarget = { attackType: 'beam', family: 'new-family', attribute: 'new-attribute' };
  assert.equal(traitBonus({ effects: { devastating: effect('devastating') } }, futureTarget, 'bonus'), .3);
});

test('resolveDamage applies strong versus sturdy as 77 damage for either team direction', () => {
  for (const [sourceTeam, targetTeam] of [['player', 'enemy'], ['enemy', 'player']]) {
    const result = resolveDamage({
      team: targetTeam,
      effects: { sturdy: effect('sturdy') },
    }, 100, {
      team: sourceTeam,
      effects: { strong: effect('strong') },
    });
    assert.deepEqual(result, { hpDamage: 77, shieldDamage: 0 });
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
  assert.equal(resolveDamage(matchingVictim, 100, attacker).hpDamage, 130);
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
  assert.equal(resolveDamage(defender, 100, matchingAttacker).hpDamage, 70);
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
    // 120 buffed attack * 1.25 gem / 1.2 defense gem * 1.3 trait * .8 trait.
    assert.equal(result.hpDamage, 130);
  }
});

test('trait damage resolves against shield before HP overflow', () => {
  const result = resolveDamage({
    team: 'enemy', shield: 40, effects: { sturdy: effect('sturdy') },
  }, 100, {
    team: 'player', effects: { devastating: effect('devastating') },
  });
  assert.deepEqual(result, { hpDamage: 51, shieldDamage: 40 });
});

test('applyEffect installs a reusable trait even when its target selector excludes the bearer', () => {
  const bearer = { team: 'player', attribute: 'wild', effects: {}, statusEffects: {} };
  assert.equal(applyEffect(bearer, effect('sturdy', { attribute: 'machine' })), true);
  assert.equal(traitBonus(bearer, { attribute: 'machine' }, 'damageReduction'), .3);
  assert.equal(traitBonus(bearer, { attribute: 'wild' }, 'damageReduction'), 0);
});

test('native trait values do not change when a character role is reclassified', () => {
  const rabbit = UNITS.find((unit) => unit.id === 'rabbit');
  const target = { team: 'enemy', attribute: 'wild', effects: {} };
  const original = resolveDamage(target, 100, { ...rabbit, team: 'player' });
  const reclassified = resolveDamage(target, 100, { ...rabbit, role: 'support', team: 'player' });
  assert.deepEqual(original, { hpDamage: 130, shieldDamage: 0 });
  assert.deepEqual(reclassified, original);

  const sheep = UNITS.find((unit) => unit.id === 'sheep');
  const attacker = { team: 'enemy', attribute: 'wild', attackType: 'melee', family: 'forest', effects: {} };
  const sturdyTarget = { ...sheep, team: 'player' };
  assert.equal(resolveDamage(sturdyTarget, 100, attacker).hpDamage, 70);
  assert.equal(resolveDamage({ ...sturdyTarget, role: 'ranged' }, 100, attacker).hpDamage, 70);
});

test('released projectile keeps its native trait snapshot after the shooter dies', () => {
  const state = createBattle({ mode: 'challenge', stageId: 1, sequence: [] });
  state._spawnSchedule = [{
    id: 'beetle', time: 0, x: 650,
    overrides: { attribute: 'wild', effects: { shield: false, regeneration: false } },
  }];
  stepBattle(state, 1 / 30);
  state.gold = 1000;
  assert.equal(summonUnit(state, 'squirrel'), true);
  const shooter = state.units.find((unit) => unit.team === 'player');
  const target = state.units.find((unit) => unit.team === 'enemy');
  shooter.x = 400;
  shooter.speed = 0;
  target.x = 650;
  target.speed = 0;
  target.hp = target.maxHp = 1000;
  target.attackTimer = 1000;

  for (let i = 0; i < 90 && !state.projectiles.length; i++) stepBattle(state, 1 / 30);
  assert.equal(state.projectiles.length, 1);
  assert.equal(state.projectiles[0].source.effects.devastating.bonus, .3);
  shooter.dead = true;
  shooter.hp = 0;
  shooter.deathTimer = .32;
  while (state.projectiles.length) stepBattle(state, 1 / 30);
  assert.equal(target.hp, 1000 - shooter.attack * 1.3);
});
