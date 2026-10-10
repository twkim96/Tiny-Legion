import { ENEMIES, STAGES, UNITS } from "./data.js";

const WORLD_MIN = 0;
const WORLD_MAX = 1200;
const PLAYER_CASTLE_X = 80;
const ENEMY_CASTLE_X = 1120;
const PLAYER_SPAWN_X = 122;
const MAX_ACTIVE_UNITS = 80;
const FIXED_STEP = 1 / 30;
const GOLD_PER_SECOND = 35;
const UNIT_LEVEL_GROWTH = 0.12;
const DEFAULT_SEQUENCE = ["sheep", "rabbit", "squirrel", "teapot", "cloud"];
const UNIT_BY_ID = new Map(UNITS.map((unit) => [unit.id, unit]));
const ENEMY_BY_ID = new Map(ENEMIES.map((enemy) => [enemy.id, enemy]));
const STAGE_BY_ID = new Map(STAGES.map((stage) => [stage.id, stage]));

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function activeUnits(state) {
  return state.units.filter((unit) => !unit.dead);
}

function activeUnitCount(state) {
  return state.units.reduce((count, unit) => count + (unit.dead ? 0 : 1), 0);
}

function makeSpawnSchedule(stage) {
  const schedule = [];
  let order = 0;

  for (const wave of stage.waves ?? []) {
    const waveTime = Math.max(0, finiteNumber(wave.time, 0));
    for (const group of wave.enemies ?? []) {
      const enemy = ENEMY_BY_ID.get(group.id);
      if (!enemy) continue;
      const count = clamp(
        Math.floor(finiteNumber(group.count, 1)),
        0,
        MAX_ACTIVE_UNITS,
      );
      const interval = Math.max(0, finiteNumber(group.interval, 0));
      const baseX = clamp(
        finiteNumber(group.x, 1080),
        PLAYER_CASTLE_X,
        ENEMY_CASTLE_X - 8,
      );
      for (let index = 0; index < count; index += 1) {
        schedule.push({
          time: waveTime + interval * index,
          id: enemy.id,
          x: clamp(
            baseX + Math.min(index * 12, 42),
            PLAYER_CASTLE_X,
            ENEMY_CASTLE_X - 8,
          ),
          order: order++,
        });
      }
    }
  }

  schedule.sort((a, b) => a.time - b.time || a.order - b.order);
  return schedule;
}

function getLevel(levels, id) {
  const value = levels?.[id];
  const rawLevel =
    typeof value === "object" && value !== null ? value.level : value;
  return clamp(Math.floor(finiteNumber(rawLevel, 1)), 1, 120);
}

function makeUnit(state, definition, team, x, level = 1) {
  const multiplier = 1 + (level - 1) * UNIT_LEVEL_GROWTH;
  const enemyMultiplier = team === "enemy" ? state._enemyAttackMultiplier : 1;
  return {
    uid: `${team === "player" ? "p" : "e"}${state._nextUid++}`,
    id: definition.id,
    team,
    x: clamp(x, WORLD_MIN, WORLD_MAX),
    hp: Math.round(
      definition.hp *
        multiplier *
        (team === "player" ? state._modifiers.hp : 1),
    ),
    maxHp: Math.round(
      definition.hp *
        multiplier *
        (team === "player" ? state._modifiers.hp : 1),
    ),
    attack: Math.max(
      1,
      Math.round(
        definition.attack *
          (team === "enemy"
            ? enemyMultiplier
            : multiplier * state._modifiers.attack),
      ),
    ),
    range: definition.range,
    speed: definition.speed,
    attackTimer: 0,
    attackInterval: definition.attackInterval,
    hitFlash: 0,
    attackFlash: 0,
  };
}

function setFinished(state, won) {
  if (state.finished) return;
  state.finished = true;
  const hpRatio = clamp(state.playerHp / state.playerMaxHp, 0, 1);
  const survival = Math.max(0, state.time);
  const reward =
    state.mode === "idle"
      ? calculateIdleReward(state.stageId, survival, hpRatio)
      : won
        ? STAGE_BY_ID.get(state.stageId).baseReward
        : 0;
  state.result = {
    won,
    survival,
    hpRatio,
    time: state.time,
    reward,
  };
}

export function calculateIdleReward(stageId, survival, hpRatio) {
  const stage = STAGE_BY_ID.get(Number(stageId)) ?? STAGES[0];
  const normalizedSurvival = clamp(finiteNumber(survival, 0), 0, 120);
  const normalizedHp = clamp(finiteNumber(hpRatio, 0), 0, 1);
  const completionFactor = normalizedSurvival >= 120 ? 1 : 0.8;
  const reward =
    stage.baseReward *
    (normalizedSurvival / 120) ** 2 *
    (0.6 + 0.4 * normalizedHp) *
    completionFactor;
  return Math.round(reward);
}

export function createBattle(options = {}) {
  const {
    mode = "idle",
    stageId = 1,
    levels = {},
    sequence = DEFAULT_SEQUENCE,
    duration = 120,
    modifiers = {},
  } = options ?? {};
  const stage = STAGE_BY_ID.get(Number(stageId)) ?? STAGES[0];
  const battleMode = ["idle", "challenge", "speedrun"].includes(mode)
    ? mode
    : "idle";
  const durationSeconds = Math.max(0, finiteNumber(duration, 120));
  const stageEnemyHp = Math.max(1, finiteNumber(stage.enemyHp, 2000));
  const enemyMaxHp =
    battleMode === "speedrun" ? Math.round(stageEnemyHp * 0.65) : stageEnemyHp;

  const state = {
    mode: battleMode,
    stageId: stage.id,
    time: 0,
    duration: durationSeconds,
    gold: 220,
    maxGold: 1000,
    playerHp: 1000,
    playerMaxHp: 1000,
    enemyHp: enemyMaxHp,
    enemyMaxHp,
    units: [],
    cooldowns: Object.fromEntries(UNITS.map((unit) => [unit.id, 0])),
    sequence: Array.isArray(sequence)
      ? sequence.slice()
      : DEFAULT_SEQUENCE.slice(),
    sequenceIndex: 0,
    finished: false,
    result: null,
    events: [],
    _enemyAttackMultiplier: Math.max(0, finiteNumber(stage.enemyAttack, 1)),
    _spawnSchedule: makeSpawnSchedule(stage),
    _spawnIndex: 0,
    _nextUid: 1,
    _levels: levels && typeof levels === "object" ? { ...levels } : {},
    _modifiers: {
      hp: Math.max(1, finiteNumber(modifiers.hp, 1)),
      attack: Math.max(1, finiteNumber(modifiers.attack, 1)),
    },
  };

  return state;
}

export function summonUnit(state, unitId) {
  if (!state || state.finished) return false;
  const definition = UNIT_BY_ID.get(unitId);
  if (!definition) return false;
  if (state.gold < definition.cost) return false;
  if ((state.cooldowns[unitId] ?? 0) > 1e-9) return false;
  if (activeUnitCount(state) >= MAX_ACTIVE_UNITS) return false;

  state.gold -= definition.cost;
  state.cooldowns[unitId] = definition.cooldown;
  const level = getLevel(state._levels, unitId);
  state.units.push(
    makeUnit(state, definition, "player", PLAYER_SPAWN_X, level),
  );
  state.waitingReason = undefined;
  state.events.push({
    type: "summon",
    x: PLAYER_SPAWN_X,
    team: "player",
    id: unitId,
  });
  return true;
}

function advanceSequence(state) {
  if (state.sequence.length > 0) {
    state.sequenceIndex = (state.sequenceIndex + 1) % state.sequence.length;
  }
}

function runIdleQueue(state) {
  const length = state.sequence.length;
  state.waitingReason = undefined;
  if (length === 0) return;

  let visited = 0;
  let skippedForCooldown = false;
  let summoned = false;

  // A single queue traversal per tick prevents cooldown-only queues from looping.
  while (visited < length) {
    const unitId = state.sequence[state.sequenceIndex];
    const definition = UNIT_BY_ID.get(unitId);
    if (!definition) {
      advanceSequence(state);
      visited += 1;
      continue;
    }

    // Gold is checked first by design: an unaffordable entry holds the queue.
    if (state.gold < definition.cost) {
      state.waitingReason = "gold";
      return;
    }

    if ((state.cooldowns[unitId] ?? 0) > 1e-9) {
      advanceSequence(state);
      visited += 1;
      skippedForCooldown = true;
      continue;
    }

    if (activeUnitCount(state) >= MAX_ACTIVE_UNITS) {
      state.waitingReason = "capacity";
      return;
    }

    if (summonUnit(state, unitId)) {
      advanceSequence(state);
      visited += 1;
      summoned = true;
    } else {
      state.waitingReason = state.gold < definition.cost ? "gold" : "capacity";
      return;
    }
  }

  if (skippedForCooldown && !summoned) state.waitingReason = "cooldown";
}

function spawnDueEnemies(state) {
  while (state._spawnIndex < state._spawnSchedule.length) {
    const scheduled = state._spawnSchedule[state._spawnIndex];
    if (scheduled.time > state.time + 1e-9) break;
    state._spawnIndex += 1;
    if (activeUnitCount(state) >= MAX_ACTIVE_UNITS) continue;
    const definition = ENEMY_BY_ID.get(scheduled.id);
    if (!definition) continue;
    const enemy = makeUnit(state, definition, "enemy", scheduled.x);
    state.units.push(enemy);
    state.events.push({
      type: "spawn",
      x: enemy.x,
      team: "enemy",
      id: enemy.id,
    });
  }
}

function findTarget(unit, units, state) {
  const opponents = units
    .filter((candidate) => candidate.team !== unit.team && !candidate.dead)
    .sort(
      (a, b) =>
        Math.abs(a.x - unit.x) - Math.abs(b.x - unit.x) ||
        a.uid.localeCompare(b.uid),
    );

  if (opponents.length > 0) {
    const target = opponents[0];
    return { kind: "unit", uid: target.uid, x: target.x, team: target.team };
  }

  if (unit.team === "player") {
    if (state.mode === "idle") return null;
    return { kind: "castle", x: ENEMY_CASTLE_X, team: "enemy" };
  }
  return { kind: "castle", x: PLAYER_CASTLE_X, team: "player" };
}

function moveUnits(state, dt) {
  const units = activeUnits(state);
  const positions = new Map(units.map((unit) => [unit.uid, unit.x]));
  for (const unit of units) {
    const target = findTarget(unit, units, state);
    if (!target) continue;
    const targetX =
      target.kind === "unit" ? positions.get(target.uid) : target.x;
    const delta = targetX - unit.x;
    const remaining = Math.abs(delta) - unit.range;
    if (remaining <= 0) continue;
    const movement = Math.min(remaining, unit.speed * dt);
    unit.x = clamp(unit.x + Math.sign(delta) * movement, WORLD_MIN, WORLD_MAX);
  }
}

function addDamage(damageByUid, uid, amount) {
  damageByUid.set(uid, (damageByUid.get(uid) ?? 0) + amount);
}

function chooseSupportTarget(unit, units, definition) {
  if (!definition.heal || !definition.healRange) return null;
  return (
    units
      .filter(
        (candidate) =>
          candidate.team === unit.team &&
          !candidate.dead &&
          candidate.hp < candidate.maxHp &&
          Math.abs(candidate.x - unit.x) <= definition.healRange,
      )
      .sort(
        (a, b) =>
          a.hp / a.maxHp - b.hp / b.maxHp ||
          Math.abs(a.x - unit.x) - Math.abs(b.x - unit.x) ||
          a.uid.localeCompare(b.uid),
      )[0] ?? null
  );
}

function resolveAttacks(state) {
  const units = activeUnits(state);
  const intents = [];

  for (const unit of units) {
    if (unit.attackTimer > 1e-9) continue;
    const target = findTarget(unit, units, state);
    if (!target) continue;
    const targetX =
      target.kind === "unit"
        ? units.find((candidate) => candidate.uid === target.uid)?.x
        : target.x;
    if (
      !Number.isFinite(targetX) ||
      Math.abs(targetX - unit.x) > unit.range + 1e-9
    )
      continue;

    const definition =
      unit.team === "player"
        ? UNIT_BY_ID.get(unit.id)
        : ENEMY_BY_ID.get(unit.id);
    intents.push({ unit, target: { ...target, x: targetX }, definition });
    unit.attackTimer = unit.attackInterval;
    unit.attackFlash = 0.14;
  }

  const damageByUid = new Map();
  const healByUid = new Map();
  let playerCastleDamage = 0;
  let enemyCastleDamage = 0;

  for (const intent of intents) {
    const { unit, target, definition } = intent;
    const targets = units.filter(
      (candidate) => candidate.team === target.team && !candidate.dead,
    );
    if (target.kind === "unit") {
      const primary = targets.find((candidate) => candidate.uid === target.uid);
      if (primary) {
        addDamage(damageByUid, primary.uid, unit.attack);
        const splashRadius = definition?.splashRadius ?? 0;
        if (splashRadius > 0) {
          for (const candidate of targets) {
            if (
              candidate.uid !== primary.uid &&
              Math.abs(candidate.x - primary.x) <= splashRadius
            ) {
              addDamage(damageByUid, candidate.uid, unit.attack);
            }
          }
          if (
            unit.team === "player" &&
            state.mode !== "idle" &&
            Math.abs(ENEMY_CASTLE_X - primary.x) <= splashRadius
          ) {
            enemyCastleDamage += unit.attack;
          }
        }
      }
    } else if (target.team === "player") {
      playerCastleDamage += unit.attack;
    } else if (state.mode !== "idle") {
      enemyCastleDamage += unit.attack;
    }

    if (unit.team === "player") {
      const supportTarget = chooseSupportTarget(unit, units, definition);
      if (supportTarget) {
        healByUid.set(
          supportTarget.uid,
          (healByUid.get(supportTarget.uid) ?? 0) + definition.heal,
        );
      }
    }

    state.events.push({
      type: "attack",
      x: unit.x,
      targetX: target.x,
      team: unit.team,
      id: unit.id,
    });
  }

  for (const unit of units) {
    const damage = damageByUid.get(unit.uid) ?? 0;
    const healing = healByUid.get(unit.uid) ?? 0;
    if (damage > 0 || healing > 0) {
      unit.hp = clamp(unit.hp - damage + healing, 0, unit.maxHp);
      if (damage > 0) unit.hitFlash = 0.16;
      if (unit.hp <= 0 && !unit.dead) {
        unit.dead = true;
        unit.deathTimer = 0.24;
        state.events.push({
          type: "death",
          x: unit.x,
          team: unit.team,
          id: unit.id,
        });
      } else if (healing > 0) {
        state.events.push({
          type: "heal",
          x: unit.x,
          team: unit.team,
          amount: healing,
        });
      }
    }
  }

  if (playerCastleDamage > 0) {
    state.playerHp = Math.max(0, state.playerHp - playerCastleDamage);
    state.events.push({
      type: "castle-hit",
      x: PLAYER_CASTLE_X,
      team: "player",
      amount: playerCastleDamage,
    });
  }
  if (enemyCastleDamage > 0) {
    state.enemyHp = Math.max(0, state.enemyHp - enemyCastleDamage);
    state.events.push({
      type: "castle-hit",
      x: ENEMY_CASTLE_X,
      team: "enemy",
      amount: enemyCastleDamage,
    });
  }
}

function advanceTimers(state, dt) {
  for (const unitId of Object.keys(state.cooldowns)) {
    state.cooldowns[unitId] = Math.max(0, state.cooldowns[unitId] - dt);
  }
  for (const unit of state.units) {
    if (unit.dead) {
      unit.deathTimer = Math.max(0, (unit.deathTimer ?? 0) - dt);
      continue;
    }
    unit.attackTimer = Math.max(0, unit.attackTimer - dt);
    unit.hitFlash = Math.max(0, unit.hitFlash - dt);
    unit.attackFlash = Math.max(0, unit.attackFlash - dt);
  }
  state.units = state.units.filter((unit) => !unit.dead || unit.deathTimer > 0);
}

function simulateFixedStep(state, dt) {
  const nextTime = state.time + dt;
  state.time = nextTime >= state.duration - 1e-9 ? state.duration : nextTime;
  advanceTimers(state, dt);
  state.gold = Math.min(state.maxGold, state.gold + GOLD_PER_SECOND * dt);
  spawnDueEnemies(state);
  if (state.mode === "idle") runIdleQueue(state);

  moveUnits(state, dt);
  resolveAttacks(state);

  if (state.playerHp <= 0) {
    setFinished(state, false);
  } else if (state.mode !== "idle" && state.enemyHp <= 0) {
    setFinished(state, true);
  } else if (state.time >= state.duration - 1e-9) {
    setFinished(state, state.mode === "idle");
  }
}

export function stepBattle(state, dt) {
  if (!state || state.finished) return state;
  const requestedDt = finiteNumber(dt, 0);
  if (requestedDt <= 0) return state;
  if (state.time >= state.duration) {
    setFinished(state, state.mode === "idle" && state.playerHp > 0);
    return state;
  }

  state.events = [];
  let remaining = Math.min(requestedDt, state.duration - state.time);
  while (remaining > 1e-9 && !state.finished) {
    const slice = Math.min(FIXED_STEP, remaining);
    simulateFixedStep(state, slice);
    remaining -= slice;
  }
  return state;
}
