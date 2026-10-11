import { ENEMIES, STAGES, UNITS } from "./data.js";
import { resolveDamage, specializationBonus } from "./combat-rules.js";

const WORLD_MIN = 0;
const WORLD_MAX = 1200;
const PLAYER_CASTLE_X = 80;
const ENEMY_CASTLE_X = 1120;
const PLAYER_SPAWN_X = 122;
const MAX_ACTIVE_UNITS = 80;
const FIXED_STEP = 1 / 30;
const GOLD_PER_SECOND = 35;
export const UNIT_LEVEL_GROWTH = 0.12;
const HIT_STUN = 0.18;
const STUN_COOLDOWN = 0.65;
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

function emit(state, event) {
  state.events.push({ ...event, time: state.time });
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
          overrides: Object.fromEntries(
            ["attribute", "shield", "regeneration"]
              .filter((key) => key in group)
              .map((key) => [key, group[key]]),
          ),
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
    artId: definition.artId ?? definition.id,
    role: definition.role,
    attribute: definition.attribute,
    specialties: [...(definition.specialties ?? [])],
    attributeBonuses: definition.attributeBonuses
      ? structuredClone(definition.attributeBonuses)
      : undefined,
    shield: Math.round(
      definition.hp * multiplier * (definition.shield?.hpRatio ?? 0),
    ),
    maxShield: Math.round(
      definition.hp * multiplier * (definition.shield?.hpRatio ?? 0),
    ),
    regeneration: definition.regeneration
      ? { ...definition.regeneration }
      : null,
    regenTimer: definition.regeneration?.interval ?? 0,
    slowRemaining: 0,
    slowFactor: 1,
    regenSuppressionRemaining: 0,
    regenSuppressionFactor: 1,
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
    action: null,
    facing: team === "player" ? 1 : -1,
    moving: false,
    hitStun: 0,
    hitStunDuration: HIT_STUN,
    hitDirection: team === "player" ? -1 : 1,
    stunCooldown: 0,
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
    ownedUnits = null,
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
    projectiles: [],
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
    _nextProjectileUid: 1,
    _ownedUnits: Array.isArray(ownedUnits) ? new Set(ownedUnits) : null,
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
  if (!definition || (state._ownedUnits && !state._ownedUnits.has(unitId)))
    return false;
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
  emit(state, {
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
    if (!definition || (state._ownedUnits && !state._ownedUnits.has(unitId))) {
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
    const enemy = makeUnit(
      state,
      { ...definition, ...scheduled.overrides },
      "enemy",
      scheduled.x,
    );
    state.units.push(enemy);
    emit(state, {
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
    unit.moving = false;
    if (unit.action || unit.hitStun > 0) continue;
    const target = findTarget(unit, units, state);
    if (!target) continue;
    const targetX =
      target.kind === "unit" ? positions.get(target.uid) : target.x;
    const delta = targetX - unit.x;
    if (delta) unit.facing = Math.sign(delta);
    const remaining = Math.abs(delta) - unit.range;
    if (remaining <= 0) continue;
    const movement = Math.min(
      remaining,
      unit.speed * (unit.slowRemaining > 0 ? unit.slowFactor : 1) * dt,
    );
    unit.x = clamp(unit.x + Math.sign(delta) * movement, WORLD_MIN, WORLD_MAX);
    unit.moving = movement > 0;
  }
}

function damageBatch() {
  return {
    damage: new Map(),
    healing: new Map(),
    playerCastle: 0,
    enemyCastle: 0,
  };
}

function addDamage(batch, target, amount, direction, kind, source = {}) {
  const previous = batch.damage.get(target.uid);
  batch.damage.set(target.uid, {
    amount: (previous?.amount ?? 0) + amount,
    direction,
    kind,
    hits: [...(previous?.hits ?? []), { amount, source }],
  });
}

function currentTarget(target, units) {
  const unit =
    target.kind === "unit"
      ? units.find(
          (candidate) => candidate.uid === target.uid && !candidate.dead,
        )
      : null;
  return unit ? { ...target, x: unit.x } : target;
}

function impact(state, shot, units, batch) {
  const { target, damage, splashRadius, kind, team } = shot;
  const primary =
    target.kind === "unit"
      ? units.find(
          (candidate) => candidate.uid === target.uid && !candidate.dead,
        )
      : null;
  const center = primary?.x ?? target.x;
  let hit = false;
  for (const candidate of units) {
    if (candidate.team !== target.team || candidate.dead) continue;
    if (
      candidate.uid !== primary?.uid &&
      !(splashRadius > 0 && Math.abs(candidate.x - center) <= splashRadius)
    )
      continue;
    addDamage(
      batch,
      candidate,
      damage,
      Math.sign(candidate.x - shot.startX) || (team === "player" ? 1 : -1),
      kind,
      shot.source,
    );
    hit = true;
  }
  if (
    target.kind === "castle" ||
    (splashRadius > 0 &&
      Math.abs(
        (target.team === "enemy" ? ENEMY_CASTLE_X : PLAYER_CASTLE_X) - center,
      ) <= splashRadius)
  ) {
    if (target.team === "player") {
      batch.playerCastle += damage;
      hit = true;
    } else if (state.mode !== "idle") {
      batch.enemyCastle += damage;
      hit = true;
    }
  }
  emit(state, { type: "impact", x: center, team, kind, splashRadius, hit });
}

function advanceProjectiles(state, dt, units, batch) {
  for (const projectile of state.projectiles) {
    projectile.target = currentTarget(projectile.target, units);
    projectile.targetX = projectile.target.x;
    projectile.elapsed = Math.min(projectile.duration, projectile.elapsed + dt);
    if (projectile.elapsed >= projectile.duration - 1e-9) {
      impact(state, projectile, units, batch);
    }
  }
  state.projectiles = state.projectiles.filter(
    (projectile) => projectile.elapsed < projectile.duration - 1e-9,
  );
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

function resolveAttacks(state, dt) {
  const units = activeUnits(state);
  const batch = damageBatch();
  for (const unit of units) {
    if (!unit.regeneration) continue;
    unit.regenTimer = (unit.regenTimer ?? unit.regeneration.interval) - dt;
    if (unit.regenTimer <= 1e-9) {
      unit.regenTimer += Math.max(FIXED_STEP, unit.regeneration.interval);
      const amount =
        unit.maxHp *
        unit.regeneration.hpRatio *
        (unit.regenSuppressionRemaining > 0 ? unit.regenSuppressionFactor : 1);
      batch.healing.set(unit.uid, amount);
    }
  }
  // Existing shots land in this step; newly released shots start at time zero.
  advanceProjectiles(state, dt, units, batch);

  for (const unit of units) {
    if (unit.hitStun > 0) continue;
    const definition =
      unit.team === "player"
        ? UNIT_BY_ID.get(unit.id)
        : ENEMY_BY_ID.get(unit.id);
    if (!definition) continue;
    if (unit.action?.phase === "recovery") continue;
    if (!unit.action) {
      if (unit.attackTimer > 1e-9) continue;
      const target = findTarget(unit, units, state);
      if (!target || Math.abs(target.x - unit.x) > unit.range + 1e-9) continue;
      unit.facing = Math.sign(target.x - unit.x) || unit.facing;
      unit.moving = false;
      unit.attackTimer = unit.attackInterval;
      unit.action = {
        phase: "windup",
        elapsed: 0,
        duration: definition.attackWindup,
        kind: definition.projectile?.kind ?? "melee",
        target,
      };
      continue;
    }
    unit.action.elapsed = Math.min(
      unit.action.duration,
      unit.action.elapsed + dt,
    );
    if (unit.action.elapsed < unit.action.duration - 1e-9) continue;
    const target = currentTarget(unit.action.target, units);
    const kind = unit.action.kind;
    unit.action = {
      phase: "recovery",
      elapsed: 0,
      duration: definition.attackRecovery,
      kind,
      target,
    };
    unit.attackFlash = definition.attackRecovery;
    const shot = {
      uid: `shot${state._nextProjectileUid++}`,
      sourceUid: unit.uid,
      id: unit.id,
      team: unit.team,
      startX: unit.x,
      targetX: target.x,
      target,
      damage: unit.attack,
      // Capture combat effects at release: projectiles survive their source.
      source: {
        team: unit.team,
        role: unit.role,
        attribute: unit.attribute,
        specialties: [...(unit.specialties ?? [])],
        attributeBonuses: unit.attributeBonuses,
        slow: definition.slow,
        suppressRegen: definition.suppressRegen,
        shieldDamageBonus:
          (definition.shieldDamageBonus ?? 0) +
          Math.max(
            0,
            ...units
              .filter((ally) => ally.team === unit.team && !ally.dead)
              .map((ally) => {
                const aura = UNIT_BY_ID.get(ally.id)?.shieldAura;
                return aura && Math.abs(ally.x - unit.x) <= aura.range
                  ? aura.bonus
                  : 0;
              }),
          ),
      },
      splashRadius: definition.splashRadius ?? 0,
      kind,
    };
    emit(state, {
      type: "attack",
      uid: unit.uid,
      x: unit.x,
      targetX: target.x,
      team: unit.team,
      id: unit.id,
      kind,
    });
    if (definition.projectile) {
      state.projectiles.push({
        ...shot,
        elapsed: 0,
        duration: clamp(
          Math.abs(target.x - unit.x) / definition.projectile.speed,
          0.1,
          0.6,
        ),
      });
    } else if (Math.abs(target.x - unit.x) <= unit.range + 1e-9) {
      impact(state, shot, units, batch);
    } else {
      emit(state, {
        type: "impact",
        x: target.x,
        team: unit.team,
        kind,
        hit: false,
        splashRadius: 0,
      });
    }
    if (unit.team === "player") {
      const supportTarget = chooseSupportTarget(unit, units, definition);
      if (supportTarget) {
        batch.healing.set(
          supportTarget.uid,
          (batch.healing.get(supportTarget.uid) ?? 0) + definition.heal,
        );
      }
    }
  }
  applyDamage(state, units, batch);
}

function applyDamage(state, units, batch) {
  // Aggregate the whole tick so both sides' committed hits resolve together.
  for (const unit of units) {
    const hit = batch.damage.get(unit.uid);
    let damage = 0;
    let shieldDamage = 0;
    for (const entry of hit?.hits ?? []) {
      const resolved = resolveDamage(unit, entry.amount, entry.source);
      unit.shield = Math.max(0, (unit.shield ?? 0) - resolved.shieldDamage);
      shieldDamage += resolved.shieldDamage;
      damage += resolved.hpDamage;
      const durationMultiplier =
        1 + specializationBonus(entry.source, unit, "duration");
      if (entry.source.slow) {
        unit.slowFactor = Math.min(
          unit.slowRemaining > 0 ? unit.slowFactor : 1,
          entry.source.slow.factor,
        );
        unit.slowRemaining = Math.max(
          unit.slowRemaining ?? 0,
          entry.source.slow.duration * durationMultiplier,
        );
      }
      if (entry.source.suppressRegen) {
        unit.regenSuppressionFactor = Math.min(
          unit.regenSuppressionRemaining > 0 ? unit.regenSuppressionFactor : 1,
          entry.source.suppressRegen.factor,
        );
        unit.regenSuppressionRemaining = Math.max(
          unit.regenSuppressionRemaining ?? 0,
          entry.source.suppressRegen.duration * durationMultiplier,
        );
      }
    }
    const healing = batch.healing.get(unit.uid) ?? 0;
    if (!damage && !shieldDamage && !healing) continue;
    unit.hp = clamp(unit.hp - damage + healing, 0, unit.maxHp);
    if (damage > 0 || shieldDamage > 0) {
      unit.hitFlash = 0.18;
      unit.hitDirection = hit.direction;
      if (damage > 0 && unit.hp > 0 && (unit.stunCooldown ?? 0) <= 1e-9) {
        unit.hitStunDuration = damage >= unit.maxHp * 0.2 ? 0.24 : HIT_STUN;
        unit.hitStun = unit.hitStunDuration;
        unit.stunCooldown = STUN_COOLDOWN;
        unit.moving = false;
      }
      emit(state, {
        type: "hit",
        uid: unit.uid,
        x: unit.x,
        team: unit.team,
        id: unit.id,
        kind: hit.kind,
        amount: damage + shieldDamage,
      });
    }
    if (unit.hp <= 0) {
      unit.dead = true;
      unit.moving = false;
      unit.action = null;
      unit.deathTimer = 0.32;
      emit(state, {
        type: "death",
        uid: unit.uid,
        x: unit.x,
        team: unit.team,
        id: unit.id,
      });
    } else if (healing > 0) {
      emit(state, {
        type: "heal",
        x: unit.x,
        team: unit.team,
        amount: healing,
      });
    }
  }
  if (batch.playerCastle > 0) {
    state.playerHp = Math.max(0, state.playerHp - batch.playerCastle);
    emit(state, {
      type: "castle-hit",
      x: PLAYER_CASTLE_X,
      team: "player",
      amount: batch.playerCastle,
    });
  }
  if (batch.enemyCastle > 0) {
    state.enemyHp = Math.max(0, state.enemyHp - batch.enemyCastle);
    emit(state, {
      type: "castle-hit",
      x: ENEMY_CASTLE_X,
      team: "enemy",
      amount: batch.enemyCastle,
    });
  }
}

export function fireCannon(state) {
  if (!state || state.finished || state.mode === "idle") return false;
  const enemies = activeUnits(state).filter((unit) => unit.team === "enemy");
  const batch = damageBatch();
  for (const enemy of enemies)
    addDamage(batch, enemy, 110, 1, "cannon", { team: "player" });
  applyDamage(state, enemies, batch);
  for (const enemy of enemies) enemy.x = Math.min(1110, enemy.x + 75);
  return true;
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
    unit.slowRemaining = Math.max(0, (unit.slowRemaining ?? 0) - dt);
    unit.regenSuppressionRemaining = Math.max(
      0,
      (unit.regenSuppressionRemaining ?? 0) - dt,
    );
    unit.attackTimer = Math.max(0, unit.attackTimer - dt);
    unit.hitFlash = Math.max(0, (unit.hitFlash ?? 0) - dt);
    unit.attackFlash = Math.max(0, (unit.attackFlash ?? 0) - dt);
    unit.hitStun = Math.max(0, (unit.hitStun ?? 0) - dt);
    unit.stunCooldown = Math.max(0, (unit.stunCooldown ?? 0) - dt);
    if (unit.action?.phase === "recovery" && unit.hitStun <= 1e-9) {
      unit.action.elapsed += dt;
      if (unit.action.elapsed >= unit.action.duration - 1e-9)
        unit.action = null;
    }
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
  resolveAttacks(state, dt);

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
    // Preserve full ticks when subtraction leaves only floating-point residue.
    const slice = remaining >= FIXED_STEP - 1e-9 ? FIXED_STEP : remaining;
    simulateFixedStep(state, slice);
    remaining -= slice;
  }
  return state;
}
