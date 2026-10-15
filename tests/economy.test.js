import test from 'node:test';
import assert from 'node:assert/strict';
import { idleFullReward, idleAcornReward, idleDiamondReward, idleRewardFactor, levelUpgradeCost, hasStageMission, stageMissionReward, missionRewardRounds, contentUnlockReward } from '../dist/src/economy.js';
import { levelCost } from '../dist/src/account.js';
import { overnight, projectProgression, cumulativeLevelCost } from '../scripts/balance-economy.mjs';

test('stage income grows by exactly ten percent, with fractional acorns retained across short cycles',()=>{
  for(let stage=1;stage<200;stage++) {
    assert.ok(Math.abs(idleFullReward(stage+1)/idleFullReward(stage)-1.1)<1e-12);
    const hourly=[40,60,90].map(duration=>idleAcornReward(stage,duration,duration,1)*3600/duration);
    assert.ok(hourly.every(value=>Math.abs(value/hourly[0]-1)<1e-12));
  }
  assert.equal(idleRewardFactor(90,90,1),1);
  assert.equal(idleRewardFactor(45,90,1),.2);
  assert.ok(idleRewardFactor(90,90,.5)<idleRewardFactor(90,90,.9));
  assert.equal(idleDiamondReward(1,90,90,1),.025);
});
test('level prices increase with increasingly costly late progression and remain safe integers',()=>{
  for(let level=1;level<=100;level++){
    const cost=levelUpgradeCost(level);
    assert.equal(levelCost(level),cost);
    assert.ok(Number.isSafeInteger(cost)&&cost>0);
    if(level>1)assert.ok(cost>levelUpgradeCost(level-1));
  }
  assert.ok(levelCost(99)>levelCost(50)*1000);
  assert.ok(Number.isSafeInteger(cumulativeLevelCost(100)*5));
});
test('a fresh zero-idle first region and 2-1 defense yield average level 12 to 13 after eight hours',()=>{
  const result=overnight();
  assert.ok(result.mean>=12&&result.mean<=13);
  assert.equal(result.record.hpRatio,1);
  assert.equal(result.income.seconds,8*3600);
  assert.ok(result.income.gold>0&&result.income.gold<15000);
  assert.equal(overnight(10).income.gold,result.income.gold);
});
test('90 daily eight-hour payouts progressing to region20 nearly fund five max levels; 60-day fast clears plus missions can finish',()=>{
  const slow=projectProgression();
  assert.ok(slow.mean>=99&&slow.mean<100);
  assert.equal(slow.maxDay,null);
  const fast=projectProgression({days:60,missions:true});
  assert.equal(fast.mean,100);
  assert.ok(fast.maxDay>=55&&fast.maxDay<=60);
  assert.ok(fast.missionTotal>0);
  const without=projectProgression({days:60});
  assert.ok(without.mean<100);
});
test('missions follow early stage and later boss cadence, with a linear stage multiplier and separate unlock reward',()=>{
  for(let s=2;s<=20;s++)assert.equal(hasStageMission(s),true);
  assert.equal(hasStageMission(21),false);assert.equal(hasStageMission(24),false);
  assert.equal(hasStageMission(25),true);assert.equal(hasStageMission(30),true);
  assert.equal(hasStageMission(31),false);assert.equal(hasStageMission(195),true);assert.equal(hasStageMission(200),true);
  assert.equal(hasStageMission(0),false);assert.equal(hasStageMission(1.5),false);
  for(let s=11;s<199;s++) assert.equal(missionRewardRounds(s+1)-missionRewardRounds(s),1.5);
  assert.ok(stageMissionReward(30).gold>stageMissionReward(25).gold);
  assert.ok(stageMissionReward(20).gold>idleFullReward(20));
  assert.equal(contentUnlockReward(11).gold,Math.ceil(idleFullReward(11)*30));
});
