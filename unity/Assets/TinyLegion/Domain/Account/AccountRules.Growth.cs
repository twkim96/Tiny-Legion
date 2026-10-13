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
        string MarkTypeFor(JObject unit) => Str((unit["specialties"] as JArray)?.FirstOrDefault(), "wild");

        bool GrowUnit(JObject account, string id)
        {
            if (!GrowthUnlocked(account) || !Owns(account, id)) return false;
            var level = EffectiveLevel(account, id);
            if (level >= LevelCap) return false;
            var cost = LevelCost(level);
            if (Number(account["gold"]) < cost) return false;
            EnsureLevelSpent(account);
            account["gold"] = Number(account["gold"]) - cost;
            account["levels"][id] = Math.Max(Int(account["levels"]?[id], 1), level) + 1;
            account["levelSpent"][id] = Number(account["levelSpent"]?[id]) + cost;
            if (Str(account["earlyGuide"]?["phase"]) == "growth") account["earlyGuide"]["phase"] = "complete";
            return true;
        }

        bool UpgradeUnitAbility(JObject account, string id, string abilityId)
        {
            var unit = catalog.Character(id);
            var ability = catalog.UnitAbilities(id).OfType<JObject>().FirstOrDefault(item => Str(item["id"]) == abilityId);
            if (unit == null || ability == null || !GrowthUnlocked(account) || !Owns(account, id) || Int(account["highestCleared"]) < Int(ability["unlock"])) return false;
            var ranks = NormalizeAbilities(id, account["abilities"]?[id] as JObject);
            var rank = Int(ranks[abilityId]);
            var maximum = Int(ability["max"]);
            if (rank >= maximum) return false;
            var cost=characterStats.AbilityCost(ability,rank);
            if(cost==null)return false;
            var marks=Int(cost["marks"]);var gold=Number(cost["gold"]);
            var mark = MarkTypeFor(unit);
            if (Number(account["gold"]) < gold || Int(account["marks"]?[mark]) < marks) return false;
            account["gold"] = Number(account["gold"]) - gold;
            account["marks"][mark] = Int(account["marks"]?[mark]) - marks;
            ranks[abilityId] = rank + 1;
            account["abilities"][id] = ranks;
            return true;
        }

        JToken RefundUnitLevels(JObject account, string id, long now)
        {
            if (!GrowthUnlocked(account)) return new JValue(0);
            var refunded = UnitLevelRefund(account, id);
            if (refunded <= 0) return new JValue(0);
            Accrue(account, now);
            account["levels"][id] = 1;
            EnsureLevelSpent(account);
            account["levelSpent"][id] = 0;
            account["gold"] = Number(account["gold"]) + refunded;
            account["records"] = new JObject();
            return new JValue(refunded);
        }

        void EnsureLevelSpent(JObject account)
        {
            account["levelSpent"] ??= new JObject();
            foreach (var id in UnitIds())
            {
                var level = Int(account["levels"]?[id], 1);
                var stored = account["levelSpent"]?[id];
                account["levelSpent"][id] = stored == null || !IsFiniteNonNegative(stored)
                    ? CumulativeLevelCost(level)
                    : Math.Min(Number(stored), CumulativeLevelCost(level));
            }
        }

    }
}
