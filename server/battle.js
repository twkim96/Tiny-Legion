import { createBattle, stepBattle, summonUnit, fireCannon } from '../dist/src/engine.js';
import { UNITS, STAGES, BALANCE_VERSION } from '../dist/src/data.js';
import { onboardingEncounter } from '../dist/src/onboarding.js';
import { SPEEDRUN_STAGES } from '../dist/src/speedrun.js';
import * as account from '../dist/src/account.js';

export class GameError extends Error {
  constructor(code, status = 400) { super(code); this.status = status; }
}
export function startBattle(a, { mode, stageId }, now) {
  if (!['idle', 'challenge', 'speedrun'].includes(mode) || !Number.isInteger(stageId)) throw new GameError('invalid_battle');
  const onboarding = account.isOnboarding(a);
  if (onboarding) {
    const encounter = onboardingEncounter(a.onboarding.phase);
    if (!encounter || mode !== 'challenge' || stageId !== encounter.id) throw new GameError('battle_locked');
  } else {
    const stages = mode === 'speedrun' ? SPEEDRUN_STAGES : STAGES;
    if (!stages.some(s => s.id === stageId)) throw new GameError('invalid_stage');
    const idleLimit = a.highestCleared + (a.highestCleared > 0 && a.highestCleared % 10 === 0 ? 1 : 0);
    if (mode === 'idle' && stageId > idleLimit) throw new GameError('battle_locked');
    if (mode === 'challenge') {
      const mission = account.currentMission(a);
      if (stageId > a.highestCleared + 1 || mission?.id === 'idle-intro' ||
          (!account.growthUnlocked(a) && stageId > 2) ||
          (stageId === 2 && a.earlyGuide.phase === 'rabbit-recruit')) throw new GameError('battle_locked');
    }
    if (mode === 'speedrun' && (!account.advancedContentUnlocked(a) || stageId > account.speedrunProgress(a))) throw new GameError('battle_locked');
    if (mode === 'idle' && stageId === 2 && a.earlyGuide.phase === 'remove-rabbit') throw new GameError('sequence_required');
  }
  const options = { mode, stageId, levels: account.battleLevels(a), abilities: structuredClone(a.abilities),
    sequence: account.playableSequence(a, mode), modifiers: account.gemModifiers(a, mode),
    ownedUnits: UNITS.filter(u => account.canUseUnit(a, u.id)).map(u => u.id),
    onboardingPhase: onboarding ? a.onboarding.phase : null,
    earlyGuidePhase: mode !== 'speedrun' && stageId === 2 ? a.earlyGuide.phase : null };
  const battle = createBattle(options);
  const snapshot = { stageId, duration: battle.duration, balanceVersion: BALANCE_VERSION,
    levels: options.levels, abilities: options.abilities, sequence: options.sequence,
    gemEquipment: structuredClone(a.gemEquipment), gemEffects: options.modifiers, dailyKey: a.daily.key,
    speedrunStageId: mode === 'speedrun' ? stageId : null };
  return { battleId: crypto.randomUUID(), options, snapshot, startedAt: now };
}

export function finishBattle(a, run, { battleId, actions }, now) {
  if (!run || battleId !== run.battleId) throw new GameError('battle_not_found', 409);
  if (!Array.isArray(actions) || actions.length > 10000) throw new GameError('invalid_actions');
  const state = createBattle(run.options);
  let cursor = 0, cannonStep = -750, last = -1;
  for (const action of actions) {
    if (!action || !Number.isInteger(action.step) || action.step < last || action.step > Math.ceil(state.duration * 30) ||
        !['summon', 'cannon'].includes(action.type) || state.mode === 'idle') throw new GameError('invalid_actions');
    last = action.step;
  }
  for (let step = 0; step <= Math.ceil(state.duration * 30); step++) {
    while (cursor < actions.length && actions[cursor].step === step) {
      const action = actions[cursor++];
      if (state.finished) throw new GameError('action_after_finish');
      if (action.type === 'summon') {
        if (!summonUnit(state, action.id)) throw new GameError('invalid_summon');
      } else {
        if (run.options.onboardingPhase || step - cannonStep < 750 || !fireCannon(state)) throw new GameError('invalid_cannon');
        cannonStep = step;
      }
    }
    if (state.finished) break;
    stepBattle(state, 1 / 30);
  }
  if (!state.finished || cursor !== actions.length) throw new GameError('invalid_actions');
  const elapsed = (now - run.startedAt) / 1000;
  // Idle is always 1x; manual modes may use the existing 2x control.
  if (elapsed + 2 < state.time / (state.mode === 'idle' ? 1 : 2)) throw new GameError('battle_too_early', 409);
  if (run.options.onboardingPhase && a.onboarding.phase !== run.options.onboardingPhase) throw new GameError('battle_obsolete', 409);
  const battleResult = state.result;
  let rewards = { gold: 0, diamonds: 0 }, recordChanged = false;
  if (run.options.onboardingPhase) account.advanceOnboardingBattle(a, battleResult.won);
  else {
    account.recordMissionBattle(a, { mode: state.mode, stageId: state.stageId, won: battleResult.won });
    if (state.mode === 'idle') recordChanged = account.recordIdle(a, battleResult, run.snapshot, now);
    else if (state.mode === 'challenge' && battleResult.won) rewards = account.completeChallenge(a, state.stageId);
    else if (state.mode === 'speedrun' && battleResult.won && run.snapshot.speedrunStageId === state.stageId) {
      account.accrue(a, now);
      if (run.snapshot.dailyKey === a.daily.key) account.recordSpeedrun(a, state.stageId, battleResult.time, now);
      else account.advanceSpeedrun(a, state.stageId, battleResult.time);
    }
  }
  return { battleResult, rewards, recordChanged };
}
