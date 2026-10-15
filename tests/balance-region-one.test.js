import test from 'node:test';
import assert from 'node:assert/strict';
import { runCampaign, simulate, ROSTER, optionsFor, idleAlternatives } from '../scripts/balance-region-one.mjs';
import * as account from '../dist/src/account.js';
import { getUnit } from '../dist/src/characters.js';

const evenly = a => {
  const copy=structuredClone(a);
  for(const id of ROSTER) account.refundUnitLevels(copy,id,0);
  for(let pass=0;pass<100;pass++) for(const id of ROSTER) account.growUnit(copy,id);
  return copy;
};
test('first-region mission and mail rewards fund a server-replayed campaign without any idle income or random recruitment', () => {
  const {account:a,report}=runCampaign({verifyServer:true,onStage(a,row,options,{bosses}){
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
      assert.ok(row.time>=50&&row.time<60,`late but legal finish at ${row.stage}`);
    }
  }});
  assert.equal(a.highestCleared,10);
  assert.equal(report.length,8);
  assert.equal(a.owned.fox,true);assert.equal(a.owned.chick,true);
  assert.ok(account.mailboxEntries(a).every(entry=>entry.claimed));
  const gold=a.gold,diamonds=a.diamonds;
  assert.equal(account.claimMission(a),null);
  assert.deepEqual(account.completeChallenge(a,10),{gold:0,diamonds:0});
  assert.equal(a.gold,gold);assert.equal(a.diamonds,diamonds);
});
test('after 1-5 the same budget needs a suitable investment and summon plan; defaults and untrained units fail', () => {
  runCampaign({onStage(a,row,options){
    if(row.stage<5)return;
    assert.equal(simulate(optionsFor(evenly(a),row.stage),{tactic:'balanced'}).state.result.won,false,`equal investment ${row.stage}`);
    for(const tactic of ['balanced','screen','all']) assert.equal(simulate(options,{tactic,cannon:row.cannon}).state.result.won,false,`wrong plan ${row.stage}/${tactic}`);
    assert.equal(simulate({...options,levels:Object.fromEntries(ROSTER.map(id=>[id,1]))},row).state.result.won,false,`investment required ${row.stage}`);
    assert.equal(simulate(options,{...row,cannon:null}).state.result.won,false,`cannon required ${row.stage}`);
    // The 25-second server cooldown is respected by the replayed reference.
    const shots=simulate(options,row).actions.filter(action=>action.type==='cannon');
    for(let i=1;i<shots.length;i++)assert.ok(shots[i].step-shots[i-1].step>=750);
  }});
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
