using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Newtonsoft.Json.Linq;
using TinyLegion.Domain.Data;
using TinyLegion.Domain.Combat;

namespace TinyLegion.Domain.Account
{
    public sealed partial class AccountRules
    {
        JObject NormalizeAbilities(string id, JObject raw) => characterStats.NormalizeAbilities(id,raw);

        JToken Required(JToken value)
        {
            if (value == null || value.Type == JTokenType.Null || (value.Type == JTokenType.Boolean && !(bool)value)) throw new RuleException("action_unavailable");
            return value;
        }

        JToken Required(bool value)
        {
            if (!value) throw new RuleException("action_unavailable");
            return new JValue(true);
        }

        JObject Mission(string id, string kind, int? stageId, string title, double gold, double diamonds, bool completed)
        {
            var mission = new JObject { ["id"] = id, ["kind"] = kind };
            if (stageId.HasValue) mission["stageId"] = stageId.Value;
            mission["title"] = title;
            mission["gold"] = gold;
            mission["diamonds"] = diamonds;
            mission["completed"] = completed;
            return mission;
        }

        int StageCount() => (catalog.Raw["stages"] as JArray)?.Count ?? 0;
        int SpeedrunCount() => (catalog.Raw["speedrunStages"] as JArray)?.Count ?? 0;
        double LevelCost(int level) => economy.LevelUpgradeCost(level);
        double CumulativeLevelCost(int level) { var total = 0.0; for (var purchased = 1; purchased < level; purchased++) total += LevelCost(purchased); return total; }
        double FullReward(int stageId) => economy.IdleFullReward(stageId);
        double SpeedrunTarget() => Number(catalog.Raw["constants"]?["speedrun"]?["targetSeconds"], 60);
        double SpeedrunLimit() => Number(catalog.Raw["constants"]?["speedrun"]?["limitSeconds"], 90);
        double SpeedrunMaxReward() => Number(catalog.Raw["constants"]?["speedrun"]?["maxReward"], 10);
        List<JObject> StageList(string mode) => ((JArray)catalog.Raw[mode == "speedrun" ? "speedrunStages" : "stages"]).OfType<JObject>().ToList();
        IEnumerable<string> UnitIds() => catalog.Units.Select(unit => Str(unit["id"]));
        double BattleDuration(int stageId,string mode) => CombatEconomy.BattleDuration(stageId,mode);
        double IdleDiamondReward(int stageId,double survival,double duration,double hpRatio) => economy.IdleDiamondReward(stageId,survival,duration,hpRatio);
        double SpeedrunStageReward(double time)
        {
            if (!Finite(time) || time <= 0 || time > SpeedrunLimit()) return 0;
            if (time <= SpeedrunTarget()) return SpeedrunMaxReward();
            return Math.Max(1, Math.Min(SpeedrunMaxReward() - 1, Math.Ceiling((SpeedrunLimit() - time) / 30 * (SpeedrunMaxReward() - 1))));
        }
        string StageLabel(int id) => (int)Math.Floor((id - 1) / 10.0 + 1) + "-" + ((id - 1) % 10 + 1);
        string DailyKey(long now) => DateTimeOffset.FromUnixTimeMilliseconds(now).ToOffset(TimeSpan.FromHours(9)).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        double Cap(JToken value, double min, double max) => GameNumbers.Clamp(Number(value), min, max);
        const double MaxSafeInteger = 9007199254740991d;
        static double Number(JToken value, double fallback = 0)
        {
            if (value?.Type == JTokenType.Boolean) return Bool(value) ? 1 : 0;
            return GameNumbers.Number(value, fallback);
        }
        static double NumberOrNaN(JToken value) => value != null && (value.Type == JTokenType.Integer || value.Type == JTokenType.Float)
            ? GameNumbers.Number(value, double.NaN) : double.NaN;
        static int Int(JToken value, int fallback = 0) { var number = Number(value, fallback); return Finite(number) ? (int)Math.Truncate(number) : fallback; }
        static long Int64(JToken value, long fallback = 0) { var number = Number(value, fallback); return Finite(number) && number >= long.MinValue && number <= long.MaxValue ? (long)Math.Truncate(number) : fallback; }
        static string Str(JToken value, string fallback = null) => value == null || value.Type == JTokenType.Null ? fallback : value.Type == JTokenType.String ? (string)value : fallback;
        static bool Bool(JToken value) => value?.Type == JTokenType.Boolean && (bool)value;
        static bool Finite(double value) => !double.IsNaN(value) && !double.IsInfinity(value);
        static bool IsFiniteNonNegative(JToken token) { var value = NumberOrNaN(token); return Finite(value) && value >= 0; }
        static int Count(JToken value) => (int)GameNumbers.Clamp(Math.Floor(Number(value)), 0, 1e6);
        static JObject FindById(JArray values, string id) => values?.OfType<JObject>().FirstOrDefault(value => Str(value["id"]) == id);
        static int ObjectPropertyCount(JObject value) => value?.Properties().Count() ?? 0;
        static double? ValidSpeedrunTime(JToken value) { var time = NumberOrNaN(value); return Finite(time) && time > 0 && time <= 90 ? time : (double?)null; }
        string JsPercent(double value) => (Math.Round(value * 10000, MidpointRounding.AwayFromZero) / 100).ToString("0.##", CultureInfo.InvariantCulture);
        static bool SafeGemUid(string uid) => !string.IsNullOrEmpty(uid) && uid.Length <= 80 && uid.All(c => (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_' || c == '-');
        static bool IsIntegerToken(JToken value) => IsFiniteNumberToken(value) && Math.Truncate(Number(value)) == Number(value);
        static bool IsFiniteNumberToken(JToken value) => value != null && (value.Type == JTokenType.Integer || value.Type == JTokenType.Float) && Finite(NumberOrNaN(value));
        static int NullishInteger(JObject value, string key, int fallback) => value.Property(key) == null || value[key].Type == JTokenType.Null ? fallback : IsIntegerToken(value[key]) ? Int(value[key]) : -1;
        static string NullishString(JObject value, string key, string fallback) => value.Property(key) == null || value[key].Type == JTokenType.Null ? fallback : Str(value[key]);
        static string UndefinedString(JObject value, string key, string fallback) => value.Property(key) == null ? fallback : Str(value[key]);
        static bool ValidGemRank(JObject item) => item != null && IsIntegerToken(item["level"]) && Int(item["level"]) >= 1 && Int(item["level"]) <= 10;
        static string AllocateGemUid(JArray existing, ref long counter, HashSet<string> reserved = null)
        {
            if (counter <= 0 || counter >= MaxSafeInteger) counter = 1;
            var used = new HashSet<string>((existing ?? new JArray()).OfType<JObject>().Select(item => Str(item["uid"])), StringComparer.Ordinal);
            if (reserved != null) used.UnionWith(reserved);
            var uid = "gem-" + counter.ToString(CultureInfo.InvariantCulture);
            while (used.Contains(uid))
            {
                counter = counter + 1 < MaxSafeInteger ? counter + 1 : 1;
                uid = "gem-" + counter.ToString(CultureInfo.InvariantCulture);
            }
            counter++;
            return uid;
        }
    }
}
