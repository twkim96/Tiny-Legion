import { pathToFileURL } from 'node:url';
import { UNITS } from '../dist/src/data.js';
import { createBattle, stepBattle, summonUnit, fireCannon } from '../dist/src/engine.js';
import * as account from '../dist/src/account.js';
import { startBattle, finishBattle } from '../server/battle.js';

export const ROSTER = ['sheep', 'squirrel', 'rabbit', 'fox', 'chick'];
export const TACTICS = {
  balanced: ['sheep', 'squirrel', 'rabbit'],
  screen: ['sheep', 'squirrel'], rush: ['sheep', 'rabbit'],
  ranged: ['squirrel'], raiders: ['rabbit'], shield: ['sheep'],
  all: ROSTER, duel: ['sheep', 'fox', 'rabbit'],
  fire: ['sheep', 'chick', 'fox', 'rabbit'],
  vanguard: ['sheep', 'sheep', 'fox', 'rabbit'],
  marksman: ['sheep', 'squirrel', 'fox', 'rabbit'],
  rear: ['sheep', 'squirrel', 'squirrel', 'rabbit'],
  raiderfox: ['fox', 'rabbit'],
};
// Reproduction inputs, not game rules. Order: shield / seeds / raider / fox / bomb.
export const REFERENCE = {
  3: { levels: [3,3,3,1,1], tactic: 'balanced', cannon: 8 },
  4: { levels: [4,4,3,4,1], tactic: 'marksman', cannon: 16 },
  5: { levels: [1,2,8,5,2], tactic: 'raiderfox', cannon: 16 },
  6: { levels: [4,8,7,2,2], tactic: 'rear', cannon: 16 },
  7: { levels: [1,1,3,10,8], tactic: 'fire', cannon: 23 },
  8: { levels: [2,13,2,5,1], tactic: 'marksman', cannon: 16 },
  9: { levels: [2,1,3,7,14], tactic: 'fire', cannon: 8 },
  10: { levels: [1,1,14,11,3], tactic: 'raiderfox', cannon: 8 },
};
export function simulate(options, { tactic = 'balanced', cannon = 8, interval = 1, delay = 0 } = {}) {
  const lineup = Array.isArray(tactic) ? tactic : TACTICS[tactic];
  const state = createBattle(options), actions = [], bosses = new Map();
  let next = delay, index = 0, nextCannon = cannon, tick = 0;
  while (!state.finished) {
    if (state.mode === 'challenge' && state.time + 1e-8 >= next) {
      const id = lineup[index];
      if (summonUnit(state, id)) { actions.push({type:'summon',id,step:tick}); index = (index + 1) % lineup.length; }
      next = state.time + interval;
    }
    if (state.mode === 'challenge' && cannon !== null && state.time + 1e-8 >= nextCannon && fireCannon(state)) {
      actions.push({type:'cannon',step:tick}); nextCannon = state.time + 25;
    }
    stepBattle(state, 1 / 30); tick++;
    for (const unit of state.units) if (unit.team === "enemy" && unit.boss) bosses.set(unit.uid,unit);
  }
  return {state, actions, bosses:[...bosses.values()]};
}
export function introduction() {
  const a = account.newAccount(0);
  account.advanceOnboardingBattle(a, true);
  account.advanceOnboardingBattle(a, false);
  account.recruitOnboardingCompanion(a);
  account.advanceOnboardingBattle(a, true);
  account.finishOnboarding(a);
  account.recordMissionBattle(a, {mode:'idle',stageId:1,won:true}); account.claimMission(a);
  account.recordMissionBattle(a, {mode:'challenge',stageId:2,won:false}); account.recruitEarlyRabbit(a);
  account.completeChallenge(a,2); account.recordMissionBattle(a,{mode:'challenge',stageId:2,won:true}); account.claimMission(a);
  account.recordMissionBattle(a,{mode:'idle',stageId:2,won:false});
  account.setSequence(a,['sheep','squirrel',...Array(8).fill(null)],'idle');
  account.recordMissionBattle(a,{mode:'idle',stageId:2,won:true}); account.claimMission(a);
  if (!account.growUnit(a,'sheep')) throw Error('Guide growth unavailable');
  account.claimMission(a);
  // Deliberately keep records empty: even production during play is excluded.
  return a;
}
export function reallocate(a, levels) {
  for (const id of ROSTER) if (a.owned[id]) account.refundUnitLevels(a,id,0);
  for (const [index,id] of ROSTER.entries()) {
    const target = levels[index] ?? 1;
    if (!a.owned[id] && target > 1) throw Error(`Unowned investment: ${id}`);
    while (a.owned[id] && a.levels[id] < target) if (!account.growUnit(a,id)) throw Error(`Budget exceeded: ${id} to ${target}`);
  }
}
export function optionsFor(a, stageId, mode='challenge') {
  return {stageId,mode,levels:account.battleLevels(a),abilities:a.abilities,
    modifiers:account.gemModifiers(a,mode),ownedUnits:UNITS.filter(u=>account.canUseUnit(a,u.id)).map(u=>u.id),
    sequence:mode==='idle'?TACTICS.screen:[]};
}
export function growEvenly(a, units) {
  for (let pass=0;pass<100;pass++) for (const id of units) account.growUnit(a,id);
}
export function idleAlternatives(source, stageId, seconds=300) {
  const a=structuredClone(source);
  for (const id of ROSTER) account.refundUnitLevels(a,id,0);
  growEvenly(a,['sheep','squirrel','rabbit']);
  let best=null;
  for (let stage=1;stage<stageId;stage++) for (const tactic of ['screen','rear','duel','fire','raiderfox']) {
    const options=optionsFor(a,stage,'idle'); options.sequence=TACTICS[tactic];
    const {state}=simulate(options), rate=state.result.reward/state.duration;
    if (!best || rate>best.rate) best={stage,options,state,rate};
  }
  a.idleStage=best.stage;
  account.recordIdle(a,best.state.result,{stageId:best.stage,duration:best.state.duration,levels:best.options.levels},0);
  const earned=account.accrue(a,seconds*1000).gold;
  const wins=[];
  for (const [units,tactic] of [[['fox','rabbit'],'raiderfox'],[['sheep','squirrel','rabbit'],'rear']]) {
    const alternative=structuredClone(a);
    for (const id of ROSTER) account.refundUnitLevels(alternative,id,seconds*1000);
    growEvenly(alternative,units);
    const {state}=simulate(optionsFor(alternative,stageId),{tactic});
    if (state.result.won) wins.push({tactic,time:Number(state.time.toFixed(2)),levels:ROSTER.map(id=>alternative.levels[id])});
  }
  return {productionStage:best.stage,seconds,earned,wins};
}
export function runCampaign({ verifyServer = false, onStage = () => {} } = {}) {
  const a = introduction(), report = [];
  for (let stageId=3;stageId<=10;stageId++) {
    const plan = REFERENCE[stageId];
    const budget = a.gold + Object.values(a.levelSpent).reduce((n,value)=>n+value,0);
    reallocate(a,plan.levels);
    const options = optionsFor(a,stageId);
    const {state,actions,bosses} = simulate(options,plan);
    if (!state.result.won) throw Error(`Reference lost at 1-${stageId}`);
    const row = {stage:stageId,budget,spent:budget-a.gold,remaining:a.gold,levels:plan.levels,
      tactic:plan.tactic,cannon:plan.cannon,time:Number(state.time.toFixed(2))};
    onStage(a,row,options,{state,actions,bosses});
    if (verifyServer) {
      const run=startBattle(a,{mode:'challenge',stageId},0);
      const result=finishBattle(a,run,{battleId:run.battleId,actions},Math.ceil(state.time*1000));
      if (!result.battleResult.won) throw Error('Server replay lost');
    } else account.completeChallenge(a,stageId);
    account.claimMission(a);
    for (const mail of account.mailboxEntries(a)) if (!mail.claimed) account.claimMail(a,mail.id);
    report.push(row);
  }
  return {account:a,report};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const {report}=runCampaign({verifyServer:true});
  console.table(report.map(({stage,budget,spent,remaining,levels,tactic,cannon,time})=>({stage:`1-${stage}`,budget,spent,remaining,levels:levels.join('/'),tactic,cannon,time})));
}
