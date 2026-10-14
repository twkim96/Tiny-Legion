// Run from repository root: node unity/Tests/Account/generate-parity.mjs <fixture.json>
// Fixture expectations are produced by the existing JavaScript account modules.
import fs from 'node:fs';
import * as accountRules from '../../../dist/src/account.js';
import * as gems from '../../../dist/src/gems.js';
import { STAGES, BALANCE_VERSION } from '../../../dist/src/data.js';
import { unitAbilities } from '../../../dist/src/abilities.js';
import { characterStats } from '../../../dist/src/character-stats.js';
import { applyCommand } from '../../../server/commands.js';
import { startBattle } from '../../../server/battle.js';
import { SPEEDRUN_STAGE_COUNT } from '../../../dist/src/speedrun.js';

const file = process.argv[2];
if (!file) throw new Error('Output fixture path required');
const now = Date.UTC(2026, 9, 14, 3, 0, 0); // 12:00 Seoul
const clone = value => structuredClone(value);
const units = accountRules.newAccount(now).levels;
const unitIds = Object.keys(units);
const ready = () => {
  const a = accountRules.newAccount(now);
  a.onboarding.phase = 'complete'; a.earlyGuide.phase = 'complete';
  return a;
};
const normalizations = [];
function normalize(name, input, at = now) {
  normalizations.push({ name, input: clone(input), now: at, expected: accountRules.normalizeAccount(clone(input), at) });
}
const fresh = accountRules.newAccount(now);
normalize('new-null', null);
normalize('new-invalid-version', { version: 2, gold: 9000 });
normalize('fresh-round-trip', fresh);
normalize('seoul-midnight-before', fresh, Date.UTC(2026, 9, 13, 14, 59, 59, 999));
normalize('seoul-midnight-after', fresh, Date.UTC(2026, 9, 13, 15, 0, 0, 0));
const legacy = clone(fresh);
delete legacy.onboarding; delete legacy.marks; delete legacy.earlyGuide; delete legacy.missions;
legacy.fragments.rabbit = 2; delete legacy.gemItems; legacy.gems = { attack: 3, gold: 2 }; legacy.equippedGem = 'attack';
legacy.highestCleared = 3; legacy.levels.rabbit = 4; legacy.records['1'] = { gold: 100, diamonds: .2, productionSeconds: 90, survival: 90, hpRatio: .5 };
normalize('legacy-starter-fragments-gems-missions', legacy);
const damaged = clone(fresh);
damaged.gold = 1e100; damaged.levels.sheep = 999; damaged.levelSpent.sheep = -1; damaged.records['1'] = { gold: -3, diamonds: 0, productionSeconds: 90 };
damaged.gemItems = [{ uid: 'dup', type: 'income', level: 4, optionTier: 'normal', options: [{ id: 'attack', value: 99 }] }, { uid: 'dup', type: 'harvest', level: 1, options: [] }];
damaged.gemEquipment.income = 'dup'; damaged.daily.key = accountRules.dailyKey(now); damaged.daily.stages['1'] = { best: 55, practice: 66, claimed: true };
normalize('limits-damaged-records-gem-id-repair-daily', damaged);
const advanced = ready(); advanced.highestCleared = 11; advanced.speedrunUnlocked = 0; advanced.daily.stages['1'] = { best: 42, practice: 60, claimed: true };
normalize('advanced-speedrun-unlock', advanced);

const deterministic = { rolls: [], index: 0, uid: 0 };
Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {
  getRandomValues(array) { array[0] = Math.floor((deterministic.rolls[deterministic.index++] ?? .5) * 4294967296); return array; },
  randomUUID() { return `account-fixture-${++deterministic.uid}`; },
} });
const commands = [];
function commandScenario(name, account, steps) {
  let state = clone(account);
  const results = steps.map(step => {
    deterministic.rolls = step.rolls ?? []; deterministic.index = 0;
    const working = clone(state);
    try {
      const output = applyCommand(working, null, step.type, clone(step.args ?? {}), step.now ?? now);
      state = working;
      return { ...step, now: step.now ?? now, result: clone(output.result), account: clone(state) };
    } catch (error) {
      return { ...step, now: step.now ?? now, error: error.code ?? error.message ?? 'action_unavailable' };
    }
  });
  commands.push({ name, account: clone(account), steps: results });
}
const recruit = ready(); recruit.highestCleared = 11; recruit.gold = 1e7; recruit.diamonds = 1e5; recruit.tickets = 100;
recruit.recruitment.sinceRare = 9; recruit.recruitment.sinceEpic = 49;
commandScenario('pity-free-banner-duplicate-and-invalid', recruit, [
  { type: 'recruit.units', args: { count: 1, banner: 'forest' }, rolls: [0, .3] },
  { type: 'recruit.units', args: { count: 10, free: true, banner: 'forest' }, rolls: Array(20).fill(.99) },
  { type: 'recruit.units', args: { count: 1, banner: 'unknown' }, error: 'action_unavailable' },
  { type: 'recruit.units', args: { count: 10, free: true }, error: 'action_unavailable' },
]);
const growth = ready(); growth.gold = 1e7; growth.highestCleared = 11;
growth.owned.rabbit = true; growth.owned.squirrel = true; growth.levels.sheep = 8; growth.levels.rabbit = 7; growth.levels.squirrel = 6; growth.levels.fox = 5; growth.owned.fox = true;
commandScenario('growth-refund-ability-idle-and-settings', growth, [
  { type: 'unit.grow', args: { id: 'rabbit' } },
  { type: 'unit.ability', args: { id: 'rabbit', abilityId: 'extra' } },
  { type: 'unit.refund', args: { id: 'rabbit' }, now: now + 5000 },
  { type: 'idle.select', args: { stageId: 12 }, error: 'stage_locked' },
  { type: 'idle.popup', args: { stageId: 2, hidden: true } },
  { type: 'settings', args: { audio: { musicVolume: .25 }, speed: 2, hiddenIdleResults: [2, 2, 3] } },
  { type: 'settings', args: { speed: 3 } },
]);
const lineup = ready(); lineup.highestCleared = 11; lineup.owned.rabbit = true; lineup.owned.fox = true;
commandScenario('lineup-presets-constraints', lineup, [
  { type: 'lineup.set', args: { mode: 'challenge', sequence: ['sheep', 'rabbit', null, null, null, null, null, null, null, null], index: 2 } },
  { type: 'lineup.set', args: { mode: 'idle', sequence: ['sheep', 'fox', null, null, null, null, null, null, null, null], index: 0 } },
  { type: 'lineup.set', args: { mode: 'idle', sequence: [null, null, null, null, null, null, null, null, null, null], index: 0 } },
]);
const gem = ready(); gem.highestCleared = 11; gem.gold = 1e7; gem.diamonds = 500; gem.tickets = 20;
commandScenario('gem-draw-equip-upgrade-reroll-materials', gem, [
  { type: 'recruit.gem', args: { payment: 'diamonds', banner: 'treasure' }, rolls: [0, 0, 0] },
  { type: 'recruit.gem', args: { payment: 'tickets' }, rolls: [0, 0, 0] },
  { type: 'gem.equip', args: { uid: 'gem-1' } },
  { type: 'gem.upgrade', args: { uid: 'gem-1', materialUids: ['gem-2'] } },
  { type: 'gem.reroll', args: { uid: 'gem-1' }, rolls: [.99, .05, .9] },
  { type: 'gem.unequip', args: { type: 'income' } },
  { type: 'gem.upgrade', args: { uid: 'missing', materialUids: ['missing'] } },
]);
const returnAccount = ready(); returnAccount.records['1'] = { gold: 100, diamonds: .3, productionSeconds: 90 }; returnAccount.lastSettled = now - 9 * 3600_000;
commandScenario('settle-daily-and-reset', returnAccount, [
  { type: 'settle', now: now + 1_000 },
  { type: 'account.reset', now: now + 2_000 },
  { type: 'onboarding.finish', now: now + 3_000 },
]);
const mission = ready(); mission.highestCleared = 11; mission.missions.idleCompleted = true;
mission.missions.claimed = ['idle-intro', ...Array.from({ length: 10 }, (_, i) => `challenge-${i + 2}`)];
mission.gemGuide.drawn = true; mission.gemGuide.equipped = true;
commandScenario('mission-and-speedrun-claim', mission, [
  { type: 'mission.claim' },
  { type: 'speedrun.claim', args: { stageId: 1 } },
  { type: 'speedrun.claim', args: { stageId: 99 } },
]);

const battles = [];
function battleScenario(name, a, mode, stageId) {
  try { battles.push({ name, account: clone(a), mode, stageId, expected: startBattle(clone(a), { mode, stageId }, now).options }); }
  catch (error) { battles.push({ name, account: clone(a), mode, stageId, error: error.code ?? error.message }); }
}
battleScenario('intro-valid', fresh, 'challenge', 0);
battleScenario('onboarding-mode-lock', fresh, 'idle', 1);
const guide = ready(); guide.highestCleared = 2; guide.earlyGuide.phase = 'remove-rabbit';
battleScenario('rabbit-sequence-required', guide, 'idle', 2);
battleScenario('challenge-next-stage', guide, 'challenge', 3);
const speed = ready(); speed.highestCleared = 11; speed.speedrunUnlocked = 1;
battleScenario('speedrun-allowed', speed, 'speedrun', 1);
battleScenario('speedrun-locked', speed, 'speedrun', 2);

const queries = [];
function queryScenario(name, a, { mode = 'idle', stageId = 1, lineupIndex = 0, unitId = 'sheep', payment = 'diamonds', recruitCount = 1, free = false, gem = { type: 'harvest', level: 3, optionTier: 'epic', options: [{ id: 'attack', value: .02 }, { id: 'wildAttack', value: .07 }] }, option = { id: 'attack', value: .02 } } = {}) {
  const normalized = accountRules.normalizeAccount(clone(a), now);
  const roster = accountRules.baseLevelRoster(normalized);
  const record = accountRules.speedrunStageRecord(normalized, stageId);
  const statLevel = accountRules.effectiveUnitLevel(normalized, unitId) + (normalized.special?.[unitId] ?? 0);
  const expected = {
    battleLevels: accountRules.battleLevels(normalized), gemModifiers: accountRules.gemModifiers(normalized),
    mission: accountRules.currentMission(normalized), roster, sharedLevel: accountRules.sharedLevel(normalized),
    growthUnlocked: accountRules.growthUnlocked(normalized), sequenceUnlocked: accountRules.sequenceUnlocked(normalized),
    advancedUnlocked: accountRules.advancedContentUnlocked(normalized), speedrunProgress: accountRules.speedrunProgress(normalized),
    speedrunRecord: record, speedrunReward: accountRules.speedrunReward(normalized, stageId),
    playable: accountRules.playableSequence(normalized, mode), activeLineup: normalized.activeLineup?.[mode] ?? 0,
    sequence: accountRules.sequenceForMode(normalized, mode, lineupIndex), owns: accountRules.ownsUnit(normalized, unitId),
    canUse: accountRules.canUseUnit(normalized, unitId), gemRecruitUnlocked: normalized.onboarding.phase === 'complete' && normalized.highestCleared >= 11,
    growthCost: accountRules.levelCost(accountRules.effectiveUnitLevel(normalized, unitId)), effectiveLevel: accountRules.effectiveUnitLevel(normalized, unitId),
    combatPower: accountRules.combatPower(normalized),
    companionStats: characterStats(unitId, { team: 'player', level: statLevel, abilities: normalized.abilities?.[unitId], modifiers: accountRules.gemModifiers(normalized) }),
    refundQuote: { id: unitId, refund: accountRules.unitLevelRefund(normalized, unitId), enabled: accountRules.growthUnlocked(normalized) && accountRules.unitLevelRefund(normalized, unitId) > 0, personalLevel: normalized.levels?.[unitId] ?? 1, effectiveLevel: accountRules.effectiveUnitLevel(normalized, unitId) },
    gemDescription: gems.gemDescription(gem), gemUpgradeCost: gems.gemUpgradeCost(gem), gemRerollCost: gems.gemRerollCost(gem),
    gemOptionText: gems.gemOptionText(option), gemRecruitmentCost: payment === 'tickets' ? 5 : payment === 'diamonds' ? 30 : null,
    recruitmentCost: [1, 10].includes(recruitCount) ? free ? 0 : recruitCount === 1 ? 30 : 270 : null,
  };
  queries.push({ name, account: normalized, mode, stageId, lineupIndex, unitId, payment, recruitCount, free, gem, option, expected });
}
queryScenario('new-account', fresh);
const queryAdvanced = ready(); queryAdvanced.highestCleared = 11; queryAdvanced.speedrunUnlocked = 2;
queryAdvanced.levels.sheep = 4; queryAdvanced.levelSpent.sheep = 600; queryAdvanced.daily.stages['1'] = { best: 55, practice: 58, claimed: false };
queryScenario('advanced-with-records', queryAdvanced, { mode: 'speedrun', stageId: 1, unitId: 'sheep', payment: 'tickets', recruitCount: 10 });

const returns = [];
function returnScenario(name, a, at) {
  const state = clone(a); const from = state.lastSettled; const income = accountRules.accrue(state, at);
  const awaySeconds = Math.max(0, (at - from) / 1000);
  const expected = awaySeconds >= 60 && (income.gold > 0 || income.diamonds > 0) ? { ...income, from, to: at, awaySeconds, capped: awaySeconds > 8 * 3600 } : null;
  returns.push({ name, account: clone(a), now: at, expected, accountExpected: state });
}
returnScenario('eight-hour-cap', returnAccount, now);
returnScenario('under-minute-no-receipt', ready(), now + 30_000);
const zeroIncome = ready(); zeroIncome.records['1'] = { gold: 0, diamonds: 0, productionSeconds: 90 };
returnScenario('zero-income-no-receipt', zeroIncome, now + 600_000);

const records = [];
function recordScenario(name, a, mode, stageId, result, extra = {}) {
  const state = clone(a); const snapshot = { mode, stageId, balanceVersion: BALANCE_VERSION, options: { onboardingPhase: null }, ...extra.snapshot };
  const startedAt = extra.startedAt ?? now - result.time * 1000 - 3000; const at = extra.now ?? now;
  try {
    if (!['idle', 'challenge', 'speedrun'].includes(mode) || snapshot.balanceVersion !== BALANCE_VERSION) throw Object.assign(new Error('battle_version_mismatch'), { code: 'battle_version_mismatch' });
    const elapsed = (at - startedAt) / 1000;
    if (!Number.isFinite(result.time) || elapsed + 2 < result.time / (mode === 'idle' ? 1 : 2)) throw Object.assign(new Error('battle_too_early'), { code: 'battle_too_early' });
    const frozenPhase = snapshot.options?.onboardingPhase ?? snapshot.onboardingPhase;
    const onboardingStage = ({ intro: 0, 'first-battle': 1, 'retry-battle': 1 })[state.onboarding.phase] ?? -1;
    if (frozenPhase != null && (mode !== 'challenge' || stageId !== onboardingStage || frozenPhase !== state.onboarding.phase)) throw Object.assign(new Error('battle_obsolete'), { code: 'battle_obsolete' });
    if (frozenPhase == null && (mode === 'speedrun' ? stageId < 1 || stageId > SPEEDRUN_STAGE_COUNT : !STAGES.some(stage => stage.id === stageId))) throw Object.assign(new Error('invalid_stage'), { code: 'invalid_stage' });
    const battleResult = clone(result); let rewards = { gold: 0, diamonds: 0 }, recordChanged = false;
    if (frozenPhase != null) accountRules.advanceOnboardingBattle(state, result.won);
    else {
      accountRules.recordMissionBattle(state, { mode, stageId, won: result.won });
      if (mode === 'idle') recordChanged = accountRules.recordIdle(state, battleResult, snapshot, at);
      else if (mode === 'challenge' && result.won) rewards = accountRules.completeChallenge(state, stageId);
      else if (mode === 'speedrun' && result.won && snapshot.speedrunStageId === stageId) {
        accountRules.accrue(state, at);
        if (snapshot.dailyKey === state.daily.key) accountRules.recordSpeedrun(state, stageId, result.time, at);
        else accountRules.advanceSpeedrun(state, stageId, result.time);
      }
    }
    const expected = { battleResult, rewards, recordChanged };
    records.push({ name, account: clone(a), result: clone(result), snapshot, startedAt, now: at, expected, accountExpected: state });
  } catch (error) { records.push({ name, account: clone(a), result: clone(result), snapshot, startedAt, now: at, error: error.code ?? error.message }); }
}
const idle = ready(); idle.highestCleared = 2; idle.idleStage = 1;
recordScenario('idle-record-gem-snapshot', idle, 'idle', 1, { won: false, survival: 30, hpRatio: .5, time: 40, reward: 120 }, { snapshot: { duration: 40, gemEffects: { acorn: 1.15 } } });
const challenge = ready();
recordScenario('challenge-first-clear', challenge, 'challenge', 1, { won: true, survival: 100, hpRatio: 1, time: 90, reward: 200 });
recordScenario('challenge-repeat-clear', Object.assign(ready(), { highestCleared: 1, challengeRewards: [1] }), 'challenge', 1, { won: true, survival: 100, hpRatio: 1, time: 90, reward: 200 });
const onboarding = accountRules.newAccount(now); onboarding.onboarding.phase = 'retry-battle';
recordScenario('onboarding-frozen-phase', onboarding, 'challenge', 1, { won: true, survival: 40, hpRatio: 1, time: 40, reward: 0 }, { snapshot: { options: { onboardingPhase: 'retry-battle' } } });
const speedrun = ready(); speedrun.highestCleared = 11; speedrun.speedrunUnlocked = 1;
recordScenario('speedrun-current-day-record', speedrun, 'speedrun', 1, { won: true, survival: 55, hpRatio: 1, time: 55, reward: 0 }, { snapshot: { speedrunStageId: 1, dailyKey: speedrun.daily.key } });
recordScenario('speedrun-previous-day-advances', speedrun, 'speedrun', 1, { won: true, survival: 55, hpRatio: 1, time: 55, reward: 0 }, { now: now + 86_400_000, startedAt: now + 86_400_000 - 58_000, snapshot: { speedrunStageId: 1, dailyKey: speedrun.daily.key } });
recordScenario('reject-too-early-without-mutation', ready(), 'challenge', 1, { won: true, time: 100, reward: 200 }, { startedAt: now - 1000 });
recordScenario('reject-balance-mismatch-without-mutation', ready(), 'idle', 1, { won: false, survival: 40, hpRatio: 1, time: 40, reward: 100 }, { snapshot: { balanceVersion: 'stale' } });

fs.writeFileSync(file, JSON.stringify({ normalizations, commands, battles, queries, returns, records }));
console.log(`Generated ${normalizations.length} normalizations, ${commands.length} command scenarios (${commands.reduce((n, item) => n + item.steps.length, 0)} steps), ${battles.length} battle options, ${queries.length} queries, ${returns.length} return receipts, ${records.length} battle records: ${file}`);
