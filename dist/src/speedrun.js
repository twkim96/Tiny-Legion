import { STAGES } from "./data.js";

export const SPEEDRUN_STAGE_COUNT = 20;
export const SPEEDRUN_LIMIT_SECONDS = 90;
export const SPEEDRUN_TARGET_SECONDS = 60;
export const SPEEDRUN_MAX_REWARD = 10;
export const SPEEDRUN_STAGES = STAGES.slice(0, SPEEDRUN_STAGE_COUNT);

export function speedrunStageReward(time) {
  if (!Number.isFinite(time) || time <= 0 || time > SPEEDRUN_LIMIT_SECONDS) return 0;
  if (time <= SPEEDRUN_TARGET_SECONDS) return SPEEDRUN_MAX_REWARD;
  return Math.max(1, Math.min(SPEEDRUN_MAX_REWARD - 1,
    Math.ceil((SPEEDRUN_LIMIT_SECONDS - time) / 30 * (SPEEDRUN_MAX_REWARD - 1))));
}
