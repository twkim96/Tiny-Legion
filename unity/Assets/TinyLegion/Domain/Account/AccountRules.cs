using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Newtonsoft.Json.Linq;
using TinyLegion.Domain.Combat;
using TinyLegion.Domain.Data;

namespace TinyLegion.Domain.Account
{
    /// <summary>Pure account, economy, recruitment, mission and progression rules.</summary>
    public sealed partial class AccountRules
    {
        const double MaxCurrency = 1e12;
        const double MaxOfflineSeconds = 8 * 3600;
        const int LevelCap = 100;
        const int GemOptionLimit = 3;
        static readonly string[] Modes = { "idle", "challenge", "speedrun" };
        static readonly string[] OnboardingPhases = { "intro", "first-battle", "recruit", "retry-battle", "idle-guide", "complete" };
        static readonly string[] EarlyPhases = { "wall-battle", "rabbit-recruit", "wall-retry", "idle-defense", "remove-rabbit", "idle-retry", "growth", "complete" };

        readonly GameCatalog catalog;
        readonly CharacterStatService characterStats;
        readonly CombatEconomy economy;
        readonly Func<double> random;

        public AccountRules(GameCatalog catalog, Func<double> random = null)
        {
            this.catalog = catalog ?? throw new ArgumentNullException(nameof(catalog));
            characterStats = new CharacterStatService(catalog);
            economy = new CombatEconomy(catalog);
            var randomSource = new Random();
            this.random = random ?? randomSource.NextDouble;
        }

        public JObject NewAccount(long now)
        {
            var units = UnitIds();
            var levels = new JObject();
            var spent = new JObject();
            var fragments = new JObject();
            var special = new JObject();
            var abilities = new JObject();
            var owned = new JObject();
            foreach (var id in units)
            {
                levels[id] = 1;
                spent[id] = 0;
                fragments[id] = 0;
                special[id] = 0;
                owned[id] = id == "sheep";
                abilities[id] = NormalizeAbilities(id, null);
            }
            var marks = new JObject();
            foreach (var mark in (JArray)catalog.Raw["markTypes"]) marks[(string)mark["id"]] = 0;
            var sequence = new JArray("sheep", null, null, null, null, null, null, null, null, null);
            var account = new JObject
            {
                ["version"] = 1,
                ["gold"] = 600,
                ["diamonds"] = 60,
                ["tickets"] = 0,
                ["levels"] = levels,
                ["levelSpent"] = spent,
                ["fragments"] = fragments,
                ["special"] = special,
                ["marks"] = marks,
                ["abilities"] = abilities,
                ["owned"] = owned,
                ["recruitment"] = new JObject { ["total"] = 0, ["sinceRare"] = 0, ["sinceEpic"] = 0, ["welcomeClaimed"] = false },
                ["sequence"] = sequence,
                ["sequencePresets"] = new JObject { ["challenge"] = sequence.DeepClone(), ["speedrun"] = sequence.DeepClone() },
                ["onboarding"] = new JObject { ["phase"] = "intro" },
                ["earlyGuide"] = new JObject { ["phase"] = "wall-battle", ["legacy"] = false },
                ["highestCleared"] = 0,
                ["records"] = new JObject(),
                ["idleStage"] = 1,
                ["lastSettled"] = now,
                ["daily"] = new JObject { ["key"] = DailyKey(now), ["stages"] = new JObject() },
                ["speedrunUnlocked"] = 0,
                ["settings"] = DefaultSettings(),
                ["challengeRewards"] = new JArray(),
                ["missions"] = new JObject { ["idleCompleted"] = false, ["claimed"] = new JArray() },
                ["gemGuide"] = new JObject { ["drawn"] = false, ["equipped"] = false }
            };
            ApplyInitialGemState(account);
            InitializeLineups(account, new JObject());
            return account;
        }

        public JObject NormalizeAccount(JObject raw, long now)
        {
            var account = NewAccount(now);
            if (raw == null || !IsIntegerToken(raw["version"]) || Int(raw["version"], 0) != 1) return account;
            raw = LegacyStarterSave(raw);
            var onboarding = Str(raw["onboarding"]?["phase"], "intro");
            account["onboarding"]["phase"] = OnboardingPhases.Contains(onboarding) ? onboarding : "intro";
            foreach (var key in new[] { "gold", "diamonds", "tickets" })
                account[key] = Cap(raw[key], 0, MaxCurrency);

            foreach (var id in UnitIds())
            {
                account["owned"][id] = id == "sheep" || Bool(raw["owned"]?[id]);
                var level = (int)Cap(raw["levels"]?[id] ?? 1, 1, LevelCap);
                account["levels"][id] = level;
                var maximumSpend = CumulativeLevelCost(level);
                var storedSpend = raw["levelSpent"]?[id];
                account["levelSpent"][id] = storedSpend != null && IsFiniteNonNegative(storedSpend)
                    ? Math.Min(Cap(storedSpend, 0, MaxCurrency), maximumSpend)
                    : maximumSpend;
                account["fragments"][id] = (int)Cap(raw["fragments"]?[id], 0, 1e6);
                account["special"][id] = (int)Cap(raw["special"]?[id], 0, 20);
                account["abilities"][id] = NormalizeAbilities(id, raw["abilities"]?[id] as JObject);
            }
            foreach (var mark in (JArray)catalog.Raw["markTypes"])
            {
                var id = (string)mark["id"];
                account["marks"][id] = (long)Cap(raw["marks"]?[id], 0, 1e9);
            }
            account["sequence"] = NormalizeSequence(raw["sequence"] as JArray, account, fallback: new[] { "sheep" });
            var phase = Str(account["onboarding"]?["phase"]);
            if (phase == "recruit" && Owns(account, "squirrel"))
            {
                account["onboarding"]["phase"] = "retry-battle";
                account["sequence"] = Sequence("sheep", "squirrel");
            }
            else if ((phase == "retry-battle" || phase == "idle-guide") && !Owns(account, "squirrel"))
                account["onboarding"]["phase"] = "recruit";

            account["recruitment"] = new JObject
            {
                ["total"] = (long)Cap(raw["recruitment"]?["total"], 0, 1e9),
                ["sinceRare"] = (int)Cap(raw["recruitment"]?["sinceRare"], 0, 9),
                ["sinceEpic"] = (int)Cap(raw["recruitment"]?["sinceEpic"], 0, 49),
                ["welcomeClaimed"] = Bool(raw["recruitment"]?["welcomeClaimed"])
            };
            account["highestCleared"] = (int)Cap(raw["highestCleared"], 0, StageCount());
            account["speedrunUnlocked"] = (int)Cap(raw["speedrunUnlocked"], 0, SpeedrunCount());
            var cleared = Int(account["highestCleared"]);
            var idleLimit = Math.Min(StageCount(), cleared + (cleared > 0 && cleared % 10 == 0 ? 1 : 0));
            account["idleStage"] = (int)Cap(raw["idleStage"] ?? 1, 1, Math.Min(StageCount(), cleared + 1));

            var records = new JObject();
            foreach (var stage in StageList("idle"))
            {
                var id = Int(stage["id"]);
                var saved = raw["records"]?[id.ToString(CultureInfo.InvariantCulture)] as JObject;
                if (saved == null) continue;
                var gold = NumberOrNaN(saved["gold"]);
                var diamonds = NumberOrNaN(saved["diamonds"]);
                var maxGold = Math.Max(Number(stage["baseReward"]), FullReward(id)) * 4;
                if (!Finite(gold) || gold < 0 || gold > maxGold || !Finite(diamonds) || diamonds < 0 || diamonds > 2) continue;
                var record = (JObject)saved.DeepClone();
                record["gold"] = gold;
                record["diamonds"] = diamonds;
                if (Str(record["snapshot"]?["balanceVersion"]) == "idle-economy-15" &&
                    Number(record["productionSeconds"]) > 0 && Number(record["productionSeconds"]) < 90)
                    continue;
                records[id.ToString(CultureInfo.InvariantCulture)] = record;
            }
            account["records"] = records;
            account["lastSettled"] = Cap(raw["lastSettled"] ?? now, 0, now);
            var today = DailyKey(now);
            if (Str(raw["daily"]?["key"]) == today)
            {
                var stages = new JObject();
                for (var id = 1; id <= SpeedrunCount(); id++)
                {
                    var saved = raw["daily"]?["stages"]?[id.ToString(CultureInfo.InvariantCulture)] as JObject;
                    if (saved == null) continue;
                    var best = ValidSpeedrunTime(saved["best"]);
                    var practice = ValidSpeedrunTime(saved["practice"]);
                    var claimed = Bool(saved["claimed"]);
                    if (best.HasValue || practice.HasValue || claimed)
                        stages[id.ToString(CultureInfo.InvariantCulture)] = new JObject
                        {
                            ["best"] = best.HasValue ? new JValue(best.Value) : JValue.CreateNull(),
                            ["practice"] = practice.HasValue ? new JValue(practice.Value) : JValue.CreateNull(),
                            ["claimed"] = claimed
                        };
                }
                account["daily"] = new JObject { ["key"] = today, ["stages"] = stages };
            }
            NormalizeSettings(account, raw);
            account["challengeRewards"] = NormalizeChallengeRewards(raw["challengeRewards"] as JArray, cleared);
            account["missions"] = NormalizeMissions(raw["missions"] as JObject);
            var rawEarlyPhase = Str(raw["earlyGuide"]?["phase"]);
            account["earlyGuide"] = new JObject
            {
                ["phase"] = EarlyPhases.Contains(rawEarlyPhase) ? rawEarlyPhase : "wall-battle",
                ["legacy"] = Bool(raw["earlyGuide"]?["legacy"])
            };
            NormalizeSequencePresets(account, raw);
            RestoreLegacyProgress(account, raw, EarlyPhases.Contains(rawEarlyPhase));
            if (AdvancedContentUnlocked(account)) account["speedrunUnlocked"] = Math.Max(1, Int(account["speedrunUnlocked"]));
            if (new[] { "wall-retry", "idle-defense", "remove-rabbit", "idle-retry" }.Contains(Str(account["earlyGuide"]?["phase"])) && !Owns(account, "rabbit"))
                account["earlyGuide"]["phase"] = "rabbit-recruit";
            NormalizeGems(account, raw);
            account["gemGuide"] = new JObject { ["drawn"] = Bool(raw["gemGuide"]?["drawn"]), ["equipped"] = Bool(raw["gemGuide"]?["equipped"]) };
            InitializeLineups(account, raw);
            return account;
        }

        public JToken Execute(JObject account, string type, JObject args, long now)
        {
            if (account == null) throw new ArgumentNullException(nameof(account));
            var working = (JObject)account.DeepClone();
            var result = ExecuteCore(working, type, args, now);
            account.RemoveAll();
            foreach (var property in working.Properties()) account[property.Name] = property.Value.DeepClone();
            return result?.DeepClone();
        }

        JToken ExecuteCore(JObject account, string type, JObject args, long now)
        {
            args ??= new JObject();
            switch (type)
            {
                case "settle": return Accrue(account, now);
                case "mission.claim": return Required(ClaimMission(account));
                case "onboarding.finish": return Required(FinishOnboarding(account));
                case "recruit.units":
                {
                    var count = NullishInteger(args, "count", 1);
                    var banner = NullishString(args, "banner", "forest");
                    if (Str(account["onboarding"]?["phase"]) == "recruit" || Str(account["earlyGuide"]?["phase"]) == "rabbit-recruit")
                    {
                        if (count != 1 || banner != "forest") throw new RuleException("invalid_recruit");
                        var guaranteed = Str(account["onboarding"]?["phase"]) == "recruit" ? RecruitOnboardingCompanion(account) : RecruitEarlyRabbit(account);
                        return new JArray(Required(guaranteed).DeepClone());
                    }
                    return Required(RecruitUnits(account, count, Bool(args["free"]), banner));
                }
                case "recruit.gem": return Required(DrawGem(account, NullishString(args, "payment", "diamonds"), Bool(args["free"]), NullishString(args, "banner", "treasure")));
                case "unit.grow": return Required(GrowUnit(account, Str(args["id"])));
                case "unit.ability": return Required(UpgradeUnitAbility(account, Str(args["id"]), Str(args["abilityId"])));
                case "unit.refund": return Required(RefundUnitLevels(account, Str(args["id"]), now));
                case "lineup.set":
                {
                    var mode = UndefinedString(args, "mode", "idle");
                    var defaultIndex = mode == null ? 0 : Int(account["activeLineup"]?[mode]);
                    var index = args.Property("index") == null ? defaultIndex : IsIntegerToken(args["index"]) ? Int(args["index"], -1) : -1;
                    return Required(SetSequence(account, args["sequence"] as JArray, mode, index));
                }
                case "gem.equip": return Required(EquipGem(account, Str(args["uid"]), args["replaceType"] == null ? null : Str(args["replaceType"])));
                case "gem.unequip": return Required(UnequipGem(account, Str(args["type"])));
                case "gem.upgrade": return Required(UpgradeGem(account, Str(args["uid"]), args.Property("materialUids") == null ? new JArray() : args["materialUids"] as JArray));
                case "gem.reroll": return Required(RerollGem(account, Str(args["uid"])));
                case "speedrun.claim":
                {
                    var reward = ClaimSpeedrun(account, NullishInteger(args, "stageId", 1), now);
                    return Required(reward > 0 ? new JValue(reward) : null);
                }
                case "idle.select":
                {
                    var stageId = IsIntegerToken(args["stageId"]) ? Int(args["stageId"], -1) : -1;
                    var highest = Int(account["highestCleared"]);
                    var limit = highest + (highest > 0 && highest % 10 == 0 ? 1 : 0);
                    if (stageId < 1 || stageId > limit || catalog.Stage(stageId, "idle") == null) throw new RuleException("stage_locked");
                    account["idleStage"] = stageId;
                    return new JValue(true);
                }
                case "idle.popup":
                {
                    var stageId = IsIntegerToken(args["stageId"]) ? Int(args["stageId"], -1) : -1;
                    if (catalog.Stage(stageId, "idle") == null || args["hidden"]?.Type != JTokenType.Boolean) throw new RuleException("invalid_preference");
                    var hidden = (JArray)account["settings"]["hiddenIdleResults"];
                    for (var i = hidden.Count - 1; i >= 0; i--) if (Int(hidden[i]) == stageId) hidden.RemoveAt(i);
                    if (Bool(args["hidden"])) hidden.Add(stageId);
                    return new JValue(true);
                }
                case "idle.popup.reset":
                    account["settings"]["hiddenIdleResults"] = new JArray();
                    return new JValue(true);
                case "settings": return ExecuteSettings(account, args);
                case "account.reset":
                {
                    var fresh = NewAccount(now);
                    account.RemoveAll();
                    foreach (var property in fresh.Properties()) account[property.Name] = property.Value.DeepClone();
                    return new JValue(true);
                }
                default: throw new RuleException("unknown_command");
            }
        }

        public JObject BattleOptions(JObject a, string mode, int stageId)
        {
            if (!Modes.Contains(mode)) throw new RuleException("invalid_battle");
            var onboarding = IsOnboarding(a);
            if (onboarding)
            {
                if (mode != "challenge" || stageId != OnboardingStageId(Str(a["onboarding"]?["phase"])))
                    throw new RuleException("battle_locked");
            }
            else
            {
                if (catalog.Stage(stageId, mode) == null) throw new RuleException("invalid_stage");
                var highest = Int(a["highestCleared"]);
                var idleLimit = highest + (highest > 0 && highest % 10 == 0 ? 1 : 0);
                if (mode == "idle" && stageId > idleLimit) throw new RuleException("battle_locked");
                if (mode == "challenge")
                {
                    var mission = CurrentMission(a);
                    if (stageId > highest + 1 || Str(mission?["id"]) == "idle-intro" ||
                        (!GrowthUnlocked(a) && stageId > 2) ||
                        (stageId == 2 && Str(a["earlyGuide"]?["phase"]) == "rabbit-recruit"))
                        throw new RuleException("battle_locked");
                }
                if (mode == "speedrun" && (!AdvancedContentUnlocked(a) || stageId > SpeedrunProgress(a)))
                    throw new RuleException("battle_locked");
                if (mode == "idle" && stageId == 2 && Str(a["earlyGuide"]?["phase"]) == "remove-rabbit")
                    throw new RuleException("sequence_required");
            }
            var modifiers = GemModifiers(a, mode);
            var levels = BattleLevels(a);
            var abilities = (JObject)a["abilities"].DeepClone();
            return new JObject
            {
                ["mode"] = mode,
                ["stageId"] = stageId,
                ["levels"] = levels,
                ["abilities"] = abilities,
                ["sequence"] = PlayableSequence(a, mode),
                ["modifiers"] = modifiers,
                ["ownedUnits"] = new JArray(UnitIds().Where(id => CanUseUnit(a, id))),
                ["onboardingPhase"] = onboarding ? Str(a["onboarding"]?["phase"]) : JValue.CreateNull(),
                ["earlyGuidePhase"] = mode != "speedrun" && stageId == 2 ? Str(a["earlyGuide"]?["phase"]) : JValue.CreateNull()
            };
        }

        public JObject BattleLevels(JObject a)
        {
            var result = new JObject();
            foreach (var id in UnitIds()) result[id] = EffectiveLevel(a, id) + Int(a["special"]?[id]);
            return result;
        }

        public JObject GemModifiers(JObject a, string mode)
        {
            var effects = GemEffects(a);
            if (!AdvancedContentUnlocked(a)) effects["killGold"] = 0;
            return effects;
        }

        public JObject CurrentMission(JObject a)
        {
            if (a == null || IsOnboarding(a)) return null;
            var claimed = new HashSet<string>(((JArray)a["missions"]?["claimed"] ?? new JArray()).Values<string>(), StringComparer.Ordinal);
            if (!claimed.Contains("idle-intro"))
                return Mission("idle-intro", "idle", 1, "1-1 방치 클리어", 120, 10, Bool(a["missions"]?["idleCompleted"]));
            var highest = Int(a["highestCleared"]);
            if (highest >= 2 && !Bool(a["earlyGuide"]?["legacy"]) && claimed.Contains("challenge-2"))
            {
                if (!claimed.Contains("idle-second"))
                    return Mission("idle-second", "idle", 2, Str(a["earlyGuide"]?["phase"]) == "remove-rabbit" ? "속공 토끼를 편성에서 빼기" : "1-2 방치 클리어", 160, 10,
                        new[] { "growth", "complete" }.Contains(Str(a["earlyGuide"]?["phase"])));
                if (!claimed.Contains("growth-intro"))
                    return Mission("growth-intro", "growth", null, "동료 레벨 올리기", 100, 10, Str(a["earlyGuide"]?["phase"]) == "complete");
            }
            foreach (var stage in StageList("challenge").Where(s => Int(s["id"]) >= 2))
            {
                var id = Int(stage["id"]);
                if (id == 12 && claimed.Contains("challenge-11") && !claimed.Contains("gem-intro"))
                    return Mission("gem-intro", "gem", null, "보석 모집하고 장착하기", 600, 30, Bool(a["gemGuide"]?["drawn"]) && Bool(a["gemGuide"]?["equipped"]));
                var missionId = "challenge-" + id.ToString(CultureInfo.InvariantCulture);
                if (claimed.Contains(missionId)) continue;
                var reward = stage["missionReward"] as JObject;
                return Mission(missionId, "challenge", id, "도전 " + StageLabel(id) + " 클리어",
                    reward == null ? Number(stage["baseReward"]) : Number(reward["gold"]),
                    reward == null ? 10 : Number(reward["diamonds"]), highest >= id);
            }
            return null;
        }

        public double GrowthCost(JObject a, string unitId) => LevelCost(EffectiveLevel(a, unitId));

        public int EffectiveLevel(JObject a, string id)
        {
            if (!Owns(a, id)) return 1;
            return Math.Max(Int(a["levels"]?[id], 1), SharedLevel(a));
        }

        public JToken RecordBattle(JObject a, JObject result, JObject snapshot, long startedAt, long now)
        {
            if (result == null || snapshot == null) throw new RuleException("invalid_battle");
            var mode = Str(snapshot["mode"]);
            var stageId = Int(snapshot["stageId"], -1);
            var frozenOptions = snapshot["options"] as JObject;
            var frozenPhase = Str(frozenOptions?["onboardingPhase"], Str(snapshot["onboardingPhase"]));
            if (!Modes.Contains(mode) || Str(snapshot["balanceVersion"]) != catalog.BalanceVersion)
                throw new RuleException("battle_version_mismatch");
            var elapsed = (now - startedAt) / 1000.0;
            var battleTime = NumberOrNaN(result["time"]);
            if (!Finite(battleTime) || elapsed + 2 < battleTime / (mode == "idle" ? 1 : 2))
                throw new RuleException("battle_too_early");
            if (frozenPhase != null)
            {
                var currentPhase = Str(a["onboarding"]?["phase"]);
                if (mode != "challenge" || stageId != OnboardingStageId(currentPhase) || frozenPhase != currentPhase) throw new RuleException("battle_obsolete");
                AdvanceOnboardingBattle(a, Bool(result["won"]));
                return new JObject { ["battleResult"] = result.DeepClone(), ["rewards"] = new JObject { ["gold"] = 0, ["diamonds"] = 0 }, ["recordChanged"] = false };
            }
            if (catalog.Stage(stageId, mode) == null) throw new RuleException("invalid_stage");
            RecordMissionBattle(a, mode, stageId, Bool(result["won"]));
            var rewards = new JObject { ["gold"] = 0, ["diamonds"] = 0 };
            var recordChanged = false;
            if (mode == "idle") recordChanged = RecordIdle(a, result, snapshot, now);
            else if (mode == "challenge" && Bool(result["won"])) rewards = CompleteChallenge(a, stageId);
            else if (mode == "speedrun" && Bool(result["won"]) && Int(snapshot["speedrunStageId"], -1) == stageId)
            {
                Accrue(a, now);
                if (Str(snapshot["dailyKey"]) == Str(a["daily"]?["key"])) RecordSpeedrun(a, stageId, Number(result["time"]), now);
                else AdvanceSpeedrun(a, stageId, Number(result["time"]));
            }
            return new JObject { ["battleResult"] = result.DeepClone(), ["rewards"] = rewards, ["recordChanged"] = recordChanged };
        }
    }
}
