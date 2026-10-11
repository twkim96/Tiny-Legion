import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { newAccount, currentMission, recordMissionBattle, claimMission, accrue, recordIdle, isOnboarding, recruitOnboardingCompanion } from '../dist/src/account.js';
import { STAGES, stageLabel } from '../dist/src/data.js';
import { recruitPanel } from '../dist/src/recruitment-ui.js';

const source = fs.readFileSync(new URL('../dist/src/main.js', import.meta.url), 'utf8');
function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1);
  const next = source.indexOf('\nfunction ', start + 1);
  // frame is the last function, followed by the initial scheduling call.
  const end = next === -1 ? source.indexOf('\nrequestAnimationFrame(frame);', start) : next;
  return source.slice(start, end);
}
function harness(names) {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { hidden: true, checked: false, innerHTML: '', textContent: '', dataset: {}, focus() {}, querySelector(selector) {return $(`${id}:${selector}`);} });
    return elements.get(id);
  };
  const account = newAccount();
  account.onboarding.phase = 'complete';
  account.highestCleared = 1;
  const calls = [];
  const context = {
    $, account, calls, STAGES, stageLabel, currentMission, recordMissionBattle, claimMission, accrue, recordIdle, isOnboarding, recruitOnboardingCompanion,
    mode: 'idle', stageId: 1, idleResultStage: null, resultHandled: false, restartAt: 0,
    battle: {result: {won:true, survival:120, hpRatio:1, reward:80}, finished:true, time:120, events:[]},
    battleSnapshot: {stageId:1, gem:null}, idleIncome:{gold:12,diamonds:.1},
    paused:false, lastFrame:0, accumulator:0, lastAccrual:Date.now(), lastUi:0, skillRemaining:0,
    document: {hidden:false}, matchMedia:()=>({matches:false}), performance:{now:()=>100},
    renderer:{consumeEvents(){},render(){}}, requestAnimationFrame(){},
    stepBattle(battle, dt){battle.time += dt; calls.push('step');},
    chirp(){}, persist(){calls.push('save');}, updateUi(){}, toast(text){calls.push(text);},
    closeModal(){calls.push('close-modal');},
    startBattle(){context.battle = {time:0,finished:false,events:[]}; context.restartAt=0; calls.push('start');},
    fmt:n=>String(Math.floor(n)), precise:n=>String(n), icon:name=>`[${name}]`,
    completeChallenge(){throw Error('Unexpected manual reward');},
    recordSpeedrun(){}, showResult(){}, finishOnboardingBattle(){throw Error('Unexpected onboarding');},
    recruitPanel, recruitCleanup:null, createHand(){}, resumeOnboarding(){throw Error('Unexpected resume');}, showOnboardingRetry(){},
    openModal(title,kind,render){calls.push([title,kind]); render();},
    revealRecruit(root, results, actions){context.revealed = results; context.revealActions=actions; return ()=>{};},
  };
  vm.createContext(context);
  vm.runInContext(names.map(functionSource).join('\n'), context);
  return context;
}
test('idle result dialog leaves simulation and automatic restart running', () => {
  const c=harness(['settleProduction','closeIdleResult','showIdleResult','finishBattle','frame']);
  c.finishBattle();
  assert.equal(c.$('idle-result-popup').hidden, false);
  assert.equal(c.$('idle-result-title').textContent, '방치 완료');
  assert.equal(c.account.missions.idleCompleted, true);
  const balance = c.account.gold;
  c.finishBattle();
  assert.equal(c.account.gold, balance);
  c.frame(3200);
  assert.equal(c.battle.finished, false);
  assert.equal(c.$('idle-result-popup').hidden, false);
  c.frame(3300);
  assert.ok(c.calls.includes('step'));
  assert.ok(c.battle.time > 0);
});
test('idle failure is informational and suppression is specific to its stage', () => {
  const c=harness(['showIdleResult','closeIdleResult']);
  c.showIdleResult({won:false,survival:30,reward:7});
  assert.equal(c.$('idle-result-title').textContent, '방치 실패');
  c.closeIdleResult();
  c.account.settings.hiddenIdleResults=[1];
  c.showIdleResult({won:true,survival:120,reward:80});
  assert.equal(c.$('idle-result-popup').hidden, true);
  c.stageId=2;
  c.showIdleResult({won:true,survival:120,reward:90});
  assert.equal(c.$('idle-result-popup').hidden, false);
  assert.equal(c.idleResultStage, 2);
});
test('mission click collects once then opens the exact challenge directly', () => {
  const c=harness(['settleProduction','closeIdleResult','startChallenge','actOnMission']);
  c.account.missions.idleCompleted=true;
  const gold=c.account.gold;
  c.actOnMission();
  assert.equal(c.account.gold, gold+120);
  assert.equal(currentMission(c.account).stageId, 2);
  c.actOnMission();
  assert.equal(c.mode,'challenge');
  assert.equal(c.stageId,2);
  assert.equal(c.calls.filter(x=>x==='start').length,1);
  assert.equal(c.account.gold, gold+120);
});
test('first recruit uses the forest banner and grants squirrel on its one-draw action', () => {
  const c=harness(['showOnboardingDraw']);
  c.account.onboarding.phase='recruit';
  const gold=c.account.gold, diamonds=c.account.diamonds;
  c.showOnboardingDraw();
  const html=c.$('modal-content').innerHTML;
  assert.match(html,/숲속 친구들/);
  assert.match(html,/data-draw-count="1"[^>]*>1회 무료/);
  assert.match(html,/data-draw-count="10" disabled/);
  assert.doesNotMatch(html,/id="welcome-draw"/);
  c.$('modal-content:[data-draw-count="1"]').onclick();
  assert.equal(c.revealed[0].unit.id, 'squirrel');
  assert.equal(c.account.onboarding.phase,'retry-battle');
  assert.equal(c.account.gold,gold);
  assert.equal(c.account.diamonds,diamonds);
  assert.equal(c.account.recruitment.total,0);
  assert.equal(c.$('draw-again').hidden,true);
});
