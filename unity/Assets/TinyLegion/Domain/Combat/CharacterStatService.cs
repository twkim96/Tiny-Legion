using System;
using System.Linq;
using Newtonsoft.Json.Linq;
using TinyLegion.Domain.Data;

namespace TinyLegion.Domain.Combat
{
    public sealed class CharacterStatService
    {
        readonly GameCatalog catalog;
        readonly CombatEffectService effects;
        public static readonly string[] StatKeys = { "hp", "attack", "speed", "range", "attackInterval" };
        public CharacterStatService(GameCatalog catalog) { this.catalog = catalog; effects = new CombatEffectService(catalog); }
        public JObject Get(string id, string team = "player", double level = 1, JObject abilities = null, JObject modifiers = null, JObject multipliers = null, JObject overrides = null)
            => Get(catalog.Character(id, team), team, level, abilities, modifiers, multipliers, overrides);
        public JObject Get(JObject character, string team = "player", double level = 1, JObject abilities = null, JObject modifiers = null, JObject multipliers = null, JObject overrides = null)
        {
            if (character == null) return null;
            var result = Js.Copy(character);
            overrides = overrides ?? new JObject(); modifiers = modifiers ?? new JObject(); multipliers = multipliers ?? new JObject();
            if (overrides.Property("attribute") != null) result["attribute"] = overrides["attribute"].DeepClone();
            if (overrides.Property("effects") != null) result["effects"] = Js.Merge(result["effects"] as JObject, overrides["effects"] as JObject);
            if (team == "player") result = ApplyAbilities(result, abilities);
            result["effects"] = effects.NormalizeEffects(result["effects"] as JObject);
            var encounter = Js.Obj(Js.Present(overrides["statMultipliers"]) ? overrides["statMultipliers"] : result["statMultipliers"]);
            var type = Js.S(result, "attackType");
            var strength = CombineStatMultipliers(multipliers, encounter, (JObject)CombineAttackTypeMultipliers(multipliers, encounter)[type]);
            var growth = team == "player" ? 1 + (Js.Clamp(Math.Floor(Js.Finite(level) ? level : 1), 1, 120) - 1) * Js.N(catalog.Raw["constants"], "levelGrowth", .12) : 1;
            foreach (var stat in StatKeys) result[stat] = Js.N(result, stat) * (stat == "hp" || stat == "attack" ? growth : 1) * Factor(modifiers[stat]) * Factor(modifiers["attackTypes"]?[type]?[stat]) * Js.N(strength, stat, 1);
            // JProperty skips assignments it considers numerically equal; force integer rounding.
            var hp = Math.Max(1, Js.Round(Js.N(result, "hp"))); var attack = Math.Max(1, Js.Round(Js.N(result, "attack")));
            result.Remove("hp"); result["hp"] = hp; result.Remove("attack"); result["attack"] = attack;
            result["attackInterval"] = Math.Max(.2, Js.N(result, "attackInterval"));
            result["gemAttributeBonuses"] = Js.Copy(modifiers["attributeBonuses"]);
            return result;
        }
        static double Factor(JToken value) => Math.Max(0, Js.Number(value, 1));
        public static JObject CombineStatMultipliers(params JObject[] sources)
        {
            var result = new JObject(); foreach (var stat in StatKeys) { double product = 1; foreach (var source in sources) product *= Factor(source?[stat]); result[stat] = product; } return result;
        }
        public static JObject CombineAttackTypeMultipliers(params JObject[] sources)
        {
            var result = new JObject(); foreach (var type in new[] { "melee", "ranged" }) result[type] = CombineStatMultipliers(sources.Select(s => s?["attackTypes"]?[type] as JObject).ToArray()); return result;
        }
        public JObject NormalizeAbilities(string id, JObject raw = null)
        {
            var result = new JObject(); foreach (JObject ability in catalog.UnitAbilities(id)) { var key = Js.S(ability, "id"); result[key] = Js.Clamp(Math.Floor(Js.N(raw, key)), 0, Js.N(ability, "max")); } return result;
        }
        public JObject AbilityCost(JObject ability, double rank = 0)
        {
            if (ability == null || rank >= Js.N(ability, "max")) return null;
            return Js.N(ability, "max") == 1 ? new JObject { ["marks"] = 24, ["gold"] = 3000 } : new JObject { ["marks"] = 1 + rank, ["gold"] = 120 + rank * 80 };
        }
        public JObject ApplyAbilities(JObject unit, JObject raw = null)
        {
            var ranks = NormalizeAbilities(Js.S(unit, "id"), raw); var result = Js.Copy(unit);
            foreach (JObject ability in catalog.UnitAbilities(Js.S(unit, "id"))) { var rank = Js.N(ranks, Js.S(ability, "id")); if (rank > 0) ApplyChanges(result, ability["changes"] as JArray, rank); }
            return result;
        }
        public JObject ApplyChanges(JObject character, JArray changes, double rank = 1)
        {
            foreach (JObject change in changes ?? new JArray())
            {
                var op = Js.S(change, "op"); var amount = Js.N(change, "amount") * rank;
                if (op == "effect") { var value = Js.Obj(change["value"]); var type = Js.S(value, "type"); if (!(character["effects"] is JObject)) character["effects"] = new JObject(); character["effects"][type] = effects.Effect(type, value); continue; }
                if (op == "specialty")
                {
                    var attribute = Js.S(change, "attribute"); var specialties = character["specialties"] as JArray ?? new JArray(); if (!specialties.Any(v => (string)v == attribute)) specialties.Add(attribute); character["specialties"] = specialties;
                    foreach (var spec in Js.Obj(character["effects"]).Properties().Select(p => p.Value).OfType<JObject>()) if (effects.IsTrait(Js.S(spec, "type")) && (Js.S(spec, "attribute", "all") != "all" || spec["attribute"] is JArray))
                    {
                        var selection = spec["attribute"] as JArray ?? new JArray(spec["attribute"]); spec["attribute"] = new JArray(selection.Select(v => (string)v).Concat(new[] { attribute }).Distinct().OrderBy(v => v, StringComparer.Ordinal));
                    }
                    continue;
                }
                if (op == "counter")
                {
                    foreach (var property in Js.Obj(character["effects"]).Properties().ToArray()) if (property.Value is JObject spec && effects.IsTrait(Js.S(spec, "type")))
                    {
                        var upgraded = effects.Effect(property.Name, spec); foreach (var field in effects.TraitFields(property.Name)) upgraded[field] = Js.N(upgraded, field) + amount; property.Value = effects.Effect(property.Name, upgraded);
                    }
                    continue;
                }
                var path = Js.S(change, "path").Split('.'); var owner = character;
                foreach (var key in path.Take(path.Length - 1)) { if (!(owner[key] is JObject)) owner[key] = new JObject(); owner = (JObject)owner[key]; }
                var last = path[path.Length - 1]; var valueNumber = Js.N(owner, last);
                if (op == "add") valueNumber += amount; else if (op == "multiply") valueNumber *= 1 + amount; else throw new ArgumentException("Unknown upgrade operation: " + op);
                if (Js.Present(change["min"])) valueNumber = Math.Max(Js.N(change, "min"), valueNumber); owner[last] = valueNumber;
            }
            return character;
        }
    }
    public sealed class CombatEconomy
    {
        readonly GameCatalog catalog;
        public CombatEconomy(GameCatalog catalog) { this.catalog = catalog; }
        public static double BattleDuration(int stageId, string mode = "idle") => mode == "speedrun" || stageId > 10 ? 90 : stageId <= (mode == "idle" ? 3 : 2) ? 40 : 60;
        public double IdleFullReward(double stageId) => 500 * Math.Pow(1 / (.1 + .9 * .9 * .9), Math.Max(1, Js.Finite(stageId) ? stageId : 1) - 1);
        public static double IdleRewardFactor(double survival, double duration, double hpRatio)
        {
            if (!Js.Finite(duration) || duration <= 0) return 0;
            var ratio = Js.Clamp((Js.Finite(survival) ? survival : 0) / duration, 0, 1); var health = Js.Clamp(Js.Finite(hpRatio) ? hpRatio : 0, 0, 1);
            return duration / 90 * ratio * ratio * (.1 + .9 * health * health) * (ratio >= 1 ? 1 : .8);
        }
        public double CalculateIdleReward(int stageId, double survival, double hpRatio, double? duration = null)
        {
            var stage = catalog.Stage(stageId, "idle") ?? catalog.Stage(1, "idle"); var id = Js.N(stage, "id", 1);
            return Js.Round(IdleFullReward(id) * IdleRewardFactor(survival, duration ?? BattleDuration(stageId), hpRatio));
        }
        public double IdleDiamondReward(double stageId, double survival, double duration, double hpRatio) => Js.Round(.025 * IdleFullReward(stageId) / 500 * IdleRewardFactor(survival, duration, hpRatio) * 1000) / 1000;
        public double LevelUpgradeCost(double level)
        {
            var current = Js.Clamp(Math.Floor(Js.Finite(level) ? level : 1), 1, 100); var anchors = (JArray)catalog.Raw["economy"]["growthAnchors"];
            int index = 1; while (index < anchors.Count - 1 && Js.N(anchors[index], "level") < current) index++;
            var start = anchors[index - 1]; var end = anchors[index]; var progress = (current - Js.N(start, "level")) / (Js.N(end, "level") - Js.N(start, "level"));
            return Math.Ceiling(IdleFullReward(Js.N(start, "stage") + (Js.N(end, "stage") - Js.N(start, "stage")) * progress) * (Js.N(start, "rounds") + (Js.N(end, "rounds") - Js.N(start, "rounds")) * progress) / 5);
        }
    }
}
