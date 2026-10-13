using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using TinyLegion.Domain.Account;
using TinyLegion.Domain.Combat;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
namespace TinyLegion.Unity
{
    public sealed partial class GameView : MonoBehaviour
    {
        IGameController game;AccountRules rules;UiKit ui;ModalNavigation modal;RectTransform root,hand;
        Text resources,battleInfo,gold,notice;Button start,cannon,pause;readonly List<(Button Button,Text Label,string Id)> cards=new List<(Button,Text,string)>();
        float noticeUntil;string shownGuide;long shownReturnTo;string shownConnection;bool sessionPresented;
        public void Initialize(IGameController controller)
        {
            game=controller;rules=new AccountRules(game.Catalog);ui=new UiKit();
            if(!FindFirstObjectByType<EventSystem>()){var es=new GameObject("EventSystem",typeof(EventSystem),typeof(StandaloneInputModule));}
            var canvas=new GameObject("Tiny Legion UI",typeof(RectTransform),typeof(Canvas),typeof(CanvasScaler),typeof(GraphicRaycaster));canvas.transform.SetParent(transform,false);
            canvas.GetComponent<Canvas>().renderMode=RenderMode.ScreenSpaceOverlay;var scaler=canvas.GetComponent<CanvasScaler>();scaler.uiScaleMode=CanvasScaler.ScaleMode.ScaleWithScreenSize;scaler.referenceResolution=new Vector2(960,540);scaler.matchWidthOrHeight=.5f;
            root=ui.Node("SafeArea",canvas.transform);UiKit.Fill(root);var header=ui.Panel(root,new Color32(247,242,225,240));header.anchorMin=new Vector2(0,1);header.anchorMax=Vector2.one;header.offsetMin=new Vector2(0,-56);header.offsetMax=Vector2.zero;
            var row=ui.Row(header,45);UiKit.Fill(row,12,6,12,6);resources=ui.Label(row,"",18);resources.gameObject.AddComponent<LayoutElement>().flexibleWidth=2;
            ui.Button(row,"전장",()=>ShowStages());ui.Button(row,"미션",()=>ShowMission());ui.Button(row,"메뉴",()=>ShowMenu());
            var bottom=ui.Panel(root,new Color32(249,245,230,235));bottom.anchorMin=Vector2.zero;bottom.anchorMax=new Vector2(1,0);bottom.offsetMin=Vector2.zero;bottom.offsetMax=new Vector2(0,160);
            var controls=ui.Row(bottom,36);controls.anchorMin=new Vector2(0,1);controls.anchorMax=Vector2.one;controls.offsetMin=new Vector2(10,-40);controls.offsetMax=new Vector2(-10,-4);
            battleInfo=ui.Label(controls,"",16);battleInfo.gameObject.AddComponent<LayoutElement>().flexibleWidth=3;
            gold=ui.Label(controls,"",16);start=ui.Button(controls,"출정",()=>Run(()=>StartCurrent()));pause=ui.Button(controls,"정지",()=>game.TogglePause());cannon=ui.Button(controls,"대포",()=>game.FireCannon());ui.Button(controls,"순서",ShowSequence);
            hand=ui.Node("Summon hand",bottom);UiKit.Fill(hand,12,8,12,46);var grid=hand.gameObject.AddComponent<GridLayoutGroup>();grid.constraint=GridLayoutGroup.Constraint.FixedColumnCount;grid.constraintCount=5;grid.spacing=new Vector2(5,5);grid.cellSize=new Vector2(104,49);grid.childAlignment=TextAnchor.MiddleCenter;var responsive=hand.gameObject.AddComponent<ResponsiveGrid>();responsive.Columns=5;responsive.FitHeight=true;
            notice=ui.Label(root,"",16,TextAnchor.MiddleCenter);notice.rectTransform.anchorMin=new Vector2(.1f,.72f);notice.rectTransform.anchorMax=new Vector2(.9f,.82f);notice.rectTransform.offsetMin=notice.rectTransform.offsetMax=Vector2.zero;
            modal=new ModalNavigation(ui,root);modal.OpenChanged+=open=>{game.SetModalOpen(open);if(!open)ShowPendingIdleResult();};game.Changed+=Refresh;game.AccountReplaced+=ResetPresentation;game.SaveImportRequested+=ConfirmImport;game.Notice+=Toast;game.BattleFinished+=ShowBattleResult;
            gameObject.AddComponent<BattleView>().Initialize(game,ui);
            Refresh();if(game.SaveRecoveryRequired)return;if(game.Account==null)ShowLogin();else {ResumeGuide();if(!Intro&&!modal.Open)Run(()=>game.StartBattle("idle",(int?)game.Account["idleStage"]??1));}
        }
        string Phase=>(string)game.Account?["onboarding"]?["phase"];
        bool Intro=>Phase!=null&&Phase!="complete";
        static string N(JToken value)=>((double?)value??0).ToString("N0",System.Globalization.CultureInfo.GetCultureInfo("ko-KR"));
        static string StageLabel(int id)=>id==0?"0":$"{(id-1)/10+1}-{(id-1)%10+1}";
        void ResetPresentation(){recoveryPresented=false;pendingIdleResult=null;if(idlePopup)Destroy(idlePopup.gameObject);modal.ForceClose();recruitReceipt=null;revealedCompanions.Clear();collectionRarity="all";collectionOwned=false;shownGuide=null;sessionPresented=false;shownReturnTo=0;shownConnection=null;Refresh();}
        void ConfirmImport(string json){Confirm("저장 불러오기","현재 진행도를 파일의 내용으로 교체합니다.",()=>game.ImportSave(json));}
        void Toast(string text){notice.text=text;noticeUntil=Time.unscaledTime+5;}
        async void Run(Func<Task> action){try{await action();}catch(Exception error){Toast(error.Message);if(game.SaveRecoveryRequired&&!modal.Open){recoveryPresented=false;ShowSaveRecovery();}}}
        async Task StartCurrent()
        {int stage=Intro?(int?)game.Catalog.Raw["onboarding"]?[Phase]?["id"]??1:game.Mode=="idle"?(int?)game.Account?["idleStage"]??1:Math.Max(1,game.StageId);modal.Close();await game.StartBattle(Intro?"challenge":game.Mode,stage);}
        void Refresh()
        {
            if(game.SaveRecoveryRequired){resources.text="저장 복구 필요";ShowSaveRecovery();return;}
            if(game.Account==null){if(game.Online&&game.ConnectionStatus!="idle")ShowConnection();return;}
            bool firstSession=!sessionPresented;sessionPresented=true;
            if(firstSession&&game.Online)modal.ForceClose();
            resources.text=$"도토리 {N(game.Account["gold"])}   다이아 {((double?)game.Account["diamonds"]??0):0.###}";
            UiKit.Clear(hand);cards.Clear();var sequence=game.Battle?.State.Sequence??rules.PlayableSequence(game.Account,game.Mode).Select(x=>x.Type==JTokenType.String?(string)x:null).ToList();
            for(int i=0;i<10;i++)
            {
                string id=i<sequence.Count?sequence[i]:null;var definition=game.Catalog.Character(id);
                var button=ui.Button(hand,"",null,definition!=null);var label=button.GetComponentInChildren<Text>();
                if(definition!=null){var image=ui.Portrait(button.transform,id,38);var r=(RectTransform)image.transform;r.anchorMin=new Vector2(0,0);r.anchorMax=new Vector2(.42f,1);r.offsetMin=r.offsetMax=Vector2.zero;label.rectTransform.anchorMin=new Vector2(.42f,0);label.rectTransform.anchorMax=Vector2.one;label.fontSize=12;}
                if(definition!=null){var input=button.gameObject.AddComponent<SummonCardInput>();input.Summon=()=>game.Summon(id);input.Explain=()=>ShowCollectionDetail(id,false);input.Hover=Toast;input.Description=(string)definition["name"]+" · "+(string)definition["description"];}
                cards.Add((button,label,id));
            }
            // Dialog action handlers refresh their own views; passive settlement must preserve drafts.

            if(game.Online&&game.ConnectionStatus!="connected")ShowConnection();else{shownConnection=null;ResumeGuide();if(firstSession&&!Intro&&game.Battle==null&&!game.Busy&&!modal.Open)Run(()=>game.StartBattle("idle",(int?)game.Account["idleStage"]??1));var returned=game.ReturnIncome;long to=(long?)returned?["to"]??0;if(to>shownReturnTo&&(((double?)returned?["gold"]??0)>0||((double?)returned?["diamonds"]??0)>0)){shownReturnTo=to;modal.Show("복귀 수익",p=>{ui.Paragraph(p,$"부재 {(double?)returned["awaySeconds"]:0}초 · {((bool?)returned["capped"]==true?"8시간 상한 적용":"")}\n도토리 {N(returned["gold"])} · 다이아 {(double?)returned["diamonds"]:0.###}");ui.Button(p,"확인",modal.Back);});}}
        }
        void Update()
        {
            if(game==null)return;var safe=Screen.safeArea;if(Screen.width>0&&Screen.height>0){root.anchorMin=new Vector2(safe.x/Screen.width,safe.y/Screen.height);root.anchorMax=new Vector2(safe.xMax/Screen.width,safe.yMax/Screen.height);root.offsetMin=root.offsetMax=Vector2.zero;}
            if(Input.GetKeyDown(KeyCode.Escape)){if(modal.Open)modal.Back();else if(idlePopup)Destroy(idlePopup.gameObject);else ShowMenu();}if(!modal.Open&&Input.GetKeyDown(KeyCode.Space))game.TogglePause();
            for(int i=0;i<10;i++){var key=i==9?KeyCode.Alpha0:(KeyCode)((int)KeyCode.Alpha1+i);if(!modal.Open&&Input.GetKeyDown(key)&&i<cards.Count)game.Summon(cards[i].Id);}
            var state=game.Battle?.State;double elapsed=state?.Time??0;double duration=state?.Duration??CombatEconomy.BattleDuration(Math.Max(1,game.StageId),game.Mode);
            var time=TimeSpan.FromSeconds(game.Mode=="speedrun"?elapsed:Math.Max(0,duration-elapsed));
            battleInfo.text=$"{StageLabel(game.StageId)} · {ModeLabel(game.Mode)}  {time.Minutes:00}:{time.Seconds:00}";gold.text=$"골드 {(state?.Gold??220):0}";
            start.gameObject.SetActive(state==null||state.Finished&&game.Mode!="idle");start.interactable=!game.Busy&&game.Account!=null&&!modal.Open;
            pause.interactable=state!=null&&!state.Finished;pause.GetComponentInChildren<Text>().text=game.Paused?"계속":"정지";cannon.interactable=state!=null&&!state.Finished&&!Intro&&game.Mode!="idle"&&!game.Paused&&!modal.Open&&game.CannonRemaining<=0;
            cannon.GetComponentInChildren<Text>().text=game.CannonRemaining>0?$"대포 {Math.Ceiling(game.CannonRemaining)}":"대포";
            foreach(var card in cards){var def=game.Catalog.Character(card.Id);if(def==null){card.Label.text="빈 칸";continue;}double cd=state!=null&&state.SummonCooldowns.TryGetValue(card.Id,out var remaining)?remaining:0;card.Label.text=$"{(string)def["name"]}\n{(cd>0?$"{cd:0.0}초":$"{(double)def["cost"]:0}G")}";card.Button.interactable=state!=null&&!state.Finished&&!game.Paused&&game.Mode!="idle"&&cd<=0&&(state.Gold>=(double)def["cost"]);}
            if(Time.unscaledTime>noticeUntil)notice.text=Screen.height>Screen.width?"기기를 가로로 돌려 주세요":"";
        }
        static string ModeLabel(string mode)=>mode=="idle"?"방치":mode=="speedrun"?"속공":"도전";
        void Confirm(string title,string body,Func<Task> apply)
        {modal.Show(title,p=>{ui.Paragraph(p,body);var row=ui.Row(p);ui.Button(row,"취소",modal.Back);ui.Button(row,"확인",()=>Run(async()=>{modal.ForceClose();await apply();}));});}
        void OnDestroy(){if(game!=null){game.Changed-=Refresh;game.AccountReplaced-=ResetPresentation;game.SaveImportRequested-=ConfirmImport;game.Notice-=Toast;game.BattleFinished-=ShowBattleResult;}}
    }
}
