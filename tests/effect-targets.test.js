import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEffectTargets,
  matchesEffectTarget,
  effectTargetText,
} from '../dist/src/effect-targets.js';
import {
  effect,
  effectInfo,
  effectOrigin,
} from '../dist/src/effects.js';
import {
  ATTRIBUTES as REEXPORTED_ATTRIBUTES,
  ENEMIES,
  FAMILIES as REEXPORTED_FAMILIES,
  NEUTRAL_ATTRIBUTE as REEXPORTED_NEUTRAL_ATTRIBUTE,
  UNITS,
  getUnit,
} from '../dist/src/characters.js';
import {
  ATTRIBUTES,
  FAMILIES,
  NEUTRAL_ATTRIBUTE,
  attributeLabel,
  familyName,
} from '../dist/src/character-tags.js';
import { characterStats } from '../dist/src/character-stats.js';
import {
  activeEffects,
  applyEffect,
  applyHitEffects,
  attackSource,
  combatStat,
  healUnit,
  initializeEffects,
  queueHealing,
  remainingEffect,
  supportTarget,
  tickPeriodicEffects,
  tickRepulsion,
} from '../dist/src/combat-effects.js';
import { resolveDamage } from '../dist/src/combat-rules.js';
import { createBattle, fireCannon, stepBattle, summonUnit } from '../dist/src/engine.js';

const taggedUnit = (uid, team = 'player', tags = {}, effects = {}) =>
  initializeEffects({
    uid,
    team,
    attackType: 'melee',
    family: 'forest',
    attribute: 'wild',
    role: 'melee',
    specialties: [],
    x: 500,
    hp: 50,
    maxHp: 100,
    attack: 40,
    speed: 20,
    range: 100,
    attackInterval: 1,
    dead: false,
    ...tags,
  }, { effects });

const statusSnapshot = (unit, type) => structuredClone(activeEffects(unit, type));

test('attribute filters select recipients without creating new battle effect origins', () => {
  for (const team of ['player', 'enemy']) {
    const target = taggedUnit(`scoped-${team}`, team);
    const excluded = taggedUnit(`excluded-${team}`, team, { attribute: 'machine' });
    const buff = effect('stat', { stat: 'attack', attribute: 'wild', multiplier: 1.3, duration: 2 });
    assert.equal(applyEffect(target, buff), true);
    assert.equal(applyEffect(excluded, buff), false);
    assert.equal(combatStat(excluded, 'attack'), 40);
    assert.equal(applyEffect(target, effect('stat', {
      stat: 'attack', family: 'forest', multiplier: 1.1, duration: 1,
    })), true);
    assert.equal(activeEffects(target, 'stat').length, 1);
    assert.equal(combatStat(target, 'attack'), 44);
    assert.equal(applyEffect(target, buff, { origin: effectOrigin('gem', 'test-gem', 'option-0') }), true);
    assert.equal(activeEffects(target, 'stat').length, 2);
    assert.ok(Math.abs(combatStat(target, 'attack') - 57.2) < 1e-9);
    assert.equal(applyEffect(target, effect('slow', { attribute: 'wild', factor: .7, duration: 2 })), true);
    assert.equal(applyEffect(target, effect('slow', { family: 'forest', factor: .8, duration: 1 })), true);
    assert.equal(activeEffects(target, 'slow').length, 1);
    assert.equal(remainingEffect(target, 'slow'), 1);
    assert.equal(combatStat(target, 'speed'), 16);
  }
});

test('effect target selectors default to all, validate IDs, and canonicalize sets', () => {
  assert.deepEqual(normalizeEffectTargets({}), {
    attackType: 'all', family: 'all', attribute: 'all',
  });
  assert.deepEqual(normalizeEffectTargets({
    attackType: ['ranged', 'melee', 'ranged'],
    family: ['winter', 'forest', 'winter'],
    attribute: ['wild', 'shadow', 'wild'],
  }), {
    attackType: ['melee', 'ranged'],
    family: ['forest', 'winter'],
    attribute: ['shadow', 'wild'],
  });
  assert.deepEqual(normalizeEffectTargets({
    attackType: 'ranged', family: 'workshop', attribute: 'normal',
  }), { attackType: 'ranged', family: 'workshop', attribute: 'normal' });
  assert.deepEqual(normalizeEffectTargets({
    attackType: null, family: null, attribute: null,
  }), { attackType: 'all', family: 'all', attribute: 'all' });

  for (const axis of ['attackType', 'family', 'attribute']) {
    for (const invalid of ['', [], ['not-registered'], 'not-registered']) {
      assert.throws(() => normalizeEffectTargets({ [axis]: invalid }), TypeError,
        `${axis} should reject ${JSON.stringify(invalid)}`);
    }
  }

  assert.equal(effect('stat', { stat: 'attack', duration: 2 }).attackType, 'all',
    'unscoped stats keep applying to both attack classes');
  for (const attackType of ['melee', 'ranged']) {
    const recipient = taggedUnit(`unscoped-${attackType}`, 'player', { attackType });
    assert.equal(applyEffect(recipient, effect('stat', {
      stat: 'attack', multiplier: 1.5, duration: 2,
    })), true);
    assert.equal(combatStat(recipient, 'attack'), 60,
      `unscoped stat should affect ${attackType} recipients`);
  }
});

test('matching is OR within an axis, AND across axes, and all accepts future tags', () => {
  const scope = {
    attackType: ['melee', 'ranged'],
    family: ['forest', 'winter'],
    attribute: ['wild', 'shadow'],
  };
  assert.equal(matchesEffectTarget(scope, {
    attackType: 'ranged', family: 'winter', attribute: 'wild',
  }), true);
  assert.equal(matchesEffectTarget(scope, {
    attackType: 'melee', family: 'forest', attribute: 'shadow',
  }), true);
  assert.equal(matchesEffectTarget(scope, {
    attackType: 'ranged', family: 'workshop', attribute: 'wild',
  }), false);
  assert.equal(matchesEffectTarget(scope, {
    attackType: 'ranged', family: 'forest', attribute: 'machine',
  }), false);
  assert.equal(matchesEffectTarget({ attackType: 'ranged' }, {
    attackType: 'ranged', family: 'future-family', attribute: 'future-attribute',
  }), true, 'unconstrained axes remain open to future subject tags');
  assert.equal(matchesEffectTarget({}, {
    attackType: 'future-attack', family: 'future-family', attribute: 'future-attribute',
  }), true, 'all must not expand into a closed list of current IDs');
});

test('character registries expose explicit family and intrinsic attribute tags', () => {
  assert.strictEqual(REEXPORTED_ATTRIBUTES, ATTRIBUTES);
  assert.strictEqual(REEXPORTED_FAMILIES, FAMILIES);
  assert.strictEqual(REEXPORTED_NEUTRAL_ATTRIBUTE, NEUTRAL_ATTRIBUTE);
  assert.deepEqual(Object.keys(FAMILIES).sort(), ['forest', 'starlight', 'winter', 'workshop']);
  assert.deepEqual([...ATTRIBUTES.map(({ id }) => id), NEUTRAL_ATTRIBUTE.id], [
    'wild', 'machine', 'spirit', 'shadow', 'normal',
  ]);
  assert.equal(familyName('forest'), '숲');
  assert.equal(familyName('workshop'), '공방');
  assert.equal(attributeLabel('wild'), '야생');
  assert.equal(attributeLabel('normal'), '무속성');

  assert.equal(getUnit('sheep').family, 'forest');
  assert.equal(getUnit('teapot').family, 'workshop');
  assert.equal(getUnit('cloud').family, 'starlight');
  assert.equal(getUnit('penguin').family, 'winter');
  for (const character of [...UNITS, ...ENEMIES]) {
    assert.ok(Object.hasOwn(FAMILIES, character.family), `${character.id} needs an explicit family`);
    assert.ok([...ATTRIBUTES, NEUTRAL_ATTRIBUTE].some(({ id }) => id === character.attribute),
      `${character.id} needs an explicit intrinsic attribute`);
  }

  const independentlyTagged = characterStats({
    ...getUnit('sheep'), specialties: ['machine'],
  });
  assert.equal(independentlyTagged.family, 'forest');
  assert.equal(independentlyTagged.attribute, 'wild');
  assert.deepEqual(independentlyTagged.specialties, ['machine'],
    'family and attribute do not get inferred from specialties');
});

test('effect information reports attack, family, attribute, and all scopes', () => {
  const scoped = effectInfo(effect('attackImmunity', {
    attackType: 'ranged', family: 'workshop', attribute: 'machine',
  }));
  assert.equal(scoped.label, '공격 무효(원거리)');
  assert.match(scoped.details, /종족 공방/);
  assert.match(scoped.details, /속성 기계/);

  const all = effectInfo(effect('attackImmunity', {
    attackType: 'all', family: 'all', attribute: 'all',
  }));
  assert.equal(all.label, '공격 무효(모든 공격)');
  assert.match(all.details, /모든 종족/);
  assert.match(all.details, /모든 속성/);
  const completeTargetText = effectTargetText(all.values, { all: true });
  assert.match(completeTargetText, /대상 모든 공격/);
  assert.match(completeTargetText, /모든 종족/);
  assert.match(completeTargetText, /모든 속성/);
});

test('hit effects match recipients on both teams and rejected refreshes preserve active statuses', () => {
  const matchingSelectors = {
    attackType: 'ranged', family: 'forest', attribute: 'wild',
  };
  const hitEffects = {
    slow: effect('slow', { ...matchingSelectors, factor: .7, duration: 5 }),
    stat: effect('stat', {
      ...matchingSelectors, stat: 'attack', multiplier: 1.5, duration: 5,
    }),
    poison: effect('poison', {
      ...matchingSelectors, ratio: .1, interval: 1, duration: 5,
    }),
    healingSuppression: effect('healingSuppression', {
      ...matchingSelectors, factor: .5, duration: 5,
    }),
    hitStun: effect('hitStun', { ...matchingSelectors, duration: .5 }),
  };

  for (const targetTeam of ['player', 'enemy']) {
    const sourceTeam = targetTeam === 'player' ? 'enemy' : 'player';
    const target = taggedUnit(`target-${targetTeam}`, targetTeam, { attackType: 'ranged' });
    const wrongRecipient = taggedUnit(`wrong-${targetTeam}`, targetTeam, {
      attackType: 'ranged', family: 'workshop', attribute: 'machine',
    });
    const caster = taggedUnit(`caster-${targetTeam}`, sourceTeam, {
      family: 'starlight', attribute: 'spirit', attackType: 'ranged',
    }, hitEffects);
    const source = attackSource(caster, [caster]);

    applyHitEffects(target, source, { hpDamage: 10, damage: 10, direction: 1 });
    applyHitEffects(wrongRecipient, source, { hpDamage: 10, damage: 10, direction: 1 });
    for (const type of Object.keys(hitEffects)) {
      assert.equal(activeEffects(target, type).length, 1, `${targetTeam} recipient gets ${type}`);
      assert.equal(activeEffects(wrongRecipient, type).length, 0, `${type} excludes wrong recipient`);
    }
    assert.equal(combatStat(target, 'attack'), 60);

    const before = Object.fromEntries(Object.keys(hitEffects)
      .map(type => [type, statusSnapshot(target, type)]));
    assert.equal(applyEffect(target, effect('slow', {
      ...matchingSelectors, family: 'workshop', attribute: 'machine',
      factor: .9, duration: 1,
    })), false);
    assert.equal(applyEffect(target, effect('stat', {
      ...matchingSelectors, family: 'workshop', attribute: 'machine',
      stat: 'attack', multiplier: 1.2, duration: 1,
    })), false);
    assert.equal(applyEffect(target, effect('poison', {
      ...matchingSelectors, family: 'workshop', attribute: 'machine',
      ratio: .5, interval: 1, duration: 1,
    }), { damage: 100, direction: -1, source: { team: sourceTeam } }), false);
    assert.equal(applyEffect(target, effect('healingSuppression', {
      ...matchingSelectors, family: 'workshop', attribute: 'machine',
      factor: .9, duration: 1,
    })), false);
    assert.equal(applyEffect(target, effect('hitStun', {
      ...matchingSelectors, family: 'workshop', attribute: 'machine', duration: 1,
    })), false);
    for (const type of Object.keys(hitEffects))
      assert.deepEqual(statusSnapshot(target, type), before[type], `${type} mismatch preserves current status`);
    assert.equal(combatStat(target, 'attack'), 60);
    assert.equal(remainingEffect(target, 'slow'), 5);
  }
});

test('healing, shields, knockback, and regeneration use the recipient matcher', () => {
  const forest = taggedUnit('forest-recipient', 'player', {
    family: 'forest', attribute: 'wild', attackType: 'ranged', x: 200,
  });
  const workshop = taggedUnit('workshop-recipient', 'player', {
    family: 'workshop', attribute: 'machine', attackType: 'ranged', x: 200,
  });
  const workshopHealing = effect('healing', {
    amount: 20, range: 100, family: 'workshop', attribute: 'machine',
  });
  const workshopShield = effect('shield', {
    amount: 30, family: 'workshop', attribute: 'machine',
  });
  const workshopKnockback = effect('knockback', {
    distance: 25, family: 'workshop', attribute: 'machine',
  });

  assert.equal(healUnit(forest, workshopHealing), 0);
  assert.equal(forest.hp, 50);
  assert.equal(applyEffect(forest, workshopHealing), false);
  assert.equal(applyEffect(forest, workshopShield), false);
  assert.equal(forest.shield, 0);
  assert.equal(applyEffect(forest, workshopKnockback, { direction: 1 }), false);
  assert.equal(forest.x, 200);

  assert.equal(healUnit(workshop, workshopHealing), 20);
  assert.equal(applyEffect(workshop, workshopShield), true);
  assert.equal(workshop.shield, 30);
  assert.equal(applyEffect(workshop, workshopKnockback, { direction: 1 }), true);
  assert.equal(workshop.x, 225);

  const nativeEffects = {
    shield: effect('shield', { amount: 30, family: 'workshop', attribute: 'machine' }),
    regeneration: effect('regeneration', {
      amount: 10, interval: 1, family: 'workshop', attribute: 'machine',
    }),
  };
  const mismatched = taggedUnit('mismatched-regen', 'player', {
    family: 'forest', attribute: 'wild', hp: 20,
  }, nativeEffects);
  const matched = taggedUnit('matched-regen', 'player', {
    family: 'workshop', attribute: 'machine', hp: 20,
  }, nativeEffects);
  assert.equal(mismatched.shield, 0, 'initial shield is conditional on its recipient');
  assert.equal(matched.shield, 30);

  const rejectedBatch = { healing: new Map() };
  tickPeriodicEffects(mismatched, 1, {
    heal: spec => queueHealing(rejectedBatch, mismatched, spec), damage() {},
  });
  assert.equal(rejectedBatch.healing.has(mismatched.uid), false);
  assert.equal(mismatched.hp, 20);
  const acceptedBatch = { healing: new Map() };
  tickPeriodicEffects(matched, 1, {
    heal: spec => queueHealing(acceptedBatch, matched, spec), damage() {},
  });
  assert.equal(acceptedBatch.healing.get(matched.uid), 10);
});

test('support healing selects eligible allies and queueing shares direct healing rules', () => {
  const healer = taggedUnit('healer', 'player', {
    family: 'starlight', attribute: 'spirit', attackType: 'ranged', x: 500,
  });
  const veryWoundedWrongFamily = taggedUnit('wrong-family', 'player', {
    family: 'forest', attribute: 'wild', hp: 10, x: 510,
  });
  const eligible = taggedUnit('eligible', 'player', {
    family: 'workshop', attribute: 'machine', hp: 55, x: 520,
  });
  const opponent = taggedUnit('opponent', 'enemy', {
    family: 'workshop', attribute: 'machine', hp: 1, x: 505,
  });
  const workshopSpec = effect('healing', {
    amount: 20, range: 100, family: 'workshop', attribute: 'machine',
  });
  const forestSpec = effect('healing', {
    amount: 15, range: 100, family: 'forest', attribute: 'wild',
  });
  const candidates = [healer, veryWoundedWrongFamily, eligible, opponent];
  assert.strictEqual(supportTarget(healer, candidates, workshopSpec), eligible);
  assert.strictEqual(supportTarget(healer, candidates, forestSpec), veryWoundedWrongFamily,
    'a different support scope can select a different recipient');

  const batch = { healing: new Map() };
  queueHealing(batch, veryWoundedWrongFamily, workshopSpec);
  assert.equal(batch.healing.has(veryWoundedWrongFamily.uid), false,
    'the excluded family receives no queued amount');
  queueHealing(batch, eligible, workshopSpec);
  queueHealing(batch, veryWoundedWrongFamily, forestSpec);
  assert.equal(batch.healing.get(eligible.uid), 20);
  assert.equal(batch.healing.get(veryWoundedWrongFamily.uid), 15);
  assert.equal(healUnit(veryWoundedWrongFamily, workshopSpec), 0);
  assert.equal(healUnit(veryWoundedWrongFamily, forestSpec), 15);
  assert.equal(healUnit(eligible, workshopSpec), 20);
});

test('native effects install regardless of the bearer and conditional immunity checks the incoming source', () => {
  for (const team of ['player', 'enemy']) {
    const bearer = taggedUnit(`bearer-${team}`, team, {
      family: 'forest', attribute: 'wild', attackType: 'melee',
    });
    const intendedTargets = {
      attackType: 'ranged', family: 'workshop', attribute: 'machine',
    };
    const native = [
      effect('immunity', { ...intendedTargets, effect: 'poison' }),
      effect('attackImmunity', intendedTargets),
      effect('repelPulse', {
        ...intendedTargets, interval: 1, range: 100, distance: 20, warning: 0,
      }),
      effect('areaAttack', { ...intendedTargets, radius: 100 }),
      effect('shieldDamageAura', { ...intendedTargets, bonus: .5, range: 100 }),
      effect('shieldDamage', { ...intendedTargets, bonus: .5 }),
      effect('castleDamage', { ...intendedTargets, bonus: .5 }),
    ];
    for (const spec of native)
      assert.equal(applyEffect(bearer, spec), true, `${team} bearer installs ${spec.type}`);

    const incomingWorkshop = {
      team: team === 'player' ? 'enemy' : 'player',
      attackType: 'ranged', family: 'workshop', attribute: 'machine',
    };
    const incomingForest = {
      ...incomingWorkshop, family: 'forest', attribute: 'wild',
    };
    assert.deepEqual(resolveDamage(bearer, 30, incomingWorkshop), {
      hpDamage: 0, shieldDamage: 0, blocked: true,
    });
    assert.equal(resolveDamage(bearer, 30, incomingForest).blocked, undefined,
      'immunity filters inspect incoming family and attribute, not the bearer');

    const poison = effect('poison', { ratio: .1, interval: 1, duration: 2 });
    const poisonBearer = taggedUnit(`poison-bearer-${team}`, team, {
      family: 'forest', attribute: 'wild', attackType: 'melee',
    }, { immunity: effect('immunity', { ...intendedTargets, effect: 'poison' }) });
    assert.equal(applyEffect(poisonBearer, poison, {
      damage: 100, direction: -1, source: incomingWorkshop,
    }), false);
    assert.equal(applyEffect(poisonBearer, poison, {
      damage: 100, direction: -1, source: incomingForest,
    }), true, 'conditional status immunity also uses context.source');
  }
});

test('attack snapshots carry family and attribute; native shield damage and aura scope differ by recipient', () => {
  const caster = taggedUnit('snapshot-caster', 'player', {
    family: 'forest', attribute: 'wild', attackType: 'ranged',
  });
  const snapshot = attackSource(caster, [caster]);
  caster.family = 'winter';
  caster.attribute = 'shadow';
  assert.equal(snapshot.family, 'forest');
  assert.equal(snapshot.attribute, 'wild');

  const forestBearer = taggedUnit('forest-bearer', 'player', {
    family: 'forest', attribute: 'wild', attackType: 'ranged',
  });
  const aura = taggedUnit('aura', 'player', {
    family: 'starlight', attribute: 'spirit', x: 500,
  }, {
    shieldDamageAura: effect('shieldDamageAura', {
      bonus: .5, range: 100, family: 'workshop', attribute: 'machine',
    }),
  });
  const auraEligibleShooter = taggedUnit('eligible-shooter', 'player', {
    family: 'workshop', attribute: 'machine', attackType: 'ranged',
  }, {
    shieldDamage: effect('shieldDamage', {
      bonus: .5, family: 'workshop', attribute: 'machine',
    }),
  });
  const eligibleSnapshot = attackSource(auraEligibleShooter, [auraEligibleShooter, aura]);
  const excludedSnapshot = attackSource(forestBearer, [forestBearer, aura]);
  assert.equal(eligibleSnapshot.effects.shieldDamage.bonus, 1,
    'snapshot retains the native bonus plus the eligible aura bonus');
  assert.equal(eligibleSnapshot.shieldDamageSupportBonus, .5);
  assert.equal(excludedSnapshot.shieldDamageSupportBonus, 0,
    'the aura filters its recipient even when the bearer is nearby');

  const victim = (uid, family, attribute) => {
    const unit = taggedUnit(uid, 'enemy', { family, attribute });
    unit.shield = 100;
    return unit;
  };
  const workshopVictim = victim('workshop-victim', 'workshop', 'machine');
  const forestVictim = victim('forest-victim', 'forest', 'wild');
  assert.equal(resolveDamage(workshopVictim, 20, eligibleSnapshot).shieldDamage, 40,
    'native shieldDamage matches the attacked victim');
  assert.equal(resolveDamage(forestVictim, 20, eligibleSnapshot).shieldDamage, 30,
    'the aura bonus remains while the mismatched native bonus is excluded');
});

test('repel pulses filter recipients by attack type, family, and attribute', () => {
  const source = taggedUnit('repeller', 'enemy', {
    family: 'forest', attribute: 'wild', attackType: 'melee', x: 500,
  });
  assert.equal(applyEffect(source, effect('repelPulse', {
    attackType: 'ranged', family: 'workshop', attribute: 'machine',
    interval: .5, range: 150, distance: 25, warning: 0,
  })), true, 'the pulse filter describes recipients, not its bearer');
  const recipient = (uid, team, attackType, family, attribute, x) =>
    taggedUnit(uid, team, { attackType, family, attribute, x });
  const eligible = recipient('eligible-pulse', 'player', 'ranged', 'workshop', 'machine', 450);
  const immune = recipient('immune-pulse', 'player', 'ranged', 'workshop', 'machine', 440);
  immune.effects.immunity = effect('immunity', {
    effect: 'knockback', attackType: 'melee', family: 'forest', attribute: 'wild',
  });
  const wrongFamily = recipient('wrong-family-pulse', 'player', 'ranged', 'forest', 'wild', 460);
  const wrongAttribute = recipient('wrong-attribute-pulse', 'player', 'ranged', 'workshop', 'wild', 470);
  const wrongAttackType = recipient('wrong-type-pulse', 'player', 'melee', 'workshop', 'machine', 480);
  const sameTeam = recipient('same-team-pulse', 'enemy', 'ranged', 'workshop', 'machine', 490);
  tickRepulsion(source, .5, [source, eligible, immune, wrongFamily, wrongAttribute, wrongAttackType, sameTeam]);
  assert.equal(eligible.x, 425);
  assert.equal(immune.x, 440, 'knockback immunity matches the pulse source snapshot');
  assert.equal(wrongFamily.x, 460);
  assert.equal(wrongAttribute.x, 470);
  assert.equal(wrongAttackType.x, 480);
  assert.equal(sameTeam.x, 490);
});

test('engine projectiles retain forest versus workshop source identity for scoped immunity', () => {
  function fireAtScopedTarget(attackerId) {
    const state = createBattle({ mode: 'challenge', stageId: 5, sequence: [] });
    state._spawnSchedule = [{ id: 'beetle', time: 0, x: 600, overrides: {} }];
    stepBattle(state, 1 / 30);
    const target = state.units.find(unit => unit.team === 'enemy' && unit.id === 'beetle');
    assert.equal(target.family, 'forest');
    assert.equal(target.attribute, 'wild');
    target.x = 600;
    target.speed = 0;
    target.attackTimer = 1000;
    target.action = null;
    assert.equal(applyEffect(target, effect('attackImmunity', {
      attackType: 'ranged', family: 'workshop', attribute: 'machine',
    })), true);

    state.gold = 10000;
    assert.equal(summonUnit(state, attackerId), true);
    const attacker = state.units.find(unit => unit.team === 'player' && unit.id === attackerId);
    attacker.x = attackerId === 'teapot' ? 450 : 400;
    attacker.speed = 0;
    attacker.attackTimer = 0;
    attacker.action = null;
    const beforeHp = target.hp;
    for (let i = 0; i < 90 && state.projectiles.length === 0; i++) stepBattle(state, 1 / 30);
    assert.ok(state.projectiles.length > 0, `${attackerId} should release a real projectile`);
    const projectile = state.projectiles.find(shot => shot.id === attackerId);
    assert.ok(projectile, `${attackerId} projectile should be present`);
    const sourceSnapshot = projectile.source;
    const expected = attackerId === 'squirrel'
      ? { family: 'forest', attribute: 'wild' }
      : { family: 'workshop', attribute: 'machine' };
    assert.equal(attacker.family, expected.family);
    assert.equal(attacker.attribute, expected.attribute);
    assert.equal(sourceSnapshot.family, expected.family);
    assert.equal(sourceSnapshot.attribute, expected.attribute);

    // The released shot must keep its captured source identity through impact.
    attacker.family = attackerId === 'squirrel' ? 'workshop' : 'forest';
    attacker.attribute = attackerId === 'squirrel' ? 'machine' : 'wild';
    while (state.projectiles.length) stepBattle(state, 1 / 30);
    assert.equal(sourceSnapshot.family, expected.family);
    assert.equal(sourceSnapshot.attribute, expected.attribute);
    return { target, beforeHp, attackerId };
  }

  const forestShot = fireAtScopedTarget('squirrel');
  assert.ok(forestShot.target.hp < forestShot.beforeHp,
    'forest/wild projectile passes workshop/machine-only immunity');
  const workshopShot = fireAtScopedTarget('teapot');
  assert.equal(workshopShot.target.hp, workshopShot.beforeHp,
    'workshop/machine projectile is blocked by the same scoped immunity');
});

test('engine cannon uses a ranged normal source for damage immunity and conditional knockback', () => {
  const state = createBattle({ mode: 'challenge', stageId: 5, sequence: [] });
  state._spawnSchedule = [
    {
      id: 'beetle', time: 0, x: 600,
      overrides: { effects: { immunity: effect('immunity', {
        effect: 'knockback', family: 'forest',
      }) } },
    },
    {
      id: 'clock-beetle', time: 0, x: 700,
      overrides: { effects: { immunity: effect('immunity', {
        effect: 'knockback', attackType: 'ranged', attribute: 'normal',
      }) } },
    },
  ];
  stepBattle(state, 1 / 30);
  const forest = state.units.find(unit => unit.team === 'enemy' && unit.id === 'beetle');
  const normalImmune = state.units.find(unit => unit.team === 'enemy' && unit.id === 'clock-beetle');
  assert.ok(forest && normalImmune, 'both scheduled enemies should spawn');
  for (const unit of [forest, normalImmune]) {
    unit.hp = unit.maxHp = 1000;
    unit.shield = unit.maxShield = 0;
    unit.speed = 0;
    unit.attackTimer = 1000;
    unit.action = null;
  }
  assert.equal(forest.family, 'forest');
  assert.equal(forest.attribute, 'wild');
  assert.equal(normalImmune.family, 'workshop');
  assert.equal(normalImmune.attribute, 'machine');
  const before = [forest, normalImmune].map(({ hp, x }) => ({ hp, x }));

  assert.equal(fireCannon(state), true);
  assert.equal(forest.hp, before[0].hp - 110,
    'knockback immunity does not make its bearer immune to cannon damage');
  assert.equal(forest.x, before[0].x + 75,
    'forest-only knockback immunity does not match cannon family:null');
  assert.equal(normalImmune.hp, before[1].hp - 110,
    'conditional knockback immunity does not block cannon damage');
  assert.equal(normalImmune.x, before[1].x,
    'ranged normal knockback immunity matches the cannon source');
});

