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
        void ApplyInitialGemState(JObject account)
        {
            account["gemItems"] = new JArray();
            account["gemEquipment"] = new JObject();
            account["gemReserves"] = new JObject { ["attack"] = 0, ["hp"] = 0, ["gold"] = 0 };
            account["nextGemUid"] = 1;
            account["gemWelcomeClaimed"] = false;
        }

        void NormalizeGems(JObject account, JObject raw)
        {
            var items = new JArray();
            var equipment = new JObject();
            var reserves = new JObject { ["attack"] = 0, ["hp"] = 0, ["gold"] = 0 };
            var counterRaw = raw["nextGemUid"];
            var counterNumber = NumberOrNaN(counterRaw);
            long counter = IsIntegerToken(counterRaw) && counterNumber > 0 && counterNumber < MaxSafeInteger
                ? (long)counterNumber : 1;
            var welcome = Bool(raw["gemWelcomeClaimed"]);
            if (raw.Property("gemItems") == null)
            {
                foreach (var type in new[] { "attack", "hp", "gold" })
                {
                    var owned = Count(raw["gems"]?[type]);
                    if (owned <= 0) continue;
                    var uid = AllocateGemUid(items, ref counter);
                    items.Add(new JObject { ["uid"] = uid, ["type"] = type, ["level"] = 1, ["optionTier"] = "normal", ["options"] = new JArray() });
                    reserves[type] = owned - 1;
                    if (Str(raw["equippedGem"]) == type) equipment[type] = uid;
                }
                account["gemItems"] = items;
                account["gemEquipment"] = equipment;
                account["gemReserves"] = reserves;
                account["nextGemUid"] = counter;
                account["gemWelcomeClaimed"] = welcome;
                return;
            }
            var sourceItems = raw["gemItems"] as JArray ?? new JArray();
            var reservedIds = new HashSet<string>(sourceItems.OfType<JObject>().Select(item => Str(item["uid"])).Where(SafeGemUid), StringComparer.Ordinal);
            var validOriginalIds = new HashSet<string>(sourceItems.OfType<JObject>()
                .Where(item => IsGemType(Str(item["type"])) && SafeGemUid(Str(item["uid"])))
                .Select(item => Str(item["uid"])), StringComparer.Ordinal);
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var item in sourceItems.OfType<JObject>())
            {
                var type = Str(item["type"]);
                if (!IsGemType(type)) continue;
                var uid = Str(item["uid"]);
                if (!SafeGemUid(uid) || !seen.Add(uid))
                {
                    uid = AllocateGemUid(items, ref counter, reservedIds);
                    seen.Add(uid);
                }
                var level = IsFiniteNumberToken(item["level"]) ? (int)Cap(item["level"], 1, 10) : 1;
                var options = new JArray();
                foreach (var option in item["options"] as JArray ?? new JArray())
                {
                    var definition = FindById(catalog.Raw["gemOptions"] as JArray, Str(option?["id"]));
                    if (definition == null || !IsFiniteNumberToken(option?["value"])) continue;
                    var rounded = GameNumbers.Round(Number(option["value"]) * 100) / 100;
                    options.Add(new JObject { ["id"] = Str(definition["id"]), ["value"] = Cap(new JValue(rounded), Number(definition["min"]), Number(definition["max"])) });
                    if (options.Count == 3) break;
                }
                var tierId = Str(FindGemTier(Str(item["optionTier"]))?["id"], TierForOptions(options));
                var tier = FindGemTier(tierId) ?? FindGemTier(TierForOptions(options));
                while (options.Count > Int(tier["lines"])) options.RemoveAt(options.Count - 1);
                items.Add(new JObject { ["uid"] = uid, ["type"] = type, ["level"] = level, ["optionTier"] = Str(tier["id"]), ["options"] = options });
            }
            foreach (var type in new[] { "attack", "hp", "gold" }) reserves[type] = Count(raw["gemReserves"]?[type]);
            foreach (var definition in (JArray)catalog.Raw["gemTypes"])
            {
                if (ObjectPropertyCount(equipment) >= GemOptionLimit) break;
                var type = Str(definition["id"]);
                var uid = Str(raw["gemEquipment"]?[type]);
                var item = items.OfType<JObject>().FirstOrDefault(g => Str(g["uid"]) == uid);
                if (validOriginalIds.Contains(uid) && item != null && Str(item["type"]) == type) equipment[type] = uid;
            }
            // Match normalizeGemState's final nextUid(items, counter).next - 1 probe.
            var probe = counter;
            AllocateGemUid(items, ref probe);
            account["gemItems"] = items;
            account["gemEquipment"] = equipment;
            account["gemReserves"] = reserves;
            account["nextGemUid"] = probe - 1;
            account["gemWelcomeClaimed"] = welcome;
        }

        JObject GemEffects(JObject account)
        {
            var effects = new JObject
            {
                ["attack"] = 1, ["hp"] = 1, ["speed"] = 1, ["goldIncome"] = 1, ["goldCapacity"] = 1, ["killGold"] = 1, ["acorn"] = 1,
                ["attributeBonuses"] = new JObject()
            };
            foreach (var attribute in new[] { "wild", "machine", "spirit", "shadow" })
                effects["attributeBonuses"][attribute] = new JObject { ["attack"] = 0, ["effectiveHp"] = 0 };
            foreach (var item in OwnedGemBasics(account))
            {
                var definition = FindById(catalog.Raw["gemTypes"] as JArray, Str(item["type"]));
                var effect = Str(definition["effect"]);
                effects[effect] = Number(effects[effect]) + Number(definition["base"]) * (1 + .25 * (Int(item["level"]) - 1));
            }
            foreach (var item in EquippedGemItems(account))
            {
                var tier = FindGemTier(Str(item["optionTier"])) ?? FindGemTier(TierForOptions(item["options"] as JArray));
                foreach (var option in (item["options"] as JArray ?? new JArray()).Take(Int(tier["lines"])))
                {
                    var definition = FindById(catalog.Raw["gemOptions"] as JArray, Str(option["id"]));
                    var value = NumberOrNaN(option["value"]);
                    if (definition == null || !Finite(value) || value < Number(definition["min"]) || value > Number(definition["max"])) continue;
                    var id = Str(option["id"]);
                    if (id.EndsWith("Attack", StringComparison.Ordinal))
                    {
                        var attribute = id.Substring(0, id.Length - 6);
                        effects["attributeBonuses"][attribute]["attack"] = Number(effects["attributeBonuses"]?[attribute]?["attack"]) + value;
                    }
                    else if (id == "wildDefense")
                        effects["attributeBonuses"]["wild"]["effectiveHp"] = Number(effects["attributeBonuses"]?["wild"]?["effectiveHp"]) + value;
                    else if (effects[id] != null) effects[id] = Number(effects[id]) + value;
                }
            }
            return effects;
        }

        List<JObject> OwnedGemBasics(JObject account)
        {
            return (account["gemItems"] as JArray ?? new JArray()).OfType<JObject>()
                .Where(item => IsGemType(Str(item["type"])) && ValidGemRank(item))
                .GroupBy(item => Str(item["type"]), StringComparer.Ordinal)
                .Select(group => group.OrderByDescending(item => Int(item["level"])).First()).ToList();
        }

        List<JObject> EquippedGemItems(JObject account)
        {
            var result = new List<JObject>();
            var equipment = account["gemEquipment"] as JObject;
            if (equipment == null) return result;
            foreach (var definition in (JArray)catalog.Raw["gemTypes"])
            {
                var type = Str(definition["id"]);
                var uid = Str(equipment[type]);
                var item = (account["gemItems"] as JArray ?? new JArray()).OfType<JObject>().FirstOrDefault(g => Str(g["uid"]) == uid && Str(g["type"]) == type && ValidGemRank(g));
                if (item != null) result.Add(item);
            }
            return result.Take(GemOptionLimit).ToList();
        }

        JObject DrawGem(JObject account, string payment, bool free, string banner)
        {
            if (!GemUnlocked(account) || FindById(catalog.Raw["gemBanners"] as JArray, banner) == null ||
                !(account["gemItems"] is JArray) || (payment != "tickets" && payment != "diamonds")) return null;
            var cost = payment == "tickets" ? 5 : 30;
            if (free ? Bool(account["gemWelcomeClaimed"]) : Number(account[payment]) < cost) return null;
            JObject item;
            long next = Int64(account["nextGemUid"], 1);
            try
            {
                var pool = FindById(catalog.Raw["gemBanners"] as JArray, banner)["types"] as JArray ?? new JArray();
                var type = free ? "income" : Str(pool[(int)Math.Floor(CheckedGemRoll() * pool.Count)]);
                var option = RollGemOptions(1);
                var uid = AllocateGemUid(account["gemItems"] as JArray, ref next);
                item = new JObject { ["uid"] = uid, ["type"] = type, ["level"] = 1, ["optionTier"] = "normal", ["options"] = option };
            }
            catch { return null; }
            ((JArray)account["gemItems"]).Add(item);
            account["nextGemUid"] = next;
            if (free) account["gemWelcomeClaimed"] = true;
            else account[payment] = Number(account[payment]) - cost;
            if (account["gemGuide"] is JObject) account["gemGuide"]["drawn"] = true;
            return (JObject)item.DeepClone();
        }

        bool EquipGem(JObject account, string uid, string replaceType)
        {
            var item = GemByUid(account, uid);
            if (!GemUnlocked(account) || item == null || !IsGemType(Str(item["type"])) || !ValidGemRank(item) || !(account["gemEquipment"] is JObject)) return false;
            var equipped = EquippedGemItems(account);
            if (replaceType != null && !equipped.Any(g => Str(g["type"]) == replaceType)) return false;
            var next = new JObject();
            foreach (var gem in equipped) next[Str(gem["type"])] = Str(gem["uid"]);
            var type = Str(item["type"]);
            if (replaceType != null && replaceType != type) next.Remove(replaceType);
            if (next[type] == null && ObjectPropertyCount(next) >= GemOptionLimit) return false;
            next[type] = uid;
            account["gemEquipment"] = next;
            if (account["gemGuide"] is JObject) account["gemGuide"]["equipped"] = true;
            return true;
        }

        bool UnequipGem(JObject account, string type)
        {
            if (!GemUnlocked(account) || !IsGemType(type) || account["gemEquipment"]?[type] == null) return false;
            ((JObject)account["gemEquipment"]).Remove(type);
            return true;
        }

        bool UpgradeGem(JObject account, string uid, JArray materialUids)
        {
            var target = GemByUid(account, uid);
            var cost = GemUpgradeCost(target);
            if (!GemUnlocked(account) || target == null || cost == null || materialUids == null || Number(account["gold"]) < Number(cost["gold"])) return false;
            var selected = materialUids.Select(token => Str(token)).ToList();
            if (selected.Distinct(StringComparer.Ordinal).Count() != selected.Count || selected.Count > Number(cost["copies"])) return false;
            var eligible = (account["gemItems"] as JArray ?? new JArray()).OfType<JObject>()
                .Where(g => Str(g["uid"]) != uid && Str(g["type"]) == Str(target["type"]) && ValidGemRank(g) && Int(g["level"]) == 1 && !IsGemEquipped(account, Str(g["uid"])))
                .Select(g => Str(g["uid"])).ToHashSet(StringComparer.Ordinal);
            if (selected.Any(id => !eligible.Contains(id))) return false;
            var gap = (int)Number(cost["copies"]) - selected.Count;
            if (Count(account["gemReserves"]?[Str(target["type"])]) < gap) return false;
            foreach (var id in selected) GemByUid(account, id)?.Remove();
            if (gap > 0) account["gemReserves"][Str(target["type"])] = Count(account["gemReserves"]?[Str(target["type"])]) - gap;
            account["gold"] = Number(account["gold"]) - Number(cost["gold"]);
            target["level"] = Int(target["level"]) + 1;
            return true;
        }

        JObject RerollGem(JObject account, string uid)
        {
            var item = GemByUid(account, uid);
            var cost = GemRerollCost(item);
            if (!GemUnlocked(account) || item == null || !cost.HasValue || Number(account["gold"]) < cost.Value) return null;
            var tier = FindGemTier(Str(item["optionTier"])) ?? FindGemTier(TierForOptions(item["options"] as JArray));
            JArray options;
            try
            {
                var chance = Number(tier["promotionChance"]);
                if (chance > 0 && CheckedGemRoll() < chance)
                {
                    var allTiers = (JArray)catalog.Raw["gemOptionTiers"];
                    tier = (JObject)allTiers[allTiers.IndexOf(tier) + 1];
                }
                options = RollGemOptions(Int(tier["lines"]));
            }
            catch { return null; }
            account["gold"] = Number(account["gold"]) - cost.Value;
            item["optionTier"] = Str(tier["id"]);
            item["options"] = options;
            return (JObject)item.DeepClone();
        }

        bool IsGemEquipped(JObject account, string uid) => EquippedGemItems(account).Any(g => Str(g["uid"]) == uid);

        JObject GemByUid(JObject account, string uid) => (account["gemItems"] as JArray ?? new JArray()).OfType<JObject>().FirstOrDefault(g => Str(g["uid"]) == uid);

        JArray RollGemOptions(int count)
        {
            var options = new JArray();
            var defs = (JArray)catalog.Raw["gemOptions"];
            for (var index = 0; index < count; index++)
            {
                var definition = (JObject)defs[(int)Math.Floor(CheckedGemRoll() * defs.Count)];
                var min = (int)Math.Round(Number(definition["min"]) * 100);
                var max = (int)Math.Round(Number(definition["max"]) * 100);
                var value = (min + (int)Math.Floor(CheckedGemRoll() * (max - min + 1))) / 100.0;
                options.Add(new JObject { ["id"] = Str(definition["id"]), ["value"] = value });
            }
            return options;
        }

        double CheckedGemRoll()
        {
            var value = random();
            if (!Finite(value) || value < 0 || value >= 1) throw new InvalidOperationException("Invalid gem RNG");
            return value;
        }

        bool GemUnlocked(JObject account) => Str(account["onboarding"]?["phase"]) == "complete" && Int(account["highestCleared"]) >= 11;

        JObject FindGemTier(string id) => FindById(catalog.Raw["gemOptionTiers"] as JArray, id);

        string TierForOptions(JArray options) => (options?.Count ?? 0) >= 3 ? "unique" : (options?.Count ?? 0) == 2 ? "epic" : "normal";

        bool IsGemType(string id) => FindById(catalog.Raw["gemTypes"] as JArray, id) != null;

    }
}
