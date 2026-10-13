import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as data from '../../dist/src/data.js';
import * as characters from '../../dist/src/characters.js';
import * as effects from '../../dist/src/effects.js';
import * as tags from '../../dist/src/character-tags.js';
import * as attack from '../../dist/src/attack-types.js';
import * as battlefield from '../../dist/src/battlefield.js';
import * as combat from '../../dist/src/combat-effects.js';
import * as gems from '../../dist/src/gems.js';
import * as abilities from '../../dist/src/abilities.js';
import * as speedrun from '../../dist/src/speedrun.js';
import * as onboarding from '../../dist/src/onboarding.js';
import * as economy from '../../dist/src/economy.js';
import { AUDIO_DEFAULTS } from '../../dist/src/audio.js';
import { spriteSvg } from '../../dist/src/art.js';
import { sampleUnitPose } from '../../dist/src/combat-visuals.js';
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const output = resolve(root, 'unity/Assets/TinyLegion/Resources/Data');
const battlePhases = ['intro','first-battle','retry-battle'];
const guidePhases = ['wall-battle','rabbit-recruit','wall-retry','idle-defense','remove-rabbit','idle-retry'];
export function exportCatalog() {
 return {
  schemaVersion: 1, balanceVersion: data.BALANCE_VERSION,
  animationPoses: Object.fromEntries([...characters.UNITS,...characters.ENEMIES].map(c=>[c.id,Object.fromEntries([["windup",1],["recovery",0]].map(([phase,elapsed])=>[phase,sampleUnitPose({id:c.id,uid:"",team:"player",facing:1,action:{phase,elapsed,duration:1}},0)]))])),
  units: characters.UNITS, enemies: characters.ENEMIES,
  stages: data.STAGES, speedrunStages: speedrun.SPEEDRUN_STAGES,
  abilitiesByUnit: Object.fromEntries(characters.UNITS.map(u=>[u.id,abilities.unitAbilities(u)])),
  effects: Object.fromEntries(Object.entries(effects.EFFECTS).map(([k,v])=>[k,{
   name:v.name,keyword:v.keyword,fields:v.fields,trigger:v.trigger??null,requiresHpDamage:!!v.requiresHpDamage,color:v.color??null,
   defaults:effects.COMBAT_TRAITS[k]??{},
  }])),
  effectKeywords: effects.EFFECT_KEYWORDS, statNames: effects.STAT_NAMES,
  attributes: tags.ATTRIBUTES, neutralAttribute: tags.NEUTRAL_ATTRIBUTE, families:tags.FAMILIES,attackTypes:attack.ATTACK_TYPES,
  rarities:data.RARITIES,banners:data.RECRUIT_BANNERS,starterUnitIds:data.STARTER_UNIT_IDS,
  gemTypes:gems.GEM_TYPES,gemBanners:gems.GEM_BANNERS,gemOptions:gems.GEM_OPTIONS,gemOptionTiers:gems.GEM_OPTION_TIERS,
  markTypes:abilities.MARK_TYPES,duplicateMarks:abilities.DUPLICATE_MARKS,
  constants:{battlefield,combatTiming:combat.COMBAT_TIMING,cannon:combat.CANNON,levelGrowth:characters.UNIT_LEVEL_GROWTH,
   shieldBonusCap:characters.SHIELD_BONUS_CAP,statMinimums:effects.STAT_MINIMUMS,statKeys:effects.STAT_KEYS,
   gemOptionLimit:gems.GEM_OPTION_LIMIT,audioDefaults:AUDIO_DEFAULTS,
   speedrun:{stageCount:speedrun.SPEEDRUN_STAGE_COUNT,targetSeconds:speedrun.SPEEDRUN_TARGET_SECONDS,limitSeconds:speedrun.SPEEDRUN_LIMIT_SECONDS,maxReward:speedrun.SPEEDRUN_MAX_REWARD}},
  onboarding:Object.fromEntries(battlePhases.map(p=>[p,onboarding.onboardingEncounter(p)])),
  earlyGuide:Object.fromEntries(guidePhases.map(p=>[p,Object.fromEntries(['challenge','idle'].map(m=>[m,onboarding.earlyGuideEncounter(p,m)]))])),
  economy:{idleRewardSeconds:economy.IDLE_REWARD_SECONDS,growthAnchors:economy.GROWTH_ANCHORS,
    levelCosts:Object.fromEntries(Array.from({length:100},(_,i)=>[i+1,economy.levelUpgradeCost(i+1)])),
    fullRewards:Object.fromEntries(data.STAGES.map(s=>[s.id,economy.idleFullReward(s.id)])),
    dailySpeedrunRewards:Object.fromEntries(Array.from({length:91},(_,i)=>[i,speedrun.speedrunStageReward(i)]))},
 };
}
export async function writeCatalog() {
 await mkdir(output,{recursive:true});
 const catalog=exportCatalog();
 await writeFile(resolve(output,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
 const svgOutput=resolve(root,'unity/Assets/TinyLegion/Art/Svg');
 await mkdir(svgOutput,{recursive:true});
 for(const character of [...characters.UNITS,...characters.ENEMIES]) await writeFile(resolve(svgOutput,`${character.id}.svg`),spriteSvg(character.id,character.attribute));
 console.log(`Exported ${catalog.units.length} companions, ${catalog.enemies.length} enemies, ${catalog.stages.length+catalog.speedrunStages.length} stages and ${Object.keys(catalog.effects).length} shared effects`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) await writeCatalog();
