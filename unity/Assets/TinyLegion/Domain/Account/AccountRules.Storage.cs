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
        void NormalizeSettings(JObject account, JObject raw)
        {
            var defaults = (JObject)account["settings"];
            var audio = raw["settings"]?["audio"] as JObject;
            foreach (var key in new[] { "musicEnabled", "sfxEnabled" })
                defaults["audio"][key] = audio?[key]?.Type == JTokenType.Boolean ? audio[key].DeepClone() : defaults["audio"][key].DeepClone();
            foreach (var key in new[] { "musicVolume", "sfxVolume" })
                    defaults["audio"][key] = IsFiniteNumberToken(audio?[key])
                    ? Cap(audio[key], 0, 1) : defaults["audio"][key].DeepClone();
            var speed = raw["settings"]?["speed"];
            defaults["speed"] = IsIntegerToken(speed) && (Int(speed) == 1 || Int(speed) == 2) ? speed.DeepClone() : new JValue(1);
            var hidden = new JArray();
            var seen = new HashSet<int>();
            if (raw["settings"]?["hiddenIdleResults"] is JArray hiddenRaw)
                foreach (var token in hiddenRaw)
                {
                    var id = IsIntegerToken(token) ? Int(token, -1) : -1;
                    if (catalog.Stage(id, "idle") != null && seen.Add(id)) hidden.Add(id);
                }
            defaults["hiddenIdleResults"] = hidden;
        }

        JObject DefaultSettings()
        {
            return new JObject
            {
                ["audio"] = ((JObject)catalog.Raw["constants"]?["audioDefaults"] ?? new JObject
                {
                    ["musicEnabled"] = true, ["sfxEnabled"] = true, ["musicVolume"] = .3, ["sfxVolume"] = .6
                }).DeepClone(),
                ["speed"] = 1,
                ["hiddenIdleResults"] = new JArray()
            };
        }

        JArray NormalizeChallengeRewards(JArray raw, int highest)
        {
            var result = new JArray();
            var seen = new HashSet<int>();
            if (raw != null)
                foreach (var token in raw)
                {
                    var id = IsIntegerToken(token) ? Int(token, -1) : -1;
                    if (id >= 1 && id <= highest && catalog.Stage(id, "challenge") != null && seen.Add(id)) result.Add(id);
                }
            return result;
        }

        JObject NormalizeMissions(JObject raw)
        {
            var claimed = new JArray();
            var seen = new HashSet<string>(StringComparer.Ordinal);
            if (raw?["claimed"] is JArray saved)
                foreach (var token in saved)
                {
                    var id = Str(token);
                    if (IsMissionId(id) && seen.Add(id)) claimed.Add(id);
                }
            return new JObject { ["idleCompleted"] = Bool(raw?["idleCompleted"]), ["claimed"] = claimed };
        }

        bool IsMissionId(string id) => id == "idle-intro" || id == "idle-second" || id == "growth-intro" || id == "gem-intro" ||
            Enumerable.Range(2, Math.Max(0, StageCount() - 1)).Any(stage => id == "challenge-" + stage.ToString(CultureInfo.InvariantCulture));

        JObject LegacyStarterSave(JObject raw)
        {
            if (raw.Property("onboarding") != null) return raw;
            var copy = (JObject)raw.DeepClone();
            copy["onboarding"] = new JObject { ["phase"] = "complete" };
            copy["owned"] = copy["owned"] is JObject owned ? (JObject)owned.DeepClone() : new JObject();
            foreach (var id in catalog.Raw["starterUnitIds"].Values<string>()) copy["owned"][id] = true;
            if (!(copy["sequence"] is JArray)) copy["sequence"] = new JArray(catalog.Raw["starterUnitIds"].Values<string>().Select(id => new JValue(id)));
            return copy;
        }

        void RestoreLegacyProgress(JObject account, JObject raw, bool hasValidGuidePhase)
        {
            if (raw.Property("marks") == null)
            {
                foreach (var unit in catalog.Units)
                {
                    var rarity = Str(unit["rarity"]);
                    var amount = Number(catalog.Raw["duplicateMarks"]?[rarity]);
                    account["marks"][MarkTypeFor(unit)] = Number(account["marks"]?[MarkTypeFor(unit)]) + Int(account["fragments"]?[Str(unit["id"])]) * amount;
                    account["fragments"][Str(unit["id"])] = 0;
                }
            }
            if (raw.Property("missions") == null)
            {
                var highest = Int(account["highestCleared"]);
                if (Str(account["onboarding"]?["phase"]) == "complete")
                {
                    if (highest >= 2)
                    {
                        account["missions"]["idleCompleted"] = true;
                        var claims = (JArray)account["missions"]["claimed"];
                        claims.Add("idle-intro");
                        for (var id = 2; id <= Math.Min(highest, StageCount()); id++) claims.Add("challenge-" + id.ToString(CultureInfo.InvariantCulture));
                    }
                    else if (highest == 1)
                    {
                        var intro = account["records"]?["1"];
                        if (Number(intro?["survival"], double.NaN) >= Number(intro?["productionSeconds"], 120) &&
                            Number(intro?["hpRatio"], double.NaN) > 0)
                            account["missions"]["idleCompleted"] = true;
                    }
                }
            }
            if (!hasValidGuidePhase)
            {
                var progressed = Int(account["highestCleared"]) >= 2 || UnitIds().Any(id => Int(account["levels"]?[id], 1) > 1 || Int(account["special"]?[id]) > 0);
                if (progressed) account["earlyGuide"] = new JObject { ["phase"] = "complete", ["legacy"] = true };
            }
            if (!(raw["sequencePresets"]?["challenge"] is JArray) && !Bool(account["earlyGuide"]?["legacy"]) &&
                new[] { "remove-rabbit", "idle-retry", "growth", "complete" }.Contains(Str(account["earlyGuide"]?["phase"])) && Owns(account, "rabbit"))
            {
                var sequence = account["sequencePresets"]?["challenge"] as JArray;
                if (sequence != null && !sequence.Any(id => Str(id) == "rabbit"))
                {
                    var slot = sequence.IndexOf(null);
                    sequence[slot < 0 ? 9 : slot] = "rabbit";
                }
            }
        }

        JToken ExecuteSettings(JObject account, JObject args)
        {
            if (args.Property("audio") != null)
            {
                if (!(args["audio"] is JObject audio)) throw new RuleException("invalid_preference");
                foreach (var property in audio.Properties())
                {
                    if (!new[] { "musicEnabled", "sfxEnabled", "musicVolume", "sfxVolume" }.Contains(property.Name) ||
                        (property.Name.EndsWith("Enabled", StringComparison.Ordinal) ? property.Value.Type != JTokenType.Boolean :
                            !IsFiniteNumberToken(property.Value) || Number(property.Value) < 0 || Number(property.Value) > 1))
                        throw new RuleException("invalid_preference");
                }
                foreach (var property in audio.Properties()) account["settings"]["audio"][property.Name] = property.Value.DeepClone();
            }
            if (args.Property("speed") != null)
            {
                if (!IsIntegerToken(args["speed"]) || (Int(args["speed"]) != 1 && Int(args["speed"]) != 2)) throw new RuleException("invalid_preference");
                account["settings"]["speed"] = args["speed"].DeepClone();
            }
            if (args.Property("hiddenIdleResults") != null)
            {
                if (!(args["hiddenIdleResults"] is JArray hidden) || hidden.Count > StageCount() ||
                    hidden.Any(token => !IsIntegerToken(token) || catalog.Stage(Int(token), "idle") == null))
                    throw new RuleException("invalid_preference");
                account["settings"]["hiddenIdleResults"] = new JArray(hidden.Select(token => Int(token)).Distinct().Select(id => new JValue(id)));
            }
            return new JValue(true);
        }

    }
}
