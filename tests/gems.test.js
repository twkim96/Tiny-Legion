import test from 'node:test';
import assert from 'node:assert/strict';
import { GEM_TYPES, GEM_OPTIONS, GEM_BANNERS, initialGemState, normalizeGemState, gemByUid, gemDefinition, gemOptionText, gemDescription, gemUpgradeCost, gemTransferCost, drawGem, gemUpgradeMaterials, upgradeGem, transferGem, equipGem, unequipGem, gemEffects } from '../dist/src/gems.js';
const account = () => ({ ...initialGemState(), onboarding: { phase: 'complete' }, highestCleared: 11, gold: 1e7, tickets: 50, diamonds: 300, gemGuide: {} });
const item = (uid, type = 'income', level = 1, options = []) => ({ uid, type, level, options });
const sequence = values => { let i = 0; return () => values[i++]; };
const unchanged = (a, operation, expected) => { const before = structuredClone(a); assert.equal(operation(), expected); assert.deepEqual(a, before); };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} ≠ ${expected}`);

test('fresh state is independent and definitions describe scaled legacy and new effects', () => {
  const a = initialGemState(), b = initialGemState();
  a.gemEquipment.income = 'x';
  assert.deepEqual(b.gemEquipment, {});
  assert.equal(GEM_TYPES.length, 7);
  assert.equal(GEM_OPTIONS.length, 10);
  assert.deepEqual(GEM_BANNERS[0].types, ['income', 'capacity', 'harvest', 'bounty']);
  assert.equal(gemDefinition('hp').name, '온기');
  assert.equal(gemDefinition('invalid'), null);
  assert.match(gemDescription(item('x', 'attack', 10)), /32.5%/);
  assert.match(gemOptionText({ id: 'wildAttack', value: .1 }), /10%/);
  assert.deepEqual(gemUpgradeCost(item('x', 'hp', 9)), { copies: 256, gold: 24300 });
  assert.equal(gemTransferCost(item('x', 'hp', 9)), 4500);
});

test('legacy migration preserves owned counts and equipped effect, occurs once without random options', () => {
  const raw = { gems: { attack: 7, hp: 3, gold: 1, evil: 4 }, equippedGem: 'hp' };
  const state = normalizeGemState(raw);
  assert.equal(state.gemItems.length, 3);
  for (const type of ['attack', 'hp', 'gold']) {
    assert.equal(state.gemItems.filter(g => g.type === type).length + state.gemReserves[type], raw.gems[type]);
  }
  assert.ok(state.gemItems.every(g => g.level === 1 && g.options.length === 0));
  assert.equal(gemByUid(state, state.gemEquipment.hp).type, 'hp');
  close(gemEffects(state).hp, 1.15);
  assert.deepEqual(normalizeGemState({ ...raw, ...state }), state);
  assert.equal(normalizeGemState({ ...raw, gemItems: [] }).gemItems.length, 0);
  const old = account();
  Object.assign(old, state);
  assert.equal(upgradeGem(old, state.gemItems.find(g => g.type === 'attack').uid), true);
  assert.equal(old.gemReserves.attack, 5);
});

test('normalization repairs duplicate IDs, caps ranks and preserves repeated valid options and ranks', () => {
  const raw = {
    gemItems: [
      item('gem-1', 'income', 8, [{ id: 'attack', value: .02 }, { id: 'attack', value: .03 }, { id: 'wildAttack', value: .1 }, { id: 'hp', value: .01 }]),
      item('gem-1', 'capacity', 100), item('gem-2', 'bounty', -7), item('', 'harvest', 4), item('bad', 'invalid', 7),
      item('odd', 'hp', 3, [{ id: 'bad', value: 1 }, { id: 'hp', value: NaN }, { id: 'acorn', value: 10 }, { id: 'speed', value: -.5 }]),
    ], gemEquipment: { income: 'gem-1', capacity: 'gem-1', bounty: 'gem-2', harvest: 'gem-3', hp: 'odd', invalid: 'bad' },
    gemReserves: { attack: 2e6, hp: -1, gold: 5.8, income: 99 }, nextGemUid: 1, gemWelcomeClaimed: true,
  };
  const before = structuredClone(raw), state = normalizeGemState(raw);
  assert.deepEqual(raw, before);
  assert.equal(new Set(state.gemItems.map(g => g.uid)).size, 5);
  assert.equal(gemByUid(state, 'gem-2').type, 'bounty');
  assert.deepEqual(state.gemItems.map(g => g.level), [8, 10, 1, 4, 3]);
  assert.deepEqual(state.gemItems[0].options, raw.gemItems[0].options.slice(0, 3));
  assert.deepEqual(state.gemItems[4].options, [{ id: 'acorn', value: .03 }, { id: 'speed', value: .01 }]);
  assert.deepEqual(state.gemEquipment, { income: 'gem-1', bounty: 'gem-2', hp: 'odd' });
  assert.equal('gemPresets' in state, false);
  assert.deepEqual(state.gemReserves, { attack: 1e6, hp: 0, gold: 5 });
  assert.deepEqual(normalizeGemState(state), state);
  Object.assign(state, { onboarding: { phase: 'complete' }, highestCleared: 11, diamonds: 30 });
  assert.ok(drawGem(state, { random: () => 0 }));
  assert.equal(new Set(state.gemItems.map(g => g.uid)).size, 6);
});

test('draw RNG exceptions and invalid samples at every generation step leave all state unchanged', () => {
  // type, line count, then three option ID/value pairs.
  const rolls = [.2, .99, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < rolls.length; i++) {
    for (const bad of [NaN, Infinity, -1, 1, undefined, '0']) {
      const a = account(), samples = [...rolls]; samples[i] = bad;
      unchanged(a, () => drawGem(a, { random: sequence(samples) }), null);
    }
    const a = account(); let n = 0;
    unchanged(a, () => drawGem(a, { random: () => { if (n++ === i) throw Error('RNG unavailable'); return rolls[n - 1]; } }), null);
  }
  const free = account();
  unchanged(free, () => drawGem(free, { free: true, random: sequence([.99, 0, 1]) }), null);
});

test('draw equal partitions, line counts, integer ranges and duplicate options, with atomic charge and no equip', () => {
  for (let t = 0; t < 4; t++) {
    for (let lines = 1; lines <= 3; lines++) {
      const a = account();
      const drawn = drawGem(a, { payment: 'tickets', random: sequence([(t + .5) / 4, (lines - .5) / 3, ...Array.from({ length: lines }, () => [0, .999]).flat()]) });
      assert.equal(drawn.type, GEM_BANNERS[0].types[t]);
      assert.equal(drawn.options.length, lines);
      assert.ok(drawn.options.every(o => o.id === 'attack' && o.value === .03));
      assert.equal(a.tickets, 45);
      assert.equal(a.diamonds, 300);
      assert.equal(a.gemGuide.drawn, true);
      assert.deepEqual(a.gemEquipment, {});
    }
  }
  for (let i = 0; i < GEM_OPTIONS.length; i++) {
    for (const amount of [0, .999]) {
      const a = account();
      const drawn = drawGem(a, { random: sequence([0, 0, (i + .5) / GEM_OPTIONS.length, amount]) });
      assert.deepEqual(drawn.options[0], { id: GEM_OPTIONS[i].id, value: amount === 0 ? GEM_OPTIONS[i].min : GEM_OPTIONS[i].max });
      assert.equal(a.diamonds, 270);
    }
  }
});

test('all operations require onboarding and 2-1 completion; free welcome is income, once, without currency', () => {
  for (const locked of [{ highestCleared: 10 }, { onboarding: { phase: 'intro' } }]) {
    const a = Object.assign(account(), locked);
    a.gemItems = [item('s', 'attack', 3), item('t', 'attack'), item('m', 'attack')];
    unchanged(a, () => drawGem(a, { free: true }), null);
    unchanged(a, () => upgradeGem(a, 't', ['m']), false);
    unchanged(a, () => transferGem(a, 's', 't'), false);
    unchanged(a, () => equipGem(a, 't'), false);
  }
  const a = account(); a.diamonds = 0; a.tickets = 0;
  const free = drawGem(a, { free: true, random: () => 0 });
  assert.equal(free.type, 'income');
  assert.equal(a.diamonds, 0);
  assert.equal(a.tickets, 0);
  assert.equal(a.gemWelcomeClaimed, true);
  unchanged(a, () => drawGem(a, { free: true }), null);
  unchanged(a, () => drawGem(a), null);
  unchanged(a, () => drawGem(a, { free: true, banner: 'bad' }), null);
  unchanged(a, () => drawGem(a, { payment: 'gold' }), null);
});

test('upgrade consumes exact explicit candidates plus reserve gap, preserves options and unrelated items', () => {
  const a = account(), options = [{ id: 'speed', value: .03 }];
  a.gemItems = [item('t', 'attack', 3, options), item('m', 'attack'), item('extra', 'attack'), item('equipped', 'attack'), item('ranked', 'attack', 2), item('other', 'hp')];
  a.gemReserves.attack = 3;
  a.gemEquipment.attack = 'equipped';
  assert.deepEqual(gemUpgradeMaterials(a, 't').map(g => g.uid), ['m', 'extra']);
  for (const ids of [['missing'], ['m', 'm'], ['t'], ['other'], ['ranked'], ['equipped'], [], ['m', 'extra', 'missing']]) {
    unchanged(a, () => upgradeGem(a, 't', ids), false);
  }
  assert.equal(upgradeGem(a, 't', ['m']), true);
  assert.equal(gemByUid(a, 't').level, 4);
  assert.deepEqual(gemByUid(a, 't').options, options);
  assert.equal(a.gemReserves.attack, 0);
  assert.equal(a.gold, 1e7 - 2700);
  assert.equal(gemByUid(a, 'm'), null);
  assert.ok(gemByUid(a, 'extra'));
  unchanged(a, () => upgradeGem(a, 't', ['m']), false);
});

test('reserve-only, instance-only, excessive materials, insufficient acorns and max-rank guards', () => {
  const a = account(); a.gemItems = [item('t', 'hp'), item('m', 'hp'), item('extra', 'hp')];
  unchanged(a, () => upgradeGem(a, 't', ['m', 'extra']), false);
  a.gold = 299;
  unchanged(a, () => upgradeGem(a, 't', ['m']), false);
  a.gold = 300;
  assert.equal(upgradeGem(a, 't', ['m']), true);
  assert.equal(a.gold, 0);
  a.gold = 1200; a.gemReserves.hp = 2;
  assert.equal(upgradeGem(a, 't'), true);
  assert.equal(gemByUid(a, 't').level, 3);
  assert.equal(a.gemReserves.hp, 0);
  a.gold = 1e7; gemByUid(a, 't').level = 10; a.gemReserves.hp = 1e6;
  assert.equal(gemUpgradeCost(gemByUid(a, 't')), null);
  unchanged(a, () => upgradeGem(a, 't', ['extra']), false);
});

test('transfer replaces destination rank across types, preserves its options, clears all source references once', () => {
  const a = account(), targetOptions = [{ id: 'acorn', value: .03 }];
  a.gemItems = [item('s', 'attack', 8, [{ id: 'attack', value: .03 }]), item('t', 'harvest', 2, targetOptions)];
  equipGem(a, 's'); equipGem(a, 't');
  assert.equal(transferGem(a, 's', 't'), true);
  assert.equal(gemByUid(a, 's'), null);
  assert.equal(gemByUid(a, 't').level, 8);
  assert.deepEqual(gemByUid(a, 't').options, targetOptions);
  assert.equal(a.gold, 1e7 - 4000);
  assert.deepEqual(a.gemEquipment, { harvest: 't' });
  unchanged(a, () => transferGem(a, 's', 't'), false);
  unchanged(a, () => transferGem(a, 't', 't'), false);
});

test('transfer rejects missing, equal/lower/rank-one sources and insufficient payment without changes', () => {
  for (const [s, t, gold] of [[1, 1, 1000], [2, 2, 1000], [2, 3, 1000], [3, 1, 1499]]) {
    const a = account(); a.gemItems = [item('s', 'income', s), item('t', 'hp', t)]; a.gold = gold;
    unchanged(a, () => transferGem(a, 's', 't'), false);
    unchanged(a, () => transferGem(a, 'missing', 't'), false);
    unchanged(a, () => transferGem(a, 's', 'missing'), false);
  }
});

test('equipment has no three-gem cap, replaces only the same kind and unregisters one kind', () => {
  const a = account();
  a.gemItems = GEM_TYPES.map(def => item(def.id, def.id));
  for (const gem of a.gemItems) assert.equal(equipGem(a, gem.uid), true);
  assert.equal(Object.keys(a.gemEquipment).length, GEM_TYPES.length);
  assert.equal(a.gemGuide.equipped, true);
  const others = {...a.gemEquipment};
  a.gemItems.push(item('better', 'income', 3));
  assert.equal(equipGem(a, 'better'), true);
  assert.deepEqual(a.gemEquipment, {...others, income: 'better'});
  assert.ok(gemByUid(a, 'income'));
  for (const uid of ['missing', undefined, null, 0]) unchanged(a, () => equipGem(a, uid), false);
  assert.equal(unequipGem(a, 'income'), true);
  assert.equal(a.gemEquipment.income, undefined);
  unchanged(a, () => unequipGem(a, 'income'), false);
  unchanged(a, () => unequipGem(a, 'missing'), false);
  assert.equal(Object.keys(a.gemEquipment).length, GEM_TYPES.length - 1);
});

test('all equipped kinds and repeated options sum into a detached account-wide snapshot', () => {
  const a = account();
  a.gemItems = [
    item('a', 'income', 5, [{ id: 'attack', value: .03 }, { id: 'attack', value: .03 }, { id: 'goldIncome', value: .02 }]),
    item('b', 'bounty', 1, [{ id: 'wildAttack', value: .1 }, { id: 'wildAttack', value: .1 }, { id: 'wildDefense', value: .05 }]),
    item('c', 'harvest', 10, [{ id: 'acorn', value: .03 }, { id: 'speed', value: .02 }, { id: 'hp', value: .01 }]),
  ];
  a.gemEquipment = { income: 'a', bounty: 'b', harvest: 'c' };
  const effects = gemEffects(a);
  close(effects.goldIncome, 1.22); close(effects.attack, 1.06); close(effects.hp, 1.01);
  close(effects.acorn, 1 + .15 * 3.25 + .03); close(effects.speed, 1.02);
  close(effects.attributeBonuses.wild.attack, .2); close(effects.attributeBonuses.wild.effectiveHp, .05);
  assert.deepEqual(effects.attributeBonuses.machine, { attack: 0, effectiveHp: 0 });
  a.gemItems[0].level = 1; a.gemItems[1].options[0].value = .05;
  close(effects.goldIncome, 1.22); close(effects.attributeBonuses.wild.attack, .2);
  assert.deepEqual(gemEffects({...a, gemEquipment:{}}), gemEffects(initialGemState()));
  for (const [type, effect, base] of [['capacity', 'goldCapacity', .15], ['bounty', 'killGold', .2], ['attack', 'attack', .1], ['hp', 'hp', .15], ['gold', 'acorn', .15]]) {
    a.gemItems = [item('x', type, 2)]; a.gemEquipment = { [type]: 'x' };
    close(gemEffects(a)[effect], 1 + base * 1.25);
  }
  for (const attribute of ['wild', 'machine', 'spirit', 'shadow']) {
    a.gemItems = [item('x', 'capacity', 1, [{ id: `${attribute}Attack`, value: .1 }])];
    a.gemEquipment = { capacity: 'x' };
    close(gemEffects(a).attributeBonuses[attribute].attack, .1);
    close(gemEffects(a).attack, 1);
  }
});

test('imported unsafe IDs cannot become executable attribute text or steal references',()=>{
 const raw={gemItems:[item('bad" onclick="alert(1)','income',2),item('safe','hp',1)],gemEquipment:{income:'bad" onclick="alert(1)',hp:'safe'}};
 const clean=normalizeGemState(raw);
 assert.ok(clean.gemItems.every(g=>/^[A-Za-z0-9_-]{1,80}$/.test(g.uid)));
 assert.equal(clean.gemItems[0].level,2);
 assert.deepEqual(clean.gemEquipment,{hp:'safe'});
});


test('old test presets do not keep live mode-specific equipment or migrate inventory',()=>{
 const raw={gemItems:[item('a'),item('b','capacity',4)],gemPresets:[['a','b',null]]};
 const state=normalizeGemState(raw);
 assert.deepEqual(state.gemItems,raw.gemItems);
 assert.deepEqual(state.gemEquipment,{});
 assert.equal('gemPresets' in state,false);
});

test('same-kind transfer clears source equipment without implicitly registering the target',()=>{
 const a=account(); a.gemItems=[item('s','income',4),item('t','income',1)];
 equipGem(a,'s'); assert.equal(transferGem(a,'s','t'),true);
 assert.deepEqual(a.gemEquipment,{});
 assert.equal(gemEffects(a).goldIncome,1);
 assert.equal(equipGem(a,'t'),true);
 close(gemEffects(a).goldIncome,1.175);
});
