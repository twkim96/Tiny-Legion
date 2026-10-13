using System;
using System.Linq;
using Newtonsoft.Json.Linq;
using TinyLegion.Domain.Combat;
using TinyLegion.Domain.Data;

namespace TinyLegion.Tests.Combat
{
    // Harness-callable without NUnit/Unity. Throws on a failed behavioral contract.
    public static class CombatRegressionChecks
    {
        static void Require(bool condition, string name) { if (!condition) throw new InvalidOperationException("Combat regression: " + name); }
        static bool Near(double a, double b) => Math.Abs(a - b) < 1e-9;
        static BattleUnit Unit(string team = "player", string attackType = "melee") => new BattleUnit { Uid = team == "player" ? 1 : 2, Id = "sheep", Team = team, Family = "forest", Attribute = "wild", AttackType = attackType, Role = "melee", X = team == "player" ? 500 : 520, Hp = 100, MaxHp = 100, Attack = 100, Range = 50, Speed = 0, AttackInterval = 1, Definition = new JObject { ["attackWindup"] = 1.0 / 30, ["attackRecovery"] = .1 } };
        public static int Run(GameCatalog catalog)
        {
            var fx = new CombatEffectService(catalog); var stats = new CharacterStatService(catalog); int checks = 0;
            var unit = Unit();
            fx.ApplyEffect(unit, fx.Effect("slow", new JObject { ["factor"] = .7, ["duration"] = 2 }));
            fx.ApplyEffect(unit, fx.Effect("slow", new JObject { ["factor"] = .8, ["duration"] = 1 }));
            Require(unit.StatusEffects.Count == 1 && Near(CombatEffectService.EffectFactor(unit, "slow"), .8), "same origin replaces"); checks++;
            fx.ApplyEffect(unit, fx.Effect("slow", new JObject { ["factor"] = .5, ["duration"] = 2 }), new EffectContext { Origin = CombatEffectService.EffectOrigin("gem", "g1", "line1") });
            Require(Near(CombatEffectService.EffectFactor(unit, "slow"), .4), "independent origins multiply");
            CombatEffectService.AdvanceEffects(unit, 1); Require(Near(CombatEffectService.EffectFactor(unit, "slow"), .5), "origins expire independently"); checks++;
            unit = Unit(); var poison = fx.Effect("poison", new JObject { ["ratio"] = .1, ["interval"] = 1, ["duration"] = 3 });
            var source = new JObject { ["team"] = "enemy", ["family"] = "forest", ["attribute"] = "wild", ["attackType"] = "ranged", ["effects"] = new JObject { ["poison"] = poison.DeepClone() } };
            fx.ApplyEffect(unit, poison, new EffectContext { Damage = 100, Source = source, Direction = -1 }); double total = 0;
            fx.TickPeriodicEffects(unit, .5, _ => { }, (damage, _, __) => total += damage);
            fx.ApplyEffect(unit, poison, new EffectContext { Damage = 200, Source = source, Direction = -1 });
            fx.TickPeriodicEffects(unit, .5, _ => { }, (damage, _, snapshot) => { total += damage; Require(((JObject)snapshot["effects"]).Count == 0, "poison strips hit recursion"); });
            Require(Near(total, 20), "poison refresh preserves next tick");
            fx.TickPeriodicEffects(unit, 2.5, _ => { }, (damage, _, __) => total += damage); Require(Near(total, 60) && unit.StatusEffects.Count == 0, "poison includes exact final tick"); checks++;
            unit = Unit(); unit.Shield = 50;
            source = new JObject { ["effects"] = new JObject { ["shieldDamage"] = fx.Effect("shieldDamage", new JObject { ["bonus"] = 1 }) } };
            var resolved = fx.ResolveDamage(unit, 100, source); Require(Near(resolved.ShieldDamage, 50) && Near(resolved.HpDamage, 75), "shield bonus overflow uses base damage"); checks++;
            unit.Shield = 0; unit.Effects["sturdy"] = fx.Effect("sturdy"); source["effects"] = new JObject { ["strong"] = fx.Effect("strong") };
            Require(Near(fx.ResolveDamage(unit, 100, source).HpDamage, 80), "final traits multiply then divide"); checks++;
            unit = Unit(); unit.Effects["attackImmunity"] = fx.Effect("attackImmunity", new JObject { ["attackType"] = "ranged", ["family"] = "forest" });
            source = new JObject { ["attackType"] = "ranged", ["family"] = "forest" }; Require(fx.ResolveDamage(unit, 100, source).Blocked, "immunity selects source"); source["family"] = "workshop"; Require(!fx.ResolveDamage(unit, 100, source).Blocked, "immunity respects all axes"); checks++;
            unit = Unit(); unit.Hp = 20;
            fx.ApplyEffect(unit, fx.Effect("healingSuppression", new JObject { ["factor"] = .5, ["duration"] = 2, ["scope"] = "regeneration" }));
            var heal = fx.Effect("healing", new JObject { ["amount"] = 20, ["range"] = 200 }); Require(Near(CombatEffectService.HealUnit(unit, heal), 20), "regeneration suppression preserves support healing");
            fx.ApplyEffect(unit, fx.Effect("healingSuppression", new JObject { ["factor"] = .25, ["duration"] = 1, ["scope"] = "all" })); Require(unit.StatusEffects.Count == 1 && Near(CombatEffectService.HealUnit(unit, heal), 5), "suppression replaces scope"); checks++;
            var bear = Unit("enemy"); var melee = Unit(); melee.Action = new BattleAction { Phase = "windup" }; bear.Effects["repelPulse"] = fx.Effect("repelPulse", new JObject { ["interval"] = 1, ["range"] = 100, ["distance"] = 75, ["warning"] = .2, ["attackType"] = "melee" });
            int warnings = 0, pulses = 0; fx.TickRepulsion(bear, .8, new[] { melee, bear }, _ => warnings++, _ => pulses++); fx.TickRepulsion(bear, .2, new[] { melee, bear }, _ => warnings++, _ => pulses++);
            Require(warnings == 1 && pulses == 1 && melee.Action == null && Near(melee.X, 425), "repulsion warns then cancels matching windup"); checks++;
            var engine = new BattleEngine(catalog, new JObject { ["mode"] = "challenge", ["duration"] = 1, ["sequence"] = new JArray() });
            var a = Unit(); var b = Unit("enemy"); engine.State.Units.Add(a); engine.State.Units.Add(b); engine.Step(1.0 / 30); Require(!a.Dead && !b.Dead, "attacks commit after windup"); engine.Step(1.0 / 30); Require(a.Dead && b.Dead, "simultaneous lethal hits resolve together"); checks++;
            engine = new BattleEngine(catalog, new JObject { ["mode"] = "challenge", ["duration"] = 1, ["sequence"] = new JArray() });
            a = Unit(); a.Dead = true; a.DeathTime = .32; b = Unit("enemy"); b.X = 600; b.AttackTimer = 1; engine.State.Units.Add(a); engine.State.Units.Add(b);
            engine.State.Projectiles.Add(new BattleProjectile { Uid = 1, SourceUid = a.Uid, Team = "player", StartX = 500, TargetX = 600, Target = new BattleTarget { Kind = "unit", Uid = b.Uid, Team = b.Team, X = b.X }, Damage = 25, Source = new JObject(), Duration = .1, Kind = "seed" });
            engine.Step(.1); Require(Near(b.Hp, 75) && engine.State.Projectiles.Count == 0, "projectile survives source death"); checks++;
            engine = new BattleEngine(catalog, new JObject { ["mode"] = "idle", ["sequence"] = new JArray("turtle", "rabbit") }); engine.State.Gold = 300; engine.Step(1.0 / 30);
            Require(engine.State.QueueIndex == 0 && engine.State.Units.Count == 0 && engine.State.WaitingReason == "gold", "queue checks gold before advancing"); checks++;
            var before = catalog.Character("rabbit").ToString(); var ranks = new JObject { ["hp"] = 999, ["attack"] = 999, ["signature"] = 1, ["extra"] = 1 }; stats.Get("rabbit", "player", 120, ranks);
            Require(catalog.Character("rabbit").ToString() == before, "ability snapshots detach catalog");
            var rounding = stats.Get("beetle", "enemy", 1, null, null, new JObject { ["hp"] = 1.9 }); Require((double)rounding["hp"] == Math.Floor((double)rounding["hp"]), "rounding replaces numerically close JValues"); checks++;
            var nullDuration = new BattleEngine(catalog, new JObject { ["duration"] = JValue.CreateNull() }); Require(nullDuration.State.Duration == 40, "null duration uses mode default"); checks++;
            return checks;
        }
    }
}
