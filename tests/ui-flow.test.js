import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { newAccount, currentMission, recordMissionBattle, claimMission, accrue, recordIdle, isOnboarding, recruitOnboardingCompanion, growthUnlocked, sequenceUnlocked, sequenceForMode, setSequence, playableSequence, growUnit, refundUnitLevels, unitLevelRefund, levelCost, recruitEarlyRabbit, applyGuideSequence, canUseUnit, ownsUnit, speedrunStageRecord, speedrunProgress, speedrunReward } from '../dist/src/account.js';
import { STAGES, UNITS, stageLabel, battleDuration } from '../dist/src/data.js';
import { SPEEDRUN_LIMIT_SECONDS, SPEEDRUN_TARGET_SECONDS, SPEEDRUN_STAGES, speedrunStageReward } from '../dist/src/speedrun.js';
import { recruitPanel } from '../dist/src/recruitment-ui.js';
import { modalLayout, messagePanel } from '../dist/src/modal-ui.js';
import { companionStats, upgradeUnitAbility, advancedContentUnlocked, collectReturnIncome, effectiveUnitLevel, baseLevelRoster, sharedLevel } from '../dist/src/account.js';
import { companionPanel } from '../dist/src/companion-ui.js';
import {drawGem,gemByUid,gemDefinition,gemDescription,gemOptionText,gemOptionTier,gemRerollCost,gemUpgradeCost,gemUpgradeMaterials,upgradeGem,rerollGem,equipGem,unequipGem,equippedGemItems,ownedGemBasics,isGemEquipped,GEM_OPTION_LIMIT,GEM_OPTION_TIERS,GEM_TYPES,GEM_BANNERS,GEM_OPTIONS} from '../dist/src/gems.js';
import { moveSequenceItem } from '../dist/src/sequence-ui.js';
import {gemPage,gemPicker,gemDetail,gemCard,gemArt,gemRateMarkup} from '../dist/src/gem-ui.js';
import { entryPanel, signInPath, signInIntent, accountIdentityPanel } from '../dist/src/sign-in.js';
import { testLoginPanel, bindTestLogin, adminPanel } from '../dist/src/test-access-ui.js';
import { bindRotationPrompt, enterLandscapeFullscreen } from '../dist/src/fullscreen.js';

const source = fs.readFileSync(new URL('../dist/src/main.js', import.meta.url), 'utf8');
function functionSource(name) {
  const starts = [`async function ${name}(`, `function ${name}(`]
    .map((declaration) => source.indexOf(declaration))
    .filter((index) => index >= 0);
  const start = starts.length ? Math.min(...starts) : -1;
  assert.notEqual(start, -1);
  const nextDeclarations = ['\nasync function ', '\nfunction ']
    .map((declaration) => source.indexOf(declaration, start + 1))
    .filter((index) => index >= 0);
  // frame is the last function, followed by the initial scheduling call.
  const end = nextDeclarations.length
    ? Math.min(...nextDeclarations)
    : source.indexOf('\nrequestAnimationFrame(frame);', start);
  return source.slice(start, end);
}
function harness(names) {
  const elements = new Map();
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { hidden: true, checked: false, innerHTML: '', textContent: '', dataset: {}, focus() {}, setAttribute(key,value){this[key]=value;}, querySelector(selector) {return $(`${id}:${selector}`);}, querySelectorAll(selector) {
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
    $, account, calls, hostedMode:false, testLoginEnabled:false, testLoginRequested:false, cloudIdentity:null, adminPanel, accountClient:null, sendCommand:async()=>null, updatePreference:async()=>true, STAGES, battleDuration, stageLabel, currentMission, recordMissionBattle, claimMission, accrue, recordIdle, isOnboarding, recruitOnboardingCompanion, growthUnlocked, sequenceUnlocked, sequenceForMode, setSequence, playableSequence, growUnit, refundUnitLevels, unitLevelRefund, levelCost, recruitEarlyRabbit, applyGuideSequence, canUseUnit, ownsUnit, UNITS, speedrunStageRecord, speedrunProgress, speedrunReward, speedrunStageReward, SPEEDRUN_LIMIT_SECONDS, SPEEDRUN_TARGET_SECONDS, SPEEDRUN_STAGES,
    bindSequenceDrag(){}, moveSequenceItem, modalHistory:[], modalLayout, messagePanel, modalKind:null, modalRender:null, lastFocused:null, hideTooltip(){},
    readyBattle(){calls.push("ready");}, openCodex(){},
    drawGem,gemByUid,gemDefinition,gemDescription,gemOptionText,gemOptionTier,gemRerollCost,gemUpgradeCost,gemUpgradeMaterials,upgradeGem,rerollGem,equipGem,unequipGem,equippedGemItems,ownedGemBasics,isGemEquipped,GEM_OPTION_LIMIT,GEM_OPTION_TIERS,GEM_TYPES,GEM_BANNERS,GEM_OPTIONS,gemPage,gemPicker,gemDetail,gemCard,gemArt,gemRateMarkup,
    companionStats, upgradeUnitAbility, advancedContentUnlocked, collectReturnIncome, effectiveUnitLevel, baseLevelRoster, sharedLevel, companionPanel, unitAbilityLines:()=>[],
    renderGems(){calls.push('gems-screen');}, renderGrowth(){calls.push('growth-screen');}, renderRecruit(){calls.push('recruit-screen');},
    sequenceDraftIndex:0, sequenceDraftChoices:null, pendingReturnIncome:null, sequenceDraft:null, sequenceDraftMode:"idle", sequenceDrafts:null, names:Object.fromEntries(UNITS.map(u=>[u.id,u.name])), portrait:id=>`[${id}]`, rarityBadge:()=>"",
    mode: 'idle', stageId: 1, idleResultStage: null, resultHandled: false, restartAt: 0, hostedHalted:false,
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
  vm.runInContext([...new Set(['firstIdleMissionPending', 'levelBasisMarkup', 'rememberModalPosition', 'displayModalFrame', 'backModal', 'returnModal', 'selectIdleStage', 'finishOnboardingRecruit', 'revealEarlyRabbit', ...names])].map(functionSource).join('\n'), context);
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
test('hosted battle finish uses server result for a completed onboarding account', async () => {
  const c = harness(['finishHostedBattle']);
  c.hostedMode = true;
  c.mode = 'challenge';
  c.battleSnapshot = { battleId: 'server-battle', dailyKey: c.account.daily.key };
  c.battle.result = { won: true, time: 42 };
  c.manualBattleActions = [
    { step: 90, type: 'summon', id: 'squirrel' },
    { step: 95, type: 'cannon' },
  ];
  const commands = [];
  const serverResult = { won: true, time: 42 };
  let shown;
  c.sendCommand = async (type, args) => {
    commands.push({ type, args: JSON.parse(JSON.stringify(args)) });
    return { result: { battleResult: serverResult, rewards: { gold: 50, diamonds: 2 }, recordChanged: true } };
  };
  c.showResult = (result, rewards) => { shown = { result, rewards }; };
  c.recordMissionBattle = () => { throw new Error('Server already records mission progress'); };

  await c.finishHostedBattle();

  assert.deepEqual(commands, [{
    type: 'battle.finish',
    args: {
      battleId: 'server-battle',
      actions: [
        { step: 90, type: 'summon', id: 'squirrel' },
        { step: 95, type: 'cannon' },
      ],
    },
  }]);
  assert.equal(shown.result, serverResult);
  assert.deepEqual(shown.rewards, { gold: 50, diamonds: 2 });
  assert.equal(c.account.highestCleared, 1);
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
  c.account.missions.claimed=['idle-intro'];
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
  c.account.missions.claimed=['idle-intro'];
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
  c.account.missions.claimed=['idle-intro'];
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
  c.account.missions.claimed=['idle-intro'];
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

test('speedrun results show one daily reward and next stage only after target, final challenge has only idle',()=>{
  const c=harness(['showResult']);
  c.speedrunReward=()=>50;
  c.account.highestCleared=11;
  c.account.speedrunUnlocked=2;
  c.account.daily.stages[1]={best:30,practice:null,claimed:false};
  c.mode='speedrun';
  c.showResult({won:true,time:30},{gold:0,diamonds:0});
  assert.match(c.$('battle-result').innerHTML,/claim-speedrun/);
  assert.match(c.$('battle-result').innerHTML,/next-speedrun/);
  assert.doesNotMatch(c.$('battle-result').innerHTML,/retry-battle|next-battle/);
  assert.doesNotMatch(c.$('battle-result').innerHTML,/next-battle/);
  c.account.daily.stages[1].claimed=true;
  c.showResult({won:true,time:30},{gold:0,diamonds:0});
  assert.match(c.$('battle-result').innerHTML,/오늘 보상 수령 완료/);
  assert.match(c.$('battle-result').innerHTML,/연습하기/);
  assert.match(c.$('battle-result').innerHTML,/next-speedrun/);
  assert.doesNotMatch(c.$('battle-result').innerHTML,/claim-speedrun/);
  c.account.daily.stages[1]={best:70,practice:null,claimed:false};
  c.showResult({won:true,time:70},{gold:0,diamonds:0});
  assert.match(c.$('battle-result').innerHTML,/retry-battle/);
  assert.match(c.$('battle-result').innerHTML,/claim-speedrun/);
  assert.doesNotMatch(c.$('battle-result').innerHTML,/next-speedrun/);
  c.mode='challenge'; c.stageId=STAGES.length;
  c.showResult({won:true,time:30},{gold:0,diamonds:0});
  assert.equal([...c.$('battle-result').innerHTML.matchAll(/<button/g)].length,1);
  assert.match(c.$('battle-result').innerHTML,/return-idle/);
});

test('speedrun daily list shows all stages with compact target, reward, record and lock state',()=>{
  const c=harness(['renderDaily']);
  c.settleProduction=()=>{};
  c.account.highestCleared=11;
  c.account.speedrunUnlocked=1;
  c.account.daily.stages[1]={best:65,practice:null,claimed:false};
  c.renderDaily();
  const html=c.$('modal-content').innerHTML;
  assert.match(html,/class="speedrun-list"/);
  assert.match(html,/목표 60초 이내 · 최대 보석 조각 10개 · 90초 제한/);
  assert.match(html,/1-1 · 여울길/);
  assert.match(html,/보상 8개 · 기록 65/);
  assert.match(html,/data-speedrun-claim="1"/);
  assert.match(html,/2-1 · .*잠김/);
  assert.equal([...html.matchAll(/data-speedrun-stage=/g)].length,20);
});


test('companion cards open upgrade details; detail refund preserves other companions and supports cancel',()=>{
  const c=harness(['openModal','renderGrowth','openUnitDetail','renderUnitDetail','showUnitRefund']);
  c.account.earlyGuide.phase='complete';
  c.account.owned.squirrel=true;
  c.account.levels.sheep=3;
  c.account.levels.squirrel=4;
  c.account.levelSpent.sheep=levelCost(1)+levelCost(2);
  c.account.levelSpent.squirrel=levelCost(1)+levelCost(2)+levelCost(3);
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
  c.account.daily.stages[1]={best:70,practice:null,claimed:false};
  c.showResult({won:true,time:70},{gold:0,diamonds:0});
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

test('gem guide links a free draw to all-owned-gem option selection and the next challenge mission',()=>{
 const c=harness(['actOnMission','openGemGuide','openGems','renderGems','openGemPicker','drawResourceGem','openGemDetail','renderGemDetail','commitGemEquip','settleProduction']);
 c.account.earlyGuide.phase='complete';c.account.highestCleared=11;c.account.missions.idleCompleted=true;
 c.account.missions.claimed=['idle-intro','idle-second','growth-intro',...Array.from({length:10},(_,i)=>`challenge-${i+2}`)];
 c.actOnMission();assert.ok(c.calls.some(call=>Array.isArray(call)&&call[1]==='gem-guide'));
 c.$('gem-guide-open').onclick();assert.match(c.$('modal-content').innerHTML,/1회 무료|숲의 보물/);
 const diamonds=c.account.diamonds;
 c.$('gem-free').onclick();assert.equal(c.account.gemItems.length,1);assert.equal(c.account.diamonds,diamonds);
 const uid=c.account.gemItems[0].uid;
 c.account.gemItems.push({uid:'other-type',type:'capacity',level:1,options:[]});
 c.openGems();assert.match(c.$('modal-content').innerHTML,/보유한 보석의 기본 효과는 항상 적용됩니다/);
 assert.match(c.$('modal-content').innerHTML,/추가옵션은 장착한 3개만 적용됩니다/);
 assert.equal(c.account.gemEquipment.income,undefined);
 c.$('modal-content:data-gem-option-pick:').onclick();
 assert.ok(c.calls.some(call=>Array.isArray(call)&&call[1]==='gem-picker'));
 assert.equal((c.$('modal-content').innerHTML.match(/data-gem-equip=/g)||[]).length,2);
 assert.equal(c.$('modal-content').innerHTML.includes('data-gem-equip="'+uid+'"'),true);
 c.$('modal-content:data-gem-equip:'+uid).onclick();assert.equal(c.account.gemEquipment.income,uid);
 assert.equal(c.account.gemGuide.equipped,true);
 assert.equal(currentMission(c.account).completed,true);
 c.actOnMission();assert.equal(currentMission(c.account).id,'challenge-12');
});
test('gem page shows every current type, hides unowned legacy types, and uses each owned type best level',()=>{
 const account=newAccount();
 let markup=gemPage(account);
 let typeGrid=markup.match(/<div class="gem-type-grid">([\s\S]*?)<\/div>/)[1];
 assert.equal((typeGrid.match(/class="gem-type-card/g)||[]).length,GEM_TYPES.filter(type=>!type.legacy).length);
 assert.doesNotMatch(typeGrid,/온기|풍요|용기/);
 assert.match(typeGrid,/미보유 · 효과 없음/);
 account.gemItems.push({uid:'legacy-hp',type:'hp',level:1,options:[]},{uid:'legacy-hp-best',type:'hp',level:4,options:[]});
 markup=gemPage(account);
 typeGrid=markup.match(/<div class="gem-type-grid">([\s\S]*?)<\/div>/)[1];
 assert.equal((typeGrid.match(/class="gem-type-card/g)||[]).length,GEM_TYPES.filter(type=>!type.legacy).length+1);
 assert.equal((typeGrid.match(/<strong>온기<\/strong>/g)||[]).length,1);
 assert.doesNotMatch(typeGrid,/<strong>(용기|풍요)<\/strong>/);
 assert.match(typeGrid,/최고 Lv\. 4/);
 assert.match(markup,/data-gem-uid="legacy-hp-best"/);
 assert.equal((markup.match(/class="gem-option-slot is-empty"/g)||[]).length,GEM_OPTION_LIMIT);
 assert.match(gemDetail(account,'legacy-hp'),/보유 기본 효과 · 최고 Lv\. 4/);
 assert.match(gemRateMarkup(),/일반 · 1줄 · 재설정 100 · 승급 10%/);
 assert.match(gemRateMarkup(),/레전더리 · 3줄 · 재설정 10,000 · 승급 0%/);
});
test('gem detail replaces the same type and offers direct unequip',()=>{
 const c=harness(['openGems','renderGems','openGemPicker','openGemDetail','renderGemDetail','commitGemEquip','settleProduction']);
 c.account.earlyGuide.phase='complete';c.account.highestCleared=11;
 c.account.gemItems=[{uid:'first',type:'income',level:1,options:[]},{uid:'second',type:'income',level:2,options:[]}];
 c.openGemDetail('first');assert.match(c.$('modal-content').innerHTML,/>추가옵션 장착<\/button>/);
 c.$('gem-equip').onclick();assert.equal(c.account.gemEquipment.income,'first');
 c.openGemDetail('second');assert.match(c.$('modal-content').innerHTML,/>같은 종류 교체<\/button>/);
 c.$('gem-equip').onclick();assert.equal(c.account.gemEquipment.income,'second');
 assert.equal(c.account.gemGuide.equipped,true);
 assert.equal(isGemEquipped(c.account,'first'),false);assert.equal(isGemEquipped(c.account,'second'),true);
 c.openGemDetail('second');assert.match(c.$('modal-content').innerHTML,/>추가옵션 해제<\/button>/);
 c.$('modal-content:data-detail-unequip:income').onclick();assert.equal(c.account.gemEquipment.income,undefined);
 assert.equal(isGemEquipped(c.account,'second'),false);
});
test('full additional-option slots replace one of the current three in one equip action',()=>{
 const c=harness(['openGems','renderGems','openGemPicker','openGemReplacePicker','commitGemEquip','settleProduction']);
 c.account.earlyGuide.phase='complete';c.account.highestCleared=11;c.account.gold=5000;
 c.account.gemItems=[
  {uid:'income-option',type:'income',level:1,options:[{id:'attack',value:.01}]},
  {uid:'capacity-option',type:'capacity',level:1,options:[{id:'hp',value:.01}]},
  {uid:'harvest-option',type:'harvest',level:1,options:[{id:'speed',value:.01}]},
  {uid:'bounty-option',type:'bounty',level:1,options:[{id:'wildAttack',value:.05}]},
 ];
 c.account.gemEquipment={income:'income-option',capacity:'capacity-option',harvest:'harvest-option'};
 c.openGemPicker();
 c.$('modal-content:data-gem-equip:bounty-option').onclick();
 assert.match(c.$('modal-content').innerHTML,/교체할 추가옵션 선택/);
 assert.equal((c.$('modal-content').innerHTML.match(/data-gem-replace-type=/g)||[]).length,3);
 c.$('modal-content:data-gem-replace-type:capacity').onclick();
 assert.deepEqual(c.account.gemEquipment,{income:'income-option',harvest:'harvest-option',bounty:'bounty-option'});
 assert.equal(equippedGemItems(c.account).length,3);
 assert.ok(c.calls.some(call=>call==='save'));
});
test('gem reroll cancellation is free, confirmation charges once, and an unaffordable attempt can retry',()=>{
 const c=harness(['openGemDetail','renderGemDetail','showGemReroll','settleProduction']);
 c.account.earlyGuide.phase='complete';c.account.highestCleared=11;c.account.gold=100;
 c.account.gemItems=[{uid:'reroll',type:'income',level:1,optionTier:'normal',options:[{id:'attack',value:.01}]}];
 c.settleProduction=()=>{};
 c.rerollGem=(account,uid)=>rerollGem(account,uid,{random:()=>.99});
 const original=JSON.stringify(c.account.gemItems[0]);
 c.openGemDetail('reroll');c.$('gem-reroll').onclick();
 assert.match(c.$('modal-content').innerHTML,/도토리 100개/);
 assert.match(c.$('modal-content').innerHTML,/승급 확률은 10%/);
 c.$('gem-reroll-cancel').onclick();
 assert.equal(c.account.gold,100);assert.equal(JSON.stringify(c.account.gemItems[0]),original);
 c.openGemDetail('reroll');c.$('gem-reroll').onclick();
 c.account.gold=0;
 const confirm=c.$('gem-reroll-confirm');confirm.onclick();
 assert.equal(c.account.gold,0);assert.equal(JSON.stringify(c.account.gemItems[0]),original);
 c.account.gold=100;confirm.onclick();
 assert.equal(c.account.gold,0);
 assert.equal(c.account.gemItems[0].options[0].id,'acorn');
 assert.equal(c.account.gemItems[0].options[0].value,.03);
 confirm.onclick();assert.equal(c.account.gold,0);
});
test('hosted gem swap and reroll use the authoritative command routes without changing battle snapshots',async()=>{
 const c=harness(['openGemDetail','renderGemDetail','openGemReplacePicker','commitGemEquip','showGemReroll']);
 c.hostedMode=true;c.account.earlyGuide.phase='complete';c.account.highestCleared=11;
 c.account.gemItems=[
  {uid:'income-option',type:'income',level:1,options:[{id:'attack',value:.01}]},
  {uid:'capacity-option',type:'capacity',level:1,options:[{id:'hp',value:.01}]},
  {uid:'harvest-option',type:'harvest',level:1,options:[{id:'speed',value:.01}]},
  {uid:'bounty-option',type:'bounty',level:1,options:[{id:'wildAttack',value:.05}]},
 ];
 c.account.gemEquipment={income:'income-option',capacity:'capacity-option',harvest:'harvest-option'};
 c.battleSnapshot={stageId:2,gemEffects:{attack:1.1},marker:'preserved'};
 const snapshot=JSON.stringify(c.battleSnapshot),commands=[];
 c.sendCommand=async(type,args)=>{commands.push({type,args});return {result:true};};
 c.openGemDetail('bounty-option');c.$('gem-equip').onclick();
 c.$('modal-content:data-gem-replace-type:capacity').onclick();
 await Promise.resolve();
 assert.deepEqual(JSON.parse(JSON.stringify(commands[0])),{type:'gem.equip',args:{uid:'bounty-option',replaceType:'capacity'}});
 assert.equal(commands.some(command=>command.type==='gem.unequip'),false);
 c.openGemDetail('income-option');c.$('gem-reroll').onclick();c.$('gem-reroll-confirm').onclick();
 await Promise.resolve();
 assert.deepEqual(JSON.parse(JSON.stringify(commands[1])),{type:'gem.reroll',args:{uid:'income-option'}});
 assert.equal(JSON.stringify(c.battleSnapshot),snapshot);
});
test('gem material picker shows options and consumes only the chosen eligible copy',()=>{
 const c=harness(['showGemUpgrade','openGemDetail','renderGemDetail','settleProduction']);
 c.account.earlyGuide.phase='complete';c.account.highestCleared=11;c.account.gold=5000;
 c.account.gemItems=[{uid:'target',type:'income',level:1,options:[]},{uid:'poor',type:'income',level:1,options:[{id:'hp',value:.01}]},{uid:'keep',type:'income',level:1,options:[{id:'attack',value:.03}]}];
 c.showGemUpgrade('target');assert.match(c.$('modal-content').innerHTML,/공격력 \+3%/);
 c.$('modal-content:data-gem-material:poor').onclick();c.$('gem-upgrade-confirm').onclick();
 assert.equal(gemByUid(c.account,'poor'),null);assert.ok(gemByUid(c.account,'keep'));
 assert.equal(gemByUid(c.account,'target').level,2);assert.equal(c.account.gold,4700);
});
test('return summary is informational, clears its pending receipt and leaves idle simulation running',()=>{
 const c=harness(['openModal','showReturnIncome','closeIdleResult','frame']);
 c.pendingReturnIncome={from:Date.now()-3600000,gold:2400,diamonds:.5,awaySeconds:3600,seconds:3600,capped:false};
 const before=JSON.stringify(c.account);
 c.showReturnIncome();assert.equal(c.pendingReturnIncome,null);
 assert.equal(c.$('modal-backdrop').hidden,false);
 assert.match(c.$('modal-content').innerHTML,/1시간 0분|2,?400/);
 assert.equal(JSON.stringify(c.account),before);
 c.battle={time:0,finished:false,events:[]};c.frame(3200);assert.ok(c.calls.includes('step'));
 c.$('return-income-confirm').onclick();assert.ok(c.calls.includes('close-modal'));
 assert.equal(JSON.stringify(c.account),before);
});
test('numbered lineup drafts keep unit selections and expose no gem controls',()=>{
 const c=harness(['openSequence','renderSequence']);
 c.account.earlyGuide.phase='complete';c.account.highestCleared=11;c.account.owned.squirrel=true;
 c.openSequence();c.$('modal-content:data-lineup-index:3').onclick();
 assert.equal((c.$('modal-content').innerHTML.match(/data-lineup-index=/g)||[]).length,10);
 assert.doesNotMatch(c.$('modal-content').innerHTML,/gemPreset|gem-preset|sequence-gem|보석 프리셋/);
 c.$('modal-content:data-replace:1').onclick();c.$('modal-content:data-pick:squirrel').onclick();
 c.$('modal-content:data-lineup-index:0').onclick();assert.equal(c.sequenceDraft[1],null);
 c.$('modal-content:data-lineup-index:3').onclick();assert.equal(c.sequenceDraft[1],'squirrel');
 c.$('apply-sequence').onclick();assert.equal(c.account.activeLineup.idle,3);
 assert.equal(sequenceForMode(c.account,'idle')[1],'squirrel');
 assert.equal(c.account.activeLineup.challenge,0);
 assert.equal(sequenceForMode(c.account,'idle',0)[1],null);
});

test('first idle mission blocks challenge until its reward is claimed', () => {
  const c = harness(['startChallenge','settleProduction','closeIdleResult','actOnMission']);
  const before = JSON.stringify(c.account);
  c.startChallenge(2);
  assert.equal(c.mode,'idle'); assert.ok(!c.calls.includes('start'));
  assert.equal(JSON.stringify(c.account),before);
  c.account.missions.idleCompleted = true;
  c.startChallenge(2);
  assert.equal(c.mode,'idle'); assert.ok(!c.calls.includes('start'));
  c.actOnMission(); c.startChallenge(2);
  assert.equal(c.mode,'challenge'); assert.equal(c.stageId,2);
  assert.equal(c.calls.filter(x=>x==='start').length,1);
});
test('manual battle menu contains only settings, idle retains its content menu', () => {
  const c = harness(['renderMenu']);
  c.mode='challenge'; c.renderMenu();
  const html=c.$('modal-content').innerHTML;
  assert.deepEqual([...html.matchAll(/data-content-menu="([^"]+)"/g)].map(m=>m[1]),['settings']);
  c.mode='speedrun'; c.renderMenu();
  assert.deepEqual([...c.$('modal-content').innerHTML.matchAll(/data-content-menu="([^"]+)"/g)].map(m=>m[1]),['settings']);
  c.mode='idle'; c.renderMenu();
  assert.match(c.$('modal-content').innerHTML,/data-content-menu="growth"/);
});
test('leave battle confirmation cancels safely and exits without recording a victory', () => {
  const c = harness(['leaveBattle','setMode','settleProduction','closeIdleResult']);
  c.account.missions.claimed=['idle-intro']; c.account.earlyGuide.phase='complete';
  c.mode='challenge'; c.stageId=3; c.battle={time:25,finished:false,events:[]};
  const progress=JSON.stringify({cleared:c.account.highestCleared,records:c.account.records,missions:c.account.missions});
  const battle=c.battle;
  c.leaveBattle(); c.$('cancel-leave').onclick();
  assert.equal(c.battle,battle); assert.equal(c.mode,'challenge');
  c.leaveBattle(); c.$('confirm-leave').onclick();
  assert.equal(c.mode,'idle'); assert.equal(c.stageId,c.account.idleStage);
  assert.equal(JSON.stringify({cleared:c.account.highestCleared,records:c.account.records,missions:c.account.missions}),progress);
  c.account.onboarding.phase='intro'; c.mode='challenge'; c.battle={time:3,finished:false};
  c.leaveBattle(); c.$('confirm-leave').onclick();
  assert.equal(c.account.onboarding.phase,'intro'); assert.ok(c.calls.includes('ready'));
});
test('editing sequence during manual combat preserves the current snapshot until next battle', () => {
  const c = harness(['openSequence','renderSequence','handUnits']);
  c.account.earlyGuide.phase='complete'; c.account.missions.claimed=['idle-intro'];
  c.account.owned.squirrel=true; c.account.sequencePresets.challenge=['sheep','squirrel',...Array(8).fill(null)];
  c.unitById=Object.fromEntries(UNITS.map(u=>[u.id,u]));
  c.mode='challenge'; c.battle={time:25,finished:false};
  c.battleSnapshot.sequence=['sheep','squirrel',...Array(8).fill(null)];
  const battle=c.battle;
  const startBattle=c.startBattle;
  c.startBattle=()=>{startBattle();c.battleSnapshot.sequence=sequenceForMode(c.account,'challenge');};
  c.openSequence(); c.$('modal-content:data-replace:1').onclick(); c.$('clear-sequence-slot').onclick();
  c.$('apply-sequence').onclick();
  assert.equal(sequenceForMode(c.account,'challenge')[1],null);
  assert.equal(c.battle,battle); assert.ok(!c.calls.includes('start'));
  assert.equal(c.handUnits()[1],'squirrel');
});
test('growth list shows the five purchased-level leaders and shared level above all companions', () => {
  const c = harness(['renderGrowth']);
  c.account.earlyGuide.phase='complete';
  const ids=UNITS.slice(0,6).map(u=>u.id);
  for(const id of ids)c.account.owned[id]=true;
  for(const [i,id] of ids.entries())c.account.levels[id]=i<5?6+i:1;
  c.renderGrowth();
  const html=c.$('modal-content').innerHTML;
  assert.ok(html.indexOf('level-basis')<html.indexOf('unit-grid'));
  assert.match(html,/공유 Lv\. 6/);
  const basis=html.slice(0,html.indexOf('unit-grid'));
  assert.equal([...basis.matchAll(/data-companion=/g)].length,5);
  assert.ok(!basis.includes(`data-companion="${ids[5]}"`));
  assert.equal(effectiveUnitLevel(c.account,ids[5]),6);
});

test('modal back restores each depth, scroll and root opener without repeating actions', () => {
  const c = harness(['openModal', 'closeModal']);
  c.account.earlyGuide.phase = 'complete';
  let opened = 0, renders = 0;
  c.document.activeElement = {focus(){opened++;}};
  const list = () => { c.$('modal-content').innerHTML = 'list'; renders++; };
  c.openModal('동료', 'growth', list);
  c.$('modal-content').scrollTop = 123;
  c.document.activeElement = {id:'selected-companion'};
  c.openModal('양 방패', 'companion', () => {c.$('modal-content').innerHTML = 'detail';});
  c.$('companion-abilities').scrollTop = 94;
  c.openModal('초기화', 'refund', () => {c.$('modal-content').innerHTML = 'confirmation';});
  assert.equal(c.modalHistory.length, 3);
  assert.equal(c.$('back-modal').hidden, false);
  assert.equal(c.backModal(), true);
  assert.equal(c.modalKind, 'companion');
  assert.equal(c.$('companion-abilities').scrollTop, 94);
  c.returnModal('동료', 'growth', list);
  assert.equal(c.modalHistory.length, 1);
  assert.equal(c.$('modal-content').scrollTop, 123);
  assert.equal(c.$('back-modal').hidden, true);
  assert.equal(c.backModal(), false);
  assert.equal(renders, 2);
  c.closeModal();
  assert.equal(c.modalHistory.length, 0);
  assert.equal(opened, 1);
  c.openModal('설정', 'settings', () => {});
  assert.equal(c.modalHistory.length, 1);
});
test('same-kind details and sibling replacement preserve only the actual parent', () => {
  const c = harness(['openModal', 'closeModal']);
  c.openModal('도감', 'codex', () => {c.$('modal-content').innerHTML='collection';});
  c.openModal('도감', 'codex', () => {c.$('modal-content').innerHTML='sheep';});
  c.openModal('도감', 'codex', () => {c.$('modal-content').innerHTML='squirrel';}, {navigation:'replace'});
  assert.equal(c.modalHistory.length, 2);
  c.backModal();
  assert.equal(c.$('modal-content').innerHTML, 'collection');
  c.openModal('모집', 'onboarding', () => {});
  assert.equal(c.modalHistory.length, 1);
  assert.equal(c.$('back-modal').hidden, true);
  assert.equal(c.backModal(), false);
  c.closeModal();
  assert.equal(c.$('modal-backdrop').hidden, false);
  c.closeModal(true);
  assert.equal(c.modalHistory.length, 0);
});
test('back from a lineup picker preserves the content, preset and unsaved draft', () => {
  const c = harness(['openModal', 'openSequence', 'renderSequence']);
  c.account.earlyGuide.phase = 'complete';
  c.account.owned.rabbit = true;
  c.openSequence('challenge');
  c.$('modal-content:data-lineup-index:3').onclick();
  c.sequenceDraft[0] = 'rabbit';
  c.$('modal-content:data-replace:0').onclick();
  assert.equal(c.modalKind,'sequence-pick');
  c.backModal();
  assert.equal(c.modalKind,'sequence');
  assert.equal(c.sequenceDraftMode,'challenge');
  assert.equal(c.sequenceDraftIndex,3);
  assert.equal(c.sequenceDraft[0],'rabbit');
  assert.equal(c.account.activeLineup.challenge,0);
});

test('companion details expose only the optional abilities assigned to that unit', () => {
  const c=harness(['openModal','openUnitDetail','renderUnitDetail']);
  c.account.earlyGuide.phase='complete';c.account.highestCleared=10;
  c.account.owned.rabbit=true;c.account.owned.whale=true;
  c.openUnitDetail('sheep');
  assert.doesNotMatch(c.$('modal-content').innerHTML,/data-ability="(?:move|range)"/);
  for(const id of ['hp','attack','counter']) assert.ok(c.$('modal-content').innerHTML.includes(`data-ability="${id}"`));
  c.openUnitDetail('rabbit');
  assert.match(c.$('modal-content').innerHTML,/data-ability="move"/);
  assert.doesNotMatch(c.$('modal-content').innerHTML,/data-ability="range"/);
  c.openUnitDetail('whale');
  assert.match(c.$('modal-content').innerHTML,/data-ability="range"/);
  assert.doesNotMatch(c.$('modal-content').innerHTML,/data-ability="move"/);
});

test('companion effect list shows each owned best-level basic once and only equipped options',()=>{
 const account=newAccount();account.owned.squirrel=true;
 account.gemItems=[
  {uid:'income-low',type:'income',level:1,options:[{id:'attack',value:.01}]},
  {uid:'income-best',type:'income',level:4,options:[{id:'hp',value:.02}]},
  {uid:'capacity-equipped',type:'capacity',level:2,options:[{id:'speed',value:.03}]},
 ];
 account.gemEquipment={income:'income-low',capacity:'capacity-equipped'};
 const markup=companionPanel(account,'squirrel');
 assert.equal((markup.match(/햇살 Lv\. 4/g)||[]).length,1);
 assert.equal((markup.match(/햇살 · 추가옵션 공격력 \+1%/g)||[]).length,1);
 assert.match(markup,/주머니 · 추가옵션 이동속도 \+3%/);
 assert.doesNotMatch(markup,/햇살 · 추가옵션 체력 \+2%/);
});

test('account choices remain available from settings during the first tutorial', () => {
  const c = harness(['openModal']);
  c.account.onboarding.phase = 'intro';
  c.openModal('설정', 'settings', () => {});
  c.openModal('게스트로 시작', 'guest-choice', () => {}, { layout: 'message' });
  assert.equal(c.$('modal-backdrop').dataset.kind, 'guest-choice');
  assert.equal(c.$('modal-backdrop').dataset.layout, 'message');
  assert.equal(c.backModal(), true);
  assert.equal(c.$('modal-backdrop').dataset.kind, 'settings');
  c.openModal('기존 계정', 'account-choice', () => {}, { layout: 'message' });
  assert.equal(c.$('modal-backdrop').dataset.kind, 'account-choice');
  assert.equal(c.backModal(), true);
});

test('entry waits for a guest choice or a verified Sites account choice', async () => {
  const c = harness(['chooseCloudEntry']);
  c.entryPanel = entryPanel;
  c.ensureCloudGate = () => c.$('entry');
  c.$('entry').style = {};
  c.sitesSignedIn = false;
  let chosen = false;
  const guest = c.chooseCloudEntry().then(value => { chosen = true; return value; });
  let prevented = false;
  c.$('entry:#entry-account').onclick({ preventDefault() { prevented = true; } });
  await Promise.resolve();
  assert.equal(chosen, false);
  assert.equal(prevented, false); // An anonymous visitor follows the normal sign-in anchor.
  c.$('entry:#entry-guest').onclick();
  assert.equal(await guest, 'guest');
  c.sitesSignedIn = true;
  const account = c.chooseCloudEntry();
  c.$('entry:#entry-account').onclick({ preventDefault() { prevented = true; } });
  assert.equal(await account, 'account');
  assert.equal(prevented, true);
});

test('Sites sign-in keeps account login and guest linking distinct on return', () => {
  for (const action of ['account', 'link']) {
    const signIn = new URL(signInPath(action), 'https://game.test');
    assert.equal(signIn.pathname, '/signin-with-chatgpt');
    const returnTo = signIn.searchParams.get('return_to');
    assert.equal(signInIntent(new URL(returnTo, signIn.origin).href), action);
  }
  assert.equal(signInIntent('https://game.test/?login=https://elsewhere.test'), null);
  assert.match(entryPanel(), /target="_top"/);
});

test('settings distinguish guest login state and safely display the signed-in account', () => {
  assert.match(accountIdentityPanel({ kind: 'guest', email: 'hidden@test.invalid' }), /로그인 안 됨/);
  assert.doesNotMatch(accountIdentityPanel({ kind: 'guest', email: 'hidden@test.invalid' }), /hidden/);
  const panel = accountIdentityPanel({ kind: 'account', displayName: '<img src=x>', email: 'player@test.invalid' });
  assert.match(panel, /로그인됨/);
  assert.match(panel, /player@test.invalid/);
  assert.match(panel, /&lt;img src=x&gt;/);
  assert.doesNotMatch(panel, /<img/);
});

test('only a server-admin identity exposes the menu and dispatches repeatable grants', async () => {
  const c=harness(['renderMenu','renderAdmin']);
  c.hostedMode=true; c.cloudIdentity={kind:'guest'}; c.mode='challenge';
  c.renderMenu();
  assert.doesNotMatch(c.$('modal-content').innerHTML,/data-content-menu="admin"/);
  c.cloudIdentity={kind:'test',isAdmin:true,displayName:'root'};
  c.renderMenu();
  assert.match(c.$('modal-content').innerHTML,/data-content-menu="admin"/);
  c.modalKind='admin';
  c.sendCommand=async(type,args)=>{
    c.calls.push({type,args});
    c.account[args.currency]+=args.amount;
    return {account:c.account};
  };
  c.renderAdmin();
  const button=c.$('modal-content:data-admin-grant:gold');
  await button.onclick();
  assert.equal(c.account.gold,10600);
  // Rendering replaces DOM buttons after a successful server response.
  button.disabled=false;
  await button.onclick();
  assert.equal(c.account.gold,20600);
  assert.deepEqual(JSON.parse(JSON.stringify(c.calls.filter(call=>call.type==='admin.grant'))),[
    {type:'admin.grant',args:{currency:'gold',amount:10000}},
    {type:'admin.grant',args:{currency:'gold',amount:10000}},
  ]);
  assert.match(accountIdentityPanel(c.cloudIdentity),/root/);
});

test('test login clears the password field and shows authentication errors in its form', async () => {
  const c=harness([]), root=c.$('test');
  root.innerHTML=testLoginPanel();
  c.$('test:#test-username').value=' root ';
  c.$('test:#test-password').value='wrong';
  let credentials;
  bindTestLogin(root,{async startTestSession(username,password){credentials={username,password};throw {payload:{error:'invalid_credentials'},status:401};}},
    {onSuccess(){throw Error('Unexpected login');},onCancel(){}});
  await c.$('test:#test-login-form').onsubmit({preventDefault(){}});
  assert.deepEqual(credentials,{username:'root',password:'wrong'});
  assert.equal(c.$('test:#test-password').value,'');
  assert.match(c.$('test:#test-login-error').textContent,/비밀번호/);
  assert.equal(c.$('test:#submit-test-login').disabled,false);
});


test('speedrun stage information stays independent of the first-battle and rabbit guides',()=>{
  const c=harness(['currentStage']);
  c.mode='speedrun'; c.stageId=2;
  c.account.onboarding.phase='first-battle';
  c.account.earlyGuide.phase='rabbit-battle';
  c.onboardingEncounter=()=>({name:'첫 전투'});
  c.earlyGuideEncounter=()=>({name:'토끼 안내'});
  assert.equal(c.currentStage().name, SPEEDRUN_STAGES[1].name);
  assert.equal(c.currentStage().enemyHp, SPEEDRUN_STAGES[1].enemyHp);
});

test('rotation button requests fullscreen from the click before locking landscape and releases on exit', async () => {
  const calls = [], button = { disabled: false }, status = { textContent: '' }, listeners = {};
  const doc = {
    fullscreenElement: null,
    getElementById: id => id === 'rotate-fullscreen' ? button : status,
    addEventListener: (event, callback) => listeners[event] = callback,
    documentElement: { requestFullscreen: async () => { calls.push('fullscreen'); doc.fullscreenElement = doc.documentElement; } },
  };
  const orientation = { lock: async value => calls.push(value), unlock: () => calls.push('unlock') };
  bindRotationPrompt(doc, orientation);
  const pending = button.onclick();
  assert.equal(button.disabled, true);
  assert.deepEqual(calls, ['fullscreen']);
  await pending;
  assert.deepEqual(calls, ['fullscreen', 'landscape']);
  assert.equal(status.textContent, '');
  assert.equal(button.disabled, false);
  doc.fullscreenElement = null;
  listeners.fullscreenchange();
  assert.equal(button.textContent, '전체 화면');
  assert.deepEqual(calls, ['fullscreen', 'landscape', 'unlock']);
});

test('rotation failures explain manual rotation and leave successful fullscreen intact', async () => {
  const doc = { fullscreenElement: null, documentElement: {} };
  const orientation = { lock: async () => { throw new Error('unsupported'); } };
  const unsupported = await enterLandscapeFullscreen(doc, orientation);
  assert.equal(unsupported.fullscreen, false);
  assert.match(unsupported.message, /지원하지/);
  let calls = 0;
  doc.documentElement.requestFullscreen = async () => { calls++; throw new Error('denied'); };
  const denied = await enterLandscapeFullscreen(doc, { lock: () => { throw new Error('must not lock'); } });
  assert.equal(denied.fullscreen, false);
  assert.match(denied.message, /다시/);
  doc.documentElement.requestFullscreen = async () => { calls++; doc.fullscreenElement = doc.documentElement; };
  const fullscreenOnly = await enterLandscapeFullscreen(doc, orientation);
  assert.equal(fullscreenOnly.fullscreen, true);
  assert.equal(fullscreenOnly.landscapeLocked, false);
  assert.match(fullscreenOnly.message, /회전 잠금/);
  const alreadyFullscreen = await enterLandscapeFullscreen(doc, undefined);
  assert.equal(alreadyFullscreen.fullscreen, true);
  assert.equal(calls, 2);
});

test('rotation button displays unavailable feedback and allows retry', async () => {
  const button = {}, status = {}, doc = {
    documentElement: {},
    getElementById: id => id === 'rotate-fullscreen' ? button : status,
    addEventListener() {},
  };
  bindRotationPrompt(doc);
  await button.onclick();
  assert.match(status.textContent, /기기를 가로/);
  assert.equal(button.disabled, false);
});

test('fullscreen exit during a pending orientation lock cannot leave the screen locked', async () => {
  let finishLock, unlocked = 0;
  const doc = { fullscreenElement: {}, documentElement: {} };
  const pending = enterLandscapeFullscreen(doc, { lock: () => new Promise(resolve => finishLock = resolve), unlock: () => unlocked++ });
  doc.fullscreenElement = null;
  finishLock();
  const result = await pending;
  assert.equal(result.fullscreen, false);
  assert.equal(unlocked, 1);
});
