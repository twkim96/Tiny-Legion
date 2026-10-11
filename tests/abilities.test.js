import test from 'node:test';
import assert from 'node:assert/strict';
import { activeEffects } from '../dist/src/combat-effects.js';
import { UNITS } from '../dist/src/data.js';
import { newAccount, normalizeAccount, upgradeUnitAbility, recruitUnits, refundUnitLevels, companionStats, recordIdle, levelCost } from '../dist/src/account.js';
import { applyUnitAbilities, unitAbilities, abilityCost, markTypeFor, DUPLICATE_MARKS } from '../dist/src/abilities.js';
import { createBattle, summonUnit, stepBattle } from '../dist/src/engine.js';
import { specializationBonus } from '../dist/src/combat-rules.js';
import { duplicateRewardText } from '../dist/src/recruitment-ui.js';

function account() {
  const a=newAccount(); a.onboarding.phase='complete'; a.earlyGuide.phase='complete';
  a.highestCleared=10; a.gold=1e6; a.diamonds=1e6;
  for(const id of Object.keys(a.owned))a.owned[id]=true;
  for(const id of Object.keys(a.marks))a.marks[id]=1000;
  return a;
}
const unit = id=>UNITS.find(u=>u.id===id);
function runFor(state,seconds){const end=state.time+seconds;while(state.time<end-1e-8&&!state.finished)stepBattle(state,1/30);}
function duel(playerId, abilities={}, enemyId='beetle', attribute='wild') {
  const state=createBattle({mode:'challenge',stageId:1,sequence:[],abilities});
  state._spawnSchedule=[{id:enemyId,time:0,x:540,overrides:{attribute,effects:{shield:false,regeneration:false}}}];
  stepBattle(state,1/30);
  state.gold=1000;
  assert.equal(summonUnit(state,playerId),true);
  const player=state.units.find(u=>u.team==='player'), enemy=state.units.find(u=>u.team==='enemy');
  player.x=500; player.speed=0;
  enemy.x=540; enemy.speed=0; enemy.hp=enemy.maxHp=10000; enemy.attackTimer=100;
  return {state,player,enemy};
}

test('repeat upgrades add fixed 1 percent steps, charge rising costs, and stop at ten',()=>{
  const a=account(), costs=[];
  for(let rank=0;rank<10;rank++){
    const beforeGold=a.gold,beforeMarks=a.marks.wild;
    assert.equal(upgradeUnitAbility(a,'sheep','hp'),true);
    costs.push(beforeGold-a.gold);
    assert.ok(a.marks.wild<beforeMarks);
    const boosted=applyUnitAbilities(unit('sheep'),a.abilities.sheep);
    assert.ok(Math.abs(boosted.hp-unit('sheep').hp*(1+(rank+1)*.01))<1e-8);
  }
  assert.ok(costs.every((value,i)=>i===0||value>costs[i-1]));
  const saved=JSON.stringify(a);
  assert.equal(upgradeUnitAbility(a,'sheep','hp'),false);
  assert.equal(JSON.stringify(a),saved);
  assert.equal(abilityCost(unitAbilities('sheep').find(x=>x.id==='hp'),10),null);
});
test('one-time upgrades are more expensive, use the unit mark type, and cannot repeat',()=>{
  const a=account(), before=a.marks.wild;
  const basic=abilityCost(unitAbilities('sheep')[0]);
  const special=abilityCost(unitAbilities('sheep').find(x=>x.id==='signature'));
  assert.ok(special.gold>basic.gold&&special.marks>basic.marks);
  assert.equal(upgradeUnitAbility(a,'sheep','signature'),true);
  assert.equal(a.marks.wild,before-special.marks);
  assert.equal(a.marks.machine,1000);
  assert.equal(companionStats(a,'sheep').effects.immunity.effect,'poison');
  const saved=JSON.stringify(a);
  assert.equal(upgradeUnitAbility(a,'sheep','signature'),false);
  assert.equal(JSON.stringify(a),saved);
});
test('locked, unowned, invalid and unaffordable upgrades leave all state unchanged',()=>{
  const a=account();
  for(const setup of [()=>a.earlyGuide.phase='wall-battle',()=>{a.earlyGuide.phase='complete';a.owned.sheep=false;},()=>{a.owned.sheep=true;a.gold=0;},()=>{a.gold=1e6;a.marks.wild=0;}]){
    setup();const before=JSON.stringify(a);
    assert.equal(upgradeUnitAbility(a,'sheep','hp'),false);
    assert.equal(JSON.stringify(a),before);
  }
  a.marks.wild=1000; a.highestCleared=9;
  const before=JSON.stringify(a);
  assert.equal(upgradeUnitAbility(a,'sheep','extra'),false);
  assert.equal(upgradeUnitAbility(a,'sheep','missing'),false);
  assert.equal(upgradeUnitAbility(a,'missing','hp'),false);
  assert.equal(JSON.stringify(a),before);
});
test('duplicates award the correct rarity and banner marks, and reveal reports those rewards',()=>{
  for(const [rarity,banner,roll,expected] of [['common','forest',.1,2],['rare','forest',.7,5],['epic','forest',.94,12],['legendary','workshop',.999,30]]){
    const a=account();let cursor=0;
    const result=recruitUnits(a,1,{banner,random:()=>cursor++%2===0?roll:0})[0];
    assert.equal(result.unit.rarity,rarity);
    assert.equal(result.marks,expected);
    assert.equal(a.marks[markTypeFor(result.unit)],1000+expected);
    assert.equal(result.fragments,0);
    assert.match(duplicateRewardText(result),new RegExp(`\\+${expected}$`));
  }
  const a=account(), before=JSON.stringify(a);let calls=0;
  assert.throws(()=>recruitUnits(a,10,{random:()=>{if(++calls===7)throw Error('interrupted');return .1;}}));
  assert.equal(JSON.stringify(a),before);
});
test('old fragments migrate exactly once, preserve purchased levels and records, and corrupt ranks are bounded',()=>{
  const old=account();delete old.marks; delete old.abilities;
  old.fragments.sheep=3;old.fragments.turtle=2;old.special.sheep=4;old.levels.sheep=12;
  old.records[1]={gold:80,diamonds:.1,snapshot:{levels:{sheep:16}}};
  const migrated=normalizeAccount(old);
  assert.equal(migrated.marks.wild,3*DUPLICATE_MARKS.common);
  assert.equal(migrated.marks.machine,2*DUPLICATE_MARKS.legendary);
  assert.equal(migrated.fragments.sheep,0);
  assert.equal(migrated.special.sheep,4);assert.equal(migrated.levels.sheep,12);
  assert.deepEqual(migrated.records,old.records);
  assert.deepEqual(normalizeAccount(migrated).marks,migrated.marks);
  migrated.abilities.sheep={hp:999,attack:NaN,signature:30,move:-2,evil:10};
  const clean=normalizeAccount(migrated);
  assert.equal(clean.abilities.sheep.hp,10);assert.equal(clean.abilities.sheep.attack,0);
  assert.equal(clean.abilities.sheep.signature,1);assert.equal(clean.abilities.sheep.move,undefined);
  assert.equal(clean.abilities.sheep.evil,undefined);
});
test('unit abilities stay in battle and production snapshots and survive an individual level refund',()=>{
  const a=account();a.levels.squirrel=4;a.levelSpent.squirrel=levelCost(1)+levelCost(2)+levelCost(3);
  const state=createBattle({mode:'challenge',stageId:1,sequence:[],levels:{squirrel:4},abilities:a.abilities});
  state.gold=1000;assert.equal(summonUnit(state,'squirrel'),true);
  const oldAttack=state.units[0].attack;
  const snapshot={stageId:1,gem:null,abilities:structuredClone(a.abilities)};
  recordIdle(a,{reward:80,survival:120,hpRatio:1},snapshot);
  assert.equal(upgradeUnitAbility(a,'squirrel','attack'),true);
  assert.equal(a.records[1].snapshot.abilities.squirrel.attack,0);
  state.gold=1000;state.cooldowns.squirrel=0;assert.equal(summonUnit(state,'squirrel'),true);
  assert.equal(state.units.at(-1).attack,oldAttack);
  const marks={...a.marks},abilities=structuredClone(a.abilities);
  refundUnitLevels(a,'squirrel');
  assert.deepEqual(a.marks,marks);assert.deepEqual(a.abilities,abilities);
  assert.deepEqual(a.records,{});
});
test('extra attributes and specialty upgrades affect real hits and remain separate from the basic bonus cap',()=>{
  const normal=duel('squirrel',{},'beetle','machine');
  const upgraded=duel('squirrel',{squirrel:{extra:1,counter:10}},'beetle','machine');
  for(const pair of [normal,upgraded]){
    while(!pair.state.finished&&pair.enemy.hp===10000)stepBattle(pair.state,1/30);
  }
  assert.ok(upgraded.enemy.hp<normal.enemy.hp);
  assert.equal(specializationBonus(normal.player,{attribute:'machine'},'attack'),0);
  assert.equal(specializationBonus(upgraded.player,{attribute:'machine'},'attack'),.5);
  const disallowed=duel('sheep',{sheep:{range:5,move:5}}).player;
  assert.equal(disallowed.range,unit('sheep').range);
  assert.equal(disallowed.definition.speed,unit('sheep').speed);
  const movement=duel('rabbit',{rabbit:{range:5,move:5}}).player;
  assert.equal(movement.range,unit('rabbit').range);
  assert.ok(Math.abs(movement.definition.speed-unit('rabbit').speed*1.1)<1e-8);
  const ranged=duel('whale',{whale:{range:5,move:5}}).player;
  assert.equal(ranged.range,unit('whale').range+20);
  assert.equal(ranged.definition.speed,unit('whale').speed);
});
test('one-time castle skill increases castle damage rather than damage to every target',()=>{
  const damages=[];
  for(const signature of [0,1]){
    const state=createBattle({mode:'challenge',stageId:1,sequence:[],abilities:{rabbit:{signature}}});
    state._spawnSchedule=[];state.gold=1000;summonUnit(state,'rabbit');
    state.units[0].x=1073;state.units[0].speed=0;
    const hp=state.enemyHp;runFor(state,.3);damages.push(hp-state.enemyHp);
  }
  assert.deepEqual(damages,[190,209]);
});
test('poison causes timed non-stacking damage and the purchased immunity blocks poison but not the hit',()=>{
  const outcomes=[];
  for(const signature of [0,1]){
    const {state,player,enemy}=duel('sheep',{sheep:{signature}},'porcupine');
    player.attackTimer=100;enemy.attackTimer=0;
    const before=player.hp;
    while(player.hp===before&&state.time<5)stepBattle(state,1/30);
    const afterHit=player.hp;
    assert.ok(afterHit<before);
    assert.equal(activeEffects(player,'poison').length>0,signature===0);
    enemy.attackTimer=100;enemy.action=null;
    runFor(state,3.2);
    outcomes.push(afterHit-player.hp);
    assert.equal(activeEffects(player,'poison').length,0);
  }
  assert.ok(Math.abs(outcomes[0]-3.6)<1e-6);
  assert.equal(outcomes[1],0);
});
test('released witch poison survives caster death and deals its three timed ticks after one impact',()=>{
  const {state,player,enemy}=duel('mushroom-witch',{'mushroom-witch':{signature:1}});
  while(!state.projectiles.length&&state.time<5)stepBattle(state,1/30);
  player.dead=true;player.hp=0;player.deathTimer=.32;
  while(enemy.hp===10000&&state.time<5)stepBattle(state,1/30);
  assert.ok(activeEffects(enemy,'poison').length);
  const afterHit=enemy.hp;
  player.attackTimer=100;player.action=null;
  runFor(state,3.2);
  assert.ok(Math.abs(afterHit-enemy.hp-36*.08*3)<1e-6);
  assert.equal(activeEffects(enemy,'poison').length,0);
});

test('signature shield and support heal use the upgraded combat definition including equipped HP',()=>{
  const state=createBattle({mode:'challenge',stageId:1,sequence:[],levels:{deer:4},modifiers:{hp:1.15},abilities:{deer:{hp:10,signature:1},otter:{signature:1}}});
  state._spawnSchedule=[{id:'beetle',time:0,x:540,overrides:{}}];
  stepBattle(state,1/30);
  const enemy=state.units[0];enemy.x=540;enemy.speed=0;enemy.hp=enemy.maxHp=10000;enemy.attackTimer=100;
  state.gold=1000;assert.equal(summonUnit(state,'deer'),true);
  const deer=state.units.find(u=>u.id==='deer');
  assert.equal(deer.shield,Math.round(deer.maxHp*.15));
  deer.x=500;deer.speed=0;deer.attackTimer=100;deer.hp=deer.maxHp-100;
  state.gold=1000;assert.equal(summonUnit(state,'otter'),true);
  const otter=state.units.find(u=>u.id==='otter');otter.x=500;otter.speed=0;
  const before=deer.hp;
  while(deer.hp===before&&state.time<5)stepBattle(state,1/30);
  assert.ok(Math.abs(deer.hp-before-24*1.2)<1e-6);
});
test('repeated poison applications refresh duration but do not stack tick damage',()=>{
  const {state,player,enemy}=duel('mushroom-witch',{'mushroom-witch':{signature:1}});
  const impacts=[];
  while(state.time<2.5){
    stepBattle(state,1/30);
    impacts.push(...state.events.filter(event=>event.type==='impact'&&event.team==='player'&&event.hit));
  }
  assert.ok(impacts.length>=2);
  assert.ok(activeEffects(enemy,'poison').length);
  assert.ok(Math.abs(activeEffects(enemy,'poison')[0].damage-player.attack*.08)<1e-8);
  assert.ok(activeEffects(enemy,'poison')[0].remaining<=3);
});

test('only the three core abilities are common; movement and range follow unit eligibility', () => {
  for (const u of UNITS) {
    const abilities = unitAbilities(u);
    assert.deepEqual(abilities.slice(0,3).map(a=>a.id), ['hp','attack','counter']);
    assert.equal(abilities.some(a=>a.id==='move'), ['rabbit','fox','deer','penguin'].includes(u.id));
    assert.equal(abilities.some(a=>a.id==='range'), u.id==='whale');
    const stats=applyUnitAbilities(u,{});
    assert.ok(Number.isFinite(stats.speed) && Number.isFinite(stats.range));
  }
  for (const overrides of [{rarity:'epic'},{role:'tank'},{cost:500},{cooldown:3}]) {
    assert.equal(unitAbilities({...unit('whale'),...overrides}).some(a=>a.id==='range'),false);
  }
  const a=account();
  for (const [id, option] of [['sheep','move'],['squirrel','range'],['turtle','range'],['owl','range']]) {
    const before=JSON.stringify(a);
    assert.equal(upgradeUnitAbility(a,id,option),false);
    assert.equal(JSON.stringify(a),before);
  }
  assert.equal(upgradeUnitAbility(a,'rabbit','move'),true);
  assert.equal(upgradeUnitAbility(a,'whale','range'),true);
});
test('unsupported ability ranks are dropped without currency compensation; permitted purchases and progress survive', () => {
  const raw=account();raw.gold=1000;
  raw.abilities.sheep={hp:4,attack:2,counter:3,move:3,range:5,signature:1};
  raw.abilities.rabbit={move:2,range:2};
  raw.abilities.whale={move:1,range:3};
  raw.levels.sheep=8;
  raw.records[1]={gold:80,diamonds:.1,snapshot:{abilities:structuredClone(raw.abilities)}};
  const clean=normalizeAccount(raw);
  assert.equal(clean.gold,raw.gold);
  assert.deepEqual(clean.marks,raw.marks);
  assert.equal(clean.abilities.sheep.move,undefined);
  assert.equal(clean.abilities.sheep.range,undefined);
  assert.equal(clean.abilities.sheep.hp,4);
  assert.equal(clean.abilities.sheep.signature,1);
  assert.equal(clean.abilities.rabbit.move,2);
  assert.equal(clean.abilities.whale.range,3);
  assert.equal(clean.levels.sheep,8);
  assert.deepEqual(clean.records,raw.records);
  assert.deepEqual(clean.sequence,raw.sequence);
  assert.deepEqual(clean.owned,raw.owned);
  const roundTrip=normalizeAccount(JSON.parse(JSON.stringify(clean)));
  assert.equal(roundTrip.gold,clean.gold);
  assert.deepEqual(roundTrip.marks,clean.marks);
  assert.deepEqual(roundTrip.abilities,clean.abilities);
});
