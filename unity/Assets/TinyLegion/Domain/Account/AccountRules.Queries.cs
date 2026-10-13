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
        public JObject CompanionStats(JObject account, string id, string mode = "idle")
        {
            if (catalog.Character(id) == null) return null;
            return characterStats.Get(id, "player", EffectiveLevel(account, id) + Int(account["special"]?[id]),
                account["abilities"]?[id] as JObject, GemModifiers(account, mode));
        }

        public JObject RefundQuote(JObject account, string id)
        {
            var refund = UnitLevelRefund(account, id);
            return new JObject
            {
                ["id"] = id,
                ["refund"] = refund,
                ["enabled"] = GrowthUnlocked(account) && refund > 0,
                ["personalLevel"] = Int(account["levels"]?[id], 1),
                ["effectiveLevel"] = EffectiveLevel(account, id)
            };
        }

        public double UnitLevelRefund(JObject account, string id)
        {
            if (!Owns(account, id)) return 0;
            var level = Int(account["levels"]?[id], 1);
            var stored = account["levelSpent"]?[id];
            return stored != null && IsFiniteNonNegative(stored)
                ? Math.Min(Number(stored), CumulativeLevelCost(level))
                : CumulativeLevelCost(level);
        }

        public JObject CollectReturnIncome(JObject account, long now)
        {
            var from = Int64(account["lastSettled"]);
            var income = Accrue(account, now);
            var awaySeconds = Math.Max(0, (now - from) / 1000.0);
            if (awaySeconds < 60 || (Number(income["gold"]) <= 0 && Number(income["diamonds"]) <= 0)) return null;
            return new JObject
            {
                ["gold"] = income["gold"].DeepClone(),
                ["diamonds"] = income["diamonds"].DeepClone(),
                ["seconds"] = income["seconds"].DeepClone(),
                ["from"] = from,
                ["to"] = now,
                ["awaySeconds"] = awaySeconds,
                ["capped"] = awaySeconds > MaxOfflineSeconds
            };
        }

        public JArray PlayableSequence(JObject account, string mode = "idle")
        {
            var sequence = SequenceForMode(account, mode);
            var result = new JArray(sequence.Select(token => CanUseUnit(account, Str(token)) ? token.DeepClone() : JValue.CreateNull()));
            if (!result.Any(token => token.Type == JTokenType.String)) result[0] = "sheep";
            return result;
        }

        public JArray SequenceForMode(JObject account, string mode = "idle", int? index = null)
        {
            var active = Int(account["activeLineup"]?[mode]);
            var chosen = index ?? active;
            if (!Modes.Contains(mode)) return new JArray();
            if (chosen != active)
            {
                var presets = account["lineupPresets"]?[mode] as JArray;
                return presets != null && chosen >= 0 && chosen < presets.Count
                    ? (JArray)(presets[chosen]?["sequence"] as JArray ?? new JArray()).DeepClone()
                    : new JArray();
            }
            return (JArray)(mode == "idle"
                ? account["sequence"] as JArray ?? new JArray()
                : account["sequencePresets"]?[mode] as JArray ?? account["sequence"] as JArray ?? new JArray()).DeepClone();
        }

        public int ActiveLineupIndex(JObject account, string mode) => Int(account["activeLineup"]?[mode]);

        public JArray BaseLevelRoster(JObject account)
        {
            return new JArray(UnitIds().Select((id, order) => new { id, order, level = Int(account["levels"]?[id], 1) })
                .Where(unit => Owns(account, unit.id))
                .OrderByDescending(unit => unit.level)
                .ThenBy(unit => unit.order)
                .Take(5)
                .Select(unit => new JValue(unit.id)));
        }

        public int SharedLevel(JObject account)
        {
            var roster = BaseLevelRoster(account);
            return roster.Count < 5 ? 1 : Int(account["levels"]?[Str(roster[4])], 1);
        }

        public bool GrowthUnlocked(JObject account) =>
            !IsOnboarding(account) && new[] { "growth", "complete" }.Contains(Str(account["earlyGuide"]?["phase"], "complete"));

        public bool SequenceUnlocked(JObject account) =>
            !IsOnboarding(account) && new[] { "remove-rabbit", "idle-retry", "growth", "complete" }.Contains(Str(account["earlyGuide"]?["phase"], "complete"));

        public bool AdvancedContentUnlocked(JObject account) =>
            !IsOnboarding(account) && Int(account["highestCleared"]) >= 11;

        public int SpeedrunProgress(JObject account) => AdvancedContentUnlocked(account)
            ? Math.Max(Int(account["speedrunUnlocked"]), 1) : 0;

        public JObject SpeedrunStageRecord(JObject account, int stageId)
        {
            if (stageId < 1 || stageId > SpeedrunCount()) return EmptySpeedrunRecord();
            var saved = account["daily"]?["stages"]?[stageId.ToString(CultureInfo.InvariantCulture)] as JObject;
            return saved == null ? EmptySpeedrunRecord() : new JObject
            {
                ["best"] = saved["best"]?.DeepClone() ?? JValue.CreateNull(),
                ["practice"] = saved["practice"]?.DeepClone() ?? JValue.CreateNull(),
                ["claimed"] = Bool(saved["claimed"])
            };
        }

        public double SpeedrunReward(JObject account, int stageId = 1)
        {
            var record = SpeedrunStageRecord(account, stageId);
            return SpeedrunStageReward(NumberOrNaN(record["best"]));
        }

        public string GemDescription(JObject item)
        {
            var definition = FindById(catalog.Raw["gemTypes"] as JArray, Str(item?["type"]));
            var level = Int(item?["level"]);
            if (definition == null || !ValidGemRank(item)) return null;
            return Str(definition["description"]) + " +" + JsPercent(Number(definition["base"]) * (1 + .25 * (level - 1))) + "%";
        }

        public JObject GemUpgradeCost(JObject item)
        {
            var level = Int(item?["level"]);
            if (FindById(catalog.Raw["gemTypes"] as JArray, Str(item?["type"])) == null || !ValidGemRank(item) || level >= 10) return null;
            return new JObject { ["copies"] = Math.Pow(2, level - 1), ["gold"] = 300 * level * level };
        }

        public double? GemRerollCost(JObject item)
        {
            if (FindById(catalog.Raw["gemTypes"] as JArray, Str(item?["type"])) == null || !ValidGemRank(item)) return null;
            return Number(FindGemTier(Str(item["optionTier"], TierForOptions(item["options"] as JArray)))?["cost"]);
        }

        public string GemOptionText(JObject option)
        {
            var definition = FindById(catalog.Raw["gemOptions"] as JArray, Str(option?["id"]));
            var value = NumberOrNaN(option?["value"]);
            return definition == null || !Finite(value) ? string.Empty : Str(definition["name"]) + " +" + JsPercent(value) + "%";
        }

        public double? GemRecruitmentCost(string payment)
        {
            if (payment == "tickets") return 5;
            if (payment == "diamonds") return 30;
            return null;
        }

        public double? RecruitmentCost(int count, bool free = false) =>
            count == 1 || count == 10 ? free ? 0 : count == 1 ? 30 : 270 : (double?)null;

        int OnboardingStageId(string phase) => phase == "intro" ? 0 : phase == "first-battle" || phase == "retry-battle" ? 1 : -1;

        bool IsOnboarding(JObject account) => OnboardingPhases.Contains(Str(account?["onboarding"]?["phase"])) && Str(account["onboarding"]["phase"]) != "complete";

        bool Owns(JObject account, string id) => catalog.Character(id) != null && (id == "sheep" || Bool(account?["owned"]?[id]));

        public bool OwnsUnit(JObject account, string id) => Owns(account, id);

        public bool CanUseUnit(JObject account, string id) => Owns(account, id) &&
            (Int(account["highestCleared"]) >= 10 || (FindById(catalog.Raw["banners"] as JArray, "forest")?["units"] as JArray ?? new JArray()).Any(token => Str(token) == id));

        public bool GemRecruitUnlocked(JObject account) => GemUnlocked(account);

        bool AdvancedContentUnlockedInternal(JObject account) => AdvancedContentUnlocked(account);

    }
}
