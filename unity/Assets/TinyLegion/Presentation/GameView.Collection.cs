using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using TinyLegion.Domain.Combat;
using TinyLegion.Domain.Data;
using UnityEngine;
using UnityEngine.UI;

namespace TinyLegion.Unity
{
    public sealed partial class GameView
    {
        EffectDescriptions collectionDescriptions;
        EffectDescriptions Descriptions => collectionDescriptions ?? (collectionDescriptions = new EffectDescriptions(game.Catalog));
        string collectionRarity = "all"; bool collectionOwned;
        bool collectionPending;
        JArray recruitReceipt; string receiptBanner; int receiptCount; bool receiptTutorial;
        readonly HashSet<int> revealedCompanions = new HashSet<int>();
        static double CValue(JToken token) => GameNumbers.Number(token);
        static string CText(JToken token) => token?.Type == JTokenType.String ? (string)token : "";
        bool OwnsCollection(string id) => (bool?)game.Account?["owned"]?[id] == true;
        bool CanCollect => game.Account != null && !game.Busy && !collectionPending;
        IEnumerable<JObject> CollectionItems(string key) => (game.Catalog.Raw[key] as JArray ?? new JArray()).OfType<JObject>();
        JObject CollectionDefinition(string key,string id) => CollectionItems(key).FirstOrDefault(x=>CText(x["id"])==id);
        string RarityName(JObject unit) => CText(CollectionDefinition("rarities",CText(unit["rarity"]))?["name"]);
        string MarkFor(JObject unit) => CText((unit["specialties"] as JArray)?.FirstOrDefault()) is string id && id.Length>0 ? id : "wild";
        string MarkName(string id) => CText(CollectionDefinition("markTypes",id)?["name"]);
        async Task<JObject> CollectionCommand(string type,JObject args=null)
        {
            if(collectionPending || game.Busy)throw new InvalidOperationException("처리 중입니다. 잠시 기다려 주세요.");
            collectionPending=true;
            try {var envelope=await game.Command(type,args);if(envelope==null)throw new InvalidOperationException("요청 결과를 확인할 수 없습니다.");return envelope;}
            finally {collectionPending=false;if(modal.Open)modal.Refresh();}
        }
        RectTransform CollectionCard(Transform parent, Color? accent=null)
        {
            var panel=ui.Panel(parent,accent??new Color32(243,239,221,255));
            var layout=panel.gameObject.AddComponent<VerticalLayoutGroup>();layout.padding=new RectOffset(10,10,8,8);layout.spacing=5;layout.childControlHeight=true;layout.childControlWidth=true;layout.childForceExpandHeight=false;
            return panel;
        }
        RectTransform CollectionGrid(RectTransform parent,int count,float height)
        {
            var root=ui.Node("Collection grid",parent);var grid=root.gameObject.AddComponent<GridLayoutGroup>();grid.constraint=GridLayoutGroup.Constraint.FixedColumnCount;grid.constraintCount=5;grid.spacing=new Vector2(12,12);var responsive=root.gameObject.AddComponent<ResponsiveGrid>();responsive.Columns=5;responsive.Height=height;var layout=root.gameObject.AddComponent<LayoutElement>();layout.preferredHeight=layout.minHeight=Mathf.Max(1,Mathf.CeilToInt(count/5f))*(height+12)-12;return root;
        }
        void CollectionTile(RectTransform parent,JObject unit,string subtitle,Action open)
        {
            var button=ui.Button(parent,"",open);ui.Style((RectTransform)button.transform,new Color32(252,250,238,255),new Color32(252,250,238,255),new Color32(216,216,196,255),14);var label=button.GetComponentInChildren<Text>();label.text=CText(unit["name"])+"\n"+subtitle;label.fontSize=11;label.alignment=TextAnchor.MiddleCenter;label.rectTransform.anchorMin=Vector2.zero;label.rectTransform.anchorMax=new Vector2(1,.35f);label.rectTransform.offsetMin=new Vector2(5,4);label.rectTransform.offsetMax=new Vector2(-5,0);var art=ui.Portrait(button.transform,CText(unit["id"]),76);art.rectTransform.anchorMin=new Vector2(.1f,.38f);art.rectTransform.anchorMax=new Vector2(.9f,.9f);art.rectTransform.offsetMin=art.rectTransform.offsetMax=Vector2.zero;
        }
        void CollectionHeading(Transform parent,JObject definition,string subtitle)
        {
            var row=ui.Row(parent,82);ui.Portrait(row,CText(definition["artId"]??definition["id"]),76);
            var column=ui.Column(row,2);ui.Paragraph(column,CText(definition["name"]),20);ui.Paragraph(column,subtitle,14);
        }
        void CollectionEffects(Transform parent,JObject definition)
        {
            foreach(var info in Descriptions.Infos(definition))
            {var card=CollectionCard(parent);ui.Paragraph(card,(string)info["label"],17);var details=(string)info["details"];if(!string.IsNullOrEmpty(details))ui.Paragraph(card,details,14);}
        }
        void CollectionStats(Transform parent,JObject stats,bool enemy=false)
        {
            ui.Paragraph(parent,$"종족 {Descriptions.Family(CText(stats["family"]))} · 속성 {Descriptions.Attribute(CText(stats["attribute"]))} · {Descriptions.AttackType(CText(stats["attackType"]))}");
            ui.Paragraph(parent,$"{(enemy?"기본 ":"")}체력 {N(stats["hp"])} · {(enemy?"기본 ":"")}공격력 {N(stats["attack"])} · 초당 공격력 {EffectDescriptions.Number(CValue(stats["attack"])/CValue(stats["attackInterval"]))}");
            ui.Paragraph(parent,$"{(enemy?"기본 ":"")}사거리 {EffectDescriptions.Number(CValue(stats["range"]))} · 이동속도 {EffectDescriptions.Number(CValue(stats["speed"]))} · 공격 간격 {EffectDescriptions.Number(CValue(stats["attackInterval"]))}초");
            if(!enemy)ui.Paragraph(parent,$"소환 골드 {N(stats["cost"])} · 소환 대기 {EffectDescriptions.Number(CValue(stats["cooldown"]))}초");
        }
        internal void ShowGrowth()
        {
            modal.Show("동료 성장",p=>{
                if(!rules.GrowthUnlocked(game.Account)){ui.Paragraph(p,"1-2 방치 미션을 완료하면 레벨업이 열립니다.");return;}
                var roster=rules.BaseLevelRoster(game.Account);ui.Paragraph(p,$"레벨 기준 · 공유 Lv. {rules.SharedLevel(game.Account)}",20);
                var basis=CollectionGrid(p,5,100);for(int i=0;i<5;i++){string id=i<roster.Count?(string)roster[i]:null;if(id==null){ui.Button(basis,"—",null,false);continue;}var unit=game.Catalog.Character(id);CollectionTile(basis,unit,$"Lv. {N(game.Account["levels"]?[id])}",()=>ShowUnitDetail(id));}
                ui.Paragraph(p,"직접 올린 레벨이 높은 5명의 최저 레벨을 다른 동료도 따라갑니다."+(roster.Count<5?" 동료 5명을 모으면 시작됩니다.":""),12);
                var owned=game.Catalog.Units.Where(u=>OwnsCollection(CText(u["id"]))).ToArray();bool compact=Screen.height/UiKit.DisplayScale<=560;var grid=CollectionGrid(p,owned.Length,compact?210:270);
                foreach(var unit in owned)
                {
                    var id=CText(unit["id"]);var level=rules.EffectiveLevel(game.Account,id);var stats=rules.CompanionStats(game.Account,id,game.Mode);var card=CollectionCard(grid);ui.Style(card,new Color32(252,250,238,255),new Color32(252,250,238,255),new Color32(216,216,196,255),14);
                    var rarity=ui.Paragraph(card,RarityName(unit),10);rarity.alignment=TextAnchor.MiddleCenter;
                    var detail=ui.Button(card,"",()=>ShowUnitDetail(id));detail.GetComponent<Image>().color=Color.clear;detail.GetComponent<LayoutElement>().minHeight=detail.GetComponent<LayoutElement>().preferredHeight=compact?110:160;var label=detail.GetComponentInChildren<Text>();label.text=$"Lv. {level}\n{CText(unit["name"])}";label.fontSize=11;label.rectTransform.anchorMin=Vector2.zero;label.rectTransform.anchorMax=new Vector2(1,.3f);label.rectTransform.offsetMin=label.rectTransform.offsetMax=Vector2.zero;var art=ui.Portrait(detail.transform,id,106);art.rectTransform.anchorMin=new Vector2(0,.35f);art.rectTransform.anchorMax=new Vector2(1,1);art.rectTransform.offsetMin=art.rectTransform.offsetMax=Vector2.zero;
                    var values=ui.Row(card,20);values.GetComponent<HorizontalLayoutGroup>().spacing=3;values.GetComponent<HorizontalLayoutGroup>().childForceExpandWidth=false;values.GetComponent<HorizontalLayoutGroup>().childAlignment=TextAnchor.MiddleCenter;ui.Icon(values,"heart",12);ui.Paragraph(values,N(stats["hp"]),11);ui.Icon(values,"swords",12);ui.Paragraph(values,N(stats["attack"]),11);
                    var cost=rules.GrowthCost(game.Account,id);var grow=ui.Button(card,level>=100?"완료":$"{N(new JValue(cost))} ↑",()=>Run(async()=>{await CollectionCommand("unit.grow",new JObject{["id"]=id});}),()=>CanCollect&&level<100&&CValue(game.Account["gold"])>=cost);grow.GetComponent<LayoutElement>().minHeight=grow.GetComponent<LayoutElement>().preferredHeight=32;grow.GetComponentInChildren<Text>().fontSize=11;ui.Primary(grow);
                }
                ui.Paragraph(p,$"도토리 {N(game.Account["gold"])} · 강화는 다음 전투부터 적용됩니다.");
            });
        }
        internal void ShowUnitDetail(string id)
        {
            if(!OwnsCollection(id)){ShowCollectionDetail(id,false);return;}
            modal.Show(CText(game.Catalog.Character(id)?["name"]),p=>RenderUnitCollection(p,id));
        }
        void RenderUnitCollection(RectTransform p,string id)
        {
            var unit=game.Catalog.Character(id);var stats=rules.CompanionStats(game.Account,id,game.Mode);if(unit==null||stats==null||!OwnsCollection(id)){ui.Paragraph(p,"이 동료를 보유하고 있지 않습니다.");return;}
            int level=rules.EffectiveLevel(game.Account,id),personal=(int?)game.Account["levels"]?[id]??1;
            CollectionHeading(p,unit,$"{RarityName(unit)} · Lv. {level} · 개인 Lv. {personal} · 공유 Lv. {rules.SharedLevel(game.Account)}");ui.Paragraph(p,CText(unit["description"]));CollectionStats(p,stats);CollectionSpecialties(p,stats);CollectionEffects(p,stats);
            ui.Paragraph(p,"적용 효과",19);bool any=false;
            foreach(JObject ability in game.Catalog.UnitAbilities(id)){int rank=(int?)game.Account["abilities"]?[id]?[CText(ability["id"])]??0;if(rank>0){ui.Paragraph(p,$"{CText(ability["name"])} {rank}단계 · {Descriptions.Ability(ability,rank)}");any=true;}}
            double special=CValue(game.Account["special"]?[id]);if(special>0){ui.Paragraph(p,$"이전 특별강화 +{special:0}레벨");any=true;}
            foreach(var gem in CollectionBasics()){ui.Paragraph(p,$"{GemName(gem)} Lv. {N(gem["level"])} · {rules.GemDescription(gem)} · 보유 기본 효과");any=true;}
            foreach(var gem in CollectionEquipped())foreach(JObject option in gem["options"] as JArray??new JArray()){ui.Paragraph(p,GemName(gem)+" · 추가옵션 "+Descriptions.GemOption(option));any=true;}
            if(!any)ui.Paragraph(p,"아직 강화한 특수능력이 없어요.");
            double price=rules.GrowthCost(game.Account,id);ui.Button(p,level>=100?"레벨 완료":$"레벨 올리기 · 도토리 {N(new JValue(price))}",()=>Run(async()=>await CollectionCommand("unit.grow",new JObject{["id"]=id})),()=>CanCollect&&rules.GrowthUnlocked(game.Account)&&level<100&&CValue(game.Account["gold"])>=price);
            var mark=MarkFor(unit);ui.Paragraph(p,$"특수능력 · {MarkName(mark)} {N(game.Account["marks"]?[mark])}",20);
            var statService=new CharacterStatService(game.Catalog);
            foreach(JObject ability in game.Catalog.UnitAbilities(id))
            {
                var abilityId=CText(ability["id"]);int rank=(int?)game.Account["abilities"]?[id]?[abilityId]??0;var cost=statService.AbilityCost(ability,rank);bool locked=CValue(game.Account["highestCleared"])<CValue(ability["unlock"]);var card=CollectionCard(p);
                ui.Paragraph(card,$"{CText(ability["name"])} · {rank}/{N(ability["max"])}",17);ui.Paragraph(card,Descriptions.Ability(ability));
                ui.Button(card,locked?$"{StageLabel((int)ability["unlock"])}에서 열림":cost==null?"완료":$"{MarkName(mark)} {N(cost["marks"])} · 도토리 {N(cost["gold"])}",()=>Run(async()=>await CollectionCommand("unit.ability",new JObject{["id"]=id,["abilityId"]=abilityId})),()=>CanCollect&&rules.GrowthUnlocked(game.Account)&&!locked&&cost!=null&&CValue(game.Account["gold"])>=CValue(cost["gold"])&&CValue(game.Account["marks"]?[mark])>=CValue(cost["marks"]));
            }
            ui.Paragraph(p,"강화는 다음 전투부터 적용됩니다.");var quote=rules.RefundQuote(game.Account,id);
            ui.Button(p,"개인 레벨 초기화",()=>Confirm("레벨 초기화",$"{CText(unit["name"])}의 개인 레벨을 1로 되돌리고 도토리 {N(quote["refund"])}개를 돌려받습니다.\n공유 레벨은 남은 기준 동료에 따라 다시 계산됩니다. 방치 기록은 모두 다시 측정해야 합니다. 특수능력과 보석은 보존됩니다.",async()=>{
                var envelope=await CollectionCommand("unit.refund",new JObject{["id"]=id});await game.LeaveBattle();if(game.Mode=="idle")await game.StartBattle("idle",(int?)game.Account["idleStage"]??1);Toast("도토리 +"+N(envelope["result"]));
            }),()=>CanCollect&&(bool?)quote["enabled"]==true);
        }
        void CollectionSpecialties(Transform parent,JObject unit)
        {var list=unit["specialties"] as JArray;ui.Paragraph(parent,list!=null&&list.Count>0?string.Join(" · ",list.Select(x=>Descriptions.Attribute((string)x)+"특화")):"범용 · 모든 속성에 동일한 기본 성능");}
        internal void ShowCodex(bool enemy=false)
        {
            modal.Show("도감",p=>RenderCollectionCodex(p,enemy));
        }
        void RenderCollectionCodex(RectTransform p,bool enemy)
        {
            var tabs=ui.Row(p);ui.Button(tabs,enemy?"동료":"✓ 동료",()=>{modal.Show("도감",q=>RenderCollectionCodex(q,false),true);},enemy);ui.Button(tabs,enemy?"✓ 적":"적",()=>{modal.Show("도감",q=>RenderCollectionCodex(q,true),true);},!enemy);
            // Tabs replace their frame so repeated switching preserves a bounded back stack.
            if(enemy){var enemyGrid=CollectionGrid(p,game.Catalog.Enemies.Count(),180);foreach(var unit in game.Catalog.Enemies){var id=CText(unit["id"]);CollectionTile(enemyGrid,unit,Descriptions.Attribute(CText(unit["attribute"]))+((bool?)unit["boss"]==true?" · 거대 적":""),()=>ShowCollectionDetail(id,true));}return;}
            ui.Paragraph(p,$"동료 {game.Catalog.Units.Count(u=>OwnsCollection(CText(u["id"])))}/{game.Catalog.Units.Count()}");
            var filters=ui.Row(p);ui.Button(filters,collectionRarity=="all"?"✓ 전체 등급":"전체 등급",()=>{collectionRarity="all";modal.Refresh();});foreach(var rarity in CollectionItems("rarities")){var id=CText(rarity["id"]);ui.Button(filters,(collectionRarity==id?"✓ ":"")+CText(rarity["name"]),()=>{collectionRarity=id;modal.Refresh();});}
            ui.Button(p,collectionOwned?"보유 동료만 · 전체 보기":"전체 동료 · 보유만 보기",()=>{collectionOwned=!collectionOwned;modal.Refresh();});
            var units=game.Catalog.Units.Where(u=>(collectionRarity=="all"||CText(u["rarity"])==collectionRarity)&&(!collectionOwned||OwnsCollection(CText(u["id"])))).ToArray();
            if(units.Length==0)ui.Paragraph(p,"해당 동료가 없습니다.");var unitGrid=CollectionGrid(p,units.Length,180);foreach(var unit in units){var id=CText(unit["id"]);CollectionTile(unitGrid,unit,RarityName(unit)+" · "+(OwnsCollection(id)?$"보유 · Lv. {rules.EffectiveLevel(game.Account,id)}":"미보유"),()=>ShowCollectionDetail(id,false));}
        }
        void ShowCollectionDetail(string id,bool enemy,bool replace=false)
        {
            var baseUnit=game.Catalog.Character(id,enemy?"enemy":"player");if(baseUnit==null)return;
            modal.Show(CText(baseUnit["name"]),p=>{
                var unit=enemy?baseUnit:rules.CompanionStats(game.Account,id,game.Mode);CollectionHeading(p,baseUnit,enemy?Descriptions.Attribute(CText(baseUnit["attribute"]))+((bool?)baseUnit["boss"]==true?" · 거대 적":""):RarityName(baseUnit)+" · "+(OwnsCollection(id)?$"보유 · Lv. {rules.EffectiveLevel(game.Account,id)}":"미보유 · 모집에서 획득")+" · "+CText(baseUnit["theme"]));
                var roles=new Dictionary<string,string>{{"tank","방어"},{"fast","돌격"},{"ranged","원거리"},{"splash","광역"},{"support","지원"},{"melee","근접"},{"heavy","돌파"},{"warrior","전사"}};var role=CText(baseUnit["role"]);ui.Paragraph(p,(roles.TryGetValue(role,out var label)?label:role)+" · "+CText(baseUnit["description"]));
                if(!enemy)CollectionSpecialties(p,unit);CollectionEffects(p,unit);CollectionStats(p,unit,enemy);
                if(!enemy&&OwnsCollection(id))ui.Button(p,"성장 · 특수능력",()=>ShowUnitDetail(id));
                var picks=(enemy?game.Catalog.Enemies:game.Catalog.Units).ToArray();for(int start=0;start<picks.Length;start+=5){var row=ui.Row(p,48);foreach(var next in picks.Skip(start).Take(5)){var nextId=CText(next["id"]);ui.Button(row,(nextId==id?"✓ ":"")+CText(next["name"]),()=>ShowCollectionDetail(nextId,enemy,true));}}
            },replace);
        }
        internal void ShowRecruit(string banner="forest")
        {
            var selected=CollectionDefinition("banners",banner)??CollectionItems("banners").First();
            if(CValue(game.Account?["highestCleared"])<CValue(selected["unlock"]))selected=CollectionDefinition("banners","forest");
            var id=CText(selected["id"]);modal.Show("동료 모집",p=>RenderCollectionRecruit(p,id),required:Phase=="recruit"||CText(game.Account?["earlyGuide"]?["phase"])=="rabbit-recruit");
        }
        void RenderCollectionRecruit(RectTransform p,string banner)
        {
            if(recruitReceipt!=null){RenderCollectionReveal(p);return;}
            bool tutorial=Phase=="recruit"||CText(game.Account?["earlyGuide"]?["phase"])=="rabbit-recruit";
            if(!tutorial&&!rules.GrowthUnlocked(game.Account)){ui.Paragraph(p,"미션을 따라 숲길을 탐험해 보세요. 1-2 방치 미션 뒤 일반 모집이 열립니다.");return;}
            var definition=CollectionDefinition("banners",tutorial?"forest":banner);banner=CText(definition["id"]);
            var tabs=ui.Row(p,52);foreach(var item in CollectionItems("banners")){var id=CText(item["id"]);bool locked=CValue(game.Account["highestCleared"])<CValue(item["unlock"]);ui.Button(tabs,(id==banner?"✓ ":"")+CText(item["name"])+(locked?"\n2-1에서 열림":""),()=>{modal.Show("동료 모집",q=>RenderCollectionRecruit(q,id),true);},!tutorial&&!locked&&!collectionPending);}
            ui.Paragraph(p,CText(definition["name"])+" · "+Descriptions.Attribute(CText(definition["attribute"]))+"특화",22);
            var featured=ui.Row(p,104);foreach(var id in definition["featured"] as JArray??new JArray()){var column=ui.Column(featured,0);ui.Portrait(column,(string)id,64);ui.Paragraph(column,CText(game.Catalog.Character((string)id)?["name"]),14);}
            if(tutorial)ui.Paragraph(p,Phase=="recruit"?"1회 모집으로 첫 동료를 만나 보세요.":"성을 공략할 동료를 무료로 만나 보세요.");
            else
            {
                ui.Paragraph(p,string.Join(" · ",CollectionRates(definition).Select(r=>CText(r["name"])+" "+EffectDescriptions.Number(CValue(r["rate"])*100)+"%")));
                ui.Paragraph(p,$"희귀 이상 {Math.Max(0,10-CValue(game.Account["recruitment"]?["sinceRare"])):0}회 이내 · 영웅 이상 {Math.Max(0,50-CValue(game.Account["recruitment"]?["sinceEpic"])):0}회 이내\n누적 {N(game.Account["recruitment"]?["total"])}회 · 다이아 {EffectDescriptions.Number(CValue(game.Account["diamonds"]))}");
            }
            var actions=ui.Row(p);ui.Button(actions,tutorial?"1회 무료":"1회 · 다이아 30",()=>Run(()=>DrawCollectionCompanions(1,tutorial,banner,tutorial)),()=>CanCollect&&(tutorial||CValue(game.Account["diamonds"])>=30));
            ui.Button(actions,"10회 · 다이아 270",()=>Run(()=>DrawCollectionCompanions(10,false,banner,false)),()=>CanCollect&&!tutorial&&CValue(game.Account["diamonds"])>=270);
            if(!tutorial&&(bool?)game.Account["recruitment"]?["welcomeClaimed"]!=true)ui.Button(p,"첫 만남 · 무료 10회",()=>Run(()=>DrawCollectionCompanions(10,true,banner,false)),()=>CanCollect);
            if(!tutorial)ui.Button(p,"확률 · 보장 · 중복 보상",()=>ShowCollectionRates(banner));
        }
        IEnumerable<JObject> CollectionRates(JObject banner)
        {
            foreach(var rarity in CollectionItems("rarities")){var copy=(JObject)rarity.DeepClone();if(banner["rates"] is JObject rates)copy["rate"]=rates[CText(rarity["id"])]?.DeepClone()??new JValue(0);if(CValue(copy["rate"])>0)yield return copy;}
        }
        void ShowCollectionRates(string banner)
        {
            modal.Show("모집 확률",p=>{
                var definition=CollectionDefinition("banners",banner);ui.Paragraph(p,CText(definition["name"]),21);var ids=new HashSet<string>(((JArray)definition["units"]).Values<string>());
                foreach(var rarity in CollectionRates(definition)){var pool=game.Catalog.Units.Where(u=>ids.Contains(CText(u["id"]))&&CText(u["rarity"])==CText(rarity["id"])).ToArray();ui.Paragraph(p,CText(rarity["name"])+" · "+EffectDescriptions.Number(CValue(rarity["rate"])*100)+"%",18);foreach(var unit in pool)ui.Paragraph(p,CText(unit["name"])+" · "+(CValue(rarity["rate"])*100/pool.Length).ToString("0.00")+"%");}
                ui.Paragraph(p,"선택한 모집의 기본 확률입니다. 같은 등급 안에서 동료별 확률은 같습니다."+(banner=="forest"?" 숲속 모집에는 전설이 없으며 영웅 확률은 12%입니다.":""));
                ui.Paragraph(p,"희귀 이상 10회 이내, 영웅 이상 50회 이내 보장. 보장 회차에서 일반 결과는 희귀로, 영웅 보장 회차의 일반·희귀 결과는 영웅으로 올라갑니다. 해당 등급 이상을 얻으면 횟수가 초기화됩니다. 모집을 바꿔도 보장 횟수는 이어집니다.");
                ui.Paragraph(p,"첫 획득은 동료를 해금하고 중복은 해당 동료 계열의 징표를 줍니다. "+string.Join(" · ",CollectionItems("rarities").Select(r=>CText(r["name"])+" "+N(game.Catalog.Raw["duplicateMarks"]?[CText(r["id"])])+"개"))+". 징표와 도토리로 특수능력을 강화합니다. 무료 10회는 계정당 한 번이며 선택한 모집에서 지급됩니다.");
                ui.Paragraph(p,$"희귀 {N(game.Account["recruitment"]?["sinceRare"])}/10 · 영웅 {N(game.Account["recruitment"]?["sinceEpic"])}/50");
            });
        }
        async Task DrawCollectionCompanions(int count,bool free,string banner,bool tutorial)
        {
            if(recruitReceipt!=null)return;
            var envelope=await CollectionCommand("recruit.units",new JObject{["count"]=count,["free"]=free,["banner"]=banner});
            var result=envelope["result"] as JArray;if(result==null)throw new InvalidOperationException("모집 결과를 확인할 수 없습니다.");
            recruitReceipt=(JArray)result.DeepClone();receiptBanner=banner;receiptCount=count;receiptTutorial=tutorial;revealedCompanions.Clear();
            modal.Show("모집 결과",p=>RenderCollectionReveal(p),true,required:tutorial);
        }
        void RenderCollectionReveal(RectTransform p)
        {
            if(recruitReceipt==null)return;
            ui.Paragraph(p,"동료 모집");
            var reveals=new Dictionary<int,Action>();var cardsRoot=ui.Node("Recruit result cards",p);var layout=cardsRoot.gameObject.AddComponent<GridLayoutGroup>();layout.constraint=GridLayoutGroup.Constraint.FixedColumnCount;layout.constraintCount=5;layout.spacing=new Vector2(7,7);
            var responsive=cardsRoot.gameObject.AddComponent<ResponsiveGrid>();responsive.Columns=5;responsive.Height=120;
            var resultHeight=cardsRoot.gameObject.AddComponent<LayoutElement>();int resultRows=Mathf.Max(1,Mathf.CeilToInt(recruitReceipt.Count/5f));resultHeight.minHeight=resultHeight.preferredHeight=resultRows*120+(resultRows-1)*7;
            Button done=null,again=null,skip=null;
            var revealStatus=ui.Paragraph(p,"동료를 만나고 있습니다.");
            Action update=()=>{bool complete=revealedCompanions.Count>=recruitReceipt.Count;if(done)done.interactable=complete&&!collectionPending;if(again)again.interactable=complete&&CanCollect&&CValue(game.Account["diamonds"])>=(receiptCount==10?270:30);if(skip)skip.gameObject.SetActive(!complete);if(revealStatus)revealStatus.text=complete?recruitReceipt.OfType<JObject>().Count(r=>(bool?)r["isNew"]==true)+"명의 새 동료를 만났습니다.":"동료를 만나고 있습니다.";};
            for(int i=0;i<recruitReceipt.Count;i++)
            {
                int index=i;var result=(JObject)recruitReceipt[i];var unit=result["unit"] as JObject??game.Catalog.Character(CText(result["id"]));if(unit==null)throw new InvalidOperationException("모집 결과의 동료 정의가 없습니다.");
                var id=CText(unit["id"]);var button=ui.Button(cardsRoot,"",()=>{if(revealedCompanions.Contains(index))ShowCollectionDetail(id,false);else reveals[index]();});var text=button.GetComponentInChildren<Text>();text.fontSize=13;UiKit.Fill(text.rectTransform,5,4,5,54);
                var art=ui.Portrait(button.transform,id,74);var ar=(RectTransform)art.transform;ar.anchorMin=new Vector2(.2f,.55f);ar.anchorMax=new Vector2(.8f,.98f);ar.offsetMin=ar.offsetMax=Vector2.zero;
                Action show=()=>{
                    art.gameObject.SetActive(true);string mark=CText(result["markAttribute"]);if(mark.Length==0)mark=MarkFor(unit);double amount=result["marks"]!=null?CValue(result["marks"]):receiptTutorial?0:CValue(game.Catalog.Raw["duplicateMarks"]?[CText(unit["rarity"])]);
                    text.text=RarityName(unit)+"\n"+CText(unit["name"])+"\n"+((bool?)result["isNew"]==true?"NEW":MarkName(mark)+" +"+amount.ToString("0"))+((bool?)result["guaranteed"]==true?" · 보장":"");
                    if(ColorUtility.TryParseHtmlString(CText(CollectionDefinition("rarities",CText(unit["rarity"]))?["color"]),out var tint))button.GetComponent<Image>().color=Color.Lerp(ui.Paper,tint,.3f);
                };
                if(revealedCompanions.Contains(index))show();else{art.gameObject.SetActive(false);text.text=(index+1)+"번째 동료\n✉ 열기";}
                reveals[index]=()=>{if(!p||!p.gameObject.activeInHierarchy||!button||recruitReceipt==null||revealedCompanions.Contains(index))return;revealedCompanions.Add(index);show();StartCoroutine(AnimateCollectionReveal((RectTransform)button.transform));update();};
            }
            skip=ui.Button(p,"모두 보기",()=>{foreach(var reveal in reveals.Values)reveal();});var actions=ui.Row(p);
            done=ui.Button(actions,"확인",()=>{bool tutorial=receiptTutorial;recruitReceipt=null;revealedCompanions.Clear();if(tutorial){modal.ForceClose();shownGuide=null;ResumeGuide();}else modal.Show("동료 모집",q=>RenderCollectionRecruit(q,receiptBanner),true);},false);
            if(!receiptTutorial)again=ui.Button(actions,"한 번 더",()=>Run(async()=>{var banner=receiptBanner;var count=receiptCount;recruitReceipt=null;revealedCompanions.Clear();modal.Show("동료 모집",q=>RenderCollectionRecruit(q,banner),true);await DrawCollectionCompanions(count,false,banner,false);}),false);
            update();StartCoroutine(AutoRevealCollection(p,reveals));
        }
        IEnumerator AutoRevealCollection(RectTransform page,Dictionary<int,Action> reveals)
        {
            yield return new WaitForSecondsRealtime(.5f);
            foreach(var reveal in reveals.OrderBy(x=>x.Key)){if(!page||!page.gameObject.activeInHierarchy||recruitReceipt==null)yield break;reveal.Value();yield return new WaitForSecondsRealtime(.18f);}
        }
        IEnumerator AnimateCollectionReveal(RectTransform card)
        {
            float elapsed=0;while(card&&elapsed<.2f){elapsed+=Time.unscaledDeltaTime;card.localScale=Vector3.one*Mathf.Lerp(.88f,1,Mathf.Clamp01(elapsed/.2f));yield return null;}if(card)card.localScale=Vector3.one;
        }
        IEnumerable<JObject> CollectionGems() => (game.Account?["gemItems"] as JArray??new JArray()).OfType<JObject>();
        JObject CollectionGem(string uid)=>CollectionGems().FirstOrDefault(x=>CText(x["uid"])==uid);
        string GemName(JObject gem)=>CText(CollectionDefinition("gemTypes",CText(gem?["type"]))?["name"]);
        bool CollectionEquipped(JObject gem)=>CText(game.Account?["gemEquipment"]?[CText(gem?["type"])])==CText(gem?["uid"]);
        IEnumerable<JObject> CollectionEquipped()=>CollectionItems("gemTypes").Select(type=>CollectionGem(CText(game.Account?["gemEquipment"]?[CText(type["id"])]))).Where(g=>g!=null).Take((int?)game.Catalog.Raw["constants"]?["gemOptionLimit"]??3);
        IEnumerable<JObject> CollectionBasics()=>CollectionItems("gemTypes").Select(type=>CollectionGems().Where(g=>CText(g["type"])==CText(type["id"])).OrderByDescending(g=>CValue(g["level"])).FirstOrDefault()).Where(g=>g!=null);
        JObject CollectionTier(JObject gem)=>CollectionDefinition("gemOptionTiers",CText(gem?["optionTier"]))??CollectionItems("gemOptionTiers").ElementAt(((JArray)gem["options"]).Count>=3?3:((JArray)gem["options"]).Count==2?2:0);
        string CollectionGemOptions(JObject gem)=>string.Join("\n",(gem["options"] as JArray??new JArray()).OfType<JObject>().Select(Descriptions.GemOption));
        void CollectionGemCard(Transform parent,JObject gem,Action action,string actionTitle="상세")
        {
            var card=CollectionCard(parent);var definition=CollectionDefinition("gemTypes",CText(gem["type"]));if(ColorUtility.TryParseHtmlString(CText(definition?["color"]),out var tint))card.GetComponent<Image>().color=Color.Lerp(ui.Paper,tint,.2f);
            ui.Paragraph(card,$"◆ {GemName(gem)} · Lv. {N(gem["level"])} · {CText(CollectionTier(gem)["name"])}"+(CollectionEquipped(gem)?" · 추가옵션 장착 중":""),17);ui.Paragraph(card,CollectionGemOptions(gem) is string text&&text.Length>0?text:"추가옵션 없음",14);ui.Button(card,actionTitle,action,!collectionPending);
        }
        internal void ShowGems()
        {
            modal.Show("보석",p=>{
                if(!rules.AdvancedContentUnlocked(game.Account)){ui.Paragraph(p,"2-1을 완료하면 열립니다.");return;}
                var equipped=CollectionEquipped().ToArray();int limit=(int?)game.Catalog.Raw["constants"]?["gemOptionLimit"]??3;
                ui.Paragraph(p,$"추가옵션 장착 {equipped.Length}/{limit}",20);
                for(int i=0;i<limit;i++){if(i<equipped.Length){var gem=equipped[i];CollectionGemCard(p,gem,()=>ShowCollectionGemDetail(CText(gem["uid"])),"상세 · 교체");}else ui.Button(p,"+ 추가옵션 장착",()=>ShowCollectionGemPicker(),()=>CanCollect);}
                ui.Paragraph(p,"보유한 보석의 기본 효과는 항상 적용됩니다. 추가옵션은 장착한 3개만 적용됩니다. 같은 종류는 하나만 장착하며, 모든 전투 모드의 다음 전투부터 반영됩니다.");
                ui.Paragraph(p,"보유 보석의 기본 효과",20);var basics=CollectionBasics().ToArray();
                foreach(var type in CollectionItems("gemTypes"))
                {
                    var basic=basics.FirstOrDefault(x=>CText(x["type"])==CText(type["id"]));if((bool?)type["legacy"]==true&&basic==null)continue;
                    var card=CollectionCard(p);ui.Paragraph(card,"◆ "+CText(type["name"]),18);ui.Paragraph(card,basic==null?"미보유 · 효과 없음":rules.GemDescription(basic)+" · 항상 적용");if(basic!=null)ui.Button(card,$"최고 Lv. {N(basic["level"])} · 기본 효과",()=>ShowCollectionGemDetail(CText(basic["uid"])));
                }
                var banner=CollectionItems("gemBanners").First();ui.Paragraph(p,CText(banner["name"]),20);ui.Paragraph(p,CText(banner["description"]));
                if((bool?)game.Account["gemWelcomeClaimed"]!=true)ui.Button(p,"1회 무료",()=>Run(()=>DrawCollectionGem("diamonds",true)),()=>CanCollect);
                var actions=ui.Row(p);ui.Button(actions,"조각 5 · 모집",()=>Run(()=>DrawCollectionGem("tickets")),()=>CanCollect&&CValue(game.Account["tickets"])>=5);ui.Button(actions,"다이아 30 · 모집",()=>Run(()=>DrawCollectionGem("diamonds")),()=>CanCollect&&CValue(game.Account["diamonds"])>=30);ui.Button(actions,"확률 · 옵션",ShowCollectionGemRates);
                ui.Paragraph(p,$"보유 보석 {CollectionGems().Count()}",20);foreach(var item in CollectionGems()){var uid=CText(item["uid"]);CollectionGemCard(p,item,()=>ShowCollectionGemDetail(uid));}
                if(!CollectionGems().Any())ui.Paragraph(p,"보석을 모집해 기본 효과와 추가옵션을 모아 보세요.");
                var reserves=game.Account["gemReserves"] as JObject;if(reserves!=null&&reserves.Properties().Any(x=>CValue(x.Value)>0))ui.Paragraph(p,"이전 보석 재료 · "+string.Join(" · ",reserves.Properties().Where(x=>CValue(x.Value)>0).Select(x=>GemName(new JObject{["type"]=x.Name})+" "+N(x.Value))));
                ui.Paragraph(p,$"도토리 {N(game.Account["gold"])} · 다이아 {EffectDescriptions.Number(CValue(game.Account["diamonds"]))} · 보석 조각 {N(game.Account["tickets"])}");
            });
        }
        async Task DrawCollectionGem(string payment,bool free=false)
        {
            var envelope=await CollectionCommand("recruit.gem",new JObject{["payment"]=payment,["free"]=free,["banner"]="treasure"});var uid=CText(envelope["result"]?["uid"]);if(uid.Length==0)throw new InvalidOperationException("보석 모집 결과를 확인할 수 없습니다.");ShowCollectionGemDetail(uid);
        }
        void ShowCollectionGemRates()
        {
            modal.Show("보석 확률 · 옵션",p=>{
                var banner=CollectionItems("gemBanners").First();ui.Paragraph(p,CText(banner["name"]),21);var types=(JArray)banner["types"];foreach(var type in types)ui.Paragraph(p,GemName(new JObject{["type"]=type.DeepClone()})+" · "+EffectDescriptions.Number(100.0/types.Count)+"%");
                ui.Paragraph(p,"모집 보석은 일반 등급 1줄 옵션입니다. 각 옵션 종류는 같은 확률이고 범위 안 정수 %를 같은 확률로 뽑습니다. 재설정은 같은 등급을 유지하거나 한 단계 승급합니다.");
                foreach(var tier in CollectionItems("gemOptionTiers"))ui.Paragraph(p,$"{CText(tier["name"])} · {N(tier["lines"])}줄 · 재설정 도토리 {N(tier["cost"])} · 승급 {EffectDescriptions.Number(CValue(tier["promotionChance"])*100)}%");
                ui.Paragraph(p,"옵션별 수치 범위",19);foreach(var option in CollectionItems("gemOptions"))ui.Paragraph(p,CText(option["name"])+" "+EffectDescriptions.Number(CValue(option["min"])*100)+"~"+EffectDescriptions.Number(CValue(option["max"])*100)+"%");
            });
        }
        void ShowCollectionGemDetail(string uid,bool replace=false)
        {
            if(CollectionGem(uid)==null)return;modal.Show("보석 상세",p=>{
                var gem=CollectionGem(uid);if(gem==null){ui.Paragraph(p,"이 보석을 더 이상 보유하고 있지 않습니다.");return;}
                var basic=CollectionBasics().First(x=>CText(x["type"])==CText(gem["type"]));var tier=CollectionTier(gem);ui.Paragraph(p,$"◆ {GemName(gem)} · Lv. {N(gem["level"])}/10 · {CText(tier["name"])}",22);ui.Paragraph(p,$"보유 기본 효과 · 최고 Lv. {N(basic["level"])} · {rules.GemDescription(basic)}");
                ui.Paragraph(p,$"추가옵션 · {N(tier["lines"])}줄",19);ui.Paragraph(p,CollectionGemOptions(gem) is string text&&text.Length>0?text:"추가옵션 없음");
                ui.Paragraph(p,$"{CText(tier["name"])} · 재설정 도토리 {N(tier["cost"])} · 승급 {EffectDescriptions.Number(CValue(tier["promotionChance"])*100)}%");
                if(CollectionEquipped(gem))ui.Button(p,"추가옵션 해제",()=>Run(async()=>{await CollectionCommand("gem.unequip",new JObject{["type"]=gem["type"].DeepClone()});Toast("해제했습니다. 다음 전투부터 적용됩니다.");}),()=>CanCollect);
                else {var equipped=CollectionEquipped().ToArray();bool same=equipped.Any(x=>CText(x["type"])==CText(gem["type"]));ui.Button(p,same?"같은 종류 교체":equipped.Length>=3?"다른 칸과 교체":"추가옵션 장착",()=>ChooseCollectionGemEquip(uid,true),()=>CanCollect);}
                var cost=rules.GemUpgradeCost(gem);var actions=ui.Row(p);ui.Button(actions,$"재설정 · 도토리 {N(tier["cost"])}",()=>ShowCollectionGemReroll(uid),()=>CanCollect&&CValue(game.Account["gold"])>=CValue(tier["cost"]));ui.Button(actions,cost==null?"강화 완료":$"강화 · 같은 보석 {N(cost["copies"])}개 + 도토리 {N(cost["gold"])}",()=>ShowCollectionGemUpgrade(uid),()=>CanCollect&&cost!=null);
                ui.Paragraph(p,"재설정은 기존 옵션을 새 결과로 바꾸며 같은 등급을 유지하거나 한 단계 승급합니다. 승급하면 옵션 줄 수도 늘어날 수 있습니다. 보석 레벨 강화는 옵션 등급·수치를 유지합니다.");ui.Button(p,"옵션 등급 · 수치 범위",ShowCollectionGemRates);
            },replace);
        }
        void ShowCollectionGemPicker()
        {
            modal.Show("추가옵션 선택",p=>{ui.Paragraph(p,"보유한 모든 종류에서 선택할 수 있습니다. 같은 종류는 한 칸만 사용합니다.");foreach(var gem in CollectionGems()){var uid=CText(gem["uid"]);CollectionGemCard(p,gem,()=>ChooseCollectionGemEquip(uid,false),"추가옵션 선택");}if(!CollectionGems().Any())ui.Paragraph(p,"보유한 보석이 없습니다.");});
        }
        void ChooseCollectionGemEquip(string uid,bool detail)
        {
            var gem=CollectionGem(uid);if(gem==null)return;var equipped=CollectionEquipped().ToArray();var same=equipped.FirstOrDefault(x=>CText(x["type"])==CText(gem["type"]));
            if(same==null&&equipped.Length>=3)
            {
                modal.Show("교체할 추가옵션",p=>{ui.Paragraph(p,GemName(gem)+" 보석을 선택한 칸과 바로 교체합니다.");foreach(var current in CollectionEquipped()){var type=CText(current["type"]);CollectionGemCard(p,current,()=>Run(()=>CommitCollectionGemEquip(uid,type,detail,true)),"이 칸 교체");}});return;
            }
            Run(()=>CommitCollectionGemEquip(uid,same==null?null:CText(same["type"]),detail));
        }
        async Task CommitCollectionGemEquip(string uid,string replaceType,bool detail,bool fromPicker=false)
        {
            var args=new JObject{["uid"]=uid};if(replaceType!=null)args["replaceType"]=replaceType;await CollectionCommand("gem.equip",args);Toast("추가옵션을 장착했습니다. 다음 전투부터 적용됩니다.");
            if(detail){if(fromPicker)modal.Back();modal.Refresh();}else{modal.Close();ShowGems();}
        }
        void ShowCollectionGemUpgrade(string uid)
        {
            var selected=new HashSet<string>();modal.Show("강화 재료",p=>{
                var target=CollectionGem(uid);var cost=rules.GemUpgradeCost(target);if(target==null||cost==null){ui.Paragraph(p,"강화할 수 없는 보석입니다.");return;}
                var candidates=CollectionGems().Where(x=>CText(x["uid"])!=uid&&CText(x["type"])==CText(target["type"])&&CValue(x["level"])==1&&!CollectionEquipped(x)).ToArray();selected.IntersectWith(candidates.Select(x=>CText(x["uid"])));
                int copies=(int)cost["copies"];double reserves=CValue(game.Account["gemReserves"]?[CText(target["type"])]);int gap=Math.Max(0,copies-selected.Count);
                ui.Paragraph(p,$"{GemName(target)} 강화 · 같은 보석 {copies}개 + 도토리 {N(cost["gold"])}",20);ui.Paragraph(p,"선택한 보석은 소모됩니다. 장착 중이거나 강화한 보석은 재료에서 제외합니다. 강화 대상의 옵션 등급과 수치는 보존됩니다.");
                ui.Paragraph(p,$"선택 {selected.Count}/{copies} · 이전 보석 재료 {reserves:0}개 · 부족한 {gap}개는 이전 재료로 사용합니다.");
                foreach(var gem in candidates){var id=CText(gem["uid"]);CollectionGemCard(p,gem,()=>{if(collectionPending)return;if(!selected.Remove(id)&&selected.Count<copies)selected.Add(id);modal.Refresh();},selected.Contains(id)?"✓ 선택됨 · 제외":"재료 선택");}
                if(candidates.Length==0)ui.Paragraph(p,"사용 가능한 같은 종류의 Lv. 1 보석이 없습니다.");
                var row=ui.Row(p);ui.Button(row,"취소",modal.Back);ui.Button(row,"선택한 재료로 강화",()=>Run(async()=>{await CollectionCommand("gem.upgrade",new JObject{["uid"]=uid,["materialUids"]=new JArray(selected.OrderBy(x=>x,StringComparer.Ordinal))});modal.Back();Toast("강화했습니다. 옵션 등급과 수치는 보존됩니다.");}),()=>CanCollect&&gap<=reserves&&CValue(game.Account["gold"])>=CValue(cost["gold"]));
            });
        }
        void ShowCollectionGemReroll(string uid)
        {
            modal.Show("추가옵션 재설정",p=>{
                var item=CollectionGem(uid);if(item==null)return;var tier=CollectionTier(item);double cost=rules.GemRerollCost(item)??0;
                ui.Paragraph(p,$"{GemName(item)} {CText(tier["name"])} · {N(tier["lines"])}줄의 옵션을 새로 뽑습니다.\n도토리 {N(new JValue(cost))}개를 사용하며, 다음 등급 승급 확률은 {EffectDescriptions.Number(CValue(tier["promotionChance"])*100)}%입니다.\n기존 옵션은 새 결과로 바뀌고, 적용은 다음 전투부터입니다.");
                ui.Paragraph(p,"현재 옵션\n"+CollectionGemOptions(item));var row=ui.Row(p);ui.Button(row,"취소",modal.Back);ui.Button(row,"재설정",()=>Run(async()=>{var before=CText(tier["id"]);var envelope=await CollectionCommand("gem.reroll",new JObject{["uid"]=uid});var result=envelope["result"] as JObject??CollectionGem(uid);modal.Back();Toast(CText(result?["optionTier"])!=before?"보석 옵션이 승급했습니다!":"추가옵션을 재설정했습니다.");}),()=>CanCollect&&cost>0&&CValue(game.Account["gold"])>=cost);
            },presentation:"message");
        }
    }
}
