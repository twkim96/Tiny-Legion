import * as account from '../dist/src/account.js';
import { equipGem, upgradeGem, transferGem, drawGem } from '../dist/src/gems.js';
import { STAGES } from '../dist/src/data.js';
import { GameError, startBattle, finishBattle } from './battle.js';

const secureRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const required = value => { if (value === false || value === null || value === undefined) throw new GameError('action_unavailable'); return value; };
export function applyCommand(a, activeBattle, type, args, now) {
  let battle = activeBattle, result = null;
  switch (type) {
    case 'settle': result = account.accrue(a, now); break;
    case 'mission.claim': result = required(account.claimMission(a)); break;
    case 'onboarding.finish': result = required(account.finishOnboarding(a)); break;
    case 'recruit.units': {
      const count = args.count ?? 1, banner = args.banner ?? 'forest';
      if (a.onboarding.phase === 'recruit' || a.earlyGuide.phase === 'rabbit-recruit') {
        if (count !== 1 || banner !== 'forest') throw new GameError('invalid_recruit');
        result = [required(a.onboarding.phase === 'recruit' ? account.recruitOnboardingCompanion(a) : account.recruitEarlyRabbit(a))];
      } else result = required(account.recruitUnits(a, count, { free: args.free === true, banner, random: secureRandom }));
      break;
    }
    case 'recruit.gem': result = required(drawGem(a, { payment: args.payment ?? 'diamonds', free: args.free === true, banner: args.banner ?? 'treasure', random: secureRandom })); break;
    case 'unit.grow': result = required(account.growUnit(a, args.id)); break;
    case 'unit.ability': result = required(account.upgradeUnitAbility(a, args.id, args.abilityId)); break;
    case 'unit.refund': result = required(account.refundUnitLevels(a, args.id, now)); break;
    case 'lineup.set': result = required(account.setSequence(a, args.sequence, args.mode, args.index, args.gemPreset)); break;
    case 'gem.equip': result = required(equipGem(a, args.presetIndex, args.slotIndex, args.uid)); break;
    case 'gem.upgrade': result = required(upgradeGem(a, args.uid, args.materialUids)); break;
    case 'gem.transfer': result = required(transferGem(a, args.sourceUid, args.targetUid)); break;
    case 'speedrun.claim': result = required(account.claimSpeedrun(a, args.stageId ?? 1, now) || null); break;
    case 'idle.select':
      if (!Number.isInteger(args.stageId) || args.stageId < 1 || args.stageId > a.highestCleared + (a.highestCleared > 0 && a.highestCleared % 10 === 0 ? 1 : 0) || !STAGES.some(s => s.id === args.stageId)) throw new GameError('stage_locked');
      a.idleStage = args.stageId; result = true; break;
    case 'idle.popup':
      if (!Number.isInteger(args.stageId) || !STAGES.some(s => s.id === args.stageId) || typeof args.hidden !== 'boolean') throw new GameError('invalid_preference');
      a.settings.hiddenIdleResults = a.settings.hiddenIdleResults.filter(id => id !== args.stageId);
      if (args.hidden) a.settings.hiddenIdleResults.push(args.stageId);
      result = true; break;
    case 'idle.popup.reset': a.settings.hiddenIdleResults = []; result = true; break;
    case 'settings':
      if (args.audio !== undefined) {
        if (!args.audio || typeof args.audio !== 'object' || Array.isArray(args.audio)) throw new GameError('invalid_preference');
        for (const [key, value] of Object.entries(args.audio)) {
          if (!['musicEnabled', 'sfxEnabled', 'musicVolume', 'sfxVolume'].includes(key) ||
              (key.endsWith('Enabled') ? typeof value !== 'boolean' : typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1)) throw new GameError('invalid_preference');
        }
        Object.assign(a.settings.audio, args.audio);
      }
      if (args.speed !== undefined) {
        if (![1, 2].includes(args.speed)) throw new GameError('invalid_preference');
        a.settings.speed = args.speed;
      }
      if (args.hiddenIdleResults !== undefined) {
        if (!Array.isArray(args.hiddenIdleResults) || args.hiddenIdleResults.length > STAGES.length || !args.hiddenIdleResults.every(id => STAGES.some(s => s.id === id))) throw new GameError('invalid_preference');
        a.settings.hiddenIdleResults = [...new Set(args.hiddenIdleResults)];
      }
      result = true; break;
    case 'account.reset': {
      const fresh = account.newAccount(now);
      Object.keys(a).forEach(key => delete a[key]); Object.assign(a, fresh);
      battle = null; result = true; break;
    }
    case 'battle.start': battle = startBattle(a, args, now); result = { battleId: battle.battleId, options: battle.options, snapshot: battle.snapshot }; break;
    case 'battle.finish': result = finishBattle(a, battle, args, now); battle = null; break;
    case 'battle.abandon':
      if (battle && args.battleId !== battle.battleId) throw new GameError('battle_not_found', 409);
      battle = null; result = true; break;
    default: throw new GameError('unknown_command');
  }
  return { result, battle };
}
