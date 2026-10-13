using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;

namespace TinyLegion.Domain.Combat
{
    public sealed class BattleState
    {
        public double Time { get; set; }
        public double Duration { get; set; }
        public string Mode { get; set; }
        public int StageId { get; set; }
        public bool Finished { get; set; }
        public JObject Result { get; set; }
        public double Gold { get; set; }
        public double GoldCapacity { get; set; }
        public double PlayerHp { get; set; }
        public double PlayerMaxHp { get; set; }
        public double EnemyHp { get; set; }
        public double EnemyMaxHp { get; set; }
        public List<BattleUnit> Units { get; set; } = new List<BattleUnit>();
        public List<BattleProjectile> Projectiles { get; set; } = new List<BattleProjectile>();
        public Dictionary<string, double> SummonCooldowns { get; } = new Dictionary<string, double>();
        public List<string> Sequence { get; } = new List<string>();
        public int QueueIndex { get; set; }
        public string WaitingReason { get; set; }
        public JToken Scene { get; set; }
        public JArray Events { get; set; } = new JArray();
    }

    public sealed class BattleUnit
    {
        public int Uid { get; set; }
        // JS compares the prefixed UID as a string, rather than numerically.
        public string SourceUid => (Team == "player" ? "p" : "e") + Uid;
        public string Id { get; set; }
        public string Team { get; set; }
        public string Family { get; set; }
        public string Attribute { get; set; }
        public string AttackType { get; set; }
        public string Role { get; set; }
        public string ArtId { get; set; }
        public bool Boss { get; set; }
        public double SizeScale { get; set; }
        public JArray Specialties { get; set; } = new JArray();
        public string Origin { get; set; }
        public JObject GemAttributeBonuses { get; set; } = new JObject();
        public JObject Definition { get; set; }
        public double X { get; set; }
        public double Hp { get; set; }
        public double MaxHp { get; set; }
        public double Shield { get; set; }
        public double MaxShield { get; set; }
        public bool Dead { get; set; }
        public int Facing { get; set; }
        public bool Moving { get; set; }
        public string ActionPhase => Action?.Phase;
        public double ActionElapsed => Action?.Elapsed ?? 0;
        public BattleAction Action { get; set; }
        public double HitFlash { get; set; }
        public double AttackFlash { get; set; }
        public double DeathTime { get; set; }
        public double Attack { get; set; }
        public double Range { get; set; }
        public double Speed { get; set; }
        public double AttackInterval { get; set; }
        public double AttackTimer { get; set; }
        public double HitStun { get; set; }
        public double HitStunDuration { get; set; }
        public double HitDirection { get; set; }
        public double StunCooldown { get; set; }
        public JObject Effects { get; set; } = new JObject();
        public JObject StatusEffects { get; set; } = new JObject();
        public Dictionary<string, double> PeriodicTimers { get; } = new Dictionary<string, double>();
        readonly JObject subject = new JObject();
        string subjectTeam,subjectFamily,subjectAttribute,subjectAttackType;
        public JObject Subject()
        {
            if(subjectTeam!=Team||subjectFamily!=Family||subjectAttribute!=Attribute||subjectAttackType!=AttackType||subject.Count==0)
            {
                subject["team"]=subjectTeam=Team;subject["family"]=subjectFamily=Family;
                subject["attribute"]=subjectAttribute=Attribute;subject["attackType"]=subjectAttackType=AttackType;
            }
            return subject;
        }
    }

    public sealed class BattleTarget
    {
        public string Kind { get; set; }
        public int Uid { get; set; }
        public double X { get; set; }
        public string Team { get; set; }
        public BattleTarget Copy() => new BattleTarget { Kind = Kind, Uid = Uid, X = X, Team = Team };
        public JObject Snapshot() { var result = new JObject { ["kind"] = Kind, ["x"] = X, ["team"] = Team }; if (Kind == "unit") result["uid"] = (Team == "player" ? "p" : "e") + Uid; return result; }
    }
    public sealed class BattleAction
    {
        public string Phase { get; set; }
        public double Elapsed { get; set; }
        public double Duration { get; set; }
        public string Kind { get; set; }
        public BattleTarget Target { get; set; }
        public JObject Snapshot() => new JObject { ["phase"] = Phase, ["elapsed"] = Elapsed, ["duration"] = Duration, ["kind"] = Kind, ["target"] = Target.Snapshot() };
    }
    public sealed class BattleProjectile
    {
        public int Uid { get; set; }
        public int SourceUid { get; set; }
        public string Id { get; set; }
        public string Team { get; set; }
        public double StartX { get; set; }
        public double TargetX { get; set; }
        // Presentation uses linear progress between launch and latest target position.
        public double X => StartX + (TargetX - StartX) * (Duration > 0 ? Elapsed / Duration : 1);
        public double Elapsed { get; set; }
        public double Duration { get; set; }
        public BattleTarget Target { get; set; }
        public double Damage { get; set; }
        public double SplashRadius { get; set; }
        public string Kind { get; set; }
        public JObject Source { get; set; }
        public JObject Snapshot() => new JObject { ["uid"] = "shot" + Uid, ["sourceUid"] = (Team == "player" ? "p" : "e") + SourceUid, ["id"] = Id, ["team"] = Team, ["startX"] = StartX, ["targetX"] = TargetX, ["target"] = Target.Snapshot(), ["damage"] = Damage, ["source"] = Source.DeepClone(), ["splashRadius"] = SplashRadius, ["kind"] = Kind, ["elapsed"] = Elapsed, ["duration"] = Duration };
    }
    public sealed class DamageResolution
    {
        public double HpDamage { get; set; }
        public double ShieldDamage { get; set; }
        public bool Blocked { get; set; }
    }
    public sealed class EffectContext
    {
        public string Origin { get; set; }
        public JObject Source { get; set; }
        public double Damage { get; set; }
        public double Direction { get; set; } = double.NaN;
        public double DurationMultiplier { get; set; } = 1;
        public double MinX { get; set; } = 0;
        public double MaxX { get; set; } = 1200;
        public bool CancelWindup { get; set; }
    }
    internal static class Js
    {
        public const double Epsilon = 1e-9;
        public static bool Finite(double x) => !double.IsNaN(x) && !double.IsInfinity(x);
        public static double Number(JToken token, double fallback = 0)
        {
            if (token == null) return fallback;
            if (token.Type == JTokenType.Null) return 0;
            if (token.Type == JTokenType.Integer || token.Type == JTokenType.Float) { var numeric = token.Value<double>(); return Finite(numeric) ? numeric : fallback; }
            if (token.Type == JTokenType.Boolean) return (bool)token ? 1 : 0;
            if (token.Type == JTokenType.Array) { var array = (JArray)token; return array.Count == 0 ? 0 : array.Count == 1 ? Number(array[0], fallback) : fallback; }
            var text = token.ToString();
            if (string.IsNullOrWhiteSpace(text)) return 0;
            return double.TryParse(text, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var x) && Finite(x) ? x : fallback;
        }
        public static double N(JToken token, string key, double fallback = 0) => Number((token as JObject)?[key], fallback);
        public static string S(JToken token, string key, string fallback = null) { var value = (token as JObject)?[key]; return value?.Type == JTokenType.String ? (string)value : fallback; }
        public static double Clamp(double x, double min, double max) => Math.Max(min, Math.Min(max, x));
        public static double Round(double x) => Math.Floor(x + .5);
        public static JObject Obj(JToken token) => token as JObject ?? new JObject();
        public static JObject Copy(JToken token) => token is JObject o ? (JObject)o.DeepClone() : new JObject();
        public static bool Present(JToken token) => token != null && token.Type != JTokenType.Null;
        public static bool Truthy(JToken token) => Present(token) && !(token.Type == JTokenType.Boolean && !(bool)token);
        public static JObject Merge(params JObject[] objects) { var r = new JObject(); foreach (var o in objects) if (o != null) foreach (var p in o.Properties()) r[p.Name] = p.Value.DeepClone(); return r; }
    }
}
