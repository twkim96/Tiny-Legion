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
        bool RecordMissionBattle(JObject account, string mode, int stageId, bool won)
        {
            var phase = Str(account["earlyGuide"]?["phase"]);
            if (stageId == 2 && mode == "challenge")
            {
                if (won && new[] { "wall-battle", "wall-retry" }.Contains(phase))
                {
                    account["earlyGuide"]["phase"] = "idle-defense";
                    account["idleStage"] = 2;
                    var sequence = (JArray)account["sequence"];
                    if (Owns(account, "rabbit") && !sequence.Any(token => Str(token) == "rabbit"))
                    {
                        var slot = sequence.IndexOf(null);
                        sequence[slot < 0 ? 9 : slot] = "rabbit";
                    }
                    return true;
                }
                if (!won && phase == "wall-battle")
                {
                    account["earlyGuide"]["phase"] = "rabbit-recruit";
                    return true;
                }
            }
            if (stageId == 2 && mode == "idle")
            {
                if (!won && phase == "idle-defense")
                {
                    account["earlyGuide"]["phase"] = "remove-rabbit";
                    return true;
                }
                if (won && phase == "idle-retry" && !(account["sequence"] as JArray).Any(token => Str(token) == "rabbit"))
                {
                    account["earlyGuide"]["phase"] = "growth";
                    return true;
                }
            }
            if (mode != "idle" || stageId != 1 || !won) return false;
            account["missions"] ??= new JObject { ["idleCompleted"] = false, ["claimed"] = new JArray() };
            var changed = !Bool(account["missions"]?["idleCompleted"]);
            account["missions"]["idleCompleted"] = true;
            return changed;
        }

        JObject ClaimMission(JObject account)
        {
            var mission = CurrentMission(account);
            if (mission == null || !Bool(mission["completed"])) return null;
            var claimed = account["missions"]?["claimed"] as JArray;
            if (claimed == null) account["missions"]["claimed"] = claimed = new JArray();
            var id = Str(mission["id"]);
            if (claimed.Any(token => Str(token) == id)) return null;
            claimed.Add(id);
            var gold = Number(mission["gold"]);
            var diamonds = Number(mission["diamonds"]);
            account["gold"] = Number(account["gold"]) + gold;
            account["diamonds"] = Number(account["diamonds"]) + diamonds;
            return new JObject { ["gold"] = gold, ["diamonds"] = diamonds, ["id"] = id };
        }

        int SpeedrunStageCount() => SpeedrunCount();

        JObject EmptySpeedrunRecord() => new JObject { ["best"] = JValue.CreateNull(), ["practice"] = JValue.CreateNull(), ["claimed"] = false };

        bool AdvanceSpeedrun(JObject account, int stageId, double time)
        {
            if (!AdvancedContentUnlocked(account) || stageId < 1 || stageId > SpeedrunCount() || stageId > SpeedrunProgress(account) ||
                !Finite(time) || time <= 0 || time > SpeedrunTarget()) return false;
            account["speedrunUnlocked"] = Math.Max(SpeedrunProgress(account), Math.Min(SpeedrunCount(), stageId + 1));
            return true;
        }

        bool RecordSpeedrun(JObject account, int stageId, double time, long now)
        {
            Accrue(account, now);
            if (stageId < 1 || stageId > SpeedrunCount() || !AdvancedContentUnlocked(account) || stageId > SpeedrunProgress(account) ||
                !Finite(time) || time <= 0 || time > SpeedrunLimit()) return false;
            AdvanceSpeedrun(account, stageId, time);
            var record = GetSpeedrunDayRecord(account, stageId);
            var field = Bool(record["claimed"]) ? "practice" : "best";
            var old = NumberOrNaN(record[field]);
            record[field] = Finite(old) ? Math.Min(old, time) : time;
            return true;
        }

        int ClaimSpeedrun(JObject account, int stageId, long now)
        {
            Accrue(account, now);
            if (!AdvancedContentUnlocked(account) || stageId < 1 || stageId > SpeedrunProgress(account)) return 0;
            var record = GetSpeedrunDayRecord(account, stageId);
            if (Bool(record["claimed"]) || record["best"] == null || record["best"].Type == JTokenType.Null) return 0;
            var reward = SpeedrunStageReward(Number(record["best"]));
            if (reward <= 0) return 0;
            account["tickets"] = Number(account["tickets"]) + reward;
            record["claimed"] = true;
            return checked((int)reward);
        }

        JObject GetSpeedrunDayRecord(JObject account, int stageId)
        {
            account["daily"]["stages"] ??= new JObject();
            var key = stageId.ToString(CultureInfo.InvariantCulture);
            if (!(account["daily"]["stages"][key] is JObject)) account["daily"]["stages"][key] = EmptySpeedrunRecord();
            return (JObject)account["daily"]["stages"][key];
        }

        bool AdvanceOnboardingBattle(JObject account, bool won)
        {
            var phase = Str(account["onboarding"]?["phase"]);
            if (phase == "intro" && won) { account["onboarding"]["phase"] = "first-battle"; return true; }
            if (phase == "first-battle" && !won) { account["onboarding"]["phase"] = "recruit"; return true; }
            if (phase == "retry-battle" && won)
            {
                CompleteChallenge(account, 1);
                account["onboarding"]["phase"] = "idle-guide";
                return true;
            }
            return false;
        }

        JObject RecruitOnboardingCompanion(JObject account)
        {
            if (Str(account["onboarding"]?["phase"]) != "recruit" || Owns(account, "squirrel")) return null;
            account["owned"]["squirrel"] = true;
            account["onboarding"]["phase"] = "retry-battle";
            account["sequence"] = Sequence("sheep", "squirrel");
            account["sequencePresets"] = new JObject { ["challenge"] = account["sequence"].DeepClone(), ["speedrun"] = account["sequence"].DeepClone() };
            return RecruitResult("squirrel", true, 0, null, false, true);
        }

        JObject RecruitEarlyRabbit(JObject account)
        {
            if (IsOnboarding(account) || Str(account["earlyGuide"]?["phase"]) != "rabbit-recruit") return null;
            var isNew = !Owns(account, "rabbit");
            account["owned"]["rabbit"] = true;
            account["earlyGuide"]["phase"] = "wall-retry";
            foreach (var mode in Modes)
            {
                var sequence = mode == "idle" ? account["sequence"] as JArray : account["sequencePresets"]?[mode] as JArray;
                if (sequence == null)
                {
                    sequence = new JArray(Enumerable.Repeat<JToken>(JValue.CreateNull(), 10));
                    sequence[0] = "sheep";
                    if (mode == "idle") account["sequence"] = sequence;
                    else account["sequencePresets"][mode] = sequence;
                }
                AddToSequence(sequence, "rabbit");
                var activeIndex = Int(account["activeLineup"]?[mode]);
                if (account["lineupPresets"]?[mode] is JArray lineup && activeIndex >= 0 && activeIndex < lineup.Count)
                    lineup[activeIndex]["sequence"] = sequence.DeepClone();
            }
            return RecruitResult("rabbit", isNew, 0, null, false, true);
        }

        void AddToSequence(JArray sequence, string id)
        {
            if (sequence.Any(token => Str(token) == id)) return;
            var slot = -1;
            for (var index = 0; index < sequence.Count; index++)
                if (sequence[index].Type == JTokenType.Null) { slot = index; break; }
            sequence[slot < 0 ? 9 : slot] = new JValue(id);
        }

        JArray Sequence(string first, string second = null)
        {
            var values = Enumerable.Repeat<JToken>(JValue.CreateNull(), 10).ToArray();
            values[0] = new JValue(first);
            if (second != null) values[1] = new JValue(second);
            return new JArray(values);
        }

        JObject RecruitResult(string id, bool isNew, int marks, string markAttribute, bool guaranteed, bool onboarding)
        {
            var result = new JObject { ["unit"] = catalog.Character(id).DeepClone(), ["isNew"] = isNew, ["fragments"] = 0 };
            if (onboarding) result["guaranteed"] = true;
            else { result["marks"] = marks; result["markAttribute"] = markAttribute; result["guaranteed"] = guaranteed; }
            return result;
        }

    }
}
