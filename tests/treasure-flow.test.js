import test from 'node:test';
import assert from 'node:assert/strict';
import {newAccount,normalizeAccount,collectReturnIncome,saveAccount,loadAccount,sequenceForMode,setSequence,gemPresetForMode,gemModifiers,currentMission,claimMission,recordIdle,advancedContentUnlocked} from '../dist/src/account.js';
import {drawGem,equipGem} from '../dist/src/gems.js';
import {createBattle,summonUnit,stepBattle,fireCannon} from '../dist/src/engine.js';
import {STAGES} from '../dist/src/data.js';
const now=Date.UTC(2026,9,11,6);
const lineup=id=>[id,...Array(9).fill(null)];
function account(){const a=newAccount(now);a.onboarding.phase='complete';a.earlyGuide.phase='complete';a.highestCleared=11;a.owned.rabbit=true;a.owned.squirrel=true;return a;}
test('return summary caps earnings once and reload does not pay them again',()=>{
 const a=account();a.lastSettled=now-10*3600000;a.records[1]={gold:80,diamonds:.1};
 const gold=a.gold,diamonds=a.diamonds;
 const result=collectReturnIncome(a,now);
 assert.equal(result.awaySeconds,36000);assert.equal(result.seconds,28800);assert.equal(result.capped,true);
 assert.equal(result.gold,19200);assert.equal(result.diamonds,24);
 assert.equal(a.gold,gold+19200);assert.equal(a.diamonds,diamonds+24);
 let saved;const storage={setItem(_,v){saved=v;},getItem(){return saved;}};
 assert.equal(saveAccount(a,storage),true);
 assert.equal(collectReturnIncome(loadAccount(storage,now).account,now),null);
 assert.equal(collectReturnIncome(a,now),null);
 const empty=account();empty.lastSettled=now-3600000;
 assert.equal(collectReturnIncome(empty,now),null);
 const future=normalizeAccount({...a,lastSettled:now+3600000},now);
 assert.equal(collectReturnIncome(future,now),null);
});
test('ten lineups per content keep independent units and gem preset choices through reload',()=>{
 const a=account();
 assert.ok(setSequence(a,lineup('squirrel'),'idle',1,2));
 assert.ok(setSequence(a,lineup('rabbit'),'challenge',1,3));
 assert.ok(setSequence(a,lineup('sheep'),'speedrun',9,9));
 assert.equal(sequenceForMode(a,'idle')[0],'squirrel');assert.equal(sequenceForMode(a,'idle',0)[0],'sheep');
 assert.equal(sequenceForMode(a,'challenge')[0],'rabbit');assert.equal(gemPresetForMode(a,'challenge'),3);
 const b=normalizeAccount(JSON.parse(JSON.stringify(a)),now);
 assert.deepEqual(b.activeLineup,{idle:1,challenge:1,speedrun:9});
 assert.equal(sequenceForMode(b,'idle')[0],'squirrel');assert.equal(gemPresetForMode(b,'idle'),2);
 assert.equal(sequenceForMode(b,'speedrun')[0],'sheep');assert.equal(gemPresetForMode(b,'speedrun'),9);
 const before=JSON.stringify(b);
 assert.equal(setSequence(b,lineup('sheep'),'idle',10),false);assert.equal(setSequence(b,lineup('sheep'),'idle',1,10),false);
 assert.equal(JSON.stringify(b),before);
 assert.notEqual(b.lineupPresets.idle[0].sequence,b.lineupPresets.idle[2].sequence);
});
test('gem guide follows the claimed 2-1 mission; free recruitment and equipment complete it once',()=>{
 const a=account();a.missions.idleCompleted=true;
 a.missions.claimed=['idle-intro','idle-second','growth-intro',...Array.from({length:9},(_,i)=>`challenge-${i+2}`)];
 assert.equal(currentMission(a).id,'challenge-11');claimMission(a);
 assert.equal(currentMission(a).id,'gem-intro');assert.equal(currentMission(a).completed,false);
 const first=drawGem(a,{free:true,random:()=>0});assert.equal(first.type,'income');
 assert.equal(currentMission(a).completed,false);
 assert.ok(equipGem(a,0,0,first.uid));assert.equal(currentMission(a).completed,true);
 const gold=a.gold;assert.equal(claimMission(a).id,'gem-intro');assert.equal(a.gold,gold+600);
 assert.equal(currentMission(a).id,'challenge-12');assert.equal(claimMission(a),null);
 assert.equal(drawGem(a,{free:true,random:()=>0}),null);
 const locked=account();locked.highestCleared=10;assert.equal(advancedContentUnlocked(locked),false);
 assert.equal(drawGem(locked,{free:true}),null);
});
test('content gem snapshots alter gold flow, capacity, unit stats and preserve recorded acorns',()=>{
 const a=account();a.gemItems=[
  {uid:'income',type:'income',level:1,options:[{id:'attack',value:.03},{id:'attack',value:.03},{id:'wildAttack',value:.1}]},
  {uid:'capacity',type:'capacity',level:1,options:[]},
  {uid:'harvest',type:'harvest',level:10,options:[{id:'acorn',value:.03}]},
 ];
 equipGem(a,0,0,'income');equipGem(a,0,1,'harvest');equipGem(a,1,0,'capacity');
 setSequence(a,lineup('sheep'),'challenge',0,1);
 const idleEffects=gemModifiers(a,'idle'),challengeEffects=gemModifiers(a,'challenge');
 const idle=createBattle({stageId:11,sequence:[],modifiers:idleEffects});
 const challenge=createBattle({stageId:11,mode:'challenge',sequence:[],modifiers:challengeEffects});
 idle._spawnSchedule=[];challenge._spawnSchedule=[];
 stepBattle(idle,1);stepBattle(challenge,1);
 assert.ok(Math.abs(idle.gold-258.5)<1e-6);assert.ok(Math.abs(challenge.gold-255)<1e-6);
 assert.equal(idle.maxGold,1000);assert.equal(challenge.maxGold,1150);
 idle.gold=1000;challenge.gold=1000;
 assert.ok(summonUnit(idle,'sheep'));assert.ok(summonUnit(challenge,'sheep'));
 assert.ok(idle.units[0].attack>challenge.units[0].attack);
 const snapshot={stageId:11,gemEffects:structuredClone(idleEffects)};
 recordIdle(a,{reward:STAGES[10].baseReward,survival:120,hpRatio:1},snapshot,now);
 const record=structuredClone(a.records[11]);a.gemItems[2].level=1;a.gemPresets[0]=[null,null,null];
 assert.deepEqual(a.records[11],record);
 assert.deepEqual(normalizeAccount(a,now).records[11],record);
 assert.equal(idle._modifiers.goldIncome,1.1);
});
test('kill rewards are paid once for enemy deaths, including cannon, and obey gold capacity',()=>{
 const battle=createBattle({mode:'challenge',sequence:[],modifiers:{killGold:1.2}});
 battle._spawnSchedule=[{time:0,id:'beetle',x:500,overrides:{}}];stepBattle(battle,1/30);
 battle.gold=990;battle.units[0].hp=1;assert.ok(fireCannon(battle));
 assert.equal(battle.gold,1000);
 assert.equal(battle.events.filter(e=>e.type==='gold').length,1);
 battle.gold=0;stepBattle(battle,.1);
 assert.ok(battle.gold<10);
 assert.equal(battle.events.filter(e=>e.type==='gold').length,0);
});
test('stronger 2-2 blocks the entry formation, while the guide gem or later levels provide real alternatives',()=>{
 function play(level,withGem){
  const a=account(),ids=['sheep','squirrel','rabbit'];
  if(withGem){const item=drawGem(a,{free:true,random:()=>0});equipGem(a,0,0,item.uid);}
  const b=createBattle({mode:'challenge',stageId:12,sequence:[],levels:Object.fromEntries(ids.map(id=>[id,level])),modifiers:gemModifiers(a,'challenge')});
  let index=0,next=0,cannon=8;
  while(!b.finished){
   if(b.time>=next){if(summonUnit(b,ids[index]))index=(index+1)%ids.length;next=b.time+1;}
   if(b.time>=cannon&&fireCannon(b))cannon=b.time+25;
   stepBattle(b,1/30);
  }
  return b.result;
 }
 assert.equal(play(35,false).won,false);
 assert.equal(play(35,true).won,true);
 assert.equal(play(50,false).won,true);
});
test('legacy account gems migrate into plain slots once without changing old production records',()=>{
 const old=account();delete old.gemItems;delete old.gemPresets;
 old.gems={attack:7,hp:2,gold:1};old.equippedGem='gold';
 old.records[1]={gold:80,diamonds:.1,snapshot:{gem:'gold'}};
 const migrated=normalizeAccount(old,now);
 assert.equal(migrated.gemItems.length,3);assert.equal(migrated.gemReserves.attack,6);
 assert.equal(migrated.gemItems.find(g=>g.uid===migrated.gemPresets[0][0]).type,'gold');
 assert.ok(Math.abs(gemModifiers(migrated).acorn-1.15)<1e-8);
 assert.deepEqual(migrated.records,old.records);
 const twice=normalizeAccount(migrated,now);
 assert.deepEqual(twice.gemItems,migrated.gemItems);assert.deepEqual(twice.gemReserves,migrated.gemReserves);
});
test('gem elemental lines add real damage against a non-specialty enemy and remain in launched shots',()=>{
 function play(withOption){
  const b=createBattle({mode:'challenge',sequence:[],modifiers:{attributeBonuses:{machine:{attack:withOption?.1:0}}}});
  b._spawnSchedule=[{time:0,id:'beetle',x:540,overrides:{attribute:'machine',shield:false,regeneration:false}}];
  stepBattle(b,1/30);b.gold=1000;summonUnit(b,'squirrel');
  const player=b.units.find(u=>u.team==='player'),enemy=b.units.find(u=>u.team==='enemy');
  player.x=500;player.speed=0;enemy.x=540;enemy.speed=0;enemy.attackTimer=100;enemy.hp=enemy.maxHp=10000;
  while(!b.projectiles.length&&b.time<5)stepBattle(b,1/30);
  player.dead=true;player.hp=0;player.deathTimer=.32;
  while(enemy.hp===10000&&b.time<5)stepBattle(b,1/30);
  return 10000-enemy.hp;
 }
 const plain=play(false),gem=play(true);
 assert.ok(plain>0);assert.ok(Math.abs(gem-plain*1.1)<1e-6);
});
