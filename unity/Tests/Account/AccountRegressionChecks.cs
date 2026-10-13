using System;
using Newtonsoft.Json.Linq;
using TinyLegion.Domain.Account;
using TinyLegion.Domain.Data;

namespace TinyLegion.Tests.Account
{
    /// <summary>Focused account behavior checks independent of Unity and the battle suite.</summary>
    public static class AccountRegressionChecks
    {
        static void Require(bool condition, string name) { if (!condition) throw new InvalidOperationException("Account regression: " + name); }
        static JObject Ready(GameCatalog catalog, long now)
        {
            var account = new AccountRules(catalog).NewAccount(now);
            account["onboarding"]["phase"] = "complete"; account["earlyGuide"]["phase"] = "complete";
            return account;
        }
        public static int Run(GameCatalog catalog)
        {
            var checks = 0; const long now = 1791900000000L; var rules = new AccountRules(catalog);
            var fresh = rules.NewAccount(now);
            Require((string)fresh["onboarding"]["phase"] == "intro" && (bool)fresh["owned"]["sheep"] && !(bool)fresh["owned"]["rabbit"] && (int)fresh["daily"]["key"].ToString().Length == 10, "new account starter and Seoul day"); checks++;

            var legacy = (JObject)fresh.DeepClone(); legacy.Remove("onboarding"); legacy.Remove("marks"); legacy["fragments"]["rabbit"] = 2; ((JObject)legacy["owned"]).Remove("rabbit");
            var restored = rules.NormalizeAccount(legacy, now);
            Require((string)restored["onboarding"]["phase"] == "complete" && (bool)restored["owned"]["rabbit"] && (int)restored["fragments"]["rabbit"] == 0 && (int)restored["marks"]["wild"] >= 4, "legacy starter and fragment conversion once");
            var twice = rules.NormalizeAccount(restored, now); Require((int)twice["marks"]["wild"] == (int)restored["marks"]["wild"], "legacy fragment conversion idempotent"); checks++;

            var account = Ready(catalog, now); account["highestCleared"] = 11;
            account["owned"]["rabbit"] = true; account["owned"]["squirrel"] = true; account["owned"]["fox"] = true; account["owned"]["chick"] = true; account["owned"]["deer"] = true;
            account["levels"]["sheep"] = 8; account["levels"]["rabbit"] = 8; account["levels"]["squirrel"] = 7; account["levels"]["fox"] = 6; account["levels"]["chick"] = 5; account["levels"]["deer"] = 5;
            Require(rules.SharedLevel(account) == 5 && rules.EffectiveLevel(account, "rabbit") == 8, "top five shared level sorts by level and unit order");
            account["levels"]["rabbit"] = 1; Require(rules.EffectiveLevel(account, "rabbit") == 5, "shared level applies to low-level owned unit"); checks++;

            var grow = Ready(catalog, now); grow["gold"] = 1e6;
            Require(rules.Execute(grow, "unit.grow", new JObject { ["id"] = "sheep" }, now).Value<bool>() && (int)grow["levels"]["sheep"] == 2, "growth spends and advances");
            var refund = rules.UnitLevelRefund(grow, "sheep"); grow["records"]["1"] = new JObject { ["gold"] = 100, ["productionSeconds"] = 90, ["diamonds"] = .2 };
            var refundResult = rules.Execute(grow, "unit.refund", new JObject { ["id"] = "sheep" }, now + 60000);
            Require((double)refundResult == refund && (int)grow["levels"]["sheep"] == 1 && grow["records"].HasValues == false, "refund returns ledger and invalidates old production"); checks++;

            var onboarding = new AccountRules(catalog).NewAccount(now);
            var introOptions = rules.BattleOptions(onboarding, "challenge", 0);
            Require((string)introOptions["onboardingPhase"] == "intro", "onboarding encounter phase is frozen in options");
            try { rules.BattleOptions(onboarding, "idle", 1); throw new InvalidOperationException("onboarding mode gate missing"); }
            catch (RuleException error) { Require(error.Code == "battle_locked", "onboarding gate code"); }
            var guide = Ready(catalog, now); guide["highestCleared"] = 2; guide["earlyGuide"]["phase"] = "remove-rabbit";
            try { rules.BattleOptions(guide, "idle", 2); throw new InvalidOperationException("remove-rabbit gate missing"); }
            catch (RuleException error) { Require(error.Code == "sequence_required", "guide lineup gate code"); }
            Require(rules.CurrentMission(guide)["id"].Value<string>() == "idle-intro", "mission order begins with intro"); checks++;

            var income = Ready(catalog, now); income["lastSettled"] = now - 9 * 3600 * 1000L; income["records"]["1"] = new JObject { ["gold"] = 90, ["diamonds"] = .9, ["productionSeconds"] = 90 };
            var receipt = rules.CollectReturnIncome(income, now);
            Require((bool)receipt["capped"] && Math.Abs((double)receipt["seconds"] - 28800) < 1e-8 && (double)income["gold"] == 600 + 28800, "offline income caps at eight hours before receipt");
            var noReceipt = rules.CollectReturnIncome(income, now + 1000);
            Require(noReceipt == null, "short return without earned income has no modal receipt"); checks++;

            var idle = Ready(catalog, now); idle["highestCleared"] = 2; idle["earlyGuide"]["phase"] = "complete";
            var snapshot = new JObject { ["mode"] = "idle", ["stageId"] = 1, ["duration"] = 40, ["balanceVersion"] = catalog.BalanceVersion, ["options"] = new JObject { ["onboardingPhase"] = JValue.CreateNull() }, ["gemEffects"] = new JObject { ["acorn"] = 1.15 } };
            var battle = new JObject { ["won"] = false, ["survival"] = 40, ["hpRatio"] = .5, ["time"] = 40, ["reward"] = 120 };
            var recorded = rules.RecordBattle(idle, battle, snapshot, now - 40000, now);
            Require((bool)recorded["recordChanged"] && (double)idle["records"]["1"]["gold"] == 138 && (JObject)recorded["battleResult"] != null, "idle record uses frozen gem snapshot and original engine result"); checks++;

            var invalid = Ready(catalog, now); invalid["gold"] = 1000; var before = invalid.DeepClone();
            try { rules.Execute(invalid, "gem.upgrade", new JObject { ["uid"] = "missing", ["materialUids"] = new JArray("x") }, now); throw new InvalidOperationException("invalid gem command accepted"); }
            catch (RuleException error) { Require(error.Code == "action_unavailable" && JToken.DeepEquals(before, invalid), "failed command leaves input untouched"); }
            checks++;
            return checks;
        }
    }
}
