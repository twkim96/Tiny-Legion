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

// Long challenge replays are checkpointed in the existing active-battle row.
// Each command has bounded work; no total combat deadline is imposed.
const REPLAY_BATCH_STEPS = 3600;
export function finishBattle(a, run, { battleId, actions, endStep }, now) {
  if (!run || battleId !== run.battleId) throw new GameError('battle_not_found', 409);
  if (run.snapshot?.balanceVersion !== BALANCE_VERSION) throw new GameError('battle_version_mismatch', 409);
  if (!Array.isArray(actions) || actions.length > 10000) throw new GameError('invalid_actions');
  const fresh = createBattle(run.options);
  const timed = fresh.duration !== null;
  const terminal = endStep ?? (timed ? Math.ceil(fresh.duration * 30) : null);
  if (!Number.isSafeInteger(terminal) || terminal < 0 ||
      (timed && terminal > Math.ceil(fresh.duration * 30))) throw new GameError('invalid_actions');
  if (endStep !== undefined && terminal / 30 > ((now - run.startedAt) / 1000 + 2) * (fresh.mode === 'idle' ? 1 : 2)) {
    throw new GameError('battle_too_early', 409);
  }
  let last = -1;
  for (const action of actions) {
    if (!action || !Number.isSafeInteger(action.step) || action.step < last || action.step > terminal ||
        !['summon', 'cannon'].includes(action.type) || fresh.mode === 'idle') throw new GameError('invalid_actions');
    last = action.step;
  }
  const inputKey = JSON.stringify({ actions, terminal });
  const checkpoint = run.replay;
  if (checkpoint && checkpoint.inputKey !== inputKey) throw new GameError('replay_input_mismatch', 409);
  const state = checkpoint?.state ?? fresh;
  // The active battle is JSON stored; rebuild the sole Set before simulation.
  state._ownedUnits = fresh._ownedUnits;
  let cursor = checkpoint?.cursor ?? 0, cannonStep = checkpoint?.cannonStep ?? -750;
  let step = checkpoint?.step ?? 0;
  const batchEnd = Math.min(terminal, step + REPLAY_BATCH_STEPS - 1);
  for (; step <= batchEnd; step++) {
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
    if (step < terminal) stepBattle(state, 1 / 30);
  }
  if (!state.finished && step <= terminal) {
    run.replay = { inputKey, state: { ...state, _ownedUnits: null }, cursor, cannonStep, step };
    return { pending: true };
  }
  if (!state.finished || cursor !== actions.length) throw new GameError('invalid_actions');
  const elapsed = (now - run.startedAt) / 1000;
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
