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
        IGameController game;AccountRules rules;UiKit ui;ModalNavigation modal;RectTransform root,hand,hudLeft,hudRight,contentIcons,combatIcons;
        Vector2 hudSize;BattleEngine displayedBattle;
        Text resources,battleInfo,gold,notice;Button start,cannon,pause,speedButton;readonly List<(Button Button,Text Label,string Id)> cards=new List<(Button,Text,string)>();
        float noticeUntil;string shownGuide;long shownReturnTo;string shownConnection;bool sessionPresented;
        public void Initialize(IGameController controller)
        {
            game=controller;rules=new AccountRules(game.Catalog);ui=new UiKit();
            if(!FindFirstObjectByType<EventSystem>()){var es=new GameObject("EventSystem",typeof(EventSystem),typeof(StandaloneInputModule));}
            var canvas=new GameObject("Tiny Legion UI",typeof(RectTransform),typeof(Canvas),typeof(CanvasScaler),typeof(GraphicRaycaster));canvas.transform.SetParent(transform,false);
            canvas.GetComponent<Canvas>().renderMode=RenderMode.ScreenSpaceOverlay;var scaler=canvas.GetComponent<CanvasScaler>();scaler.uiScaleMode=CanvasScaler.ScaleMode.ScaleWithScreenSize;scaler.referenceResolution=new Vector2(960,540);scaler.matchWidthOrHeight=.5f;
            root=ui.Node("SafeArea",canvas.transform);UiKit.Fill(root);
            var shade=ui.Node("HUD shade",root);shade.anchorMin=new Vector2(0,1);shade.anchorMax=Vector2.one;shade.offsetMin=new Vector2(0,-150);shade.offsetMax=Vector2.zero;var tint=shade.gameObject.AddComponent<RawImage>();tint.texture=Resources.Load<Texture2D>("Scenery/hud-shade");tint.raycastTarget=false;
            var header=ui.Node("Header",root);header.anchorMin=new Vector2(0,1);header.anchorMax=Vector2.one;header.offsetMin=new Vector2(0,-66);header.offsetMax=Vector2.zero;
            var row=ui.Row(header,56);row.GetComponent<HorizontalLayoutGroup>().childForceExpandWidth=false;UiKit.Fill(row,12,4,12,4);resources=ui.Label(row,"",16);var wallet=resources.gameObject.AddComponent<LayoutElement>();wallet.flexibleWidth=2;wallet.preferredWidth=210;wallet.minWidth=120;
            battleInfo=ui.Label(row,"",16,TextAnchor.MiddleCenter);var stageInfo=battleInfo.gameObject.AddComponent<LayoutElement>();stageInfo.flexibleWidth=2;stageInfo.preferredWidth=150;stageInfo.minWidth=100;
            resources.color=battleInfo.color=Color.white;
            contentIcons=ui.Row(row,56);contentIcons.GetComponent<HorizontalLayoutGroup>().childForceExpandWidth=false;ui.IconButton(contentIcons,"units","동료",ShowGrowth);ui.IconButton(contentIcons,"envelope","모집",()=>ShowRecruit());ui.IconButton(contentIcons,"book","도감",()=>ShowCodex());
            combatIcons=ui.Row(row,56);combatIcons.GetComponent<HorizontalLayoutGroup>().childForceExpandWidth=false;ui.IconButton(combatIcons,"sequence","순서",ShowSequence);ui.IconButton(combatIcons,"close","나가기",()=>Confirm("전투 나가기","현재 전투를 종료하고 방치로 돌아갑니다.",async()=>{await game.LeaveBattle();await game.StartBattle("idle",(int?)game.Account["idleStage"]??1);}));pause=ui.IconButton(combatIcons,"pause","정지",()=>game.TogglePause());
            speedButton=ui.IconButton(combatIcons,"forward","1×",()=>Run(async()=>await game.Command("settings",new JObject{["speed"]=(double?)game.Account?["settings"]?["speed"]==2?1:2})));
            ui.IconButton(row,"menu","메뉴",()=>ShowMenu());
            var bottom=ui.Node("Battle HUD",root);bottom.anchorMin=Vector2.zero;bottom.anchorMax=new Vector2(1,0);bottom.offsetMin=Vector2.zero;bottom.offsetMax=new Vector2(0,130);
            hudLeft=ui.Column(bottom,4);hudLeft.anchorMin=hudLeft.anchorMax=new Vector2(0,0);hudLeft.pivot=Vector2.zero;hudLeft.anchoredPosition=new Vector2(12,8);hudLeft.sizeDelta=new Vector2(150,52);gold=ui.Label(hudLeft,"",16);
            hudRight=ui.Row(bottom,56);hudRight.anchorMin=hudRight.anchorMax=new Vector2(1,0);hudRight.pivot=new Vector2(1,0);hudRight.anchoredPosition=new Vector2(-12,8);hudRight.sizeDelta=new Vector2(119,56);
            start=ui.IconButton(hudRight,"swords","출정",()=>Run(()=>StartCurrent()));cannon=ui.IconButton(hudRight,"cannon","대포",()=>game.FireCannon());
            hand=ui.Node("Summon hand",bottom);hand.anchorMin=hand.anchorMax=new Vector2(.5f,0);hand.pivot=new Vector2(.5f,0);hand.anchoredPosition=new Vector2(0,8);var grid=hand.gameObject.AddComponent<GridLayoutGroup>();grid.constraint=GridLayoutGroup.Constraint.FixedColumnCount;grid.constraintCount=5;grid.spacing=new Vector2(5,5);grid.cellSize=new Vector2(48,48);grid.childAlignment=TextAnchor.MiddleCenter;var responsive=hand.gameObject.AddComponent<ResponsiveGrid>();responsive.Columns=5;responsive.FitHeight=true;
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
        {int stage=Intro?(int?)game.Catalog.Raw["onboarding"]?[Phase]?["id"]??1:game.Mode=="idle"?Math.Min(((JArray)game.Catalog.Raw["stages"]).Count,(int?)game.Account?["highestCleared"]+1??1):Math.Max(1,game.StageId);modal.Close();await game.StartBattle(Intro||game.Mode=="idle"?"challenge":game.Mode,stage);}
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
                var button=ui.Button(hand,"",null,definition!=null);button.GetComponent<Image>().color=definition!=null?Color.white:new Color32(248,248,242,255);var colors=button.colors;colors.disabledColor=Color.white;button.colors=colors;var label=button.GetComponentInChildren<Text>();label.fontSize=9;
                if(definition!=null){var image=ui.Portrait(button.transform,id,38);var r=(RectTransform)image.transform;r.anchorMin=new Vector2(.08f,.25f);r.anchorMax=new Vector2(.92f,1);r.offsetMin=r.offsetMax=Vector2.zero;label.rectTransform.anchorMin=Vector2.zero;label.rectTransform.anchorMax=new Vector2(1,.27f);label.rectTransform.offsetMin=label.rectTransform.offsetMax=Vector2.zero;}
                var number=ui.Label(button.transform,i==9?"0":(i+1).ToString(),9,TextAnchor.UpperRight);number.rectTransform.anchorMin=new Vector2(.72f,.75f);number.rectTransform.anchorMax=Vector2.one;number.rectTransform.offsetMin=Vector2.zero;number.rectTransform.offsetMax=new Vector2(-2,-2);
                if(definition!=null){var input=button.gameObject.AddComponent<SummonCardInput>();input.Summon=()=>game.Summon(id);input.Explain=()=>ShowCollectionDetail(id,false);input.Hover=Toast;input.Description=(string)definition["name"]+" · "+(string)definition["description"];}
                cards.Add((button,label,id));
            }
            // Dialog action handlers refresh their own views; passive settlement must preserve drafts.

            if(game.Online&&game.ConnectionStatus!="connected")ShowConnection();else{shownConnection=null;ResumeGuide();if(firstSession&&!Intro&&game.Battle==null&&!game.Busy&&!modal.Open)Run(()=>game.StartBattle("idle",(int?)game.Account["idleStage"]??1));var returned=game.ReturnIncome;long to=(long?)returned?["to"]??0;if(to>shownReturnTo&&(((double?)returned?["gold"]??0)>0||((double?)returned?["diamonds"]??0)>0)){shownReturnTo=to;modal.Show("복귀 수익",p=>{ui.Paragraph(p,$"부재 {(double?)returned["awaySeconds"]:0}초 · {((bool?)returned["capped"]==true?"8시간 상한 적용":"")}\n도토리 {N(returned["gold"])} · 다이아 {(double?)returned["diamonds"]:0.###}");ui.Button(p,"확인",modal.Back);});}}
        }
        void Update()
        {
            if(game==null)return;var safe=Screen.safeArea;if(Screen.width>0&&Screen.height>0){root.anchorMin=new Vector2(safe.x/Screen.width,safe.y/Screen.height);root.anchorMax=new Vector2(safe.xMax/Screen.width,safe.yMax/Screen.height);root.offsetMin=root.offsetMax=Vector2.zero;}
            if(displayedBattle!=game.Battle){displayedBattle=game.Battle;if(game.Mode!="idle"){pendingIdleResult=null;if(idlePopup)Destroy(idlePopup.gameObject);}}
            if(hudSize!=root.rect.size){hudSize=root.rect.size;float cell=Mathf.Clamp(hudSize.y*.09f,32,58);cell=Mathf.Min(cell,Mathf.Max(25,(hudSize.x-300-20)/5));hand.sizeDelta=new Vector2(cell*5+20,cell*2+5);}
            modal.Resize();
            if(Input.GetKeyDown(KeyCode.Escape)){if(modal.Open)modal.Back();else if(idlePopup)Destroy(idlePopup.gameObject);else ShowMenu();}if(!modal.Open&&Input.GetKeyDown(KeyCode.Space))game.TogglePause();
            for(int i=0;i<10;i++){var key=i==9?KeyCode.Alpha0:(KeyCode)((int)KeyCode.Alpha1+i);if(!modal.Open&&Input.GetKeyDown(key)&&i<cards.Count)game.Summon(cards[i].Id);}
            var state=game.Battle?.State;double elapsed=state?.Time??0;double duration=state?.Duration??CombatEconomy.BattleDuration(Math.Max(1,game.StageId),game.Mode);
            var time=TimeSpan.FromSeconds(game.Mode=="speedrun"?elapsed:Math.Max(0,duration-elapsed));
            battleInfo.text=$"{StageLabel(game.StageId)} · {ModeLabel(game.Mode)}  {time.Minutes:00}:{time.Seconds:00}";gold.text=$"골드 {(state?.Gold??220):0}";
            start.gameObject.SetActive(state==null||game.Mode=="idle"||state.Finished);start.interactable=!game.Busy&&game.Account!=null&&!modal.Open;
            bool fighting=state!=null&&!state.Finished&&game.Mode!="idle";contentIcons.gameObject.SetActive(!fighting);combatIcons.gameObject.SetActive(fighting);
            speedButton.GetComponentInChildren<Text>().text=$"{(double?)game.Account?["settings"]?["speed"]??1:0}×";
            pause.interactable=state!=null&&!state.Finished;pause.GetComponentInChildren<Text>().text=game.Paused?"계속":"정지";cannon.interactable=state!=null&&!state.Finished&&!Intro&&game.Mode!="idle"&&!game.Paused&&!modal.Open&&game.CannonRemaining<=0;
            cannon.GetComponentInChildren<Text>().text=game.CannonRemaining>0?$"대포 {Math.Ceiling(game.CannonRemaining)}":"대포";
            foreach(var card in cards){var def=game.Catalog.Character(card.Id);if(def==null){card.Label.text="—";continue;}double cd=state!=null&&state.SummonCooldowns.TryGetValue(card.Id,out var remaining)?remaining:0;card.Label.text=cd>0?$"{cd:0.0}초":$"{(double)def["cost"]:0}G";card.Button.interactable=state!=null&&!state.Finished&&!game.Paused&&game.Mode!="idle"&&cd<=0&&(state.Gold>=(double)def["cost"]);}
            if(Time.unscaledTime>noticeUntil)notice.text=Screen.height>Screen.width?"기기를 가로로 돌려 주세요":"";
        }
        static string ModeLabel(string mode)=>mode=="idle"?"방치":mode=="speedrun"?"속공":"도전";
        void Confirm(string title,string body,Func<Task> apply)
        {modal.Show(title,p=>{ui.Paragraph(p,body);var row=ui.Row(p);ui.Button(row,"취소",modal.Back);ui.Button(row,"확인",()=>Run(async()=>{modal.ForceClose();await apply();}));},presentation:"message");}
        void OnDestroy(){if(game!=null){game.Changed-=Refresh;game.AccountReplaced-=ResetPresentation;game.SaveImportRequested-=ConfirmImport;game.Notice-=Toast;game.BattleFinished-=ShowBattleResult;}}
    }
}
