using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Newtonsoft.Json.Linq;
using TinyLegion.Domain.Combat;

namespace TinyLegion.Domain.Data
{
    // Shared Korean presentation vocabulary. Values and target validation come from the combat registry.
    public sealed class EffectDescriptions
    {
        readonly GameCatalog catalog;
        readonly CombatEffectService effects;
        public EffectDescriptions(GameCatalog catalog) { this.catalog = catalog; effects = new CombatEffectService(catalog); }
        public static string Number(double value) => value.ToString("#,0.##", CultureInfo.GetCultureInfo("ko-KR"));
        static double Value(JToken value) => GameNumbers.Number(value);
        static double V(JObject spec, string key) => Value(spec?[key]);
        static string Percent(double value) => Number(value * 100) + "%";
        public string Attribute(string id) => (string)((JArray)catalog.Raw["attributes"]).OfType<JObject>().FirstOrDefault(x => (string)x["id"] == id)?["name"] ?? (string)catalog.Raw["neutralAttribute"]?["name"] ?? "무속성";
        public string Family(string id) => (string)catalog.Raw["families"]?[id ?? ""]?["name"] ?? "";
        public string AttackType(string id) => (string)catalog.Raw["attackTypes"]?[id ?? ""]?["name"] ?? "";
        public string Stat(string id) => (string)catalog.Raw["statNames"]?[id ?? ""] ?? id;
        public string AttackTarget(JToken selection) => selection == null || selection.Type == JTokenType.Null || (string)(selection is JValue ? selection : null) == "all" ? "모든 공격" : string.Join("·", (selection is JArray a ? a : new JArray(selection)).Select(x => AttackType((string)x)));
        public string Targets(JObject spec, bool all = false, bool includeAttackType = true)
        {
            var parts = new List<string>();
            if (includeAttackType && (all || spec?["attackType"] != null && spec["attackType"].ToString() != "all")) parts.Add("대상 " + AttackTarget(spec?["attackType"]));
            foreach (var axis in new[] { "family", "attribute" })
            {
                var selection = spec?[axis]; var name = axis == "family" ? "종족" : "속성";
                if (selection == null || selection.Type == JTokenType.Null || selection.ToString() == "all") { if (all) parts.Add("모든 " + name); }
                else parts.Add(name + " " + string.Join("·", (selection is JArray a ? a : new JArray(selection)).Select(x => axis == "family" ? Family((string)x) : Attribute((string)x))));
            }
            return string.Join(" · ", parts);
        }
        string Amount(JObject spec) => string.Join(" + ", new[] { V(spec, "amount") != 0 ? Number(V(spec, "amount")) : "", V(spec, "hpRatio") != 0 ? "최대 체력의 " + Percent(V(spec, "hpRatio")) : "" }.Where(x => x.Length > 0));
        public string Keyword(JObject spec)
        {
            var type = (string)spec?["type"]; if (type == null) return "";
            var label = (string)catalog.Raw["effects"]?[type]?["name"] ?? "";
            if (type == "attackImmunity") return label + "(" + AttackTarget(spec["attackType"]) + ")";
            if (type == "immunity") return label + "(" + ((string)catalog.Raw["effects"]?[(string)spec["effect"]]?["name"] ?? (string)spec["effect"]) + ")";
            if (type == "stat")
            {
                var direction = CombatEffectService.EffectKind(spec).Split(':')[2];
                return Stat((string)spec["stat"]) + " " + (direction == "increase" ? "증가" : direction == "decrease" ? "감소" : "변화") + (spec["attackType"] != null && spec["attackType"].ToString() != "all" ? "(" + AttackTarget(spec["attackType"]) + ")" : "");
            }
            return label;
        }
        public string Details(JObject spec)
        {
            string detail; var type = (string)spec["type"];
            switch (type)
            {
                case "sturdy": detail = "유효 체력 +" + Percent(V(spec, "effectiveHp")); break;
                case "strong": detail = "유효 체력 +" + Percent(V(spec, "effectiveHp")) + " · 추가 피해 " + Percent(V(spec, "bonus")); break;
                case "devastating": detail = "추가 피해 " + Percent(V(spec, "bonus")); break;
                case "slow": detail = "이동속도 " + Percent(1 - V(spec, "factor")) + " 감소 · " + Number(V(spec, "duration")) + "초"; break;
                case "healingSuppression": detail = ((string)spec["scope"] == "regeneration" ? "재생 " : "") + "회복량 " + Percent(1 - V(spec, "factor")) + " 감소 · " + Number(V(spec, "duration")) + "초"; break;
                case "healing": detail = "회복량 " + Amount(spec) + " · 범위 " + Number(V(spec, "range")); break;
                case "regeneration": detail = Number(V(spec, "interval")) + "초마다 " + Amount(spec) + " 회복"; break;
                case "shield": detail = Amount(spec) + " 흡수"; break;
                case "poison": detail = Number(V(spec, "duration")) + "초간 " + Number(V(spec, "interval")) + "초마다 공격력 " + Percent(V(spec, "ratio")) + " 피해"; break;
                case "immunity": case "attackImmunity": detail = ""; break;
                case "shieldDamageAura": detail = "방어막 추가 피해 +" + Percent(V(spec, "bonus")) + " · 범위 " + Number(V(spec, "range")); break;
                case "areaAttack": detail = "범위 " + Number(V(spec, "radius")); break;
                case "castleDamage": case "shieldDamage": detail = "+" + Percent(V(spec, "bonus")); break;
                case "knockback": detail = "거리 " + Number(V(spec, "distance")); break;
                case "repelPulse": detail = Number(V(spec, "interval")) + "초마다 · 대상 " + AttackTarget(spec["attackType"]) + " · 범위 " + Number(V(spec, "range")) + " · 거리 " + Number(V(spec, "distance")); break;
                case "hitStun": detail = Number(V(spec, "duration")) + "초"; break;
                case "stat":
                    var changes = new[] { V(spec, "flat") != 0 ? (V(spec, "flat") > 0 ? "+" : "") + Number(V(spec, "flat")) : "", V(spec, "multiplier") != 1 ? Number(V(spec, "multiplier")) + "배" : "" }.Where(x => x.Length > 0).ToArray();
                    detail = (changes.Length > 0 ? string.Join(" · ", changes) : "변화 없음") + " · " + Number(V(spec, "duration")) + "초"; break;
                default: throw new ArgumentException("Unknown effect description: " + type);
            }
            var target = Targets(spec, type == "attackImmunity", !new[] { "attackImmunity", "repelPulse", "stat" }.Contains(type));
            return string.Join(" · ", new[] { detail, target }.Where(x => x.Length > 0));
        }
        public JObject Info(JObject spec)
        {
            var type = (string)spec?["type"]; if (type == null || catalog.Raw["effects"]?[type] == null) return null;
            var values = effects.Effect(type, spec);
            return new JObject { ["type"] = type, ["keyword"] = catalog.Raw["effects"][type]["keyword"].DeepClone(), ["label"] = Keyword(values), ["details"] = Details(values), ["values"] = values };
        }
        public string Text(JObject spec) { var info = Info(spec); return info == null ? "" : string.Join(" · ", new[] { (string)info["label"], (string)info["details"] }.Where(x => !string.IsNullOrEmpty(x))); }
        public IEnumerable<JObject> Infos(JObject character) => ((JObject)character?["effects"] ?? new JObject()).Properties().Select(x => x.Value as JObject).Where(x => x != null).Select(Info).Where(x => x != null);
        public IEnumerable<string> Lines(JObject character) => Infos(character).Select(x => string.Join(" · ", new[] { (string)x["label"], (string)x["details"] }.Where(s => !string.IsNullOrEmpty(s))));
        public string Change(JObject change, double rank = 1)
        {
            var op = (string)change["op"]; if (op == "effect") return Text((JObject)change["value"]); if (op == "specialty") return "";
            var amount = V(change, "amount") * rank;
            if (op == "counter")
            {
                var fields = change["fields"] as JArray; return string.Join(" · ", (fields != null && fields.Count > 0 ? fields : new JArray("trait")).Select(x => ((string)x == "effectiveHp" ? "유효 체력" : (string)x == "bonus" ? "추가 피해" : "특성 효과") + " +" + Number(amount * 100) + "%p"));
            }
            var path = ((string)change["path"]).Split('.'); var root = path[0]; var field = path.Length > 2 ? path[2] : "";
            var fieldName = new Dictionary<string,string> { ["duration"] = "지속시간", ["radius"] = "범위", ["bonus"] = "", ["amount"] = "회복량", ["hpRatio"] = "흡수량" };
            var label = root == "effects" ? ((string)catalog.Raw["effects"]?[path[1]]?["name"] + " " + (fieldName.TryGetValue(field, out var name) ? name : field)).Trim() : Stat(root);
            return label + " " + (amount >= 0 ? "+" : "−") + (op == "multiply" || field == "bonus" || field == "hpRatio" ? Percent(Math.Abs(amount)) : Number(Math.Abs(amount))) + (root == "attackInterval" || field == "duration" ? "초" : "");
        }
        public string Changes(JArray changes, double rank = 1) => string.Join(" · ", (changes ?? new JArray()).OfType<JObject>().Select(x => Change(x, rank)).Where(x => !string.IsNullOrEmpty(x)));
        public string Ability(JObject ability, double rank = 1) => ability["attribute"] != null ? Attribute((string)ability["attribute"]) + "특화 추가" : Changes(ability["changes"] as JArray, rank);
        public string GemOption(JObject option)
        {
            var definition = ((JArray)catalog.Raw["gemOptions"]).OfType<JObject>().FirstOrDefault(x => (string)x["id"] == (string)option?["id"]);
            return definition == null ? "" : (string)definition["name"] + " +" + Percent(Value(option["value"]));
        }
    }
}
