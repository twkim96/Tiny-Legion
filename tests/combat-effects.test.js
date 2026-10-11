import test from 'node:test';
import assert from 'node:assert/strict';
import { effect, effectText, effectLines, applyChanges } from '../dist/src/effects.js';
import { initializeEffects, applyEffect, advanceEffects, combatStat, healingFactor, healUnit, queueHealing, tickPeriodicEffects, attackSource, statusMarks, supportTarget } from '../dist/src/combat-effects.js';
import { getUnit, getEnemy, UNITS, ENEMIES } from '../dist/src/characters.js';
import { unitAbilities, abilityText, applyUnitAbilities } from '../dist/src/abilities.js';
import { characterStats } from '../dist/src/character-stats.js';
import { resolveDamage } from '../dist/src/combat-rules.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
const unit=(team='player',effects={})=>initializeEffects({uid:team,team,hp:50,maxHp:100,attack:80,speed:40,range:50,attackInterval:1,x:100}, {effects});

test('either team uses one control API: strongest reapplication, expiration, and stat refresh leave base stats unchanged',()=>{
  for(const team of ['player','enemy']) {
    const target=unit(team);
    applyEffect(target,effect('slow',{factor:.5,duration:2}));
    advanceEffects(target,1);
    applyEffect(target,effect('slow',{factor:.8,duration:3}));
    applyEffect(target,effect('stat',{id:'boots',stat:'speed',multiplier:2,duration:1}));
    assert.equal(combatStat(target,'speed'),40);
    assert.equal(target.statusEffects.slow.remaining,3);
    assert.deepEqual(statusMarks(target).map(m=>m.kind),['slow']);
    advanceEffects(target,1);
    assert.equal(combatStat(target,'speed'),20);
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

test('periodic effects deliver each due tick including final poison tick, refresh without multiplying damage, and respect immunity',()=>{
  for(const team of ['player','enemy']) {
    const target=unit(team,{regeneration:effect('regeneration',{amount:2,interval:1})});
    const poison=effect('poison',{ratio:.1,interval:1,duration:3});
    const source={team:team==='player'?'enemy':'player',effects:{poison}};
    applyEffect(target,poison,{damage:100,direction:-1,source});
    applyEffect(target,poison,{damage:50,direction:1,source});
    const hits=[],heals=[];
    tickPeriodicEffects(target,3,{damage:(amount,direction,snapshot)=>hits.push({amount,direction,snapshot}),heal:spec=>heals.push(spec.amount)});
    assert.deepEqual(hits.map(h=>h.amount),[10,10,10]);
    assert.ok(hits.every(h=>h.direction===-1 && !h.snapshot.effects.poison));
    assert.deepEqual(heals,[2,2,2]);
    assert.equal(target.statusEffects.poison,undefined);
    target.effects.immunity=effect('immunity',{effect:'poison'});
    assert.equal(applyEffect(target,poison,{damage:100}),false);
  }
});

test('shield, attack area, and strongest nearby aura use frozen release snapshots without mutating character definitions',()=>{
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
  applyEffect(target,effect('healingSuppression',{factor:.2,duration:3,scope:'regeneration'}));
  applyEffect(target,effect('healingSuppression',{factor:.8,duration:1,scope:'all'}));
  assert.equal(healingFactor(target,direct),.8);
  assert.equal(healingFactor(target,regen),.2);
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
