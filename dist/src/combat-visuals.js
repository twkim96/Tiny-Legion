const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

function numberOr(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function stablePhase(uid) {
  const text = String(uid ?? "");
  let hash = 0;
  for (let index = 0; index < text.length; index++)
    hash = (hash * 31 + text.charCodeAt(index)) % 6283;
  return hash / 1000;
}

/** Sample a unit's presentation pose from simulation state only. Values are
 * normalized to sprite size so the Canvas renderer can scale them uniformly.
 */
export function sampleUnitPose(unit, simulationTime = 0) {
  const id = unit?.id ?? "";
  const facing =
    unit?.facing === -1 || unit?.facing === 1
      ? unit.facing
      : unit?.team === "enemy"
        ? -1
        : 1;
  const time = numberOr(simulationTime);
  const phase = stablePhase(unit?.uid);
  const moving = unit?.moving === true;
  const gait = moving ? Math.sin(time * 11 + phase) : 0;
  const bob =
    id === "cloud"
      ? Math.sin(time * 2.3 + phase) * 0.035
      : moving
        ? Math.abs(gait) * 0.028
        : Math.sin(time * 2.8 + phase) * 0.008;

  const pose = {
    phase: "idle",
    progress: 0,
    kind: null,
    offsetX: 0,
    offsetY: bob,
    bob: 0,
    rotation: moving ? gait * 0.025 * facing : 0,
    scaleX: 1,
    scaleY: 1,
    alpha: 1,
  };

  if (unit?.dead) {
    const remaining = Math.max(0, numberOr(unit.deathTimer));
    const total = Math.max(0.01, numberOr(unit.deathDuration, 0.32));
    const aliveFraction = clamp(remaining / total);
    pose.phase = "death";
    pose.progress = 1 - aliveFraction;
    pose.alpha = aliveFraction;
    pose.offsetY += pose.progress * 0.12;
    pose.scaleY = 1 - pose.progress * 0.16;
    pose.rotation = pose.progress * 0.16;
    return pose;
  }

  const stunRemaining = Math.max(0, numberOr(unit?.hitStun));
  if (stunRemaining > 0) {
    const stunDuration = Math.max(0.001, numberOr(unit?.hitStunDuration, 0.18));
    const strength = clamp(stunRemaining / stunDuration);
    const direction =
      unit?.hitDirection === -1 || unit?.hitDirection === 1
        ? unit.hitDirection
        : -facing;
    pose.phase = "hit";
    pose.progress = 1 - strength;
    pose.offsetX = direction * 0.14 * strength;
    pose.offsetY += 0.035 * strength;
    pose.rotation = direction * facing * 0.2 * strength;
    pose.scaleX = 1 + 0.035 * strength;
    pose.scaleY = 1 - 0.1 * strength;
    return pose;
  }

  const action = unit?.action;
  if (!action || (action.phase !== "windup" && action.phase !== "recovery"))
    return pose;

  const duration = Math.max(0.001, numberOr(action.duration, 0.001));
  const progress = clamp(numberOr(action.elapsed) / duration);
  pose.phase = action.phase;
  pose.progress = progress;
  pose.kind = action.kind ?? null;

  if (action.phase === "windup") {
    const prepare = 0.2 + smoothstep(progress) * 0.8;
    const anticipation = {
      sheep: {
        back: 0.05,
        tilt: -0.07,
        squash: 0.12,
        stretch: 0.04,
        lift: 0.025,
      },
      rabbit: {
        back: 0.07,
        tilt: -0.17,
        squash: 0.07,
        stretch: 0.035,
        lift: 0.01,
      },
      squirrel: {
        back: 0.055,
        tilt: -0.12,
        squash: 0.07,
        stretch: 0.045,
        lift: 0.005,
      },
      teapot: {
        back: 0.045,
        tilt: -0.18,
        squash: 0.055,
        stretch: 0.035,
        lift: 0.01,
      },
      cloud: {
        back: 0.025,
        tilt: -0.06,
        squash: 0.025,
        stretch: 0.09,
        lift: -0.025,
      },
      beetle: {
        back: 0.045,
        tilt: -0.11,
        squash: 0.1,
        stretch: 0.025,
        lift: 0.015,
      },
      mushroom: {
        back: 0.035,
        tilt: -0.08,
        squash: 0.16,
        stretch: 0.045,
        lift: 0.015,
      },
      boar: {
        back: 0.1,
        tilt: -0.15,
        squash: 0.13,
        stretch: 0.085,
        lift: 0.035,
      },
    }[id] ?? {
      back: 0.055,
      tilt: -0.12,
      squash: 0.09,
      stretch: 0.035,
      lift: 0.02,
    };
    pose.offsetX = -facing * anticipation.back * prepare;
    pose.offsetY += anticipation.lift * prepare;
    pose.rotation = anticipation.tilt * prepare;
    pose.scaleX = 1 + anticipation.stretch * prepare;
    pose.scaleY = 1 - anticipation.squash * prepare;
    return pose;
  }

  const release = 1 - smoothstep(progress);
  const releasePose = {
    sheep: { lunge: 0.1, tilt: 0.1, stretch: 0.05, squash: 0.015, rise: 0.01 },
    rabbit: {
      lunge: 0.11,
      tilt: 0.21,
      stretch: 0.045,
      squash: 0.025,
      rise: 0.025,
    },
    squirrel: {
      lunge: 0.055,
      tilt: 0.08,
      stretch: 0.035,
      squash: 0.015,
      rise: 0.005,
    },
    teapot: {
      lunge: 0.055,
      tilt: 0.23,
      stretch: 0.035,
      squash: 0.01,
      rise: 0.015,
    },
    cloud: {
      lunge: 0.045,
      tilt: 0.06,
      stretch: 0.1,
      squash: -0.015,
      rise: 0.035,
    },
    beetle: {
      lunge: 0.075,
      tilt: 0.1,
      stretch: 0.035,
      squash: 0.02,
      rise: 0.005,
    },
    mushroom: {
      lunge: 0.055,
      tilt: 0.08,
      stretch: 0.035,
      squash: -0.045,
      rise: 0.005,
    },
    boar: {
      lunge: 0.14,
      tilt: 0.16,
      stretch: 0.075,
      squash: 0.025,
      rise: 0.035,
    },
  }[id] ?? {
    lunge: 0.075,
    tilt: 0.12,
    stretch: 0.045,
    squash: 0.025,
    rise: 0.025,
  };
  pose.offsetX = facing * releasePose.lunge * release;
  pose.offsetY -= releasePose.rise * release;
  pose.rotation = releasePose.tilt * release;
  pose.scaleX = 1 + releasePose.stretch * release;
  pose.scaleY = 1 - releasePose.squash * release;
  return pose;
}
