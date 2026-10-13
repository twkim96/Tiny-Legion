using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;
using TinyLegion.Domain.Data;

namespace TinyLegion.Domain.Combat
{
    // Pure deterministic simulation. No scene objects, physics or wall clock are authoritative.
    public sealed class BattleEngine
    {
        readonly GameCatalog catalog;
        readonly CharacterStatService stats;
        readonly CombatEffectService effects;
        readonly CombatEconomy economy;
        readonly JObject modifiers, enemyModifiers, levels, abilities;
        readonly HashSet<string> owned;
        readonly List<Spawn> schedule = new List<Spawn>();
        readonly double baseReward;
        int spawnIndex, nextUid = 1, nextProjectileUid = 1;
        public BattleState State { get; }
        double Anchor(string key, double fallback) => Js.N(catalog.Raw["constants"]?["battlefield"], key, fallback);
        double Timing(string key, double fallback) => Js.N(catalog.Raw["constants"]?["combatTiming"], key, fallback);
        sealed class Spawn { public double Time; public string Id; public JObject Overrides; public int Order; }
        sealed class Hit { public double Amount; public JObject Source; }
        sealed class Hits { public double Direction; public string Kind; public List<Hit> Entries = new List<Hit>(); }
        sealed class Batch
        {
            public Dictionary<int, Hits> Damage = new Dictionary<int, Hits>();
            public Dictionary<int, double> Healing = new Dictionary<int, double>();
            public double PlayerCastle, EnemyCastle;
        }
        public BattleEngine(GameCatalog catalog, JObject options = null)
        {
            this.catalog = catalog ?? throw new ArgumentNullException(nameof(catalog)); stats = new CharacterStatService(catalog); effects = new CombatEffectService(catalog); economy = new CombatEconomy(catalog); options = options ?? new JObject();
            var mode = Js.S(options, "mode", "idle"); if (!(mode == "idle" || mode == "challenge" || mode == "speedrun")) mode = "idle";
            var stageId = Js.N(options, "stageId", 1); JObject encounter = null;
            var onboardingPhase = Js.S(options, "onboardingPhase"); var guidePhase = Js.S(options, "earlyGuidePhase");
            if (mode == "challenge" && onboardingPhase != null) encounter = catalog.Raw["onboarding"]?[onboardingPhase] as JObject;
            if (encounter == null && mode != "speedrun" && stageId == 2 && guidePhase != null) encounter = catalog.Raw["earlyGuide"]?[guidePhase]?[mode] as JObject;
            var stage = encounter ?? (stageId == Math.Floor(stageId) ? catalog.Stage((int)stageId, mode) : null) ?? ((JArray)catalog.Raw[mode == "speedrun" ? "speedrunStages" : "stages"]).OfType<JObject>().First();
            var actualId = (int)Js.N(stage, "id"); var modeDuration = CombatEconomy.BattleDuration(actualId, mode);
            var requestedDuration = Js.Present(encounter?["duration"]) ? encounter["duration"] : Js.Present(options["duration"]) ? options["duration"] : null;
            var duration = Js.Clamp(Js.Number(requestedDuration, modeDuration), 0, modeDuration);
            var inputModifiers = Js.Obj(options["modifiers"]); var inputEnemies = Js.Obj(options["enemyModifiers"]);
            modifiers = CharacterStatService.CombineStatMultipliers(inputModifiers); modifiers["attackTypes"] = CharacterStatService.CombineAttackTypeMultipliers(inputModifiers);
            modifiers["goldIncome"] = Math.Max(1, Js.N(inputModifiers, "goldIncome", 1)); modifiers["killGold"] = Math.Max(0, Js.N(inputModifiers, "killGold")); modifiers["attributeBonuses"] = Js.Copy(inputModifiers["attributeBonuses"]);
            enemyModifiers = CharacterStatService.CombineStatMultipliers(stage["enemyModifiers"] as JObject, inputEnemies, new JObject { ["attack"] = stage["enemyAttack"]?.DeepClone() });
            // An absent enemyAttack is undefined in JS and defaults to one, not null/zero.
            if (stage.Property("enemyAttack") == null) enemyModifiers["attack"] = Js.N(CharacterStatService.CombineStatMultipliers(stage["enemyModifiers"] as JObject, inputEnemies), "attack");
            enemyModifiers["attackTypes"] = CharacterStatService.CombineAttackTypeMultipliers(stage["enemyModifiers"] as JObject, inputEnemies);
            levels = Js.Copy(options["levels"]); abilities = new JObject(); foreach (var unit in catalog.Units) { var id = Js.S(unit, "id"); abilities[id] = stats.NormalizeAbilities(id, options["abilities"]?[id] as JObject); }
            if (options["ownedUnits"] is JArray ownedArray) owned = new HashSet<string>(ownedArray.Select(t => (string)t));
            var hp = Math.Max(1, Js.N(stage, "enemyHp", 2000)); baseReward = Js.N(stage, "baseReward");
            State = new BattleState { Mode = mode, StageId = actualId, Scene = stage["scene"]?.DeepClone(), Duration = duration, Gold = 220, GoldCapacity = Js.Round(1000 * Math.Max(1, Js.N(inputModifiers, "goldCapacity", 1))), PlayerHp = 1000, PlayerMaxHp = 1000, EnemyHp = hp, EnemyMaxHp = hp };
            foreach (var unit in catalog.Units) State.SummonCooldowns[Js.S(unit, "id")] = 0;
            foreach (var id in options["sequence"] as JArray ?? (JArray)catalog.Raw["starterUnitIds"]) State.Sequence.Add(id.Type == JTokenType.String ? (string)id : null);
            int order = 0;
            foreach (JObject wave in stage["waves"] as JArray ?? new JArray()) foreach (JObject group in wave["enemies"] as JArray ?? new JArray())
            {
                var id = Js.S(group, "id"); if (catalog.Character(id, "enemy") == null) continue;
                var count = (int)Js.Clamp(Math.Floor(Js.N(group, "count", 1)), 0, 80); var interval = Math.Max(0, Js.N(group, "interval")); var overrides = new JObject();
                foreach (var key in new[] { "attribute", "effects", "statMultipliers" }) if (group.Property(key) != null) overrides[key] = group[key].DeepClone();
                for (int index = 0; index < count; index++) schedule.Add(new Spawn { Time = Math.Max(0, Js.N(wave, "time")) + interval * index, Id = id, Overrides = overrides, Order = order++ });
            }
            schedule.Sort((a, b) => { var cmp = a.Time.CompareTo(b.Time); return cmp != 0 ? cmp : a.Order.CompareTo(b.Order); });
        }
        void Emit(JObject evt) { evt["time"] = State.Time; State.Events.Add(evt); }
        int ActiveCount() => State.Units.Count(u => !u.Dead);
        double Cooldown(string id) => State.SummonCooldowns.TryGetValue(id, out var t) ? t : 0;
        BattleUnit MakeUnit(JObject definition, string team, double x, double level = 1)
        {
            var id = Js.S(definition, "id"); definition = stats.Get(definition, team, level, abilities[id] as JObject, team == "player" ? modifiers : null, team == "enemy" ? enemyModifiers : null);
            var unit = new BattleUnit { Uid = nextUid++, Id = id, Team = team, ArtId = Js.S(definition, "artId", id), Definition = definition, Boss = (bool?)definition["boss"] == true, SizeScale = Js.N(definition, "sizeScale", 1), Role = Js.S(definition, "role"), AttackType = Js.S(definition, "attackType"), Family = Js.S(definition, "family"), Attribute = Js.S(definition, "attribute"), Specialties = definition["specialties"] is JArray list ? (JArray)list.DeepClone() : new JArray(), GemAttributeBonuses = team == "player" ? Js.Copy(modifiers["attributeBonuses"]) : new JObject(), X = Js.Clamp(x, Anchor("WORLD_MIN", 0), Anchor("WORLD_MAX", 1200)), Hp = Js.N(definition, "hp"), MaxHp = Js.N(definition, "hp"), Attack = Js.N(definition, "attack"), Range = Js.N(definition, "range"), Speed = Js.N(definition, "speed"), AttackInterval = Js.N(definition, "attackInterval"), Facing = team == "player" ? 1 : -1, HitStunDuration = Timing("hitStun", .18), HitDirection = team == "player" ? -1 : 1 };
            effects.Initialize(unit, definition); return unit;
        }
        public bool Summon(string id)
        {
            if (State.Finished || id == null) return false; var definition = catalog.Character(id); if (definition == null || owned != null && !owned.Contains(id) || State.Gold < Js.N(definition, "cost") || Cooldown(id) > Js.Epsilon || ActiveCount() >= 80) return false;
            State.Gold -= Js.N(definition, "cost"); State.SummonCooldowns[id] = Js.N(definition, "cooldown"); var level = levels[id]; if (level is JObject o) level = o["level"];
            State.Units.Add(MakeUnit(definition, "player", Anchor("PLAYER_SPAWN_X", 122), Js.Clamp(Math.Floor(Js.Number(level, 1)), 1, 120))); State.WaitingReason = null;
            Emit(new JObject { ["type"] = "summon", ["x"] = Anchor("PLAYER_SPAWN_X", 122), ["team"] = "player", ["id"] = id }); return true;
        }
        void AdvanceQueue() { if (State.Sequence.Count > 0) State.QueueIndex = (State.QueueIndex + 1) % State.Sequence.Count; }
        void RunIdleQueue()
        {
            State.WaitingReason = null; int visited = 0; bool skipped = false, summoned = false;
            while (visited < State.Sequence.Count)
            {
                var id = State.Sequence[State.QueueIndex]; var definition = id == null ? null : catalog.Character(id);
                if (definition == null || owned != null && !owned.Contains(id)) { AdvanceQueue(); visited++; continue; }
                if (State.Gold < Js.N(definition, "cost")) { State.WaitingReason = "gold"; return; }
                if (Cooldown(id) > Js.Epsilon) { AdvanceQueue(); visited++; skipped = true; continue; }
                if (ActiveCount() >= 80) { State.WaitingReason = "capacity"; return; }
                if (Summon(id)) { AdvanceQueue(); visited++; summoned = true; } else { State.WaitingReason = State.Gold < Js.N(definition, "cost") ? "gold" : "capacity"; return; }
            }
            if (skipped && !summoned) State.WaitingReason = "cooldown";
        }
        void SpawnDueEnemies()
        {
            while (spawnIndex < schedule.Count)
            {
                var spawn = schedule[spawnIndex]; if (spawn.Time > State.Time + Js.Epsilon) break; spawnIndex++; if (ActiveCount() >= 80) continue;
                var definition = catalog.Character(spawn.Id, "enemy"); if (definition == null) continue;
                var merged = Js.Merge(definition, spawn.Overrides); merged["effects"] = Js.Merge(definition["effects"] as JObject, spawn.Overrides["effects"] as JObject);
                var enemy = MakeUnit(merged, "enemy", Anchor("ENEMY_SPAWN_X", 1132)); State.Units.Add(enemy); Emit(new JObject { ["type"] = "spawn", ["x"] = enemy.X, ["team"] = "enemy", ["id"] = enemy.Id });
            }
        }
        BattleTarget FindTarget(BattleUnit unit, IList<BattleUnit> units)
        {
            var target = units.Where(u => u.Team != unit.Team && !u.Dead).OrderBy(u => Math.Abs(u.X - unit.X)).ThenBy(u => u.SourceUid, StringComparer.Ordinal).FirstOrDefault();
            if (target != null) return new BattleTarget { Kind = "unit", Uid = target.Uid, X = target.X, Team = target.Team };
            if (unit.Team == "player" && State.Mode == "idle") return null;
            return new BattleTarget { Kind = "castle", X = unit.Team == "player" ? Anchor("ENEMY_CASTLE_X", 1120) : Anchor("PLAYER_CASTLE_X", 80), Team = unit.Team == "player" ? "enemy" : "player" };
        }
        void MoveUnits(double dt)
        {
            var units = State.Units.Where(u => !u.Dead).ToList(); var positions = units.ToDictionary(u => u.Uid, u => u.X);
            foreach (var unit in units)
            {
                unit.Moving = false; if (unit.Action != null || unit.HitStun > 0) continue; var target = FindTarget(unit, units); if (target == null) continue;
                var targetX = target.Kind == "unit" ? positions[target.Uid] : target.X; var delta = targetX - unit.X; if (delta != 0) unit.Facing = Math.Sign(delta);
                var remaining = Math.Abs(delta) - CombatEffectService.CombatStat(unit, "range"); if (remaining <= 0) continue;
                var movement = Math.Min(remaining, CombatEffectService.CombatStat(unit, "speed") * dt); unit.X = Js.Clamp(unit.X + Math.Sign(delta) * movement, Anchor("WORLD_MIN", 0), Anchor("WORLD_MAX", 1200)); unit.Moving = movement > 0;
            }
        }
        static void AddDamage(Batch batch, BattleUnit unit, double amount, double direction, string kind, JObject source)
        {
            if (!batch.Damage.TryGetValue(unit.Uid, out var hits)) batch.Damage[unit.Uid] = hits = new Hits(); hits.Direction = direction; hits.Kind = kind; hits.Entries.Add(new Hit { Amount = amount, Source = source });
        }
        static void QueueHealing(Batch batch, BattleUnit unit, JObject spec)
        {
            if (unit == null || unit.Dead || !CombatEffectService.Matches(spec, unit.Subject())) return; var amount = CombatEffectService.HealingAmount(unit, spec) * CombatEffectService.HealingFactor(unit, spec);
            batch.Healing[unit.Uid] = (batch.Healing.TryGetValue(unit.Uid, out var previous) ? previous : 0) + amount;
        }
        static BattleTarget CurrentTarget(BattleTarget target, IList<BattleUnit> units)
        {
            var unit = target.Kind == "unit" ? units.FirstOrDefault(u => u.Uid == target.Uid && !u.Dead) : null; var result = target.Copy(); if (unit != null) result.X = unit.X; return result;
        }
        void Impact(BattleProjectile shot, IList<BattleUnit> units, Batch batch)
        {
            var target = shot.Target; var primary = target.Kind == "unit" ? units.FirstOrDefault(u => u.Uid == target.Uid && !u.Dead) : null; var center = primary?.X ?? target.X; bool hit = false;
            foreach (var candidate in units)
            {
                if (candidate.Team != target.Team || candidate.Dead) continue;
                if (candidate.Uid != primary?.Uid && !(shot.SplashRadius > 0 && CombatEffectService.Matches(CombatEffectService.EffectOf(shot.Source, "areaAttack"), candidate.Subject()) && Math.Abs(candidate.X - center) <= shot.SplashRadius)) continue;
                var direction = Math.Sign(candidate.X - shot.StartX); AddDamage(batch, candidate, shot.Damage, direction != 0 ? direction : shot.Team == "player" ? 1 : -1, shot.Kind, shot.Source); hit = true;
            }
            var castle = new JObject { ["kind"] = "castle", ["team"] = target.Team };
            if (target.Kind == "castle" || shot.SplashRadius > 0 && CombatEffectService.Matches(CombatEffectService.EffectOf(shot.Source, "areaAttack"), castle) && Math.Abs((target.Team == "enemy" ? Anchor("ENEMY_CASTLE_X", 1120) : Anchor("PLAYER_CASTLE_X", 80)) - center) <= shot.SplashRadius)
            {
                if (target.Team == "player") { batch.PlayerCastle += shot.Damage; hit = true; }
                else if (State.Mode != "idle") { var bonus = CombatEffectService.EffectOf(shot.Source, "castleDamage"); batch.EnemyCastle += shot.Damage * (shot.Team == "player" ? 1 + Math.Max(0, CombatEffectService.Matches(bonus, castle) ? Js.N(bonus, "bonus") : 0) : 1); hit = true; }
            }
            Emit(new JObject { ["type"] = "impact", ["x"] = center, ["team"] = shot.Team, ["kind"] = shot.Kind, ["splashRadius"] = shot.SplashRadius, ["hit"] = hit });
        }
        void AdvanceProjectiles(double dt, IList<BattleUnit> units, Batch batch)
        {
            foreach (var projectile in State.Projectiles) { projectile.Target = CurrentTarget(projectile.Target, units); projectile.TargetX = projectile.Target.X; projectile.Elapsed = Math.Min(projectile.Duration, projectile.Elapsed + dt); if (projectile.Elapsed >= projectile.Duration - Js.Epsilon) Impact(projectile, units, batch); }
            State.Projectiles.RemoveAll(p => p.Elapsed >= p.Duration - Js.Epsilon);
        }
        void ResolveAttacks(double dt)
        {
            var units = State.Units.Where(u => !u.Dead).ToList(); var batch = new Batch();
            foreach (var unit in units) effects.TickRepulsion(unit, dt, units, spec => Emit(new JObject { ["type"] = "repel-warning", ["x"] = unit.X, ["team"] = unit.Team, ["radius"] = spec["range"].DeepClone(), ["duration"] = spec["warning"].DeepClone() }), spec => Emit(new JObject { ["type"] = "repel-pulse", ["x"] = unit.X, ["team"] = unit.Team, ["radius"] = spec["range"].DeepClone() }));
            foreach (var unit in units) effects.TickPeriodicEffects(unit, dt, spec => QueueHealing(batch, unit, spec), (amount, direction, source) => AddDamage(batch, unit, amount, direction, "poison", source));
            AdvanceProjectiles(dt, units, batch);
            foreach (var unit in units)
            {
                if (unit.HitStun > 0) continue; var definition = unit.Definition ?? catalog.Character(unit.Id, unit.Team); if (definition == null || unit.ActionPhase == "recovery") continue;
                if (unit.Action == null)
                {
                    if (unit.AttackTimer > Js.Epsilon) continue; var target = FindTarget(unit, units); if (target == null || Math.Abs(target.X - unit.X) > CombatEffectService.CombatStat(unit, "range") + Js.Epsilon) continue;
                    var facing = Math.Sign(target.X - unit.X); if (facing != 0) unit.Facing = facing; unit.Moving = false; unit.AttackTimer = CombatEffectService.CombatStat(unit, "attackInterval");
                    unit.Action = new BattleAction { Phase = "windup", Duration = Js.N(definition, "attackWindup"), Kind = Js.S(definition["projectile"], "kind", "melee"), Target = target }; continue;
                }
                unit.Action.Elapsed = Math.Min(unit.Action.Duration, unit.Action.Elapsed + dt); if (unit.Action.Elapsed < unit.Action.Duration - Js.Epsilon) continue;
                var releaseTarget = CurrentTarget(unit.Action.Target, units); var kind = unit.Action.Kind;
                unit.Action = new BattleAction { Phase = "recovery", Duration = Js.N(definition, "attackRecovery"), Kind = kind, Target = releaseTarget }; unit.AttackFlash = Js.N(definition, "attackRecovery");
                var shot = new BattleProjectile { Uid = nextProjectileUid++, SourceUid = unit.Uid, Id = unit.Id, Team = unit.Team, StartX = unit.X, TargetX = releaseTarget.X, Target = releaseTarget, Damage = CombatEffectService.CombatStat(unit, "attack"), Source = effects.AttackSource(unit, units), SplashRadius = Js.N(CombatEffectService.EffectOf(unit, "areaAttack"), "radius"), Kind = kind };
                Emit(new JObject { ["type"] = "attack", ["uid"] = unit.SourceUid, ["x"] = unit.X, ["targetX"] = releaseTarget.X, ["team"] = unit.Team, ["id"] = unit.Id, ["kind"] = kind });
                if (definition["projectile"] is JObject projectile) { shot.Duration = Js.Clamp(Math.Abs(releaseTarget.X - unit.X) / Js.N(projectile, "speed"), .1, .6); State.Projectiles.Add(shot); }
                else if (Math.Abs(releaseTarget.X - unit.X) <= CombatEffectService.CombatStat(unit, "range") + Js.Epsilon) Impact(shot, units, batch);
                else Emit(new JObject { ["type"] = "impact", ["x"] = releaseTarget.X, ["team"] = unit.Team, ["kind"] = kind, ["hit"] = false, ["splashRadius"] = 0 });
                var healing = CombatEffectService.EffectOf(unit, "healing"); var ally = CombatEffectService.SupportTarget(unit, units, healing); if (ally != null) QueueHealing(batch, ally, healing);
            }
            ApplyDamage(units, batch);
        }
        void ApplyDamage(IList<BattleUnit> units, Batch batch)
        {
            foreach (var unit in units)
            {
                batch.Damage.TryGetValue(unit.Uid, out var hit); double damage = 0, shieldDamage = 0;
                foreach (var entry in hit?.Entries ?? new List<Hit>())
                {
                    var resolved = effects.ResolveDamage(unit, entry.Amount, entry.Source);
                    if (resolved.Blocked) { Emit(new JObject { ["type"] = "blocked", ["x"] = unit.X, ["team"] = unit.Team, ["uid"] = unit.SourceUid }); continue; }
                    unit.Shield = Math.Max(0, unit.Shield - resolved.ShieldDamage); shieldDamage += resolved.ShieldDamage; damage += resolved.HpDamage;
                    effects.ApplyHitEffects(unit, entry.Source, resolved.HpDamage, entry.Amount, hit.Direction);
                }
                var healing = batch.Healing.TryGetValue(unit.Uid, out var amount) ? amount : 0; if (damage == 0 && shieldDamage == 0 && healing == 0) continue;
                unit.Hp = Js.Clamp(unit.Hp - damage + healing, 0, unit.MaxHp);
                if (damage > 0 || shieldDamage > 0)
                {
                    unit.HitFlash = Timing("hitFlash", .18); unit.HitDirection = hit.Direction;
                    if (damage > 0 && unit.Hp > 0 && unit.StunCooldown <= Js.Epsilon)
                    {
                        effects.ApplyEffect(unit, effects.Effect("hitStun", new JObject { ["duration"] = damage >= unit.MaxHp * Timing("heavyHitRatio", .2) ? Timing("heavyHitStun", .24) : Timing("hitStun", .18) })); unit.StunCooldown = Timing("stunCooldown", .65); unit.Moving = false;
                    }
                    Emit(new JObject { ["type"] = "hit", ["uid"] = unit.SourceUid, ["x"] = unit.X, ["team"] = unit.Team, ["id"] = unit.Id, ["kind"] = hit.Kind, ["amount"] = damage + shieldDamage });
                }
                if (unit.Hp <= 0)
                {
                    unit.Dead = true; unit.Moving = false; unit.Action = null; unit.DeathTime = Timing("death", .32);
                    if (unit.Team == "enemy" && Js.N(modifiers, "killGold") > 0) { var gold = 18 * Js.N(modifiers, "killGold"); State.Gold = Math.Min(State.GoldCapacity, State.Gold + gold); Emit(new JObject { ["type"] = "gold", ["x"] = unit.X, ["team"] = "player", ["amount"] = gold }); }
                    Emit(new JObject { ["type"] = "death", ["uid"] = unit.SourceUid, ["x"] = unit.X, ["team"] = unit.Team, ["id"] = unit.Id });
                }
                else if (healing > 0) Emit(new JObject { ["type"] = "heal", ["x"] = unit.X, ["team"] = unit.Team, ["amount"] = healing });
            }
            if (batch.PlayerCastle > 0) { State.PlayerHp = Math.Max(0, State.PlayerHp - batch.PlayerCastle); Emit(new JObject { ["type"] = "castle-hit", ["x"] = Anchor("PLAYER_CASTLE_X", 80), ["team"] = "player", ["amount"] = batch.PlayerCastle }); }
            if (batch.EnemyCastle > 0) { State.EnemyHp = Math.Max(0, State.EnemyHp - batch.EnemyCastle); Emit(new JObject { ["type"] = "castle-hit", ["x"] = Anchor("ENEMY_CASTLE_X", 1120), ["team"] = "enemy", ["amount"] = batch.EnemyCastle }); }
        }
        public bool FireCannon()
        {
            if (State.Finished || State.Mode == "idle") return false;
            var enemies = State.Units.Where(u => !u.Dead && u.Team == "enemy").ToList(); var batch = new Batch(); var source = new JObject { ["team"] = "player", ["attackType"] = "ranged", ["family"] = null, ["attribute"] = "normal" };
            foreach (var enemy in enemies) AddDamage(batch, enemy, Js.N(catalog.Raw["constants"]?["cannon"], "damage", 110), 1, "cannon", source); ApplyDamage(enemies, batch);
            foreach (var enemy in enemies) if (!CombatEffectService.BlocksAttack(enemy, source)) effects.ApplyEffect(enemy, Js.Obj(catalog.Raw["constants"]?["cannon"]?["knockback"]), new EffectContext { Source = source, Direction = 1, MaxX = Anchor("ENEMY_CASTLE_X", 1120) - 10 }); return true;
        }
        void AdvanceTimers(double dt)
        {
            foreach (var id in State.SummonCooldowns.Keys.ToArray()) State.SummonCooldowns[id] = Math.Max(0, State.SummonCooldowns[id] - dt);
            foreach (var unit in State.Units)
            {
                if (unit.Dead) { unit.DeathTime = Math.Max(0, unit.DeathTime - dt); continue; }
                CombatEffectService.AdvanceEffects(unit, dt); unit.AttackTimer = Math.Max(0, unit.AttackTimer - dt); unit.HitFlash = Math.Max(0, unit.HitFlash - dt); unit.AttackFlash = Math.Max(0, unit.AttackFlash - dt); unit.StunCooldown = Math.Max(0, unit.StunCooldown - dt);
                if (unit.ActionPhase == "recovery" && unit.HitStun <= Js.Epsilon) { unit.Action.Elapsed += dt; if (unit.Action.Elapsed >= unit.Action.Duration - Js.Epsilon) unit.Action = null; }
            }
            State.Units.RemoveAll(u => u.Dead && u.DeathTime <= 0);
        }
        void Finish(bool won)
        {
            if (State.Finished) return; State.Finished = true; var hpRatio = Js.Clamp(State.PlayerHp / State.PlayerMaxHp, 0, 1); var survival = Math.Max(0, State.Time);
            State.Result = new JObject { ["won"] = won, ["survival"] = survival, ["hpRatio"] = hpRatio, ["time"] = State.Time, ["reward"] = State.Mode == "idle" ? economy.CalculateIdleReward(State.StageId, survival, hpRatio, State.Duration) : won ? baseReward : 0 };
        }
        void Simulate(double dt)
        {
            var next = State.Time + dt; State.Time = next >= State.Duration - Js.Epsilon ? State.Duration : next;
            AdvanceTimers(dt); State.Gold = Math.Min(State.GoldCapacity, State.Gold + 35 * Js.N(modifiers, "goldIncome", 1) * dt); SpawnDueEnemies(); if (State.Mode == "idle") RunIdleQueue(); MoveUnits(dt); ResolveAttacks(dt);
            if (State.PlayerHp <= 0) Finish(false); else if (State.Mode != "idle" && State.EnemyHp <= 0) Finish(true); else if (State.Time >= State.Duration - Js.Epsilon) Finish(State.Mode == "idle");
        }
        public void Step(double dt)
        {
            if (State.Finished || !Js.Finite(dt) || dt <= 0) return;
            if (State.Time >= State.Duration) { Finish(State.Mode == "idle" && State.PlayerHp > 0); return; }
            State.Events = new JArray(); var remaining = Math.Min(dt, State.Duration - State.Time); var fixedStep = Timing("step", 1.0 / 30);
            while (remaining > Js.Epsilon && !State.Finished) { var slice = remaining >= fixedStep - Js.Epsilon ? fixedStep : remaining; Simulate(slice); remaining -= slice; }
        }
        public JObject Snapshot()
        {
            var units = new JArray(); foreach (var unit in State.Units)
            {
                var value = new JObject { ["uid"] = unit.SourceUid, ["id"] = unit.Id, ["team"] = unit.Team, ["artId"] = unit.ArtId, ["boss"] = unit.Boss, ["sizeScale"] = unit.SizeScale, ["role"] = unit.Role, ["attackType"] = unit.AttackType, ["family"] = unit.Family, ["attribute"] = unit.Attribute, ["specialties"] = unit.Specialties.DeepClone(), ["x"] = unit.X, ["hp"] = unit.Hp, ["maxHp"] = unit.MaxHp, ["attack"] = unit.Attack, ["range"] = unit.Range, ["speed"] = unit.Speed, ["attackTimer"] = unit.AttackTimer, ["attackInterval"] = unit.AttackInterval, ["hitFlash"] = unit.HitFlash, ["attackFlash"] = unit.AttackFlash, ["action"] = unit.Action?.Snapshot(), ["facing"] = unit.Facing, ["moving"] = unit.Moving, ["hitStun"] = unit.HitStun, ["hitStunDuration"] = unit.HitStunDuration, ["hitDirection"] = unit.HitDirection, ["stunCooldown"] = unit.StunCooldown, ["effects"] = unit.Effects.DeepClone(), ["statusEffects"] = unit.StatusEffects.DeepClone(), ["periodicTimers"] = JObject.FromObject(unit.PeriodicTimers), ["shield"] = unit.Shield, ["maxShield"] = unit.MaxShield };
                if (unit.Team == "player") value["gemAttributeBonuses"] = unit.GemAttributeBonuses.DeepClone(); if (unit.Dead) { value["dead"] = true; value["deathTimer"] = unit.DeathTime; } units.Add(value);
            }
            var result = new JObject { ["mode"] = State.Mode, ["stageId"] = State.StageId, ["scene"] = State.Scene?.DeepClone(), ["time"] = State.Time, ["duration"] = State.Duration, ["gold"] = State.Gold, ["maxGold"] = State.GoldCapacity, ["playerHp"] = State.PlayerHp, ["playerMaxHp"] = State.PlayerMaxHp, ["enemyHp"] = State.EnemyHp, ["enemyMaxHp"] = State.EnemyMaxHp, ["units"] = units, ["projectiles"] = new JArray(State.Projectiles.Select(p => p.Snapshot())), ["cooldowns"] = JObject.FromObject(State.SummonCooldowns), ["sequence"] = new JArray(State.Sequence), ["sequenceIndex"] = State.QueueIndex, ["finished"] = State.Finished, ["result"] = State.Result?.DeepClone(), ["events"] = State.Events.DeepClone(), ["_spawnIndex"] = spawnIndex, ["_nextUid"] = nextUid, ["_nextProjectileUid"] = nextProjectileUid };
            if (State.WaitingReason != null) result["waitingReason"] = State.WaitingReason; return result;
        }
    }
}
