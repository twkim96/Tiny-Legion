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
        JArray RecruitUnits(JObject account, int count, bool free, string bannerId)
        {
            if (IsOnboarding(account) || !GrowthUnlocked(account) || (count != 1 && count != 10)) return null;
            var banner = FindById(catalog.Raw["banners"] as JArray, bannerId);
            if (banner == null || Int(account["highestCleared"]) < Int(banner["unlock"])) return null;
            if (free && (count != 10 || Bool(account["recruitment"]?["welcomeClaimed"]))) return null;
            var cost = free ? 0 : count == 1 ? 30 : 270;
            if (Number(account["diamonds"]) < cost) return null;
            var owned = (JObject)account["owned"].DeepClone();
            var marks = (JObject)account["marks"].DeepClone();
            var recruitment = (JObject)account["recruitment"].DeepClone();
            var results = new JArray();
            var poolIds = (banner["units"] as JArray ?? new JArray()).Values<string>().ToHashSet(StringComparer.Ordinal);
            var pool = catalog.Units.Where(unit => poolIds.Contains(Str(unit["id"]))).ToList();
            var rarities = (JArray)catalog.Raw["rarities"];
            try
            {
                for (var draw = 0; draw < count; draw++)
                {
                    var roll = CheckedRoll();
                    double cumulative = 0;
                    JObject tier = null;
                    foreach (var rarity in rarities.OfType<JObject>())
                    {
                        var rate = banner["rates"]?[Str(rarity["id"])] == null ? Number(rarity["rate"]) : Number(banner["rates"][Str(rarity["id"])]);
                        cumulative += rate;
                        if (roll < cumulative) { tier = rarity; break; }
                    }
                    tier ??= (JObject)rarities.Last.DeepClone();
                    var tierId = Str(tier["id"]);
                    var guaranteed = false;
                    if (Int(recruitment["sinceEpic"]) >= 49 && tierId != "epic" && tierId != "legendary")
                    {
                        tier = FindById(rarities, "epic");
                        tierId = "epic";
                        guaranteed = true;
                    }
                    else if (Int(recruitment["sinceRare"]) >= 9 && tierId == "common")
                    {
                        tier = FindById(rarities, "rare");
                        tierId = "rare";
                        guaranteed = true;
                    }
                    var candidates = pool.Where(unit => Str(unit["rarity"]) == tierId).ToList();
                    if (candidates.Count == 0) throw new InvalidOperationException("Empty recruit pool");
                    var unit = candidates[(int)Math.Floor(CheckedRoll() * candidates.Count)];
                    var id = Str(unit["id"]);
                    var isNew = !Bool(owned[id]);
                    owned[id] = true;
                    var markAttribute = MarkTypeFor(unit);
                    var markAmount = isNew ? 0 : Number(catalog.Raw["duplicateMarks"]?[tierId]);
                    if (markAmount != 0) marks[markAttribute] = Number(marks[markAttribute]) + markAmount;
                    recruitment["total"] = Int(recruitment["total"]) + 1;
                    recruitment["sinceRare"] = tierId == "common" ? Int(recruitment["sinceRare"]) + 1 : 0;
                    recruitment["sinceEpic"] = tierId == "epic" || tierId == "legendary" ? 0 : Int(recruitment["sinceEpic"]) + 1;
                    results.Add(RecruitResult(id, isNew, (int)markAmount, markAttribute, guaranteed, false));
                }
            }
            catch { return null; }
            if (free) recruitment["welcomeClaimed"] = true;
            account["diamonds"] = Number(account["diamonds"]) - cost;
            account["owned"] = owned;
            account["marks"] = marks;
            account["recruitment"] = recruitment;
            return results;
        }

        double CheckedRoll()
        {
            var value = random();
            if (!Finite(value)) throw new InvalidOperationException("Invalid random value");
            return GameNumbers.Clamp(value, 0, 1 - 2.2204460492503131e-16);
        }

        bool FinishOnboarding(JObject account)
        {
            if (Str(account["onboarding"]?["phase"]) != "idle-guide") return false;
            account["onboarding"]["phase"] = "complete";
            account["idleStage"] = 1;
            return true;
        }

    }
}
