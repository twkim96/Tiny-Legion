using System;
using System.Linq;
using Newtonsoft.Json.Linq;
using TinyLegion.Domain.Account;
using TinyLegion.Domain.Data;

namespace TinyLegion.Tests.Account
{
    /// <summary>Runs account scenarios generated from the current JavaScript rules.</summary>
    public static class AccountParityChecks
    {
        public static int Run(GameCatalog catalog, JObject fixture)
        {
            var count = 0;
            foreach (JObject scenario in (JArray)fixture["normalizations"])
            {
                var rules = new AccountRules(catalog);
                var actual = rules.NormalizeAccount(scenario["input"] as JObject, (long)scenario["now"]);
                Compare(scenario["expected"], actual, "normalize:" + (string)scenario["name"]);
                count++;
            }
            foreach (JObject scenario in (JArray)fixture["commands"])
            {
                var rolls = new double[0]; var rollIndex = 0;
                var rules = new AccountRules(catalog, () => rollIndex < rolls.Length ? rolls[rollIndex++] : 0.5);
                var account = (JObject)scenario["account"].DeepClone();
                foreach (JObject step in (JArray)scenario["steps"])
                {
                    rolls = (step["rolls"] as JArray ?? new JArray()).Values<double>().ToArray(); rollIndex = 0;
                    if (step["error"] != null)
                    {
                        var before = account.DeepClone();
                        try { rules.Execute(account, (string)step["type"], step["args"] as JObject, (long)step["now"]); }
                        catch (RuleException error)
                        {
                            if (error.Code != (string)step["error"]) throw new InvalidOperationException("command:" + (string)scenario["name"] + " expected " + (string)step["error"] + " but got " + error.Code);
                            Compare(before, account, "rollback:" + (string)scenario["name"] + ":" + (string)step["type"]); count++; continue;
                        }
                        throw new InvalidOperationException("command:" + (string)scenario["name"] + " expected error " + (string)step["error"]);
                    }
                    var result = rules.Execute(account, (string)step["type"], step["args"] as JObject, (long)step["now"]);
                    Compare(step["result"], result, "result:" + (string)scenario["name"] + ":" + (string)step["type"]);
                    Compare(step["account"], account, "account:" + (string)scenario["name"] + ":" + (string)step["type"]); count += 2;
                }
            }
            foreach (JObject scenario in (JArray)fixture["battles"])
            {
                var rules = new AccountRules(catalog); var account = (JObject)scenario["account"].DeepClone();
                try
                {
                    var actual = rules.BattleOptions(account, (string)scenario["mode"], (int)scenario["stageId"]);
                    if (scenario["error"] != null) throw new InvalidOperationException("battle:" + (string)scenario["name"] + " expected " + (string)scenario["error"]);
                    Compare(scenario["expected"], actual, "battle:" + (string)scenario["name"]); count++;
                }
                catch (RuleException error)
                {
                    if (error.Code != (string)scenario["error"]) throw new InvalidOperationException("battle:" + (string)scenario["name"] + " expected " + (string)scenario["error"] + " but got " + error.Code);
                    count++;
                }
            }
            foreach (JObject scenario in (JArray)(fixture["queries"] ?? new JArray()))
            {
                var rules = new AccountRules(catalog); var account = (JObject)scenario["account"].DeepClone();
                var actual = new JObject
                {
                    ["battleLevels"] = rules.BattleLevels(account),
                    ["gemModifiers"] = rules.GemModifiers(account, (string)scenario["mode"] ?? "idle"),
                    ["mission"] = rules.CurrentMission(account),
                    ["roster"] = rules.BaseLevelRoster(account),
                    ["sharedLevel"] = rules.SharedLevel(account),
                    ["growthUnlocked"] = rules.GrowthUnlocked(account),
                    ["sequenceUnlocked"] = rules.SequenceUnlocked(account),
                    ["advancedUnlocked"] = rules.AdvancedContentUnlocked(account),
                    ["speedrunProgress"] = rules.SpeedrunProgress(account),
                    ["speedrunRecord"] = rules.SpeedrunStageRecord(account, (int)scenario["stageId"]),
                    ["speedrunReward"] = rules.SpeedrunReward(account, (int)scenario["stageId"]),
                    ["playable"] = rules.PlayableSequence(account, (string)scenario["mode"] ?? "idle"),
                    ["activeLineup"] = rules.ActiveLineupIndex(account, (string)scenario["mode"] ?? "idle"),
                    ["sequence"] = rules.SequenceForMode(account, (string)scenario["mode"] ?? "idle", (int)scenario["lineupIndex"]),
                    ["owns"] = rules.OwnsUnit(account, (string)scenario["unitId"]),
                    ["canUse"] = rules.CanUseUnit(account, (string)scenario["unitId"]),
                    ["gemRecruitUnlocked"] = rules.GemRecruitUnlocked(account),
                    ["growthCost"] = rules.GrowthCost(account, (string)scenario["unitId"]),
                    ["effectiveLevel"] = rules.EffectiveLevel(account, (string)scenario["unitId"]),
                    ["combatPower"] = rules.CombatPower(account),
                    ["companionStats"] = rules.CompanionStats(account, (string)scenario["unitId"], (string)scenario["mode"] ?? "idle"),
                    ["refundQuote"] = rules.RefundQuote(account, (string)scenario["unitId"]),
                    ["gemDescription"] = rules.GemDescription(scenario["gem"] as JObject),
                    ["gemUpgradeCost"] = rules.GemUpgradeCost(scenario["gem"] as JObject),
                    ["gemRerollCost"] = rules.GemRerollCost(scenario["gem"] as JObject),
                    ["gemOptionText"] = rules.GemOptionText(scenario["option"] as JObject),
                    ["gemRecruitmentCost"] = rules.GemRecruitmentCost((string)scenario["payment"]),
                    ["recruitmentCost"] = rules.RecruitmentCost((int)scenario["recruitCount"], (bool)scenario["free"])
                };
                Compare(scenario["expected"], actual, "query:" + (string)scenario["name"]); count++;
            }
            foreach (JObject scenario in (JArray)(fixture["returns"] ?? new JArray()))
            {
                var rules = new AccountRules(catalog); var account = (JObject)scenario["account"].DeepClone();
                var receipt = rules.CollectReturnIncome(account, (long)scenario["now"]);
                Compare(scenario["expected"] ?? JValue.CreateNull(), receipt, "return-income:" + (string)scenario["name"]);
                Compare(scenario["accountExpected"], account, "return-account:" + (string)scenario["name"]); count += 2;
            }
            foreach (JObject scenario in (JArray)(fixture["records"] ?? new JArray()))
            {
                var rules = new AccountRules(catalog); var account = (JObject)scenario["account"].DeepClone();
                var result = (JObject)scenario["result"].DeepClone(); var snapshot = (JObject)scenario["snapshot"].DeepClone();
                try
                {
                    var actual = rules.RecordBattle(account, result, snapshot, (long)scenario["startedAt"], (long)scenario["now"]);
                    if (scenario["error"] != null) throw new InvalidOperationException("record:" + (string)scenario["name"] + " expected " + (string)scenario["error"]);
                    Compare(scenario["expected"], actual, "record-result:" + (string)scenario["name"]);
                    Compare(scenario["accountExpected"], account, "record-account:" + (string)scenario["name"]); count += 2;
                }
                catch (RuleException error)
                {
                    if (error.Code != (string)scenario["error"]) throw new InvalidOperationException("record:" + (string)scenario["name"] + " expected " + (string)scenario["error"] + " but got " + error.Code);
                    Compare(scenario["account"], account, "record-rollback:" + (string)scenario["name"]); count++;
                }
            }
            return count;
        }

        static void Compare(JToken expected, JToken actual, string path)
        {
            var expectedNull = expected == null || expected.Type == JTokenType.Null;
            var actualNull = actual == null || actual.Type == JTokenType.Null;
            if (expectedNull || actualNull) { if (expectedNull != actualNull) Fail(path, expected, actual); return; }
            if (expected is JObject expectedObject && actual is JObject actualObject)
            {
                foreach (var property in expectedObject.Properties())
                {
                    if (actualObject.Property(property.Name) == null) Fail(path + "." + property.Name, property.Value, null);
                    Compare(property.Value, actualObject[property.Name], path + "." + property.Name);
                }
                foreach (var property in actualObject.Properties()) if (expectedObject.Property(property.Name) == null) Fail(path + "." + property.Name, null, property.Value);
                return;
            }
            if (expected is JArray expectedArray && actual is JArray actualArray)
            {
                if (expectedArray.Count != actualArray.Count) Fail(path + ".length", expectedArray.Count, actualArray.Count);
                for (var index = 0; index < expectedArray.Count; index++) Compare(expectedArray[index], actualArray[index], path + "[" + index + "]");
                return;
            }
            if (Numeric(expected) && Numeric(actual))
            {
                var left = (double)expected; var right = (double)actual;
                if (Math.Abs(left - right) > Math.Max(1e-8, Math.Abs(left) * 1e-11)) Fail(path, expected, actual);
                return;
            }
            if (!JToken.DeepEquals(expected, actual)) Fail(path, expected, actual);
        }

        static bool Numeric(JToken token) => token.Type == JTokenType.Float || token.Type == JTokenType.Integer;
        static void Fail(string path, object expected, object actual) => throw new InvalidOperationException(path + ": expected " + (expected?.ToString() ?? "<missing>") + ", actual " + (actual?.ToString() ?? "<missing>"));
    }
}
