using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;
namespace TinyLegion.Domain.Data
{
    // Definitions are loaded once. Callers clone before applying runtime modifiers.
    public sealed class GameCatalog
    {
        public JObject Raw { get; }
        public string BalanceVersion => (string)Raw["balanceVersion"];
        readonly Dictionary<string, JObject> characters;
        readonly Dictionary<string, JObject> stages;
        public GameCatalog(JObject raw)
        {
            Raw = (JObject)(raw ?? throw new ArgumentNullException(nameof(raw))).DeepClone();
            if ((int?)Raw["schemaVersion"] != 1) throw new ArgumentException("Unsupported catalog schema");
            characters = new Dictionary<string, JObject>(StringComparer.Ordinal);
            foreach (var pair in new[] { ("units", "player"), ("enemies", "enemy") })
                foreach (JObject item in (JArray)Raw[pair.Item1]) characters.Add(pair.Item2 + ":" + (string)item["id"], item);
            stages = new Dictionary<string, JObject>(StringComparer.Ordinal);
            foreach (var mode in new[] { "idle", "challenge", "speedrun" })
                foreach (JObject item in (JArray)Raw[mode == "speedrun" ? "speedrunStages" : "stages"])
                    stages.Add(mode + ":" + (int)item["id"], item);
        }
        public JObject Character(string id, string team = "player") => characters.TryGetValue(team + ":" + id, out var value) ? value : null;
        public JObject Stage(int id, string mode = "challenge") => stages.TryGetValue(mode + ":" + id, out var value) ? value : null;
        public JArray UnitAbilities(string id) => Raw["abilitiesByUnit"]?[id] as JArray ?? new JArray();
        public IEnumerable<JObject> Units => ((JArray)Raw["units"]).Cast<JObject>();
        public IEnumerable<JObject> Enemies => ((JArray)Raw["enemies"]).Cast<JObject>();
    }
    public static class GameNumbers
    {
        public static double Round(double value) => Math.Floor(value + .5); // JavaScript Math.round, not banker's rounding.
        public static double Number(JToken value, double fallback = 0)
        {
            if (value == null || value.Type == JTokenType.Null) return fallback;
            if(value.Type==JTokenType.Integer||value.Type==JTokenType.Float){double numeric=value.Value<double>();return !double.IsNaN(numeric)&&!double.IsInfinity(numeric)?numeric:fallback;}
            return double.TryParse(value.ToString(), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var result)
                && !double.IsNaN(result) && !double.IsInfinity(result) ? result : fallback;
        }
        public static double Clamp(double value, double min, double max) => Math.Max(min, Math.Min(max, value));
    }
}
