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
        Text diamonds,power,battleInfo,stageTitle,gold,notice;Image walletFill;RectTransform menuControls,profileRect,walletRect,strengthRect,stageRect,missionRect,incomeRect;Text missionText;Button start,cannon,pause,speedButton;readonly List<(Button Button,Text Label,string Id,Image Portrait,RectTransform Auto,Image Cooldown)> cards=new List<(Button,Text,string,Image,RectTransform,Image)>();
        float noticeUntil;string shownGuide;long shownReturnTo;string shownConnection;bool sessionPresented;
        public void Initialize(IGameController controller)
        {
            game=controller;rules=new AccountRules(game.Catalog);ui=new UiKit();
            if(!FindFirstObjectByType<EventSystem>()){var es=new GameObject("EventSystem",typeof(EventSystem),typeof(StandaloneInputModule));}
            var canvas=new GameObject("Tiny Legion UI",typeof(RectTransform),typeof(Canvas),typeof(CanvasScaler),typeof(GraphicRaycaster));canvas.transform.SetParent(transform,false);
            canvas.GetComponent<Canvas>().renderMode=RenderMode.ScreenSpaceOverlay;var scaler=canvas.GetComponent<CanvasScaler>();scaler.uiScaleMode=CanvasScaler.ScaleMode.ConstantPixelSize;scaler.scaleFactor=UiKit.DisplayScale;
            root=ui.Node("SafeArea",canvas.transform);UiKit.Fill(root);
            var shade=ui.Node("HUD shade",root);shade.anchorMin=new Vector2(0,1);shade.anchorMax=Vector2.one;shade.offsetMin=new Vector2(0,-200);shade.offsetMax=Vector2.zero;var tint=shade.gameObject.AddComponent<RawImage>();tint.texture=Resources.Load<Texture2D>("Scenery/hud-shade");tint.raycastTarget=false;
            var profile=ui.Button(root,"",ShowGrowth);profileRect=(RectTransform)profile.transform;profile.GetComponent<Image>().color=Color.clear;var portrait=ui.Portrait(profile.transform,"sheep",60);UiKit.Fill(portrait.rectTransform);Place((RectTransform)profile.transform,new Vector2(0,1),new Vector2(24,-22),new Vector2(60,60),new Vector2(0,1));
            var wallet=ui.Node("Account resources",root);walletRect=wallet;Place(wallet,new Vector2(0,1),new Vector2(96,-22),new Vector2(150,60),new Vector2(0,1));
            diamonds=Resource(wallet,"gem",Vector2.zero,new Color32(136,222,255,255));
            var strength=ui.Node("Combat power",root);strengthRect=strength;Place(strength,new Vector2(0,1),new Vector2(24,-86),new Vector2(180,24),new Vector2(0,1));power=Resource(strength,"swords",Vector2.zero,Color.white);
            var stage=ui.Node("Stage status",root);stageRect=stage;Place(stage,new Vector2(.5f,1),new Vector2(0,-22),new Vector2(240,74),new Vector2(.5f,1));
            var stageButton=ui.Button(stage,"",ShowStages);stageButton.GetComponent<Image>().color=Color.clear;Place((RectTransform)stageButton.transform,new Vector2(.5f,1),Vector2.zero,new Vector2(240,32),new Vector2(.5f,1));stageTitle=stageButton.GetComponentInChildren<Text>();stageTitle.fontSize=19;stageTitle.color=Color.white;
            var map=ui.Icon(stageButton.transform,"map",17,Color.white);Place(map.rectTransform,new Vector2(0,.5f),new Vector2(54,0),new Vector2(17,17),new Vector2(0,.5f));
            battleInfo=ui.Label(stage,"",13,TextAnchor.MiddleCenter);battleInfo.color=Color.white;battleInfo.fontStyle=FontStyle.Bold;Place(battleInfo.rectTransform,new Vector2(.5f,0),Vector2.zero,new Vector2(240,32),new Vector2(.5f,0));
            var mission=ui.Button(root,"",ShowMission);missionRect=(RectTransform)mission.transform;mission.GetComponent<Image>().sprite=null;mission.GetComponent<Image>().color=new Color32(37,54,44,165);Place(missionRect,new Vector2(0,1),new Vector2(24,-122),new Vector2(224,100),new Vector2(0,1));missionText=mission.GetComponentInChildren<Text>();missionText.color=Color.white;missionText.fontSize=12;missionText.alignment=TextAnchor.MiddleLeft;
            var income=ui.Button(root,"",ShowIncome);income.name="Acorn income";incomeRect=(RectTransform)income.transform;income.GetComponent<Image>().color=Color.clear;Place(incomeRect,Vector2.zero,new Vector2(24,18),new Vector2(40,40),Vector2.zero);var acorn=ui.Icon(income.transform,"acorn",20);Place(acorn.rectTransform,new Vector2(.5f,.5f),Vector2.zero,new Vector2(20,20),new Vector2(.5f,.5f));
            menuControls=ui.Row(root,70);menuControls.GetComponent<HorizontalLayoutGroup>().childForceExpandWidth=false;menuControls.GetComponent<HorizontalLayoutGroup>().spacing=13;menuControls.gameObject.AddComponent<ContentSizeFitter>().horizontalFit=ContentSizeFitter.FitMode.PreferredSize;Place(menuControls,new Vector2(1,1),new Vector2(-22,-22),new Vector2(320,70),new Vector2(1,1));
            contentIcons=ui.Row(menuControls,70);contentIcons.GetComponent<HorizontalLayoutGroup>().childForceExpandWidth=false;contentIcons.GetComponent<HorizontalLayoutGroup>().spacing=13;ui.IconButton(contentIcons,"units","동료",ShowGrowth);ui.IconButton(contentIcons,"envelope","모집",()=>ShowRecruit());ui.IconButton(contentIcons,"sequence","순서",ShowSequence);ui.IconButton(contentIcons,"book","도감",()=>ShowCodex());
            combatIcons=ui.Row(menuControls,70);combatIcons.GetComponent<HorizontalLayoutGroup>().childForceExpandWidth=false;combatIcons.GetComponent<HorizontalLayoutGroup>().spacing=13;ui.IconButton(combatIcons,"sequence","순서",ShowSequence);ui.IconButton(combatIcons,"close","나가기",()=>Confirm("전투 나가기","현재 전투를 종료하고 방치로 돌아갑니다.",async()=>{await game.LeaveBattle();await game.StartBattle("idle",(int?)game.Account["idleStage"]??1);}));pause=ui.IconButton(combatIcons,"pause","정지",()=>game.TogglePause());
            speedButton=ui.IconButton(combatIcons,"forward","1×",()=>Run(async()=>await game.Command("settings",new JObject{["speed"]=(double?)game.Account?["settings"]?["speed"]==2?1:2})));
            ui.IconButton(menuControls,"menu","메뉴",()=>ShowMenu());
            var bottom=ui.Node("Battle HUD",root);bottom.anchorMin=Vector2.zero;bottom.anchorMax=new Vector2(1,0);bottom.offsetMin=Vector2.zero;bottom.offsetMax=new Vector2(0,200);
            hudLeft=ui.Node("Battle wallet",bottom);Place(hudLeft,new Vector2(.5f,0),new Vector2(-285,100),new Vector2(120,100),new Vector2(.5f,.5f));
            var coin=ui.Icon(hudLeft,"coin",34,new Color32(255,207,104,255));Place(coin.rectTransform,new Vector2(.5f,1),Vector2.zero,new Vector2(34,34),new Vector2(.5f,1));gold=ui.Label(hudLeft,"",36,TextAnchor.MiddleCenter);gold.fontStyle=FontStyle.Bold;gold.color=Color.white;Place(gold.rectTransform,new Vector2(.5f,.5f),Vector2.zero,new Vector2(120,44),new Vector2(.5f,.5f));
            var track=ui.Panel(hudLeft,new Color32(220,215,192,255));Place(track,new Vector2(.5f,0),new Vector2(0,12),new Vector2(70,4),new Vector2(.5f,0));var fill=ui.Panel(track,new Color32(181,154,83,255));UiKit.Fill(fill);walletFill=fill.GetComponent<Image>();
            hudRight=ui.Node("Battle actions",bottom);UiKit.Fill(hudRight);
            start=ui.Button(hudRight,"⚔  전투 시작",()=>Run(()=>StartCurrent()));ui.Style((RectTransform)start.transform,ui.Paper,ui.Paper,ui.Paper,14);start.GetComponentInChildren<Text>().color=new Color32(67,93,75,255);
            cannon=ui.Button(hudRight,"",()=>game.FireCannon());cannon.GetComponent<Image>().color=Color.clear;var cannonIcon=ui.Icon(cannon.transform,"cannon",76,new Color32(53,55,46,255));UiKit.Fill(cannonIcon.rectTransform,18,18,18,18);
            hand=ui.Node("Summon hand",bottom);hand.anchorMin=hand.anchorMax=new Vector2(.5f,0);hand.pivot=new Vector2(.5f,0);hand.anchoredPosition=new Vector2(0,23);var grid=hand.gameObject.AddComponent<GridLayoutGroup>();grid.constraint=GridLayoutGroup.Constraint.FixedColumnCount;grid.constraintCount=5;grid.spacing=new Vector2(6,6);grid.cellSize=new Vector2(48,48);grid.childAlignment=TextAnchor.MiddleCenter;var responsive=hand.gameObject.AddComponent<ResponsiveGrid>();responsive.Columns=5;responsive.FitHeight=true;
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
            if(game.SaveRecoveryRequired){diamonds.text="저장 복구 필요";ShowSaveRecovery();return;}
            if(game.Account==null){if(game.Online&&game.ConnectionStatus!="idle")ShowConnection();return;}
            bool firstSession=!sessionPresented;sessionPresented=true;
            if(firstSession&&game.Online)modal.ForceClose();
            diamonds.text=$"{((double?)game.Account["diamonds"]??0):0}";power.text=$"{rules.CombatPower(game.Account):N0}";
            var mission=rules.CurrentMission(game.Account);missionRect.gameObject.SetActive(mission!=null&&!Intro);if(mission!=null){bool ready=(bool?)mission["ready"]??(bool?)mission["completed"]??false;missionText.text=$"{(ready?"미션 완료":"미션")}\n{(string)(mission["title"]??mission["name"])}\n{(ready?"보상 받기":"진행 중")}\n도토리 {N(mission["gold"]??mission["reward"]?["gold"])}  다이아 {N(mission["diamonds"]??mission["reward"]?["diamonds"])}";}

            UiKit.Clear(hand);cards.Clear();var sequence=game.Battle?.State.Sequence??rules.PlayableSequence(game.Account,game.Mode).Select(x=>x.Type==JTokenType.String?(string)x:null).ToList();
            for(int i=0;i<10;i++)
            {
                string id=i<sequence.Count?sequence[i]:null;var definition=game.Catalog.Character(id);
                var button=ui.Button(hand,"",null,definition!=null);var rect=(RectTransform)button.transform;Color border=definition==null?new Color32(174,181,160,255):ui.Ink;Color paper=definition==null?new Color32(248,248,242,255):Color.white;ui.Style(rect,paper,paper,border,2);var colors=button.colors;colors.disabledColor=Color.white;button.colors=colors;var label=button.GetComponentInChildren<Text>();label.fontSize=12;
                label.alignment=TextAnchor.LowerRight;label.rectTransform.anchorMin=new Vector2(0,0);label.rectTransform.anchorMax=new Vector2(1,.22f);label.rectTransform.offsetMin=new Vector2(2,2);label.rectTransform.offsetMax=new Vector2(-4,0);
                Image image=null;RectTransform automatic=null;Image cooldown=null;
                if(definition!=null){image=ui.Portrait(button.transform,id,52);var r=image.rectTransform;r.anchorMin=new Vector2(0,.15f);r.anchorMax=new Vector2(1,.85f);r.offsetMin=r.offsetMax=Vector2.zero;var arrow=ui.Icon(button.transform,"auto",30,new Color(53f/255,55f/255,46f/255,.65f));automatic=arrow.rectTransform;automatic.name="Automatic summon";Place(automatic,new Vector2(.5f,.58f),Vector2.zero,new Vector2(30,30),new Vector2(.5f,.5f));var autoText=ui.Label(automatic,"자동",9,TextAnchor.MiddleCenter);Place(autoText.rectTransform,new Vector2(.5f,0),new Vector2(0,-8),new Vector2(40,14),new Vector2(.5f,1));var cover=ui.Panel(button.transform,new Color(0,0,0,.28f));UiKit.Fill(cover);cooldown=cover.GetComponent<Image>();cooldown.raycastTarget=false;}
                var number=ui.Label(button.transform,(i+1).ToString(),10,TextAnchor.UpperLeft);number.color=definition==null?new Color32(160,168,148,255):ui.Ink;number.rectTransform.anchorMin=new Vector2(0,.75f);number.rectTransform.anchorMax=new Vector2(.4f,1);number.rectTransform.offsetMin=new Vector2(4,0);number.rectTransform.offsetMax=Vector2.zero;
                if(definition!=null){var input=button.gameObject.AddComponent<SummonCardInput>();input.Summon=()=>game.Summon(id);input.Explain=()=>ShowCollectionDetail(id,false);input.Hover=Toast;input.Description=(string)definition["name"]+" · "+(string)definition["description"];}
                cards.Add((button,label,id,image,automatic,cooldown));

            }
            // Dialog action handlers refresh their own views; passive settlement must preserve drafts.

            if(game.Online&&game.ConnectionStatus!="connected")ShowConnection();else{shownConnection=null;ResumeGuide();if(firstSession&&!Intro&&game.Battle==null&&!game.Busy&&!modal.Open)Run(()=>game.StartBattle("idle",(int?)game.Account["idleStage"]??1));var returned=game.ReturnIncome;long to=(long?)returned?["to"]??0;if(to>shownReturnTo&&(((double?)returned?["gold"]??0)>0||((double?)returned?["diamonds"]??0)>0)){shownReturnTo=to;modal.Show("복귀 수익",p=>{ui.Paragraph(p,$"부재 {(double?)returned["awaySeconds"]:0}초 · {((bool?)returned["capped"]==true?"8시간 상한 적용":"")}\n도토리 {N(returned["gold"])} · 다이아 {(double?)returned["diamonds"]:0.###}");ui.Button(p,"확인",modal.Back);});}}
        }
        void Update()
        {
            if(game==null)return;GetComponentInChildren<CanvasScaler>().scaleFactor=UiKit.DisplayScale;var safe=Screen.safeArea;if(Screen.width>0&&Screen.height>0){root.anchorMin=new Vector2(safe.x/Screen.width,safe.y/Screen.height);root.anchorMax=new Vector2(safe.xMax/Screen.width,safe.yMax/Screen.height);root.offsetMin=root.offsetMax=Vector2.zero;}
            if(displayedBattle!=game.Battle){displayedBattle=game.Battle;if(game.Mode!="idle"){pendingIdleResult=null;if(idlePopup)Destroy(idlePopup.gameObject);}}
            if(hudSize!=root.rect.size){hudSize=root.rect.size;bool compact=hudSize.y<=560||hudSize.x<=1000;float cell=compact?Mathf.Clamp(hudSize.y*.14f,44,66):78;float gap=compact?4:6;float width=Mathf.Min(cell*5+gap*4,hudSize.x-(compact?184:284));cell=(width-gap*4)/5;hand.sizeDelta=new Vector2(width,cell*2+gap);hand.anchoredPosition=new Vector2(0,compact?12:23);hand.GetComponent<GridLayoutGroup>().spacing=Vector2.one*gap;
                hudLeft.sizeDelta=new Vector2(compact?76:120,compact?82:100);hudLeft.anchoredPosition=new Vector2(-width*.5f-(compact?46:78),hand.anchoredPosition.y+hand.sizeDelta.y*.5f);gold.fontSize=compact?28:36;
                Place((RectTransform)cannon.transform,new Vector2(.5f,0),new Vector2(width*.5f+(compact?46:74),hand.anchoredPosition.y+hand.sizeDelta.y*.5f),new Vector2(compact?76:112,compact?76:112),new Vector2(.5f,.5f));Place((RectTransform)start.transform,new Vector2(1,0),new Vector2(compact?-12:-22,compact?12:23),new Vector2(compact?76:114,compact?42:58),new Vector2(1,0));start.GetComponentInChildren<Text>().fontSize=compact?10:14;
                menuControls.anchoredPosition=new Vector2(compact?-12:-22,compact?-12:-22);foreach(var menu in menuControls.GetComponentsInChildren<Button>(true)){var le=menu.GetComponent<LayoutElement>();le.minWidth=le.preferredWidth=compact?36:51;le.minHeight=le.preferredHeight=compact?52:70;menu.GetComponentInChildren<Text>().fontSize=compact?8:11;var badge=menu.transform.Find("Menu medallion") as RectTransform;if(badge){badge.sizeDelta=new Vector2(compact?36:51,compact?36:51);var image=badge.GetComponentInChildren<Image>();if(badge.childCount>0)UiKit.Fill((RectTransform)badge.GetChild(0),compact?7:10,compact?7:10,compact?7:10,compact?7:10);}}menuControls.sizeDelta=new Vector2(menuControls.sizeDelta.x,compact?52:70);foreach(var controls in new[]{contentIcons,combatIcons}){var layout=controls.GetComponent<LayoutElement>();layout.minHeight=layout.preferredHeight=compact?52:70;}
                Place(profileRect,new Vector2(0,1),new Vector2(compact?12:24,compact?-12:-22),new Vector2(compact?43:60,compact?43:60),new Vector2(0,1));walletRect.anchoredPosition=new Vector2(compact?62:96,compact?-12:-22);diamonds.fontSize=compact?12:16;strengthRect.anchoredPosition=new Vector2(compact?12:24,compact?-61:-86);power.fontSize=compact?12:16;stageRect.anchoredPosition=new Vector2(0,compact?-12:-22);stageTitle.fontSize=compact?15:19;battleInfo.fontSize=compact?11:13;
                missionRect.anchoredPosition=new Vector2(compact?12:24,compact?-91:-122);missionRect.sizeDelta=new Vector2(compact?186:224,compact?65:100);missionText.fontSize=compact?10:12;incomeRect.anchoredPosition=new Vector2(compact?12:24,compact?12:18);
            }
            modal.Resize();
            if(Input.GetKeyDown(KeyCode.Escape)){if(modal.Open)modal.Back();else if(idlePopup)Destroy(idlePopup.gameObject);else ShowMenu();}if(!modal.Open&&Input.GetKeyDown(KeyCode.Space))game.TogglePause();
            for(int i=0;i<10;i++){var key=i==9?KeyCode.Alpha0:(KeyCode)((int)KeyCode.Alpha1+i);if(!modal.Open&&Input.GetKeyDown(key)&&i<cards.Count)game.Summon(cards[i].Id);}
            var state=game.Battle?.State;double elapsed=state?.Time??0;double duration=state?.Duration??CombatEconomy.BattleDuration(Math.Max(1,game.StageId),game.Mode);
            var time=TimeSpan.FromSeconds(game.Mode=="speedrun"?elapsed:Math.Max(0,duration-elapsed));
            stageTitle.text=$"{StageLabel(game.StageId)} {(string)game.Catalog.Stage(Math.Max(1,game.StageId),game.Mode)?["regionName"]??"초원"}";battleInfo.text=$"{(game.Mode=="idle"?$"{Math.Min(3,(int)(elapsed/Math.Max(1,duration)*3)+1)} / 3    ":"")}{ModeLabel(game.Mode)}    ◷ {time.Minutes:00}:{time.Seconds:00}";gold.text=$"{(state?.Gold??220):0}";walletFill.rectTransform.anchorMax=new Vector2((float)((state?.Gold??220)/Math.Max(1,state?.GoldCapacity??1000)),1);
            start.gameObject.SetActive(state==null||game.Mode=="idle"||state.Finished);start.interactable=!game.Busy&&game.Account!=null&&!modal.Open;
            bool fighting=state!=null&&!state.Finished&&game.Mode!="idle";profileRect.gameObject.SetActive(!fighting);missionRect.gameObject.SetActive(!fighting&&!Intro&&rules.CurrentMission(game.Account)!=null);incomeRect.gameObject.SetActive(!fighting&&!Intro);contentIcons.gameObject.SetActive(!fighting);combatIcons.gameObject.SetActive(fighting);
            speedButton.GetComponentInChildren<Text>().text=$"{(double?)game.Account?["settings"]?["speed"]??1:0}×";
            pause.interactable=state!=null&&!state.Finished;pause.GetComponentInChildren<Text>().text=game.Paused?"계속":"정지";cannon.gameObject.SetActive(game.Mode!="idle");cannon.interactable=state!=null&&!state.Finished&&!Intro&&game.Mode!="idle"&&!game.Paused&&!modal.Open&&game.CannonRemaining<=0;
            cannon.GetComponentInChildren<Text>().text=game.CannonRemaining>0?$"대포 {Math.Ceiling(game.CannonRemaining)}":"대포";
            foreach(var card in cards){var def=game.Catalog.Character(card.Id);if(def==null){card.Label.text="";continue;}double cd=state!=null&&state.SummonCooldowns.TryGetValue(card.Id,out var remaining)?remaining:0;card.Label.text=cd>0?$"{cd:0.0}초":$"{(double)def["cost"]:0}";card.Button.interactable=state!=null&&!state.Finished&&!game.Paused&&game.Mode!="idle"&&cd<=0&&(state.Gold>=(double)def["cost"]);card.Auto.gameObject.SetActive(game.Mode=="idle");card.Cooldown.gameObject.SetActive(cd>0&&game.Mode!="idle");if(card.Cooldown)card.Cooldown.rectTransform.anchorMax=new Vector2(1,(float)(cd/Math.Max(.01,(double?)def["cooldown"]??1)));if(card.Portrait)card.Portrait.color=new Color(1,1,1,game.Mode=="idle"||state!=null&&state.Gold>=(double)def["cost"]?1:.4f);}

            if(Time.unscaledTime>noticeUntil)notice.text=Screen.height>Screen.width?"기기를 가로로 돌려 주세요":"";
        }
        static void Place(RectTransform rect,Vector2 anchor,Vector2 position,Vector2 size,Vector2 pivot){rect.anchorMin=rect.anchorMax=anchor;rect.pivot=pivot;rect.anchoredPosition=position;rect.sizeDelta=size;}
        Text Resource(RectTransform parent,string icon,Vector2 position,Color color){var r=ui.Node(icon+" amount",parent);Place(r,new Vector2(0,1),position,new Vector2(180,26),new Vector2(0,1));var image=ui.Icon(r,icon,18,color);Place(image.rectTransform,new Vector2(0,.5f),Vector2.zero,new Vector2(18,18),new Vector2(0,.5f));var text=ui.Label(r,"",16);text.color=Color.white;text.fontStyle=FontStyle.Bold;UiKit.Fill(text.rectTransform,25,0,0,0);return text;}
        static string ModeLabel(string mode)=>mode=="idle"?"방치":mode=="speedrun"?"속공":"도전";
        void Confirm(string title,string body,Func<Task> apply)
        {modal.Show(title,p=>{ui.Paragraph(p,body);var row=ui.Row(p);ui.Button(row,"취소",modal.Back);ui.Button(row,"확인",()=>Run(async()=>{modal.ForceClose();await apply();}));},presentation:"message");}
        void OnDestroy(){if(game!=null){game.Changed-=Refresh;game.AccountReplaced-=ResetPresentation;game.SaveImportRequested-=ConfirmImport;game.Notice-=Toast;game.BattleFinished-=ShowBattleResult;}}
    }
}
