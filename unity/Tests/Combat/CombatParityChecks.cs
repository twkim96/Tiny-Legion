using System;
using System.Linq;
using Newtonsoft.Json.Linq;
using TinyLegion.Domain.Combat;
using TinyLegion.Domain.Data;

namespace TinyLegion.Tests.Combat
{
    public static class CombatParityChecks
    {
        // Fixture is produced by generate-parity.mjs against current JS sources.
        public static int Run(GameCatalog catalog, JObject fixture)
        {
            int count = 0;
            foreach (JObject scenario in (JArray)fixture["cases"])
            {
                var engine = new BattleEngine(catalog, (JObject)scenario["options"]); var commands = (JArray)scenario["commands"]; var expected = (JArray)scenario["snapshots"];
                for (int index = 0; index < commands.Count; index++)
                {
                    var command = (JObject)commands[index]; switch ((string)command["op"]) { case "step": engine.Step((double)command["dt"]); break; case "summon": engine.Summon((string)command["id"]); break; case "cannon": engine.FireCannon(); break; default: throw new ArgumentException("Unknown parity command"); }
                    Compare(expected[index], engine.Snapshot(), (string)scenario["name"] + ":" + index); count++;
                }
            }
            var stats = new CharacterStatService(catalog);
            foreach (JObject item in (JArray)fixture["statCases"])
            {
                var options = (JObject)item["options"]; var actual = stats.Get((string)item["id"], (string)options["team"], (double)options["level"], (JObject)options["abilities"], (JObject)options["modifiers"], (JObject)options["multipliers"], (JObject)options["overrides"]);
                Compare(item["expected"], actual, "stat:" + (string)item["id"] + ":" + (string)options["level"]); count++;
            }
            return count;
        }
        static void Compare(JToken expected, JToken actual, string path)
        {
            if (expected == null || actual == null) { if (expected != actual) Fail(path, expected, actual); return; }
            if (expected is JObject eo && actual is JObject ao)
            {
                foreach (var property in eo.Properties()) { if (ao.Property(property.Name) == null) Fail(path + "." + property.Name, property.Value, null); Compare(property.Value, ao[property.Name], path + "." + property.Name); }
                foreach (var property in ao.Properties()) if (eo.Property(property.Name) == null) Fail(path + "." + property.Name, null, property.Value);
                return;
            }
            if (expected is JArray ea && actual is JArray aa)
            {
                if (ea.Count != aa.Count) throw new InvalidOperationException(path + ": array length " + ea.Count + " != " + aa.Count);
                for (int i = 0; i < ea.Count; i++) Compare(ea[i], aa[i], path + "[" + i + "]"); return;
            }
            if (Numeric(expected) && Numeric(actual))
            {
                double e = (double)expected, a = (double)actual;
                // Math.pow differs by a few ULPs across JS/.NET; outcomes and discrete state stay exact.
                if (Math.Abs(e - a) > Math.Max(1e-8, Math.Abs(e) * 1e-11)) Fail(path, expected, actual); return;
            }
            if (!JToken.DeepEquals(expected, actual)) Fail(path, expected, actual);
        }
        static bool Numeric(JToken token) => token.Type == JTokenType.Float || token.Type == JTokenType.Integer;
        static void Fail(string path, JToken expected, JToken actual) => throw new InvalidOperationException(path + ": expected " + (expected?.ToString() ?? "<missing>") + ", actual " + (actual?.ToString() ?? "<missing>"));
    }
}
