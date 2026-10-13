using System;
using System.Linq;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using TinyLegion.Domain.Combat;
using UnityEngine;
using UnityEngine.UI;
namespace TinyLegion.Unity
{
    public sealed partial class GameView
    {
        void ShowMenu()
        {
            modal.Show("군단 메뉴",p=>{
                if(game.Account==null){ui.Button(p,"로그인",ShowLogin);return;}
                if(Intro){ui.Button(p,"설정",ShowSettings);return;}
                var row=ui.Row(p);ui.Button(row,"동료",ShowGrowth);ui.Button(row,"모집",()=>ShowRecruit());ui.Button(row,"도감",()=>ShowCodex());
                var next=ui.Row(p);ui.Button(next,"전장",ShowStages);ui.Button(next,"순서",ShowSequence);ui.Button(next,"미션",ShowMission);
                var economy=ui.Row(p);ui.Button(economy,"생산 기록",ShowIncome);ui.Button(economy,"속공",ShowDaily,rules.AdvancedContentUnlocked(game.Account));ui.Button(economy,"보석",ShowGems,rules.AdvancedContentUnlocked(game.Account));
                ui.Button(p,"설정",ShowSettings);
                if((bool?)game.Identity?["isAdmin"]==true)ui.Button(p,"관리자 기능",ShowAdmin);
                if(game.Battle!=null)ui.Button(p,"전투 나가기",()=>Confirm("전투 나가기","진행 중인 전투를 종료하고 방치로 돌아갑니다.",async()=>{await game.LeaveBattle();if(!Intro)await game.StartBattle("idle",(int?)game.Account["idleStage"]??1);}));
            });
        }
        void ShowStages()
        {
            if(game.Account==null)return;
            modal.Show("전장",p=>{
                var modes=ui.Row(p);foreach(string m in new[]{"idle","challenge","speedrun"}){string mode=m;ui.Button(modes,ModeLabel(mode),()=>ShowStageMode(mode),mode!="speedrun"||rules.AdvancedContentUnlocked(game.Account));}
                RenderStages(p,game.Mode);
            });
        }
        void ShowStageMode(string mode)=>modal.Show(ModeLabel(mode),p=>RenderStages(p,mode));
        void RenderStages(RectTransform parent,string mode)
        {
            if(game.Account==null)return;
            int unlocked=mode=="speedrun"?rules.SpeedrunProgress(game.Account):Math.Min(rules.GrowthUnlocked(game.Account)?20:2,(int?)game.Account["highestCleared"]+1??1);
            if((string)rules.CurrentMission(game.Account)?["id"]=="idle-intro")unlocked=1;
            foreach(JObject stage in (JArray)game.Catalog.Raw[mode=="speedrun"?"speedrunStages":"stages"])
            {
                int id=(int)stage["id"];var row=ui.Row(parent);ui.Button(row,$"{StageLabel(id)} {(string)stage["name"]}",()=>Run(async()=>{await game.LeaveBattle();if(mode=="idle")await game.Command("idle.select",new JObject{["stageId"]=id});modal.Close();await game.StartBattle(mode,id);}),id<=unlocked&&!Intro);
                ui.Button(row,"정보",()=>modal.Show((string)stage["name"],p=>{
                    ui.Paragraph(p,(string)stage["description"]??"");ui.Paragraph(p,$"성 체력 {N(stage["enemyHp"])} · 제한 {CombatEconomy.BattleDuration(id,mode)}초");
                    foreach(JObject wave in (JArray)stage["waves"]){ui.Paragraph(p,$"{(double)wave["time"]:0.#}초 · "+string.Join(" / ",((JArray)wave["enemies"]).OfType<JObject>().Select(e=>$"{(string)game.Catalog.Character((string)e["id"],"enemy")?["name"]} × {(int?)e["count"]??1}")));}
                }));
            }
        }
        void ShowMission()
        {
            modal.Show("진행 미션",p=>{
                var mission=rules.CurrentMission(game.Account);if(mission==null){ui.Paragraph(p,"현재 미션을 모두 완료했습니다.");return;}
                ui.Paragraph(p,(string)mission["title"]??(string)mission["name"]??(string)mission["id"],22);ui.Paragraph(p,(string)mission["description"]??"");
                ui.Paragraph(p,$"보상 도토리 {N(mission["gold"]??mission["reward"]?["gold"])} · 다이아 {N(mission["diamonds"]??mission["reward"]?["diamonds"])}");
                bool ready=(bool?)mission["ready"]??(bool?)mission["completed"]??false;
                ui.Button(p,ready?"보상 받기":"미션 진행",()=>Run(async()=>{if(ready){await game.Command("mission.claim");modal.Close();ResumeGuide();}else{modal.Close();if((string)mission["id"]=="idle-intro"|| (string)mission["id"]=="idle-second")await game.StartBattle("idle",(string)mission["id"]=="idle-intro"?1:2);else if((string)mission["id"]=="growth-intro")ShowGrowth();else if((string)mission["id"]=="gem-intro")ShowGems();else await game.StartBattle("challenge",(int?)mission["stageId"]??Math.Min(20,(int?)game.Account["highestCleared"]+1??1));} }));
            });
        }
        void ShowIncome()
        {
            modal.Show("기록 기반 생산",p=>{
                ui.Paragraph(p,"한 스테이지의 최고 기록으로 생산합니다. 성장은 새 기록에 반영됩니다. 오프라인 정산은 최대 8시간입니다.");
                foreach(var record in ((JObject)game.Account["records"]).Properties())
                {int id=int.Parse(record.Name);var r=(JObject)record.Value;double seconds=(double?)r["productionSeconds"]??120;ui.Paragraph(p,$"{StageLabel(id)} · 도토리 {(double?)r["gold"]*3600/seconds:0} / 시간 · 다이아 {(double?)r["diamonds"]*3600/seconds:0.###} / 시간");ui.Button(p,(int?)game.Account["idleStage"]==id?"현재 생산 중":"생산 선택",()=>Run(async()=>{await game.Command("idle.select",new JObject{["stageId"]=id});modal.Refresh();}));}
            });
        }
        void ShowDaily()
        {
            modal.Show("오늘의 속공",p=>{
                ui.Paragraph(p,$"{(string)game.Account["daily"]?["key"]} · 서울 자정에 기록/수령 초기화\n60초 이내 완료하면 다음 스테이지가 열립니다.");
                for(int i=1;i<=20;i++){int id=i;var record=rules.SpeedrunStageRecord(game.Account,id);var row=ui.Row(p);ui.Button(row,$"{StageLabel(id)} {(double?)record["time"]:0.##}초",()=>Run(async()=>{await game.LeaveBattle();modal.Close();await game.StartBattle("speedrun",id);}),id<=rules.SpeedrunProgress(game.Account));double reward=rules.SpeedrunReward(game.Account,id);ui.Button(row,(bool?)record["claimed"]==true?"수령 완료":$"조각 {reward:0} 받기",()=>Run(async()=>{await game.Command("speedrun.claim",new JObject{["stageId"]=id});modal.Refresh();}),reward>0&&(bool?)record["claimed"]!=true);}
            });
        }
        void ResumeGuide()
        {
            if(game.Account==null)return;string phase=Phase;string early=(string)game.Account["earlyGuide"]?["phase"];
            string key=phase+":"+early;if(shownGuide==key)return;shownGuide=key;
            if(phase=="intro")Guide("첫 출정","양 방패 카드를 눌러 적 성을 무너뜨리세요.","출정",()=>game.StartBattle("challenge",0));
            else if(phase=="first-battle")Guide("첫 숲길","양 방패로 첫 숲길에 도전해 보세요.","도전",()=>game.StartBattle("challenge",1));
            else if(phase=="recruit")ShowRecruit();
            else if(phase=="retry-battle")Guide("동료와 함께","양 방패와 씨앗 다람쥐를 소환해 다시 도전하세요.","다시 출정",()=>game.StartBattle("challenge",1));
            else if(phase=="idle-guide")Guide("기록으로 생산","방치에서는 정한 순서로 자동 소환합니다. 방어 성적을 기록하면 도토리와 다이아가 생산됩니다.","방치 시작",async()=>{await game.Command("onboarding.finish");await game.StartBattle("idle",1);});
            else if(phase=="complete"&&early=="rabbit-recruit")ShowRecruit();
            else if(phase=="complete"&&early=="wall-retry")Guide("속공 토끼","속공 토끼의 성 추가 피해로 튼튼한 성벽을 공략하세요.","도전",()=>game.StartBattle("challenge",2));
            else if(phase=="complete"&&early=="idle-defense")Guide("방치 편성","속공 토끼가 포함된 같은 편성으로 1-2 방치를 측정해 보세요.","방치 측정",()=>game.StartBattle("idle",2));
            else if(phase=="complete"&&early=="remove-rabbit")Guide("방어를 위한 순서","소환 골드를 많이 쓰는 속공 토끼를 방치 순서에서 빼고 양과 다람쥐를 배치해 보세요.","순서 편집",()=>{ShowSequence();return Task.CompletedTask;});
            else if(phase=="complete"&&early=="growth")Guide("동료 성장","도토리로 동료를 성장시키세요. 공유 레벨과 투자 비용은 성장 화면에서 확인할 수 있습니다.","동료 성장",()=>{ShowGrowth();return Task.CompletedTask;});
            else if(phase=="complete"&&early=="idle-retry")Guide("다시 측정","방어에 맞춘 순서로 1-2를 다시 측정하세요.","방치 측정",()=>game.StartBattle("idle",2));
        }
        void Guide(string title,string text,string action,Func<Task> run)
        {modal.Show(title,p=>{ui.Portrait(p,"sheep",96);ui.Paragraph(p,text,18);ui.Button(p,action,()=>Run(async()=>{modal.ForceClose();await run();}));},required:true);}
        JObject pendingIdleResult;RectTransform idlePopup;
        void ShowPendingIdleResult(){if(pendingIdleResult!=null&&!modal.Open){var outcome=pendingIdleResult;pendingIdleResult=null;ShowIdlePopup(outcome);}}
        void ShowIdlePopup(JObject outcome)
        {
            if(idlePopup)Destroy(idlePopup.gameObject);
            idlePopup=ui.Panel(root,new Color32(249,245,232,245));idlePopup.anchorMin=new Vector2(.69f,.36f);idlePopup.anchorMax=new Vector2(.985f,.71f);idlePopup.offsetMin=idlePopup.offsetMax=Vector2.zero;
            var content=ui.Column(idlePopup,3);UiKit.Fill(content);var result=outcome["battleResult"] as JObject??outcome;
            ui.Paragraph(content,"방치 측정",18);ui.Paragraph(content,$"성 체력 {((double?)result["hpRatio"]??0)*100:0}% · {(double?)result["survival"]:0.#}초",14);
            var record=game.Account["records"]?[game.StageId.ToString()];ui.Paragraph(content,$"최고 도토리 {(double?)record?["gold"]*3600/((double?)record?["productionSeconds"]??120):0} / 시간",14);
            var income=outcome["income"];if(income!=null)ui.Paragraph(content,$"이번 생산 도토리 {N(income["gold"])} · 다이아 {(double?)income["diamonds"]:0.###}",14);
            var row=ui.Row(content,30);ui.Button(row,"숨기기",()=>Run(async()=>{await game.Command("idle.popup",new JObject{["stageId"]=game.StageId,["hidden"]=true});if(idlePopup)Destroy(idlePopup.gameObject);}));ui.Button(row,"확인",()=>{if(idlePopup)Destroy(idlePopup.gameObject);});
        }
        void ShowBattleResult(JObject outcome)
        {
            var result=outcome["battleResult"] as JObject??outcome;bool won=(bool?)result["won"]??false;
            if(Intro){shownGuide=null;ResumeGuide();return;}
            if(game.Mode=="idle"){if(((JArray)game.Account["settings"]?["hiddenIdleResults"])?.Any(x=>(int)x==game.StageId)==true)return;if(modal.Open)pendingIdleResult=(JObject)outcome.DeepClone();else ShowIdlePopup(outcome);shownGuide=null;ResumeGuide();return;}
            modal.Show(game.Mode=="idle"?"방치 측정":won?"승리":"도전 종료",p=>{
                ui.Paragraph(p,$"성 체력 {((double?)result["hpRatio"]??0)*100:0}% · 생존 {(double?)result["survival"]:0.##}초");
                if(game.Mode=="idle"){
                    var record=game.Account["records"]?[game.StageId.ToString()];ui.Paragraph(p,$"시간당 도토리 {(double?)record?["gold"]*3600/((double?)record?["productionSeconds"]??120):0}");
                    ui.Toggle(p,"이 스테이지 결과 숨기기",false,value=>Run(async()=>await game.Command("idle.popup",new JObject{["stageId"]=game.StageId,["hidden"]=value})));
                    ui.Button(p,"확인",modal.Close);
                }else{
                    ui.Paragraph(p,$"보상 도토리 {N(outcome["rewards"]?["gold"])} · 다이아 {N(outcome["rewards"]?["diamonds"])}");
                    var row=ui.Row(p);ui.Button(row,"방치로",()=>Run(async()=>{modal.Close();await game.StartBattle("idle",(int?)game.Account["idleStage"]??1);}));
                    if(won&&game.StageId<20){ui.Button(row,"다음",()=>Run(async()=>{modal.Close();await game.StartBattle(game.Mode,Math.Min(20,game.StageId+1));}));}else ui.Button(row,"다시 도전",()=>Run(async()=>{modal.Close();await game.StartBattle(game.Mode,game.StageId);}));
                    if(game.Mode=="speedrun")ui.Button(p,"일일 보상",ShowDaily);
                    if(!won){ui.Button(p,"동료 성장",ShowGrowth);ui.Button(p,"모집",()=>ShowRecruit());ui.Button(p,"미션",ShowMission);}
                }
            });
            shownGuide=null;ResumeGuide();
        }
    }
}
