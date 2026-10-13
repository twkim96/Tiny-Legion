using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Newtonsoft.Json.Linq;
using TinyLegion.Domain.Data;

namespace TinyLegion.Domain.Account
{
    public sealed partial class AccountRules
    {
        JObject Accrue(JObject account, long now)
        {
            var last = Number(account["lastSettled"]);
            var seconds = Cap(new JValue((now - last) / 1000.0), 0, MaxOfflineSeconds);
            var record = account["records"]?[Int(account["idleStage"]).ToString(CultureInfo.InvariantCulture)] as JObject;
            var gold = 0.0;
            var diamonds = 0.0;
            if (record != null)
            {
                var period = Number(record["productionSeconds"]) > 0 ? Number(record["productionSeconds"]) : 120;
                gold = Number(record["gold"]) * seconds / period;
                diamonds = Number(record["diamonds"]) * seconds / period;
                account["gold"] = Number(account["gold"]) + gold;
                account["diamonds"] = Number(account["diamonds"]) + diamonds;
            }
            account["lastSettled"] = Math.Max(last, now);
            var today = DailyKey(now);
            if (Str(account["daily"]?["key"]) != today) account["daily"] = new JObject { ["key"] = today, ["stages"] = new JObject() };
            return new JObject { ["gold"] = gold, ["diamonds"] = diamonds, ["seconds"] = seconds };
        }

        bool RecordIdle(JObject account, JObject result, JObject snapshot, long now)
        {
            Accrue(account, now);
            var effects = snapshot["gemEffects"] as JObject;
            var rateBonus = effects != null && IsFiniteNumberToken(effects["acorn"])
                ? Number(effects["acorn"])
                : Str(snapshot["gem"]) == "gold" ? 1.15 : 1;
            var stageId = Int(snapshot["stageId"]);
            var productionSeconds = IsFiniteNumberToken(snapshot["duration"]) && Number(snapshot["duration"]) > 0 ? Number(snapshot["duration"]) : BattleDuration(stageId, "idle");
            var survival = Number(result["survival"]);
            var hpRatio = Number(result["hpRatio"]);
            var record = new JObject
            {
                ["gold"] = Math.Floor(Number(result["reward"]) * rateBonus),
                ["productionSeconds"] = productionSeconds,
                ["diamonds"] = IdleDiamondReward(stageId, survival, productionSeconds, hpRatio),
                ["hpRatio"] = hpRatio,
                ["survival"] = survival,
                ["snapshot"] = snapshot.DeepClone(),
                ["version"] = 1,
                ["recordedAt"] = now
            };
            var key = stageId.ToString(CultureInfo.InvariantCulture);
            var old = account["records"]?[key] as JObject;
            var oldPeriod = Number(old?["productionSeconds"]) > 0 ? Number(old["productionSeconds"]) : 120;
            if (old == null || Number(record["gold"]) / productionSeconds > Number(old["gold"]) / oldPeriod)
            {
                account["records"][key] = record;
                return true;
            }
            return false;
        }

        JObject CompleteChallenge(JObject account, int stageId)
        {
            account["highestCleared"] = Math.Max(Int(account["highestCleared"]), stageId);
            var rewards = (JArray)account["challengeRewards"];
            if (rewards.Any(token => Int(token) == stageId)) return new JObject { ["gold"] = 0, ["diamonds"] = 0 };
            rewards.Add(stageId);
            var stage = catalog.Stage(stageId, "challenge");
            var gold = Number(stage["baseReward"]) * 2;
            account["gold"] = Number(account["gold"]) + gold;
            account["diamonds"] = Number(account["diamonds"]) + 10;
            return new JObject { ["gold"] = gold, ["diamonds"] = 10 };
        }

    }
}
