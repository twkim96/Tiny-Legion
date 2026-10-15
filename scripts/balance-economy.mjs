import { pathToFileURL } from 'node:url';
import { runCampaign, simulate, ROSTER, optionsFor } from './balance-region-one.mjs';
import * as account from '../dist/src/account.js';
import { idleFullReward, levelUpgradeCost, hasStageMission, stageMissionReward } from '../dist/src/economy.js';

export const LONG_TERM = { days:90, dailyHours:24, startStage:11, endStage:191, targetLevel:100, companions:5 };
export function lowestFirst(a) {
  let upgrades=0;
  for (;;) {
    const id=ROSTER.toSorted((left,right)=>a.levels[left]-a.levels[right])[0];
    if (!account.growUnit(a,id)) break;
    upgrades++;
  }
  return {levels:ROSTER.map(id=>a.levels[id]),mean:ROSTER.reduce((sum,id)=>sum+a.levels[id],0)/ROSTER.length,upgrades};
}
export function overnight(hours=8) {
  const {account:a}=runCampaign();
  const challenge=simulate(optionsFor(a,11),{tactic:'raiderfox'}).state;
  if (!challenge.result.won) throw Error('2-1 reference lost');
  account.completeChallenge(a,11); account.claimMission(a);
  const before=ROSTER.map(id=>a.levels[id]),startGold=a.gold;
  const options=optionsFor(a,11,'idle');
  const {state}=simulate(options);
  a.idleStage=11;
  account.recordIdle(a,state.result,{stageId:11,duration:state.duration,levels:options.levels,gemEffects:options.modifiers},0);
  const income=account.accrue(a,hours*3600000);
  return {before,startGold,income,record:a.records[11],...lowestFirst(a),remaining:a.gold};
}
export function cumulativeLevelCost(level) {
  let cost=0;
  for (let current=1;current<level;current++) cost+=levelUpgradeCost(current);
  return cost;
}
// This is an economic projection: region 3+ encounters and unlock rewards do not exist yet.
// Every scenario traverses the SAME stages by its last day; faster clears earn rewards sooner.
export function projectProgression({days=LONG_TERM.days,missions=false,dailyHours=LONG_TERM.dailyHours}={}) {
  const levels=Array(5).fill(1),rows=[];
  let gold=0,idleTotal=0,missionTotal=0,lastStage=10;
  for(let day=1;day<=days;day++) {
    const stageId=LONG_TERM.startStage+Math.floor((LONG_TERM.endStage-LONG_TERM.startStage)*(day-1)/(days-1));
    // Daily production includes multiple settlements within the 12-hour limit.
    const idle=idleFullReward(stageId)*Math.max(0,Math.min(24,dailyHours))*3600/90;
    let reward=0;
    if(missions) for(let stage=lastStage+1;stage<=stageId;stage++) if(hasStageMission(stage)) reward+=stageMissionReward(stage).gold;
    lastStage=stageId;
    idleTotal+=idle; missionTotal+=reward; gold+=idle+reward;
    for(;;){
      const index=levels.indexOf(Math.min(...levels));
      if(levels[index]>=100||gold<levelUpgradeCost(levels[index]))break;
      gold-=levelUpgradeCost(levels[index]);levels[index]++;
    }
    rows.push({day,stageId,idle,reward,levels:[...levels],mean:levels.reduce((a,b)=>a+b)/5,remaining:gold});
  }
  return {days,missions,idleTotal,missionTotal,total:idleTotal+missionTotal,levels,mean:levels.reduce((a,b)=>a+b)/5,
    maxDay:rows.find(row=>row.levels.every(level=>level===100))?.day??null,rows};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  console.log('Overnight',JSON.stringify(overnight()));
  console.table([30,60,90].flatMap(days=>[false,true].map(missions=>{
    const result=projectProgression({days,missions});
    return {days,missions,total:Math.round(result.total),average:result.mean,maxDay:result.maxDay};
  })));
  console.table([1,5,10,15,20,30,50,75,90,99].map(level=>({level,cost:levelUpgradeCost(level)})));
  console.log('five companions to 100',cumulativeLevelCost(100)*5);
}
