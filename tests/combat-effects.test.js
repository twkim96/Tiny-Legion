import test from 'node:test';
import assert from 'node:assert/strict';
import { effect, effectText, effectLines, applyChanges, effectOrigin, BATTLE_ORIGIN, EFFECTS, EFFECT_KEYWORDS, effectInfo, effectKeywords, hasEffectKeyword } from '../dist/src/effects.js';
import { initializeEffects, activeEffects, remainingEffect, applyHitEffects, applyEffect, advanceEffects, combatStat, healingFactor, healUnit, queueHealing, tickPeriodicEffects, attackSource, statusMarks, supportTarget, tickRepulsion } from '../dist/src/combat-effects.js';
import { getUnit, getEnemy, UNITS, ENEMIES } from '../dist/src/characters.js';
import { unitAbilities, abilityText, applyUnitAbilities } from '../dist/src/abilities.js';
import { characterStats } from '../dist/src/character-stats.js';
import { resolveDamage } from '../dist/src/combat-rules.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
const unit=(team='player',effects={})=>initializeEffects({uid:team,team,hp:50,maxHp:100,attack:80,speed:40,range:50,attackInterval:1,x:100}, {effects});

test('either team uses one control API: last reapplication, expiration, and stat refresh leave base stats unchanged',()=>{
  for(const team of ['player','enemy']) {
    const target=unit(team);
    applyEffect(target,effect('slow',{factor:.7,duration:2}));
    advanceEffects(target,.25);
    applyEffect(target,effect('slow',{factor:.8,duration:1}));
    applyEffect(target,effect('stat',{id:'boots',stat:'speed',multiplier:2,duration:1}));
    assert.equal(combatStat(target,'speed'),64);
    assert.equal(remainingEffect(target,'slow'),1);
    assert.deepEqual(statusMarks(target).map(m=>m.kind),['slow']);
    advanceEffects(target,1);
    assert.equal(combatStat(target,'speed'),40);
    advanceEffects(target,2);
    assert.equal(combatStat(target,'speed'),40);
    assert.equal(target.speed,40);
    assert.equal(applyEffect(target,{type:'slow',factor:NaN,duration:1}),false);
    assert.equal(applyEffect(target,{type:'poison',ratio:.1,interval:0,duration:1}),false);
    assert.deepEqual(target.statusEffects,{});
  }
});

test('healing and regeneration share amounts and caps, with explicit suppression scope and additive batches',()=>{
  const target=unit(), heal=effect('healing',{amount:20,range:150}), regen=effect('regeneration',{hpRatio:.1,interval:1});
  applyEffect(target,effect('healingSuppression',{factor:.5,duration:3,scope:'regeneration'}));
  assert.equal(healUnit(target,heal),20);
  assert.equal(healingFactor(target,regen),.5);
  const batch={healing:new Map()};
  queueHealing(batch,target,regen); queueHealing(batch,target,heal);
  assert.equal(batch.healing.get(target.uid),25);
  applyEffect(target,effect('healingSuppression',{factor:.25,duration:3,scope:'all'}));
  assert.equal(healUnit(target,heal),5);
  target.hp=99;
  assert.equal(healUnit(target,heal),1);
  target.dead=true;
  assert.equal(healUnit(target,heal),0);
  assert.equal(applyEffect(target,effect('shield',{hpRatio:.5})),false);
});

test('periodic effects deliver each due tick including final poison tick, overwrite strength and direction without multiplying same-origin damage, and respect immunity',()=>{
  for(const team of ['player','enemy']) {
    const target=unit(team,{regeneration:effect('regeneration',{amount:2,interval:1})});
    const poison=effect('poison',{ratio:.1,interval:1,duration:3});
    const source={team:team==='player'?'enemy':'player',effects:{poison}};
    applyEffect(target,poison,{damage:100,direction:-1,source});
    applyEffect(target,poison,{damage:50,direction:1,source});
    const hits=[],heals=[];
    tickPeriodicEffects(target,3,{damage:(amount,direction,snapshot)=>hits.push({amount,direction,snapshot}),heal:spec=>heals.push(spec.amount)});
    assert.deepEqual(hits.map(h=>h.amount),[5,5,5]);
    assert.ok(hits.every(h=>h.direction===1 && !h.snapshot.effects.poison));
    assert.deepEqual(heals,[2,2,2]);
    assert.equal(activeEffects(target,'poison').length,0);
    target.effects.immunity=effect('immunity',{effect:'poison'});
    assert.equal(applyEffect(target,poison,{damage:100}),false);
  }
});

test('shield, attack area, and latest nearby aura use frozen release snapshots without mutating character definitions',()=>{
  const definition=getUnit('cloud'), before=structuredClone(definition);
  const caster=unit('player',definition.effects);caster.role=definition.role;caster.specialties=definition.specialties;
  const ally=unit(); ally.uid='ally'; ally.x=110;
  const shot=attackSource(ally,[ally,caster]);
  caster.dead=true;caster.effects.slow.factor=.1;
  assert.equal(shot.effects.shieldDamage.bonus,1);
  assert.equal(attackSource(ally,[ally,caster]).effects.shieldDamage.bonus,0);
  assert.deepEqual(getUnit('cloud'),before);
  const target=unit('enemy'); applyEffect(target,effect('shield',{hpRatio:.5}));
  assert.deepEqual(resolveDamage(target,100,shot),{shieldDamage:50,hpDamage:75});
  const details=characterStats('deer',{abilities:{signature:1}});
  assert.equal(details.effects.areaAttack.radius,65);
  assert.equal(details.effects.shield.hpRatio,.15);
});

test('effect and upgrade descriptions track tuning data rather than fixed strings; every registered character is describable',()=>{
  const custom=effect('poison',{ratio:.12,duration:4,interval:.5});
  assert.match(effectText(custom),/4초간 0.5초마다 공격력 12%/);
  const change={op:'effect',value:custom};
  assert.equal(abilityText({changes:[change]}),effectText(custom));
  const copy=applyChanges({effects:{}},[change]);
  copy.effects.poison.ratio=.2;
  assert.equal(custom.ratio,.12);
  for(const character of [...UNITS,...ENEMIES]) assert.ok(effectLines(character).every(line=>line && !/undefined|NaN/.test(line)));
  for(const character of UNITS)for(const ability of unitAbilities(character)) {
    if(!ability.attribute)assert.ok(abilityText(ability));
    const stats=applyUnitAbilities(character,{[ability.id]:ability.max});
    assert.ok(Number.isFinite(stats.attack) && Number.isFinite(stats.hp));
  }
  assert.match(effectText(getEnemy('spirit-rabbit').effects.regeneration),/재생/);
});

test('effect overrides merge and disable independently; team support selects wounded allies with shared rules',()=>{
  const enemy=characterStats('clock-beetle',{team:'enemy',overrides:{effects:{shield:false,slow:effect('slow',{factor:.8,duration:1})}}});
  assert.equal(enemy.effects.shield,false);
  assert.equal(enemy.effects.slow.factor,.8);
  assert.equal(getEnemy('clock-beetle').effects.shield.hpRatio,.4);
  for(const team of ['player','enemy']) {
    const source=unit(team), wounded=unit(team), healthy=unit(team), opponent=unit(team==='player'?'enemy':'player');
    wounded.uid='wounded';wounded.hp=10;healthy.hp=100;
    assert.equal(supportTarget(source,[healthy,wounded,opponent],effect('healing',{amount:20,range:200})),wounded);
    applyEffect(wounded,effect('knockback',{distance:25}),{direction:-1});
    assert.equal(wounded.x,75);
    applyEffect(wounded,effect('hitStun',{duration:.4}));
    assert.equal(wounded.hitStun,.4);
  }
});


test('regeneration-only and all-healing suppression keep independent strength and expiry',()=>{
  const target=unit(), direct=effect('healing',{amount:20,range:100}), regen=effect('regeneration',{hpRatio:.1,interval:1});
  applyEffect(target,effect('healingSuppression',{factor:.2,duration:3,scope:'regeneration'}),{origin:effectOrigin('ability','regen-suppression')});
  applyEffect(target,effect('healingSuppression',{factor:.8,duration:1,scope:'all'}));
  assert.equal(healingFactor(target,direct),.8);
  near(healingFactor(target,regen),.16);
  advanceEffects(target,1);
  assert.equal(healingFactor(target,direct),1);
  assert.equal(healingFactor(target,regen),.2);
  advanceEffects(target,2);
  assert.equal(healingFactor(target,regen),1);
  assert.equal(applyEffect(target,effect('slow',{factor:.5,duration:1}),{durationMultiplier:NaN}),false);
});


test('passive effects can be installed with numeric parameters without adding character-specific logic',()=>{
  const target=unit('enemy');
  assert.equal(applyEffect(target,effect('regeneration',{hpRatio:.05,interval:2})),true);
  assert.equal(target.periodicTimers.regeneration,2);
  assert.equal(applyEffect(target,effect('immunity',{effect:'slow'})),true);
  assert.equal(applyEffect(target,effect('slow',{factor:.5,duration:1})),false);
  assert.equal(applyEffect(target,effect('areaAttack',{radius:100})),true);
  assert.equal(attackSource(target,[target]).effects.areaAttack.radius,100);
  assert.match(effectText(effect('healing',{amount:10,hpRatio:.05,range:100})),/10 \+ 최대 체력의 5%/);
  assert.match(effectText(effect('stat',{id:'mixed',stat:'attack',flat:5,multiplier:1.2,duration:2})),/\+5 · 1.2배/);
});


test('gem options, an ability, and shared supporters coexist; a weaker second supporter replaces both value and duration',()=>{
  for(const team of ['player','enemy']) {
    const target=unit(team);
    const boost=multiplier=>effect('stat',{stat:'attack',multiplier,duration:10});
    const origins=[effectOrigin('gem','gem-1','0'),effectOrigin('gem','gem-1','1'),effectOrigin('gem','gem-2','0'),effectOrigin('ability','periodic-attack')];
    for(const origin of origins)applyEffect(target,boost(1.1),{origin});
    const supporter1=unit(team), supporter2=unit(team==='player'?'enemy':'player');
    supporter1.uid='supporter-1';supporter2.uid='supporter-2';
    supporter1.effects.stat=boost(1.3);
    supporter2.effects.stat=effect('stat',{id:'another-label',stat:'attack',multiplier:1.05,duration:1});
    applyHitEffects(target,attackSource(supporter1,[supporter1]),{hpDamage:1,damage:1,direction:1});
    applyHitEffects(target,attackSource(supporter2,[supporter2]),{hpDamage:1,damage:1,direction:-1});
    assert.equal(activeEffects(target,'stat').length,5);
    assert.equal(activeEffects(target,'stat').find(e=>e.origin===BATTLE_ORIGIN).remaining,1);
    near(combatStat(target,'attack'),80*1.1**4*1.05);
    advanceEffects(target,1);
    near(combatStat(target,'attack'),80*1.1**4);
    advanceEffects(target,9);
    assert.equal(combatStat(target,'attack'),80);
    assert.equal(applyEffect(target,boost(1.2),{origin:''}),false);
    assert.throws(()=>effectOrigin('gem','gem-1'),TypeError);
  }
});

test('effect kind includes the stat; scope and arbitrary labels do not create new origins',()=>{
  const target=unit();
  applyEffect(target,effect('stat',{id:'attack-a',stat:'attack',multiplier:1.3,duration:10}));
  applyEffect(target,effect('stat',{id:'speed-a',stat:'speed',multiplier:1.2,duration:10}));
  applyEffect(target,effect('stat',{id:'attack-b',stat:'attack',multiplier:1.1,duration:1}));
  assert.equal(activeEffects(target,'stat').length,2);
  near(combatStat(target,'attack'),88);near(combatStat(target,'speed'),48);
  applyEffect(target,effect('healingSuppression',{factor:.2,duration:10,scope:'regeneration'}));
  applyEffect(target,effect('healingSuppression',{factor:.8,duration:1,scope:'all'}));
  assert.equal(activeEffects(target,'healingSuppression').length,1);
  assert.equal(healingFactor(target,effect('regeneration',{amount:1,interval:1})),.8);
  assert.equal(healingFactor(target,effect('healing',{amount:1,range:1})),.8);
  advanceEffects(target,1);
  assert.equal(activeEffects(target,'healingSuppression').length,0);
});

test('different-origin control and poison tick independently; poison refresh preserves progress while replacing the snapshot',()=>{
  const target=unit(), poison=effect('poison',{ratio:.1,interval:1,duration:3});
  const origin=effectOrigin('ability','poison');
  applyEffect(target,effect('slow',{factor:.7,duration:2}));
  applyEffect(target,effect('slow',{factor:.8,duration:1}),{origin});
  near(combatStat(target,'speed'),40*.7*.8);
  advanceEffects(target,1);near(combatStat(target,'speed'),28);
  applyEffect(target,poison,{damage:100,direction:-1,source:{team:'enemy',tag:'old'}});
  const hits=[], callbacks={damage:(amount,direction,source)=>hits.push([amount,direction,source.tag]),heal:()=>{}};
  tickPeriodicEffects(target,.6,callbacks);
  applyEffect(target,effect('poison',{ratio:.1,interval:1,duration:1}),{damage:50,direction:1,source:{team:'player',tag:'new'}});
  applyEffect(target,poison,{origin,damage:20,direction:-1,source:{tag:'ability'}});
  assert.equal(remainingEffect(target,'poison'),3);
  tickPeriodicEffects(target,.4,callbacks);
  assert.deepEqual(hits,[[5,1,'new']]);
  tickPeriodicEffects(target,.6,callbacks);
  assert.deepEqual(hits,[[5,1,'new'],[2,-1,'ability']]);
  assert.equal(activeEffects(target,'poison').length,1);
  tickPeriodicEffects(target,2,callbacks);
  assert.deepEqual(hits.slice(2),[[2,-1,'ability'],[2,-1,'ability']]);
  assert.equal(activeEffects(target,'poison').length,0);
});

test('support auras use the latest eligible supporter even when weaker and return to remaining support when it leaves',()=>{
  for(const team of ['player','enemy']) {
    const target=unit(team), first=unit(team), second=unit(team);
    first.effects.shieldDamageAura=effect('shieldDamageAura',{bonus:1,range:100});
    second.effects.shieldDamageAura=effect('shieldDamageAura',{bonus:.25,range:100});
    const units=[target,first,second];
    assert.equal(attackSource(target,units).effects.shieldDamage.bonus,.25);
    second.x=500;
    assert.equal(attackSource(target,units).effects.shieldDamage.bonus,1);
    second.x=100;second.dead=true;
    assert.equal(attackSource(target,units).effects.shieldDamage.bonus,1);
    second.dead=false;second.effects.shieldDamageAura.origin=effectOrigin('ability','other-aura');
    assert.equal(attackSource(target,units).effects.shieldDamage.bonus,1.25);
  }
});


test('hit stun uses the same overwrite and independent-origin expiration contract',()=>{
  for(const team of ['player','enemy']) {
    const target=unit(team);
    applyEffect(target,effect('hitStun',{duration:2}));
    advanceEffects(target,.25);
    applyEffect(target,effect('hitStun',{duration:1}));
    assert.equal(target.hitStun,1);
    assert.equal(activeEffects(target,'hitStun').length,1);
    applyEffect(target,effect('hitStun',{duration:2}),{origin:effectOrigin('upgrade','resonance')});
    advanceEffects(target,1);
    assert.equal(target.hitStun,1);
    assert.equal(activeEffects(target,'hitStun').length,1);
    advanceEffects(target,1);
    assert.equal(target.hitStun,0);
  }
});


test('battle attack buffs and attack debuffs are different kinds, while another buff replaces only the buff',()=>{
  const target=unit();
  applyEffect(target,effect('stat',{stat:'attack',multiplier:1.3,duration:10}),{source:{team:'player'}});
  applyEffect(target,effect('stat',{stat:'attack',multiplier:.5,duration:2}),{source:{team:'enemy'}});
  applyEffect(target,effect('stat',{stat:'attack',multiplier:1.1,duration:1}),{source:{team:'enemy'}});
  assert.equal(activeEffects(target,'stat').length,2);
  near(combatStat(target,'attack'),44);
  advanceEffects(target,1);assert.equal(combatStat(target,'attack'),40);
  advanceEffects(target,1);assert.equal(combatStat(target,'attack'),80);
});


test('native mechanics and buffs share keyword identities with detached tuning values', () => {
  for (const definition of Object.values(EFFECTS)) assert.ok(EFFECT_KEYWORDS[definition.keyword]);
  const boss = getEnemy('grove-bear');
  const infos = effectKeywords(boss);
  assert.deepEqual(infos.map(info => info.label), ['공격 무효(원거리)', '밀쳐내기']);
  const pulse = infos.find(info => info.keyword === 'knockback');
  assert.equal(pulse.values.range, boss.effects.repelPulse.range);
  pulse.values.range = 88;
  assert.notEqual(boss.effects.repelPulse.range, 88);
  const tuned = effectInfo(effect('repelPulse', { ...pulse.values, interval: 4, range: 88 }));
  assert.match(tuned.details, /4초마다 · 대상 근거리 · 범위 88/);
  assert.equal(effectInfo(effect('knockback', { distance: 50 })).keyword, tuned.keyword);
  assert.equal(hasEffectKeyword(boss, 'knockback'), true);
  assert.equal(hasEffectKeyword(boss, 'slow'), false);
  for (const team of ['player', 'enemy']) {
    const target = unit(team);
    applyEffect(target, effect('slow', { factor: .7, duration: 2 }));
    assert.equal(hasEffectKeyword(target, 'slow'), true);
    advanceEffects(target, 2);
    assert.equal(hasEffectKeyword(target, 'slow'), false);
  }
  assert.equal(effectInfo(effect('stat', { stat: 'attack', multiplier: 1.1, duration: 5, attackType: 'melee' })).label, '공격력 증가(근거리)');
});


test('attack immunity and periodic knockback are reusable on either team with independent values', () => {
  for (const team of ['player', 'enemy']) {
    const caster = unit(team);
    const target = unit(team === 'player' ? 'enemy' : 'player');
    target.x = 140; target.attackType = 'melee';
    assert.equal(applyEffect(caster, effect('attackImmunity', { attackType: 'ranged' })), true);
    assert.deepEqual(resolveDamage(caster, 30, { team: target.team, attackType: 'ranged' }), { hpDamage: 0, shieldDamage: 0, blocked: true });
    assert.equal(resolveDamage(caster, 30, { team: target.team, attackType: 'melee' }).hpDamage, 30);
    assert.equal(applyEffect(caster, effect('repelPulse', { attackType: 'melee', interval: 1, range: 50, distance: 25, warning: .2 })), true);
    tickRepulsion(caster, .9, [caster, target]);
    assert.equal(target.x, 140);
    tickRepulsion(caster, .1, [caster, target]);
    assert.equal(target.x, 165);
    assert.equal(effectInfo(caster.effects.repelPulse).values.range, 50);
  }
});
