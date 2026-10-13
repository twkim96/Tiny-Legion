// Run from repository root: node unity/Tests/Combat/generate-parity.mjs <fixture.json>
// This uses the existing JS implementation as the oracle; no fixtures are tracked.
import fs from 'node:fs';
import { createBattle, stepBattle, summonUnit, fireCannon } from '../../../dist/src/engine.js';
import { UNITS, ENEMIES } from '../../../dist/src/characters.js';
import { characterStats } from '../../../dist/src/character-stats.js';
import { unitAbilities } from '../../../dist/src/abilities.js';
const file = process.argv[2];
if (!file) throw new Error('Output fixture path required');
const cases = [];
const sequence = ['sheep','rabbit','squirrel','teapot','cloud','deer','hedgehog','turtle','whale'];
function add(name,options,commands) { cases.push({ name, options, commands }); }
for (const mode of ['idle','challenge','speedrun']) for (let stageId=1;stageId<=20;stageId++) {
  const options = { mode, stageId, levels: Object.fromEntries(sequence.map(id=>[id,stageId<7?4:35])), sequence };
  const commands=[];
  for(let i=0;i<90;i++) {
    if(mode!=='idle') { commands.push({op:'summon',id:sequence[i%sequence.length]}); if(i%9===0) commands.push({op:'cannon'}); }
    commands.push({op:'step',dt:1});
  }
  add(`${mode}:${stageId}`,options,commands);
}
for (const phase of ['intro','first-battle','retry-battle']) add(`onboarding:${phase}`, {mode:'challenge',onboardingPhase:phase}, [{op:'step',dt:.6},{op:'step',dt:1.1},{op:'summon',id:'rabbit'},{op:'step',dt:35}]);
const modifiers = {hp:1.1,attack:1.1,attackTypes:{ranged:{attack:1.13}},goldIncome:3,killGold:1,goldCapacity:2,attributeBonuses:{wild:{attack:.1,effectiveHp:.05}}};
const ranks = Object.fromEntries(UNITS.map(unit=>[unit.id,Object.fromEntries(unitAbilities(unit).map(ability=>[ability.id,ability.max]))]));
for(const mode of ['idle','challenge','speedrun']) add(`${mode}:partial-equipment`, {mode,stageId:20,modifiers,levels:Object.fromEntries(sequence.map(id=>[id,50])),abilities:ranks,sequence}, Array.from({length:100},(_,i)=>({op:'step',dt:i%2?.017:.65})));
for(const unit of UNITS) add(`ability:${unit.id}`, {mode:'idle',stageId:20,sequence:[unit.id],levels:{[unit.id]:50},modifiers:{goldIncome:10,goldCapacity:10},abilities:{[unit.id]:ranks[unit.id]}}, Array.from({length:45},()=>({op:'step',dt:2})));
for(const phase of ['wall-battle','rabbit-recruit','wall-retry','idle-defense','remove-rabbit','idle-retry']) for(const mode of ['idle','challenge']) add(`guide:${phase}:${mode}`,{mode,stageId:2,earlyGuidePhase:phase,duration:null},[{op:'step',dt:.6},{op:'step',dt:40}]);
function snapshot(state) {
  const result=structuredClone(state);
  for(const key of Object.keys(result)) if(key.startsWith('_')&&!['_spawnIndex','_nextUid','_nextProjectileUid'].includes(key)) delete result[key];
  for(const unit of result.units) delete unit.definition;
  return result;
}
for(const item of cases) {
  const state=createBattle(item.options); item.snapshots=item.commands.map(command=> {
    if(command.op==='step') stepBattle(state,command.dt);
    else if(command.op==='summon') summonUnit(state,command.id);
    else if(command.op==='cannon') fireCannon(state);
    return snapshot(state);
  });
}
const statCases=[];
for(const team of ['player','enemy']) for(const unit of team==='player'?UNITS:ENEMIES) for(const level of [1,17,120]) {
  const options={team,level,abilities:ranks[unit.id]??{},modifiers:{hp:.97,attack:1.07,speed:1.03,attackTypes:{melee:{attack:1.03},ranged:{range:1.01}},attributeBonuses:{wild:{attack:.07}}},multipliers:{hp:1.9,attack:.7,attackTypes:{melee:{hp:.8}}},overrides:{statMultipliers:{attack:1.05},effects:{shield:false}}};
  statCases.push({id:unit.id,options,expected:characterStats(unit.id,options)});
}
fs.writeFileSync(file,JSON.stringify({cases,statCases}));
console.log(`Generated ${cases.length} battle scenarios, ${cases.reduce((sum,item)=>sum+item.commands.length,0)} snapshots, ${statCases.length} stat snapshots: ${file}`);
