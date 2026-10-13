using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using TinyLegion.Domain.Data;

namespace TinyLegion.Domain.Combat
{
    public sealed class CombatEffectService
    {
        readonly GameCatalog catalog;
        readonly Dictionary<string,HashSet<string>> targetRegistries=new Dictionary<string,HashSet<string>>();
        static readonly string[] Axes = { "attackType", "family", "attribute" };
        static readonly HashSet<string> Installed = new HashSet<string> { "sturdy", "strong", "devastating", "immunity", "attackImmunity", "repelPulse", "areaAttack", "shieldDamageAura", "castleDamage", "shieldDamage" };
        public CombatEffectService(GameCatalog catalog) { this.catalog = catalog; foreach(var axis in Axes)targetRegistries[axis]=new HashSet<string>(Registry(axis),StringComparer.Ordinal); }
        public bool IsTrait(string type) => type == "sturdy" || type == "strong" || type == "devastating";
        public IEnumerable<string> TraitFields(string type) => IsTrait(type) ? Js.Obj(catalog.Raw["effects"]?[type]?["defaults"]).Properties().Select(p => p.Name) : Enumerable.Empty<string>();
        public JObject Descriptor(string type) => Js.Copy(catalog.Raw["effects"]?[type]);
        public static string EffectOrigin(string category, string id = null, string option = null)
        {
            if (category == "battle") return category;
            if (!(category == "gem" || category == "ability" || category == "upgrade") || string.IsNullOrWhiteSpace(id) || category == "gem" && string.IsNullOrWhiteSpace(option)) throw new ArgumentException("Invalid effect origin");
            return (category == "gem" ? new JArray(category, id, option) : new JArray(category, id)).ToString(Formatting.None);
        }
        public static string EffectKind(JObject spec)
        {
            if (Js.S(spec, "type") != "stat") return Js.S(spec, "type");
            var signs = new[] { Math.Sign(Js.N(spec, "multiplier", 1) - 1), Math.Sign(Js.N(spec, "flat")) }.Where(v => v != 0).ToArray();
            var direction = signs.All(v => v >= 0) ? "increase" : signs.All(v => v <= 0) ? "decrease" : "mixed";
            var selection = spec["attackType"]; var typeText = selection is JArray array ? string.Join(",", array.Select(v => (string)v)) : (string)selection ?? "all";
            return "stat:" + Js.S(spec, "stat") + ":" + direction + ":" + typeText;
        }
        public static string EffectKey(string origin, JObject spec) => new JArray(origin, EffectKind(spec)).ToString(Formatting.None);
        IEnumerable<string> Registry(string axis)
        {
            if (axis == "attribute") return ((JArray)catalog.Raw["attributes"]).OfType<JObject>().Select(a => Js.S(a, "id")).Concat(new[] { Js.S(catalog.Raw["neutralAttribute"], "id") });
            return Js.Obj(catalog.Raw[axis == "family" ? "families" : "attackTypes"]).Properties().Select(p => p.Name);
        }
        public JObject NormalizeTargets(JObject values)
        {
            var result = new JObject();
            foreach (var axis in Axes)
            {
                var selection = values?[axis]; if (!Js.Present(selection) || selection.Type == JTokenType.String && (string)selection == "all") { result[axis] = "all"; continue; }
                var list = selection is JArray array ? array.Select(v => v.Type == JTokenType.String ? (string)v : null).Distinct().OrderBy(v => v, StringComparer.Ordinal).ToArray() : new[] { selection.Type == JTokenType.String ? (string)selection : null };
                var valid = targetRegistries[axis]; if (list.Length == 0 || list.Any(v => v == null || !valid.Contains(v))) throw new ArgumentException("Invalid effect target." + axis);
                result[axis] = selection is JArray ? (JToken)new JArray(list) : new JValue(list[0]);
            }
            return result;
        }
        public static bool Matches(JObject spec, JObject subject)
        {
            foreach (var axis in Axes)
            {
                var selection = spec?[axis]; if (!Js.Present(selection) || selection.Type == JTokenType.String && (string)selection == "all") continue;
                var value = subject?[axis]; if (selection is JArray list) { if (!list.Any(v => JToken.DeepEquals(v, value))) return false; } else if (!JToken.DeepEquals(selection, value)) return false;
            }
            return true;
        }
        public static JObject EffectOf(JObject subject, string type) => subject?["effects"]?[type] as JObject;
        public static JObject EffectOf(BattleUnit unit, string type) => unit?.Effects?[type] as JObject;
        public JObject Effect(string type, JObject values = null)
        {
            var descriptor = catalog.Raw["effects"]?[type] as JObject; if (descriptor == null) throw new ArgumentException("Unknown effect: " + type);
            var result = Js.Copy(values); result["type"] = type;
            foreach (var p in NormalizeTargets(values).Properties()) result[p.Name] = p.Value.DeepClone();
            foreach (var p in Js.Obj(descriptor["defaults"]).Properties()) if (!Js.Present(result[p.Name])) result[p.Name] = p.Value.DeepClone();
            if (Js.Present(result["origin"]) && (result["origin"].Type != JTokenType.String || string.IsNullOrWhiteSpace((string)result["origin"]))) throw new ArgumentException("Invalid effect origin");
            foreach (var field in (JArray)descriptor["fields"])
            {
                var key = (string)field; var value = result[key]; if (!Js.Present(value)) continue;
                if (!(value.Type == JTokenType.Float || value.Type == JTokenType.Integer) || !Js.Finite(Js.Number(value, double.NaN)) || key != "flat" && Js.N(result, key) < 0) throw new ArgumentException("Invalid " + type + "." + key);
            }
            Func<string, bool> numeric = key => result[key] != null && (result[key].Type == JTokenType.Float || result[key].Type == JTokenType.Integer) && Js.Finite(Js.Number(result[key], double.NaN));
            if ((type == "slow" || type == "healingSuppression") && (!numeric("factor") || Js.N(result, "factor") > 1 || !(Js.N(result, "duration") > 0))) throw new ArgumentException("Invalid " + type);
            if ((type == "poison" || type == "regeneration") && !(Js.N(result, "interval") > 0)) throw new ArgumentException("Invalid interval");
            if (type == "poison" && (!(Js.N(result, "duration") > 0) || !numeric("ratio"))) throw new ArgumentException("Invalid poison");
            if ((type == "healing" || type == "regeneration" || type == "shield") && !(Js.N(result, "amount") > 0 || Js.N(result, "hpRatio") > 0)) throw new ArgumentException("Invalid amount");
            if (type == "immunity" && catalog.Raw["effects"]?[Js.S(result, "effect", "")] == null) throw new ArgumentException("Invalid immunity");
            if (type == "repelPulse")
            {
                if (!(Js.N(result, "interval") > 0) || !numeric("range") || !numeric("distance")) throw new ArgumentException("Invalid repelPulse");
                result["interval"] = Math.Max(1.0 / 30, Js.N(result, "interval")); if (!Js.Present(result["warning"])) result["warning"] = 0;
                if (Js.N(result, "warning") >= Js.N(result, "interval")) throw new ArgumentException("Invalid warning");
            }
            if (type == "healingSuppression" && Js.Present(result["scope"]) && Js.S(result, "scope") != "all" && Js.S(result, "scope") != "regeneration") throw new ArgumentException("Invalid scope");
            if (type == "healing" && !numeric("range")) throw new ArgumentException("Invalid range");
            if (new[] { "areaAttack", "knockback", "castleDamage", "shieldDamage", "shieldDamageAura", "hitStun" }.Contains(type) && ((JArray)descriptor["fields"]).Any(v => !numeric((string)v))) throw new ArgumentException("Invalid " + type);
            if (type == "stat")
            {
                if (!Js.Present(result["multiplier"])) result["multiplier"] = 1; if (!Js.Present(result["flat"])) result["flat"] = 0;
                if (!CharacterStatService.StatKeys.Contains(Js.S(result, "stat")) || Js.S(result, "stat") == "hp" || !(Js.N(result, "duration") > 0)) throw new ArgumentException("Invalid stat");
            }
            if (type == "poison" || type == "regeneration") result["interval"] = Math.Max(1.0 / 30, Js.N(result, "interval"));
            return result;
        }
        public JObject NormalizeEffects(JObject values)
        {
            var result = new JObject(); foreach (var p in (values ?? new JObject()).Properties()) result[p.Name] = !Js.Truthy(p.Value) ? (JToken)new JValue(false) : Effect(p.Name, p.Value as JObject); return result;
        }
        public static IEnumerable<JObject> ActiveEffects(BattleUnit unit, string type) => unit.StatusEffects.Properties().Select(p => p.Value).OfType<JObject>().Where(s => Js.S(s, "type") == type && Js.N(s, "remaining") > 0);
        public static double RemainingEffect(BattleUnit unit, string type) => ActiveEffects(unit, type).Select(s => Js.N(s, "remaining")).DefaultIfEmpty(0).Max();
        public static bool IsImmune(BattleUnit unit, string type, JObject source = null) { var spec = EffectOf(unit, "immunity"); return Js.S(spec, "effect") == type && Matches(spec, source ?? unit.Subject()); }
        public static double EffectFactor(BattleUnit unit, string type, string scope = "all") => ActiveEffects(unit, type).Where(s => scope == "regeneration" || Js.S(s, "scope") != "regeneration").Aggregate(1.0, (f, s) => f * Js.N(s, "factor"));
        public static double HealingAmount(BattleUnit unit, JObject spec) => Math.Max(0, Js.N(spec, "amount")) + Math.Max(0, unit.MaxHp) * Math.Max(0, Js.N(spec, "hpRatio"));
        public static double HealingFactor(BattleUnit unit, JObject spec) => EffectFactor(unit, "healingSuppression", Js.S(spec, "type") == "regeneration" ? "regeneration" : "all");
        public static double HealUnit(BattleUnit unit, JObject spec)
        {
            if (unit == null || unit.Dead || !Matches(spec, unit.Subject())) return 0;
            var before = unit.Hp; unit.Hp = Math.Min(unit.MaxHp, unit.Hp + HealingAmount(unit, spec) * HealingFactor(unit, spec)); return unit.Hp - before;
        }
        public void Initialize(BattleUnit unit, JObject definition)
        {
            unit.Effects = Js.Copy(definition["effects"]); unit.StatusEffects = new JObject(); unit.PeriodicTimers.Clear();
            var shield = EffectOf(unit, "shield"); unit.Shield = unit.MaxShield = Js.Round(Matches(shield, unit.Subject()) ? HealingAmount(unit, shield) : 0);
            var regen = EffectOf(unit, "regeneration"); if (regen != null && Matches(regen, unit.Subject())) unit.PeriodicTimers["regeneration"] = Js.N(regen, "interval");
            var repel = EffectOf(unit, "repelPulse"); if (repel != null) unit.PeriodicTimers["repelPulse"] = Js.N(repel, "interval");
        }
        public bool ApplyEffect(BattleUnit unit, JObject spec, EffectContext context = null)
        {
            if (unit == null || unit.Dead || spec == null) return false;
            try { spec = Effect(Js.S(spec, "type"), spec); } catch (ArgumentException) { return false; }
            context = context ?? new EffectContext(); var type = Js.S(spec, "type");
            if (!Installed.Contains(type) && !Matches(spec, unit.Subject()) || IsImmune(unit, type, context.Source ?? unit.Subject())) return false;
            var origin = context.Origin ?? Js.S(spec, "origin") ?? Js.S(context.Source, "origin") ?? "battle";
            if (string.IsNullOrWhiteSpace(origin) || !Js.Finite(context.DurationMultiplier) || context.DurationMultiplier <= 0) return false;
            var key = EffectKey(origin, spec); var status = Js.Copy(spec); status["origin"] = origin; status["remaining"] = Js.N(spec, "duration") * context.DurationMultiplier;
            if (type == "slow" || type == "healingSuppression" || type == "stat") unit.StatusEffects[key] = status;
            else if (type == "poison")
            {
                var previous = unit.StatusEffects[key] as JObject; var source = Js.Copy(context.Source);
                foreach (var p in Js.Obj(source["effects"]).Properties().ToArray()) if (Js.S(catalog.Raw["effects"]?[Js.S(p.Value, "type", "")], "trigger") == "hit") p.Remove();
                status["tickRemaining"] = Js.N(previous, "remaining") > 0 ? Math.Min(Js.N(previous, "tickRemaining"), Js.N(spec, "interval")) : Js.N(spec, "interval");
                status["damage"] = Math.Max(0, Js.Finite(context.Damage) ? context.Damage : 0) * Js.N(spec, "ratio"); status["direction"] = Js.Finite(context.Direction) ? context.Direction : 0; status["source"] = source; unit.StatusEffects[key] = status;
            }
            else if (type == "healing") return HealUnit(unit, spec) > 0;
            else if (type == "shield") { unit.Shield = Math.Max(unit.Shield, Js.Round(HealingAmount(unit, spec))); unit.MaxShield = Math.Max(unit.MaxShield, unit.Shield); }
            else if (type == "knockback")
            {
                if (!Js.Finite(unit.X) || !Js.Finite(context.Direction)) return false;
                var before = unit.X; unit.X = Js.Clamp(unit.X + Math.Sign(context.Direction) * Js.N(spec, "distance"), context.MinX, context.MaxX);
                if (before != unit.X) { if (context.CancelWindup && unit.ActionPhase == "windup") unit.Action = null; unit.Moving = false; }
            }
            else if (type == "hitStun") { unit.StatusEffects[key] = status; SyncHitStun(unit); unit.Moving = false; }
            else if (Installed.Contains(type) || type == "regeneration") { unit.Effects[type] = spec.DeepClone(); if (type == "regeneration" || type == "repelPulse") unit.PeriodicTimers[type] = Js.N(spec, "interval"); }
            else return false;
            return true;
        }
        static void SyncHitStun(BattleUnit unit)
        {
            var longest = ActiveEffects(unit, "hitStun").OrderByDescending(s => Js.N(s, "remaining")).FirstOrDefault(); unit.HitStun = Js.N(longest, "remaining"); if (longest != null) unit.HitStunDuration = Js.N(longest, "duration");
        }
        public static void AdvanceEffects(BattleUnit unit, double dt)
        {
            if (!Js.Finite(dt) || dt <= 0) return;
            var managed = ActiveEffects(unit, "hitStun").Any();
            foreach (var p in unit.StatusEffects.Properties().ToArray()) { var status = (JObject)p.Value; if (Js.S(status, "type") == "poison") continue; status["remaining"] = Math.Max(0, Js.N(status, "remaining") - dt); if (Js.N(status, "remaining") <= Js.Epsilon) p.Remove(); }
            if (managed) SyncHitStun(unit); else unit.HitStun = Math.Max(0, unit.HitStun - dt);
        }
        public static double CombatStat(BattleUnit unit, string stat)
        {
            double value;
            switch (stat) { case "hp": value = unit.Hp; break; case "attack": value = unit.Attack; break; case "speed": value = unit.Speed; break; case "range": value = unit.Range; break; case "attackInterval": value = unit.AttackInterval; break; default: value = 0; break; }
            var statuses = ActiveEffects(unit, "stat").Where(s => Js.S(s, "stat") == stat && Matches(s, unit.Subject())).ToArray(); value += statuses.Sum(s => Js.N(s, "flat")); foreach (var s in statuses) value *= Js.N(s, "multiplier", 1);
            if (stat == "speed") value *= EffectFactor(unit, "slow"); return Math.Max(stat == "hp" ? 1 : stat == "attackInterval" ? .2 : 0, value);
        }
        public void TickPeriodicEffects(BattleUnit unit, double dt, Action<JObject> heal, Action<double, double, JObject> damage)
        {
            if (unit.Dead || !Js.Finite(dt) || dt <= 0) return;
            foreach (var p in unit.StatusEffects.Properties().ToArray())
            {
                var poison = (JObject)p.Value; if (Js.S(poison, "type") != "poison") continue;
                if (IsImmune(unit, "poison", Js.Obj(poison["source"]))) { p.Remove(); continue; }
                var active = Math.Min(dt, Js.N(poison, "remaining")); poison["remaining"] = Math.Max(0, Js.N(poison, "remaining") - active); var next = Js.N(poison, "tickRemaining") - active;
                while (next <= Js.Epsilon) { damage(Js.N(poison, "damage"), Js.N(poison, "direction"), Js.Obj(poison["source"])); next += Js.N(poison, "interval"); } poison["tickRemaining"] = next;
                if (Js.N(poison, "remaining") <= Js.Epsilon) p.Remove();
            }
            var regen = EffectOf(unit, "regeneration"); if (regen != null && Matches(regen, unit.Subject()))
            {
                var timer = (unit.PeriodicTimers.TryGetValue("regeneration", out var t) ? t : Js.N(regen, "interval")) - dt;
                while (timer <= Js.Epsilon) { heal(regen); timer += Js.N(regen, "interval"); } unit.PeriodicTimers["regeneration"] = timer;
            }
        }
        public void TickRepulsion(BattleUnit unit, double dt, IList<BattleUnit> units, Action<JObject> warning = null, Action<JObject> pulse = null)
        {
            var spec = EffectOf(unit, "repelPulse"); if (spec == null || unit.Dead || !Js.Finite(dt) || dt <= 0) return;
            var before = unit.PeriodicTimers.TryGetValue("repelPulse", out var t) ? t : Js.N(spec, "interval"); var remaining = before - dt;
            if (Js.N(spec, "warning") > 0 && before > Js.N(spec, "warning") && remaining <= Js.N(spec, "warning")) warning?.Invoke(spec);
            while (remaining <= Js.Epsilon)
            {
                foreach (var target in units) if (!target.Dead && target.Team != unit.Team && Matches(spec, target.Subject()) && Math.Abs(target.X - unit.X) <= Js.N(spec, "range")) ApplyEffect(target, Effect("knockback", new JObject { ["distance"] = spec["distance"].DeepClone() }), new EffectContext { Direction = Math.Sign(target.X - unit.X) != 0 ? Math.Sign(target.X - unit.X) : unit.Team == "enemy" ? -1 : 1, CancelWindup = true, Source = unit.Subject() });
                pulse?.Invoke(spec); remaining += Js.N(spec, "interval");
            }
            unit.PeriodicTimers["repelPulse"] = remaining;
        }
        public void ApplyHitEffects(BattleUnit target, JObject source, double hpDamage, double damage, double direction)
        {
            if (BlocksAttack(target, source)) return;
            foreach (var spec in Js.Obj(source?["effects"]).Properties().Select(p => p.Value).OfType<JObject>())
            {
                var contract = catalog.Raw["effects"]?[Js.S(spec, "type", "")];
                if (Js.S(contract, "trigger") == "hit" && ((bool?)contract?["requiresHpDamage"] != true || hpDamage > 0)) ApplyEffect(target, spec, new EffectContext { Source = source, Damage = damage, Direction = direction });
            }
        }
        public static bool BlocksAttack(BattleUnit target, JObject source) { var immunity = EffectOf(target, "attackImmunity"); return immunity != null && Matches(immunity, source); }
        public double TraitBonus(JObject source, JObject target, string field) => Js.Obj(source?["effects"]).Properties().Select(p => p.Value).OfType<JObject>().Where(s => TraitFields(Js.S(s, "type")).Contains(field) && Matches(s, target)).Select(s => Math.Max(0, Js.N(s, field))).DefaultIfEmpty(0).Max();
        public DamageResolution ResolveDamage(BattleUnit target, double rawDamage, JObject source = null)
        {
            source = source ?? new JObject(); if (BlocksAttack(target, source)) return new DamageResolution { Blocked = true };
            var victim = Js.Copy(target.Subject()); victim["effects"] = target.Effects.DeepClone(); victim["gemAttributeBonuses"] = target.GemAttributeBonuses.DeepClone();
            var damage = Math.Max(0, rawDamage) * (1 + Math.Max(0, Js.Number(source["gemAttributeBonuses"]?[target.Attribute]?["attack"]))) / (1 + Math.Max(0, Js.Number(target.GemAttributeBonuses?[Js.S(source, "attribute", "")]?["effectiveHp"])));
            damage *= 1 + TraitBonus(source, victim, "bonus"); damage /= 1 + TraitBonus(victim, source, "effectiveHp");
            var bonus = EffectOf(source, "shieldDamage"); var multiplier = 1 + Math.Min(Js.N(catalog.Raw["constants"], "shieldBonusCap", 1), Math.Max(0, Matches(bonus, victim) ? Js.N(bonus, "bonus") : Js.N(source, "shieldDamageSupportBonus")));
            var absorbed = Math.Min(damage, Math.Max(0, target.Shield) / multiplier); return new DamageResolution { HpDamage = damage - absorbed, ShieldDamage = absorbed * multiplier };
        }
        public static double AuraBonus(BattleUnit source, IList<BattleUnit> units, string type)
        {
            var origins = new Dictionary<string, double>(); foreach (var unit in units) if (!unit.Dead && unit.Team == source.Team) { var aura = EffectOf(unit, type); if (aura != null && Matches(aura, source.Subject()) && Math.Abs(unit.X - source.X) <= Js.N(aura, "range")) origins[Js.S(aura, "origin", "battle")] = Js.N(aura, "bonus"); } return origins.Values.Sum();
        }
        public JObject AttackSource(BattleUnit unit, IList<BattleUnit> units)
        {
            var source = Js.Copy(unit.Subject()); source["origin"] = unit.Origin ?? "battle"; source["role"] = unit.Role; source["specialties"] = unit.Specialties.DeepClone(); if (unit.Team == "player" || unit.GemAttributeBonuses.Count > 0) source["gemAttributeBonuses"] = unit.GemAttributeBonuses.DeepClone();
            var native = EffectOf(unit, "shieldDamage"); var support = AuraBonus(unit, units, "shieldDamageAura"); source["shieldDamageSupportBonus"] = support; source["effects"] = unit.Effects.DeepClone();
            var bonus = Js.Copy(native); bonus["bonus"] = Js.N(native, "bonus") + support; source["effects"]["shieldDamage"] = Effect("shieldDamage", bonus); return source;
        }
        public static BattleUnit SupportTarget(BattleUnit source, IList<BattleUnit> units, JObject spec) => spec == null ? null : units.Where(u => u.Team == source.Team && !u.Dead && Matches(spec, u.Subject()) && u.Hp < u.MaxHp && Math.Abs(u.X - source.X) <= Js.N(spec, "range")).OrderBy(u => u.Hp / u.MaxHp).ThenBy(u => Math.Abs(u.X - source.X)).ThenBy(u => u.SourceUid, StringComparer.Ordinal).FirstOrDefault();
        public JArray StatusMarks(BattleUnit unit)
        {
            var result = new JArray(); if (unit.Dead) return result;
            foreach (var type in new[] { "regeneration", "slow", "healingSuppression", "poison" }) if (type == "regeneration" ? EffectOf(unit, type) != null && Matches(EffectOf(unit, type), unit.Subject()) : RemainingEffect(unit, type) > 0) result.Add(new JObject { ["kind"] = type, ["color"] = catalog.Raw["effects"]?[type]?["color"]?.DeepClone() }); return result;
        }
    }
}
