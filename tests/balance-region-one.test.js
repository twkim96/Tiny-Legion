import test from 'node:test';
import assert from 'node:assert/strict';
import { runCampaign, simulate, ROSTER, optionsFor, idleAlternatives } from '../scripts/balance-region-one.mjs';
import * as account from '../dist/src/account.js';
import { getUnit } from '../dist/src/characters.js';
import { STAGES } from '../dist/src/data.js';

const castleLoss = (result, label) => {
  assert.equal(result.state.result.won, false, label);
  assert.equal(result.state.playerHp, 0, `${label}: actual castle defeat`);
  assert.ok(result.state.enemyHp > 0, label);
};

const evenly = a => {
  const copy=structuredClone(a);
  for(const id of ROSTER) account.refundUnitLevels(copy,id,0);
  for(let pass=0;pass<100;pass++) for(const id of ROSTER) account.growUnit(copy,id);
  return copy;
};
test('first-region mission and mail rewards fund a server-replayed campaign without any idle income or random recruitment', () => {
  const {account:a,report}=runCampaign({verifyServer:true,onStage(a,row,options,{bosses,enemySpawns}){
    assert.deepEqual(a.records,{});
    if ([5,10].includes(row.stage)) {
      assert.ok(bosses.length>0);
      assert.ok(bosses.every(boss=>boss.dead && boss.hp===0), `boss defeated at ${row.stage}`);
    }
    assert.equal(a.recruitment.total,0);
    assert.ok(Object.keys(a.owned).filter(id=>a.owned[id]).every(id=>['common','rare'].includes(getUnit(id).rarity)));
    assert.ok(row.remaining>=0);
    if(row.stage>=5){
      assert.ok(row.spent>row.budget*.9,`investment matters at ${row.stage}`);
      assert.ok(row.time>=50,`meaningful castle push at ${row.stage}`);
      const encounter=STAGES.find(stage=>stage.id===row.stage).challenge;
      const repeating=encounter.waves.filter(wave=>wave.repeatEvery);
      assert.ok(repeating.length>0);
      assert.ok(repeating.every(wave=>wave.time<=26),'pressure belongs to an early normal phase');
      const initialCount=encounter.waves.reduce((total,wave)=>total+wave.enemies.reduce((n,group)=>n+(group.count??1),0),0);
      assert.ok(enemySpawns.length>initialCount,`reference fights recurring reinforcements at ${row.stage}`);
    }
  }});
  assert.equal(a.highestCleared,10);
  assert.equal(report.length,8);
  // A long-term economy retune must leave each existing no-idle fight's budget intact.
  assert.deepEqual(report.map(row=>row.budget),[1552,2118,2906,3957,5317,7037,9174,11792]);
  assert.equal(a.owned.fox,true);assert.equal(a.owned.chick,true);
  assert.ok(account.mailboxEntries(a).every(entry=>entry.claimed));
  const gold=a.gold,diamonds=a.diamonds;
  assert.equal(account.claimMission(a),null);
  assert.deepEqual(account.completeChallenge(a,10),{gold:0,diamonds:0});
  assert.equal(a.gold,gold);assert.equal(a.diamonds,diamonds);
});
test('after 1-5 the same budget needs a suitable investment and summon plan; defaults and untrained units fail', () => {
  let lateLosses = 0;
  runCampaign({onStage(a,row,options){
    if(row.stage<5)return;
    castleLoss(simulate(optionsFor(evenly(a),row.stage),{tactic:'balanced'}),`equal investment ${row.stage}`);
    // Screen is the reference at 1-7 and a valid alternative at 1-6.
    // Compare defaults/blind five-unit spending plus an unsupported rush there.
    for(const tactic of ['balanced', ...([6,7].includes(row.stage)?['rush']:['screen']), 'all']) {
      const result=simulate(options,{tactic,cannon:row.cannon});
      castleLoss(result,`wrong plan ${row.stage}/${tactic}`);
      if (result.state.time > 60) lateLosses++;
    }
    castleLoss(simulate({...options,levels:Object.fromEntries(ROSTER.map(id=>[id,1]))},row),`investment required ${row.stage}`);
    castleLoss(simulate(options,{...row,cannon:null}),`cannon required ${row.stage}`);
    // The 25-second server cooldown is respected by the replayed reference.
    const shots=simulate(options,row).actions.filter(action=>action.type==='cannon');
    for(let i=1;i<shots.length;i++)assert.ok(shots[i].step-shots[i-1].step>=750);
  }});
  assert.ok(lateLosses >= 6, 'wrong plans remain real defeats beyond the former 60-second deadline');
});

test('eight hours of measured income on an already cleared stage opens a simple growth alternative', () => {
  runCampaign({onStage(a,row){
    if(row.stage<5)return;
    const alternative=idleAlternatives(a,row.stage);
    assert.ok(alternative.productionStage<row.stage);
    assert.ok(alternative.earned>0);
    assert.ok(alternative.wins.length>0,`growth alternative 1-${row.stage}`);
  }});
});

test('simulation safety horizon throws instead of manufacturing a battle result', () => {
  assert.throws(() => simulate({mode:'challenge',stageId:1}, {horizon:1}), /safety horizon/);
});
