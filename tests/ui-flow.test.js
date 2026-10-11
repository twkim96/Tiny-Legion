import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { newAccount, currentMission, recordMissionBattle, claimMission, accrue, recordIdle, isOnboarding, recruitOnboardingCompanion, growthUnlocked, sequenceUnlocked, sequenceForMode, setSequence, playableSequence, growUnit, refundUnitLevels, unitLevelRefund, levelCost, recruitEarlyRabbit, applyGuideSequence, canUseUnit, ownsUnit } from '../dist/src/account.js';
import { STAGES, UNITS, stageLabel } from '../dist/src/data.js';
import { recruitPanel } from '../dist/src/recruitment-ui.js';
import { modalLayout, messagePanel } from '../dist/src/modal-ui.js';
import { companionStats, upgradeUnitAbility } from '../dist/src/account.js';
import { companionPanel } from '../dist/src/companion-ui.js';

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
    if (!elements.has(id)) elements.set(id, { hidden: true, checked: false, innerHTML: '', textContent: '', dataset: {}, focus() {}, querySelector(selector) {return $(`${id}:${selector}`);}, querySelectorAll(selector) {
      const attr=selector.slice(1,-1);
      return [...this.innerHTML.matchAll(/<button[^>]*>/g)].filter(([tag])=>tag.includes(`${attr}=`)).map(([tag])=>{
        const key=tag.match(new RegExp(`${attr}="([^"]*)"`))[1];
        const button=$(`${id}:${attr}:${key}`);
        for(const [,attribute,value] of tag.matchAll(/data-([\w-]+)="([^"]*)"/g)) button.dataset[attribute.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;
        return button;
      });
    } });
    return elements.get(id);
  };
  const account = newAccount();
  account.onboarding.phase = 'complete';
  account.highestCleared = 1;
  const calls = [];
  const context = {
    $, account, calls, STAGES, stageLabel, currentMission, recordMissionBattle, claimMission, accrue, recordIdle, isOnboarding, recruitOnboardingCompanion, growthUnlocked, sequenceUnlocked, sequenceForMode, setSequence, playableSequence, growUnit, refundUnitLevels, unitLevelRefund, levelCost, recruitEarlyRabbit, applyGuideSequence, canUseUnit, ownsUnit, UNITS,
    modalLayout, messagePanel, modalKind:null, modalRender:null, lastFocused:null, hideTooltip(){},
    readyBattle(){calls.push("ready");}, openCodex(){},
    companionStats, upgradeUnitAbility, companionPanel, unitAbilityLines:()=>[],
    renderGrowth(){calls.push('growth-screen');}, renderRecruit(){calls.push('recruit-screen');},
    sequenceDraft:null, sequenceDraftMode:"idle", sequenceDrafts:null, names:Object.fromEntries(UNITS.map(u=>[u.id,u.name])), portrait:id=>`[${id}]`, rarityBadge:()=>"",
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
test('regional victory returns to the newly opened idle stage and preserves prior production records', () => {
  const c=harness(['settleProduction','closeIdleResult','enterRegionIdle','showResult','setMode']);
  c.mode='challenge'; c.stageId=10; c.account.highestCleared=10;
  c.account.earlyGuide.phase='complete';
  recordIdle(c.account,{survival:120,hpRatio:1,reward:80},{stageId:1});
  const oldRecord=structuredClone(c.account.records[1]);
  c.account.lastSettled=Date.now()-120000;
  const gold=c.account.gold;
  c.showResult({won:true,time:70},{gold:430,diamonds:10});
  assert.equal(c.account.idleStage,1);
  c.$('return-idle').onclick();
  assert.equal(c.mode,'idle');
  assert.equal(c.stageId,11);
  assert.equal(c.account.idleStage,11);
  assert.deepEqual(c.account.records[1],oldRecord);
  assert.ok(c.account.gold>=gold+80);
  assert.equal(c.calls.filter(x=>x==='start').length,1);
  assert.ok(c.calls.includes('save'));
  c.mode='challenge'; c.stageId=10;
  c.account.idleStage=1;
  c.showResult({won:false,time:120},{gold:0,diamonds:0});
  c.$('return-idle').onclick();
  assert.equal(c.account.idleStage,1);
  c.mode='challenge'; c.stageId=20; c.account.highestCleared=20;
  c.showResult({won:true,time:70},{gold:1,diamonds:1});
  c.$('return-idle').onclick();
  assert.equal(c.stageId,1);
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

test('second free banner action guarantees rabbit and retries the exact wall stage', () => {
  const c=harness(['showEarlyDraw','settleProduction','closeIdleResult','startChallenge']);
  c.account.earlyGuide.phase='rabbit-recruit';
  c.account.owned.squirrel=true;
  c.account.sequence=['sheep','squirrel',...Array(8).fill(null)];
  c.onboardingMessage=(title,text,label,action)=>action();
  const diamonds=c.account.diamonds;
  c.showEarlyDraw();
  assert.match(c.$('modal-content').innerHTML,/숲속 친구들/);
  c.$('modal-content:[data-draw-count="1"]').onclick();
  assert.equal(c.revealed[0].unit.id,'rabbit');
  assert.equal(c.account.diamonds,diamonds);
  assert.equal(c.account.earlyGuide.phase,'wall-retry');
  assert.ok(c.calls.includes('save'));
  c.revealActions.done();
  assert.equal(c.mode,'challenge');
  assert.equal(c.stageId,2);
  assert.equal(c.calls.filter(x=>x==='start').length,1);
});
test('defense lesson uses real replace, clear and apply actions without removing ownership', () => {
  const c=harness(['openModal','openSequence','showDefenseGuide','renderSequence']);
  c.account.earlyGuide.phase='remove-rabbit';
  c.account.owned.squirrel=true;
  c.account.owned.rabbit=true;
  c.account.sequence=['sheep','squirrel','rabbit',...Array(7).fill(null)];
  c.account.sequencePresets={challenge:[...c.account.sequence],speedrun:[...c.account.sequence]};
  c.closeIdleResult=()=>{};
  c.showDefenseGuide();
  assert.match(c.$('modal-content').innerHTML,/교체/);
  assert.equal(c.$('modal-backdrop').dataset.layout,'message');
  assert.match(c.$('modal-content').innerHTML,/<div class="modal-message-art"><svg/);
  assert.equal(c.paused,false);
  c.$('defense-edit').onclick();
  c.$('modal-content:data-replace:2').onclick();
  c.$('clear-sequence-slot').onclick();
  c.$('apply-sequence').onclick();
  assert.equal(c.account.earlyGuide.phase,'idle-retry');
  assert.equal(c.account.sequence[2],null);
  assert.equal(c.account.owned.rabbit,true);
  assert.ok(c.account.sequencePresets.challenge.includes('rabbit'));
  assert.ok(c.account.sequencePresets.speedrun.includes('rabbit'));
  assert.ok(c.calls.includes('start'));
});
test('idle failure opens defense lesson while the automatic retry keeps running',()=>{
  const c=harness(['settleProduction','showIdleResult','finishBattle','frame','showDefenseGuide']);
  c.stageId=2;
  c.account.earlyGuide.phase='idle-defense';
  c.account.highestCleared=2;
  c.account.owned.rabbit=true;
  c.battle.result={won:false,survival:50,hpRatio:0,reward:20};
  c.battleSnapshot.stageId=2;
  c.finishBattle();
  assert.equal(c.account.earlyGuide.phase,'remove-rabbit');
  assert.ok(c.calls.some(x=>Array.isArray(x)&&x[1]==='defense-guide'));
  c.frame(3200);
  assert.equal(c.battle.finished,false);
  c.frame(3300);
  assert.ok(c.calls.includes('step'));
});
test('second idle completion announces growth and its mission opens the growth screen',()=>{
  const c=harness(['openModal','settleProduction','closeIdleResult','showIdleResult','finishBattle','actOnMission']);
  c.stageId=2;
  c.account.highestCleared=2;
  c.account.earlyGuide.phase='idle-retry';
  c.account.owned.squirrel=true;
  c.account.owned.rabbit=true;
  c.account.sequence=['sheep','squirrel',...Array(8).fill(null)];
  c.account.missions={idleCompleted:true,claimed:['idle-intro','challenge-2']};
  c.renderGrowth=()=>c.calls.push('growth-screen');
  c.finishBattle();
  assert.equal(growthUnlocked(c.account),true);
  assert.equal(c.$('modal-backdrop').dataset.kind,'growth-guide');
  assert.equal(c.$('modal-backdrop').dataset.layout,'notice');
  c.$('growth-guide-done').onclick();
  assert.equal(currentMission(c.account).id,'growth-intro');
  assert.equal(c.$('modal-backdrop').dataset.kind,'growth');
  assert.ok(c.calls.includes('growth-screen'));
  assert.equal(c.$('idle-result-popup').hidden,true);
  assert.equal(c.paused,false);
  const balance=c.account.gold;
  c.$('growth-guide-done').onclick();
  assert.equal(c.account.gold,balance);
});


test('challenge success offers idle and next challenge, preserving result when the idle lesson blocks entry',()=>{
  const c=harness(['showResult','startChallenge','enterSecondIdle','settleProduction','closeIdleResult']);
  c.mode='challenge'; c.stageId=2;
  c.account.highestCleared=2; c.account.earlyGuide.phase='idle-defense';
  c.showResult({won:true,time:58},{gold:240,diamonds:10});
  const html=c.$('battle-result').innerHTML;
  assert.equal([...html.matchAll(/<button/g)].length,2);
  assert.match(html,/1-3 도전/);
  assert.doesNotMatch(html,/retry-battle|1-2 방치/);
  c.$('next-battle').onclick();
  assert.ok(c.calls.includes('1-2 방치 미션을 먼저 완료하세요.'));
  assert.equal(c.stageId,2);
  assert.equal(c.mode,'challenge');
  assert.equal(c.$('battle-result').hidden,false);
  assert.ok(!c.calls.includes('start'));
  c.$('return-idle').onclick();
  assert.equal(c.mode,'idle');
  assert.equal(c.stageId,2);
  assert.equal(c.account.idleStage,2);
  assert.ok(c.calls.includes('start'));
});
test('next challenge opens after the idle lesson, and failures retain retry',()=>{
  const c=harness(['showResult','startChallenge','settleProduction','closeIdleResult']);
  c.mode='challenge'; c.stageId=2;
  c.account.highestCleared=2; c.account.earlyGuide.phase='growth';
  c.showResult({won:true,time:58},{gold:0,diamonds:0});
  c.$('next-battle').onclick();
  assert.equal(c.stageId,3);
  assert.equal(c.mode,'challenge');
  assert.equal(c.calls.filter(x=>x==='start').length,1);
  c.showResult({won:false,time:120},{gold:0,diamonds:0});
  assert.match(c.$('battle-result').innerHTML,/retry-battle/);
  assert.doesNotMatch(c.$('battle-result').innerHTML,/next-battle/);
  c.$('retry-battle').onclick();
  assert.equal(c.calls.filter(x=>x==='start').length,2);
});
test('sequence windows stay locked until the first stage two idle failure',()=>{
  const c=harness(['openModal']);
  c.account.highestCleared=2; c.account.earlyGuide.phase='idle-defense';
  let renders=0;
  for(const kind of ['sequence','sequence-pick']) c.openModal('순서',kind,()=>renders++);
  assert.equal(renders,0);
  assert.equal(c.$('modal-backdrop').hidden,true);
  recordMissionBattle(c.account,{mode:'idle',stageId:2,won:false});
  c.openModal('순서','sequence',()=>renders++);
  assert.equal(renders,1);
  assert.equal(c.$('modal-backdrop').hidden,false);
  assert.equal(c.$('modal-backdrop').dataset.layout,'panel');
});
test('tutorial banners use collection layout and their next notice returns to compact layout',()=>{
  for(const flow of ['showOnboardingDraw','showEarlyDraw']) {
    const c=harness(['openModal','onboardingMessage',flow]);
    c.account.earlyGuide.phase='rabbit-recruit';
    c[flow]();
    assert.equal(c.$('modal-backdrop').dataset.layout,'collection');
    assert.equal(c.$('close-modal').hidden,true);
    assert.match(c.$('modal-content').innerHTML,/숲속 친구들/);
    let next=false;
    c.onboardingMessage('안내','다음 단계','확인',()=>next=true,'rabbit');
    assert.equal(c.$('modal-backdrop').dataset.layout,'message');
    assert.match(c.$('modal-content').innerHTML,/<div class="modal-message-art"><svg/);
    c.$('onboarding-next').onclick();
    assert.equal(next,true);
  }
});

test('speedrun success keeps reward and practice actions, final challenge has only idle',()=>{
  const c=harness(['showResult']);
  c.speedrunReward=()=>50;
  c.mode='speedrun';
  c.showResult({won:true,time:30},{gold:0,diamonds:0});
  assert.match(c.$('battle-result').innerHTML,/retry-battle/);
  assert.match(c.$('battle-result').innerHTML,/claim-speedrun/);
  assert.doesNotMatch(c.$('battle-result').innerHTML,/next-battle/);
  c.account.daily.claimed=true;
  c.showResult({won:true,time:30},{gold:0,diamonds:0});
  assert.match(c.$('battle-result').innerHTML,/연습하기/);
  assert.doesNotMatch(c.$('battle-result').innerHTML,/claim-speedrun/);
  c.mode='challenge'; c.stageId=STAGES.length;
  c.showResult({won:true,time:30},{gold:0,diamonds:0});
  assert.equal([...c.$('battle-result').innerHTML.matchAll(/<button/g)].length,1);
  assert.match(c.$('battle-result').innerHTML,/return-idle/);
});


test('companion cards open upgrade details; detail refund preserves other companions and supports cancel',()=>{
  const c=harness(['openModal','renderGrowth','openUnitDetail','renderUnitDetail','showUnitRefund']);
  c.account.earlyGuide.phase='complete';
  c.account.owned.squirrel=true;
  c.account.levels.sheep=3;
  c.account.levels.squirrel=4;
  c.renderGrowth();
  assert.doesNotMatch(c.$('modal-content').innerHTML,/data-refund|data-inspect/);
  c.$('modal-content:data-companion:sheep').onclick();
  assert.equal(c.$('modal-backdrop').dataset.kind,'companion');
  assert.match(c.$('modal-content').innerHTML,/적용 효과|특수능력/);
  const initial=JSON.stringify(c.account);
  c.$('companion-refund').onclick();
  assert.match(c.$('modal-title').textContent,/양 방패/);
  assert.equal(c.$('modal-backdrop').dataset.layout,'message');
  assert.match(c.$('modal-content').innerHTML,/도토리 220개/);
  c.$('cancel-refund').onclick();
  assert.equal(JSON.stringify(c.account),initial);
  c.$('companion-refund').onclick();
  c.$('confirm-refund').onclick();
  assert.equal(c.account.levels.sheep,1);
  assert.equal(c.account.levels.squirrel,4);
  assert.equal(c.$('modal-backdrop').dataset.kind,'companion');
  assert.ok(c.calls.includes('start'));
  const after=JSON.stringify(c.account);
  c.$('confirm-refund').onclick();
  assert.equal(JSON.stringify(c.account),after);
  c.openUnitDetail('squirrel');
  c.$('companion-refund').onclick();
  c.$('confirm-refund').onclick();
  assert.equal(c.account.levels.squirrel,1);
});


test('content selector preserves separate drafts and applies only the selected preset',()=>{
  const c=harness(['openModal','openSequence','renderSequence','handUnits']);
  c.account.earlyGuide.phase='complete'; c.account.highestCleared=3;
  c.account.owned.squirrel=true; c.account.owned.rabbit=true;
  c.account.sequence=['sheep','squirrel',...Array(8).fill(null)];
  c.account.sequencePresets={challenge:['sheep','rabbit',...Array(8).fill(null)],speedrun:['rabbit','squirrel',...Array(8).fill(null)]};
  const idle=[...c.account.sequence];
  const speedrun=[...c.account.sequencePresets.speedrun];
  c.openSequence();
  c.$('modal-content:data-sequence-preset:challenge').onclick();
  c.$('modal-content:data-replace:1').onclick();
  c.$('clear-sequence-slot').onclick();
  c.$('modal-content:data-sequence-preset:idle').onclick();
  assert.equal(c.sequenceDraft[1],'squirrel');
  c.$('modal-content:data-sequence-preset:challenge').onclick();
  assert.equal(c.sequenceDraft[1],null);
  c.$('apply-sequence').onclick();
  assert.deepEqual([...c.account.sequence],idle);
  assert.deepEqual([...c.account.sequencePresets.speedrun],speedrun);
  assert.equal(c.account.sequencePresets.challenge[1],null);
  assert.ok(!c.calls.includes('start'));
  assert.deepEqual([...c.handUnits()],idle);
  c.mode='challenge';
  assert.deepEqual([...c.handUnits()],['sheep',...Array(9).fill(null)]);
  c.mode='speedrun';
  assert.deepEqual([...c.handUnits()],speedrun);
  c.openSequence();
  assert.equal(c.sequenceDraftMode,'speedrun');
});

test('ordinary victories never offer retry at any stage, while speedrun still does',()=>{
  const c=harness(['showResult']);
  c.mode='challenge';
  for(const stage of STAGES){
    c.stageId=stage.id;
    c.showResult({won:true,time:60},{gold:0,diamonds:0});
    const html=c.$('battle-result').innerHTML;
    assert.doesNotMatch(html,/retry-battle|result-support/);
    assert.match(html,/return-idle/);
    assert.equal(html.includes('next-battle'),stage.id<STAGES.length);
  }
  c.mode='speedrun'; c.speedrunReward=()=>5;
  c.showResult({won:true,time:60},{gold:0,diamonds:0});
  assert.match(c.$('battle-result').innerHTML,/retry-battle/);
});
test('failed challenges expose earned mission rewards once and open growth or recruitment',()=>{
  const c=harness(['showResult']);
  c.mode='challenge'; c.stageId=4;
  c.account.highestCleared=3; c.account.earlyGuide.phase='complete';
  c.account.missions.claimed=['idle-intro','challenge-2','idle-second','growth-intro'];
  const before=c.account.gold;
  c.showResult({won:false,time:120},{gold:0,diamonds:0});
  assert.equal(c.account.gold,before);
  assert.match(c.$('battle-result').innerHTML,/result-mission|result-growth|result-recruit/);
  const claim=c.$('result-mission').onclick;
  claim();
  const balance=c.account.gold;
  assert.ok(balance>before);
  assert.doesNotMatch(c.$('battle-result').innerHTML,/result-mission/);
  claim();
  assert.equal(c.account.gold,balance);
  c.$('result-growth').onclick();
  c.$('result-recruit').onclick();
  assert.ok(c.calls.includes('growth-screen'));
  assert.ok(c.calls.includes('recruit-screen'));
  assert.match(c.$('battle-result').innerHTML,/retry-battle/);
});

test('companion detail upgrades deduct marks and acorns, update effects, and keep the selected companion',()=>{
  const c=harness(['openModal','openUnitDetail','renderUnitDetail','settleProduction']);
  c.account.earlyGuide.phase='complete';c.account.highestCleared=10;
  c.account.marks.wild=10;c.account.gold=1000;
  c.openUnitDetail('sheep');
  assert.equal(c.$('modal-backdrop').dataset.kind,'companion');
  assert.match(c.$('modal-content').innerHTML,/초당 공격력|이동속도|소환 대기/);
  c.$('modal-content:data-ability:hp').onclick();
  assert.equal(c.account.abilities.sheep.hp,1);
  assert.equal(c.account.marks.wild,9);assert.equal(c.account.gold,880);
  assert.match(c.$('modal-content').innerHTML,/체력 \+1%/);
  assert.equal(c.$('modal-title').textContent,'양 방패');
  assert.equal(c.account.abilities.squirrel.hp,0);
});
