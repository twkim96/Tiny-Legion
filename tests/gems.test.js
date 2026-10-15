import test from 'node:test';
import assert from 'node:assert/strict';
import { GEM_TYPES, GEM_OPTIONS, GEM_BANNERS, GEM_OPTION_LIMIT, GEM_OPTION_TIERS, initialGemState, normalizeGemState, gemByUid, gemDefinition, gemOptionText, gemDescription, gemOptionTier, gemRerollCost, gemUpgradeCost, drawGem, rerollGem, ownedGemBasics, gemUpgradeMaterials, upgradeGem, equipGem, unequipGem, gemEffects } from '../dist/src/gems.js';
const account = () => ({ ...initialGemState(), onboarding: { phase: 'complete' }, highestCleared: 11, gold: 1e7, tickets: 50, diamonds: 300, gemGuide: {} });
const item = (uid, type = 'income', level = 1, options = [], optionTier = undefined) => ({ uid, type, level, ...(optionTier === undefined ? {} : { optionTier }), options });
const sequence = values => { let i = 0; return () => values[i++]; };
const unchanged = (a, operation, expected) => { const before = structuredClone(a); assert.equal(operation(), expected); assert.deepEqual(a, before); };
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} ≠ ${expected}`);

test('fresh state is independent and definitions describe scaled legacy and new effects', () => {
  const a = initialGemState(), b = initialGemState();
  a.gemEquipment.income = 'x';
  assert.deepEqual(b.gemEquipment, {});
  assert.equal(GEM_TYPES.length, 7);
  assert.equal(GEM_OPTIONS.length, 10);
  assert.equal(GEM_OPTION_LIMIT, 3);
  assert.deepEqual(GEM_OPTION_TIERS.map(({ id, lines, cost, promotionChance }) => [id, lines, cost, promotionChance]), [
    ['normal', 1, 100, .10], ['rare', 1, 300, .07], ['epic', 2, 1000, .04], ['unique', 3, 3000, .02], ['legendary', 3, 10000, 0],
  ]);
  assert.deepEqual(GEM_BANNERS[0].types, ['income', 'capacity', 'harvest', 'bounty']);
  assert.equal(gemDefinition('hp').name, '온기');
  assert.equal(gemDefinition('invalid'), null);
  assert.match(gemDescription(item('x', 'attack', 10)), /32.5%/);
  assert.match(gemOptionText({ id: 'wildAttack', value: .1 }), /10%/);
  assert.deepEqual(gemUpgradeCost(item('x', 'hp', 9)), { copies: 5, gold: 24300, successChance: .05 });
  assert.equal(gemOptionTier(item('old', 'hp', 1, [{ id: 'attack', value: .01 }, { id: 'hp', value: .02 }])).id, 'epic');
  assert.equal(gemRerollCost(item('x', 'hp', 9)), 100);
  assert.equal(gemRerollCost({ ...item('x', 'hp'), optionTier: 'legendary' }), 10000);
});

test('legacy migration preserves owned counts and equipped effect, occurs once without random options', () => {
  const raw = { gems: { attack: 7, hp: 3, gold: 1, evil: 4 }, equippedGem: 'hp' };
  const state = normalizeGemState(raw);
  assert.equal(state.gemItems.length, 3);
  for (const type of ['attack', 'hp', 'gold']) {
    assert.equal(state.gemItems.filter(g => g.type === type).length + state.gemReserves[type], raw.gems[type]);
  }
  assert.ok(state.gemItems.every(g => g.level === 1 && g.options.length === 0));
  assert.ok(state.gemItems.every(g => g.optionTier === 'normal'));
  assert.equal(gemByUid(state, state.gemEquipment.hp).type, 'hp');
  close(gemEffects(state).hp, 1.15);
  close(gemEffects(state).attack, 1.1);
  close(gemEffects(state).acorn, 1.15);
  assert.deepEqual(normalizeGemState({ ...raw, ...state }), state);
  assert.equal(normalizeGemState({ ...raw, gemItems: [] }).gemItems.length, 0);
  const old = account();
  Object.assign(old, state);
  assert.deepEqual(upgradeGem(old, state.gemItems.find(g => g.type === 'attack').uid), {success:true,level:2});
  assert.equal(old.gemReserves.attack, 3);
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
  assert.deepEqual(state.gemItems.map(g => g.optionTier), ['unique', 'normal', 'normal', 'normal', 'epic']);
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

test('normalization infers legacy tiers without rerolling and caps explicit options to tier lines', () => {
  const raw = { gemItems: [
    item('old-normal', 'income', 1, [{ id: 'attack', value: .02 }]),
    item('old-epic', 'capacity', 1, [{ id: 'hp', value: .01 }, { id: 'hp', value: .03 }]),
    item('explicit', 'harvest', 1, [{ id: 'attack', value: .01 }, { id: 'hp', value: .02 }, { id: 'speed', value: .03 }], 'rare'),
  ] };
  raw.gemItems[2].optionTier = 'rare';
  const state = normalizeGemState(raw);
  assert.deepEqual(state.gemItems.map(g => g.optionTier), ['normal', 'epic', 'rare']);
  assert.deepEqual(state.gemItems.map(g => g.options), [raw.gemItems[0].options, raw.gemItems[1].options, [raw.gemItems[2].options[0]]]);
  assert.deepEqual(normalizeGemState(state), state);
});

test('normalization keeps only the first three valid equipped types in GEM_TYPES order and preserves inventory', () => {
  const types = ['income', 'capacity', 'harvest', 'bounty', 'attack'];
  const raw = {
    gemItems: types.map(type => item(type, type, 1, [], 'normal')),
    gemEquipment: { attack: 'attack', bounty: 'bounty', harvest: 'harvest', capacity: 'capacity', income: 'income' },
  };
  const state = normalizeGemState(raw);
  assert.deepEqual(state.gemEquipment, { income: 'income', capacity: 'capacity', harvest: 'harvest' });
  assert.deepEqual(state.gemItems.map(g => g.uid), types);
});

test('draw RNG exceptions and invalid samples at every generation step leave all state unchanged', () => {
  // Nonfree draws sample type, then one option kind and value; free draws omit type.
  const rolls = [.2, 0, 0];
  for (let i = 0; i < rolls.length; i++) {
    for (const bad of [NaN, Infinity, -1, 1, undefined, '0']) {
      const a = account(), samples = [...rolls]; samples[i] = bad;
      unchanged(a, () => drawGem(a, { random: sequence(samples) }), null);
    }
    const a = account(); let n = 0;
    unchanged(a, () => drawGem(a, { random: () => { if (n++ === i) throw Error('RNG unavailable'); return rolls[n - 1]; } }), null);
  }
  for (let i = 0; i < 2; i++) {
    for (const bad of [NaN, Infinity, -1, 1, undefined, '0']) {
      const a = account(), samples = [0, 0]; samples[i] = bad;
      unchanged(a, () => drawGem(a, { free: true, random: sequence(samples) }), null);
    }
    const a = account(); let n = 0;
    unchanged(a, () => drawGem(a, { free: true, random: () => { if (n++ === i) throw Error('RNG unavailable'); return 0; } }), null);
  }
});

test('draw equal type partitions and one integer-range option, with atomic charge and no equip', () => {
  for (let t = 0; t < 4; t++) {
    const a = account();
    const drawn = drawGem(a, { payment: 'tickets', random: sequence([(t + .5) / 4, 0, .999]) });
    assert.equal(drawn.type, GEM_BANNERS[0].types[t]);
    assert.equal(drawn.optionTier, 'normal');
    assert.deepEqual(drawn.options, [{ id: 'attack', value: .03 }]);
    assert.equal(a.tickets, 45);
    assert.equal(a.diamonds, 300);
    assert.equal(a.gemGuide.drawn, true);
    assert.deepEqual(a.gemEquipment, {});
  }
  for (let i = 0; i < GEM_OPTIONS.length; i++) {
    for (const amount of [0, .999]) {
      const a = account();
      const drawn = drawGem(a, { random: sequence([0, (i + .5) / GEM_OPTIONS.length, amount]) });
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
    unchanged(a, () => rerollGem(a, 't'), null);
    unchanged(a, () => equipGem(a, 't'), false);
  }
  const a = account(); a.diamonds = 0; a.tickets = 0;
  const free = drawGem(a, { free: true, random: () => 0 });
  assert.equal(free.type, 'income');
  assert.equal(free.optionTier, 'normal');
  assert.equal(free.options.length, 1);
  assert.equal(a.diamonds, 0);
  assert.equal(a.tickets, 0);
  assert.equal(a.gemWelcomeClaimed, true);
  unchanged(a, () => drawGem(a, { free: true }), null);
  unchanged(a, () => drawGem(a), null);
  unchanged(a, () => drawGem(a, { free: true, banner: 'bad' }), null);
  unchanged(a, () => drawGem(a, { payment: 'gold' }), null);
});

test('reroll definitions promote one tier at a time and generate the resulting tier line count', () => {
  for (let i = 0; i < GEM_OPTION_TIERS.length; i++) {
    const tier = GEM_OPTION_TIERS[i], a = account();
    const gem = item('g', 'income', 4, Array.from({ length: tier.lines }, () => ({ id: 'hp', value: .02 })), tier.id);
    a.gemItems = [gem];
    const initialGold = a.gold;
    let rolls = 0;
    const rerolled = rerollGem(a, 'g', { random: () => { rolls++; return 0; } });
    const expectedTier = GEM_OPTION_TIERS[Math.min(i + 1, GEM_OPTION_TIERS.length - 1)];
    assert.equal(rerolled.uid, 'g');
    assert.equal(rerolled.level, 4);
    assert.equal(rerolled.optionTier, expectedTier.id);
    assert.equal(rerolled.options.length, expectedTier.lines);
    assert.ok(rerolled.options.every(option => option.id === 'attack' && option.value === .01));
    assert.equal(a.gold, initialGold - tier.cost);
    assert.equal(rolls, (tier.id === 'legendary' ? 0 : 1) + expectedTier.lines * 2);
  }
});

test('reroll failures for locked, missing, unaffordable or invalid RNG leave state and payment unchanged', () => {
  const a = account(), gem = item('g', 'income', 2, [{ id: 'hp', value: .02 }, { id: 'attack', value: .01 }], 'epic');
  a.gemItems = [gem];
  let calls = 0;
  const locked = structuredClone(a); locked.onboarding.phase = 'intro';
  unchanged(locked, () => rerollGem(locked, 'g', { random: () => { calls++; return 0; } }), null);
  assert.equal(calls, 0);
  unchanged(a, () => rerollGem(a, 'missing', { random: () => { calls++; return 0; } }), null);
  assert.equal(calls, 0);
  a.gold = 999;
  unchanged(a, () => rerollGem(a, 'g', { random: () => { calls++; return 0; } }), null);
  assert.equal(calls, 0);
  a.gold = 1000;
  const rolls = [.5, 0, 0, 0, 0];
  for (let i = 0; i < rolls.length; i++) {
    for (const bad of [NaN, Infinity, -1, 1, undefined, '0']) {
      const before = structuredClone(a), samples = [...rolls]; samples[i] = bad;
      assert.equal(rerollGem(a, 'g', { random: sequence(samples) }), null);
      assert.deepEqual(a, before);
    }
    const before = structuredClone(a); let n = 0;
    assert.equal(rerollGem(a, 'g', { random: () => { if (n++ === i) throw Error('RNG unavailable'); return rolls[n - 1]; } }), null);
    assert.deepEqual(a, before);
  }
});

test('reroll of a legendary stays legendary and keeps its three-line tier', () => {
  const a = account(); a.gemItems = [item('legend', 'hp', 1, [{ id: 'attack', value: .01 }], 'legendary')];
  const result = rerollGem(a, 'legend', { random: sequence([0, .5, 0, .5, 0, .5]) });
  assert.equal(result.optionTier, 'legendary');
  assert.equal(result.options.length, 3);
  assert.equal(a.gold, 1e7 - 10000);
});

test('reroll promotion threshold is exclusive and a failed promotion never downgrades', () => {
  const a = account(); a.gemItems = [item('normal', 'income', 1, [{ id: 'hp', value: .02 }], 'normal')];
  const result = rerollGem(a, 'normal', { random: sequence([.10, 0, 0]) });
  assert.equal(result.optionTier, 'normal');
  assert.equal(result.options.length, 1);
});

test('upgrade consumes exact explicit candidates plus reserve gap, preserves options and unrelated items', () => {
  const a = account(), options = [{ id: 'speed', value: .03 }];
  a.gemItems = [item('t', 'attack', 3, options), item('m', 'attack'), item('extra', 'attack'), item('equipped', 'attack'), item('ranked', 'attack', 2), item('other', 'hp')];
  a.gemReserves.attack = 4;
  a.gemEquipment.attack = 'equipped';
  assert.deepEqual(gemUpgradeMaterials(a, 't').map(g => g.uid), ['m', 'extra']);
  for (const ids of [['missing'], ['m', 'm'], ['t'], ['other'], ['ranked'], ['equipped'], [], ['m', 'extra', 'missing']]) {
    unchanged(a, () => upgradeGem(a, 't', ids), false);
  }
  assert.deepEqual(upgradeGem(a, 't', ['m']), {success:true,level:4});
  assert.equal(gemByUid(a, 't').level, 4);
  assert.deepEqual(gemByUid(a, 't').options, options);
  assert.equal(a.gemReserves.attack, 0);
  assert.equal(a.gold, 1e7 - 2700);
  assert.equal(gemByUid(a, 'm'), null);
  assert.ok(gemByUid(a, 'extra'));
  unchanged(a, () => upgradeGem(a, 't', ['m']), false);
});

test('reserve-only, instance-only, excessive materials, insufficient acorns and max-rank guards', () => {
  const a = account(); a.gemItems = [item('t', 'hp'), item('m', 'hp'), item('m2', 'hp'), item('m3', 'hp'), item('extra', 'hp')];
  unchanged(a, () => upgradeGem(a, 't', ['m', 'm2', 'm3', 'extra']), false);
  a.gold = 299;
  unchanged(a, () => upgradeGem(a, 't', ['m', 'm2', 'm3']), false);
  a.gold = 300;
  assert.deepEqual(upgradeGem(a, 't', ['m', 'm2', 'm3']), {success:true,level:2});
  assert.equal(a.gold, 0);
  a.gold = 1200; a.gemReserves.hp = 4;
  assert.deepEqual(upgradeGem(a, 't'), {success:true,level:3});
  assert.equal(gemByUid(a, 't').level, 3);
  assert.equal(a.gemReserves.hp, 0);
  a.gold = 1e7; gemByUid(a, 't').level = 10; a.gemReserves.hp = 1e6;
  assert.equal(gemUpgradeCost(gemByUid(a, 't')), null);
  unchanged(a, () => upgradeGem(a, 't', ['extra']), false);
});

test('upgrade material consumption keeps the strongest owned basic effect and increases it with target level', () => {
  const a = account(); a.gemItems = [item('target', 'income'), ...['material','m2','m3'].map(uid=>item(uid,'income'))];
  close(gemEffects(a).goldIncome, 1.1);
  assert.deepEqual(upgradeGem(a, 'target', ['material','m2','m3']), {success:true,level:2});
  assert.equal(gemByUid(a, 'material'), null);
  assert.equal(gemByUid(a, 'target').level, 2);
  assert.deepEqual(ownedGemBasics(a).map(g => g.uid), ['target']);
  close(gemEffects(a).goldIncome, 1.125);
});

test('upgrades are certain through level five, then use target-level odds and consume costs on failure', () => {
  const odds=[1,1,1,1,.5,.35,.2,.1,.05];
  for(let level=1;level<10;level++) for(const success of [true,false]) {
    if(level<5&&!success)continue;
    const a=account(),options=[{id:'attack',value:.02},{id:'hp',value:.03}];
    const copies=level<5?level+2:5;
    a.gemItems=[item('target','income',level,options,'epic'),...Array.from({length:copies},(_,n)=>item(`m${n}`))];
    a.gemEquipment={income:'target'};
    const materials=a.gemItems.slice(1).map(g=>g.uid),before=a.gold;
    let rolls=0;
    const result=upgradeGem(a,'target',materials,{random:()=>{
      rolls++;
      assert.ok(level>=5,'guaranteed upgrades do not roll');
      return success?odds[level-1]-1e-8:odds[level-1];
    }});
    assert.deepEqual(result,{success,level:level+(success?1:0)});
    assert.equal(rolls,level<5?0:1);
    assert.equal(a.gold,before-300*level**2);
    assert.deepEqual(a.gemItems,[item('target','income',result.level,options,'epic')]);
    assert.deepEqual(a.gemEquipment,{income:'target'});
    assert.equal(gemUpgradeCost(item('cost','income',level)).successChance,odds[level-1]);
  }
});

test('invalid gem upgrade inputs and random failures preserve all resources before a paid attempt',()=>{
  const a=account();a.gemItems=[item('target','income',5),item('material')];a.gemReserves.income=4;
  for(const value of [-.1,1,NaN,Infinity,undefined]) {
    unchanged(a,()=>upgradeGem(a,'target',['material'],{random:()=>value}),false);
  }
  unchanged(a,()=>upgradeGem(a,'target',['material'],{random:()=>{throw Error('RNG unavailable');}}),false);
  let rolls=0;
  unchanged(a,()=>upgradeGem(a,'target',['missing'],{random:()=>{rolls++;return 0;}}),false);
  assert.equal(rolls,0);
  const gold=a.gold;
  assert.deepEqual(upgradeGem(a,'target',['material'],{random:()=>.99}),{success:false,level:5});
  assert.equal(a.gold,gold-7500);
  assert.equal(a.gemReserves.income,0);
  assert.equal(gemByUid(a,'material'),null);
});

test('equipment selects at most three option sets, supports atomic replacement and unregisters one type', () => {
  const a = account();
  a.gemItems = GEM_TYPES.map(def => item(def.id, def.id));
  for (const gem of a.gemItems.slice(0, GEM_OPTION_LIMIT)) assert.equal(equipGem(a, gem.uid), true);
  const selected = structuredClone(a.gemEquipment);
  assert.equal(Object.keys(a.gemEquipment).length, GEM_OPTION_LIMIT);
  assert.equal(a.gemGuide.equipped, true);
  unchanged(a, () => equipGem(a, 'bounty'), false);
  unchanged(a, () => equipGem(a, 'bounty', 'attack'), false);
  assert.deepEqual(a.gemEquipment, selected);
  a.gemItems.push(item('better', 'income', 3));
  assert.equal(equipGem(a, 'better'), true);
  assert.deepEqual(a.gemEquipment, {...selected, income: 'better'});
  assert.ok(gemByUid(a, 'income'));
  assert.equal(equipGem(a, 'bounty', 'capacity'), true);
  assert.deepEqual(a.gemEquipment, { income: 'better', harvest: 'harvest', bounty: 'bounty' });
  assert.equal(Object.keys(a.gemEquipment).length, GEM_OPTION_LIMIT);
  unchanged(a, () => equipGem(a, 'gold', 'attack'), false);
  assert.equal(equipGem(a, 'gold', 'bounty'), true);
  assert.deepEqual(a.gemEquipment, { income: 'better', harvest: 'harvest', gold: 'gold' });
  for (const uid of ['missing', undefined, null, 0]) unchanged(a, () => equipGem(a, uid), false);
  assert.equal(unequipGem(a, 'income'), true);
  assert.equal(a.gemEquipment.income, undefined);
  unchanged(a, () => unequipGem(a, 'income'), false);
  unchanged(a, () => unequipGem(a, 'missing'), false);
  assert.equal(Object.keys(a.gemEquipment).length, GEM_OPTION_LIMIT - 1);
});

test('strongest owned basics always apply while only selected gem options sum into a detached snapshot', () => {
  const a = account();
  a.gemItems = [
    item('income-low', 'income', 1, [{ id: 'attack', value: .03 }, { id: 'goldIncome', value: .02 }]),
    item('income-best', 'income', 5, [{ id: 'wildAttack', value: .1 }]),
    item('capacity', 'capacity', 3),
    item('bounty', 'bounty', 4, [{ id: 'machineAttack', value: .1 }]),
    item('harvest', 'harvest', 2, [{ id: 'acorn', value: .03 }, { id: 'speed', value: .02 }]),
    item('attack', 'attack', 2), item('hp', 'hp', 4), item('gold', 'gold', 7),
  ];
  a.gemEquipment = { income: 'income-low', capacity: 'capacity', harvest: 'harvest' };
  assert.deepEqual(ownedGemBasics(a).map(g => g.uid), ['income-best', 'capacity', 'harvest', 'bounty', 'attack', 'hp', 'gold']);
  const effects = gemEffects(a);
  close(effects.goldIncome, 1.22); close(effects.attack, 1.155); close(effects.hp, 1.2625);
  close(effects.goldCapacity, 1.225); close(effects.killGold, 1.35);
  close(effects.acorn, 1.5925); close(effects.speed, 1.02);
  assert.deepEqual(effects.attributeBonuses.wild, { attack: 0, effectiveHp: 0 });
  assert.deepEqual(effects.attributeBonuses.machine, { attack: 0, effectiveHp: 0 });
  a.gemItems[0].options[0].value = .01;
  close(effects.attack, 1.155);
  const basicsWithoutEquipment = gemEffects({...a, gemEquipment:{}});
  close(basicsWithoutEquipment.goldIncome, 1.2);
  close(basicsWithoutEquipment.attack, 1.125);
  close(basicsWithoutEquipment.acorn, 1.5625);
  close(basicsWithoutEquipment.speed, 1);
  assert.deepEqual(basicsWithoutEquipment.attributeBonuses.machine, { attack: 0, effectiveHp: 0 });
  assert.equal(unequipGem(a, 'income'), true);
  close(gemEffects(a).goldIncome, 1.2);
  close(gemEffects(a).attack, 1.125);
  assert.equal(gemEffects(a).goldIncome, gemEffects({...a, gemEquipment:{}}).goldIncome);
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
 assert.deepEqual(state.gemItems,raw.gemItems.map(g=>({...g,optionTier:'normal'})));
 assert.deepEqual(state.gemEquipment,{});
 assert.equal('gemPresets' in state,false);
});

test('unequipping removes only selected options while the strongest owned basic effect remains',()=>{
 const a=account(); a.gemItems=[item('low','income',2,[{id:'attack',value:.03}]),item('best','income',6,[{id:'hp',value:.02}])];
 equipGem(a,'low');
 close(gemEffects(a).goldIncome,1.225);
 close(gemEffects(a).attack,1.03);
 assert.equal(unequipGem(a,'income'),true);
 close(gemEffects(a).goldIncome,1.225);
 close(gemEffects(a).attack,1);
 close(gemEffects(a).hp,1);
});
