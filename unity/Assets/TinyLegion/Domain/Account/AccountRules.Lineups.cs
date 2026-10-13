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
        void InitializeLineups(JObject account, JObject raw)
        {
            var activeLineup = new JObject();
            var presets = new JObject();
            foreach (var mode in Modes)
            {
                var savedPresets = raw["lineupPresets"]?[mode] as JArray;
                var activeToken = raw["activeLineup"]?[mode];
                var active = IsIntegerToken(activeToken) ? Int(activeToken) : 0;
                if (active < 0 || active >= 10) active = 0;
                activeLineup[mode] = active;
                var fallback = mode == "idle"
                    ? account["sequence"] as JArray
                    : account["sequencePresets"]?[mode] as JArray ?? account["sequence"] as JArray;
                var modePresets = new JArray();
                for (var index = 0; index < 10; index++)
                {
                    var candidate = index != active ? savedPresets?[index]?["sequence"] as JArray : null;
                    var sequence = NormalizeSequence(candidate ?? fallback, account, new[] { "sheep" });
                    modePresets.Add(new JObject { ["sequence"] = sequence });
                }
                presets[mode] = modePresets;
                var selected = (JArray)modePresets[active]["sequence"].DeepClone();
                if (mode == "idle") account["sequence"] = selected;
                else account["sequencePresets"][mode] = selected;
            }
            account["activeLineup"] = activeLineup;
            account["lineupPresets"] = presets;
        }

        void NormalizeSequencePresets(JObject account, JObject raw)
        {
            foreach (var mode in new[] { "challenge", "speedrun" })
            {
                var saved = raw["sequencePresets"]?[mode] as JArray;
                var preset = saved != null && !IsOnboarding(account) ? saved : account["sequence"] as JArray;
                account["sequencePresets"][mode] = NormalizeSequence(preset, account, new[] { "sheep" });
            }
        }

        JArray NormalizeSequence(JArray source, JObject account, IEnumerable<string> fallback)
        {
            List<JToken> values = source == null
                ? fallback.Select(id => (JToken)(Owns(account, id) ? new JValue(id) : JValue.CreateNull())).ToList()
                : source.Take(10).Select(token => (JToken)(Owns(account, Str(token)) ? token.DeepClone() : JValue.CreateNull())).ToList();
            while (values.Count < 10) values.Add(JValue.CreateNull());
            if (!values.Any(token => token.Type == JTokenType.String)) values[0] = new JValue("sheep");
            return new JArray(values);
        }

        bool SetSequence(JObject account, JArray sequence, string mode, int index)
        {
            if (!Modes.Contains(mode) || !SequenceUnlocked(account) || index < 0 || index >= 10 ||
                sequence == null || sequence.Count != 10 || !sequence.Any(token => token.Type == JTokenType.String && !string.IsNullOrEmpty(Str(token))) ||
                sequence.Any(token => token.Type != JTokenType.Null && (token.Type != JTokenType.String || !CanUseUnit(account, Str(token))))) return false;
            if (mode == "idle")
            {
                var phase = Str(account["earlyGuide"]?["phase"]);
                if (phase == "idle-defense" && !sequence.Any(token => Str(token) == "rabbit")) return false;
                if (phase == "remove-rabbit" && sequence.Any(token => Str(token) == "rabbit")) return false;
            }
            if (account["lineupPresets"] == null || account["activeLineup"] == null) InitializeLineups(account, new JObject());
            var previousIndex = Int(account["activeLineup"]?[mode]);
            account["lineupPresets"][mode][previousIndex]["sequence"] = SequenceForMode(account, mode);
            if (mode == "idle")
            {
                ApplyGuideSequence(account, sequence);
                account["sequence"] = (JArray)sequence.DeepClone();
            }
            else account["sequencePresets"][mode] = (JArray)sequence.DeepClone();
            account["activeLineup"][mode] = index;
            account["lineupPresets"][mode][index] = new JObject { ["sequence"] = (JArray)(mode == "idle" ? account["sequence"] : account["sequencePresets"][mode]).DeepClone() };
            return true;
        }

        bool ApplyGuideSequence(JObject account, JArray sequence)
        {
            if (Str(account["earlyGuide"]?["phase"]) != "remove-rabbit" ||
                sequence.Any(token => Str(token) == "rabbit") || !sequence.Any(token => CanUseUnit(account, Str(token)))) return false;
            account["earlyGuide"]["phase"] = "idle-retry";
            return true;
        }

    }
}
