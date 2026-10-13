using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
namespace TinyLegion.Unity
{
    public sealed partial class GameView
    {
        void ShowSequence()
        {
            if(game.Account==null||!rules.SequenceUnlocked(game.Account)){Toast("1-2 방치 안내에서 순서 편집이 열립니다");return;}
            string selected=game.Mode;var drafts=new Dictionary<string,JArray>();var indexes=new Dictionary<string,int>();
            foreach(string mode in new[]{"idle","challenge","speedrun"}){drafts[mode]=rules.SequenceForMode(game.Account,mode);indexes[mode]=rules.ActiveLineupIndex(game.Account,mode);}
            modal.Show("소환 순서",Render);
            void Render(RectTransform parent)
            {
                var modes=ui.Row(parent);foreach(string m in new[]{"idle","challenge","speedrun"}){string mode=m;ui.Button(modes,(selected==mode?"● ":"")+ModeLabel(mode),()=>{selected=mode;modal.Refresh();},mode!="speedrun"||rules.AdvancedContentUnlocked(game.Account));}
                var presets=ui.Row(parent,30);ui.Button(presets,"이전 편성",()=>{indexes[selected]=(indexes[selected]+9)%10;drafts[selected]=rules.SequenceForMode(game.Account,selected,indexes[selected]);modal.Refresh();});ui.Paragraph(presets,$"편성 {indexes[selected]+1} / 10");ui.Button(presets,"다음 편성",()=>{indexes[selected]=(indexes[selected]+1)%10;drafts[selected]=rules.SequenceForMode(game.Account,selected,indexes[selected]);modal.Refresh();});
                var grid=ui.Node("Slots",parent);grid.gameObject.AddComponent<LayoutElement>().preferredHeight=156;var layout=grid.gameObject.AddComponent<GridLayoutGroup>();layout.constraint=GridLayoutGroup.Constraint.FixedColumnCount;layout.constraintCount=5;layout.cellSize=new Vector2(112,70);layout.spacing=new Vector2(5,5);layout.childAlignment=TextAnchor.MiddleCenter;var responsive=grid.gameObject.AddComponent<ResponsiveGrid>();responsive.Columns=5;responsive.Height=70;
                var draft=drafts[selected];while(draft.Count<10)draft.Add(JValue.CreateNull());
                for(int i=0;i<10;i++){int index=i;string id=(string)draft[index];var card=ui.Button(grid,$"{i+1}. {(string)game.Catalog.Character(id)?["name"]??"빈 칸"}",()=>Pick(index));var drag=card.gameObject.AddComponent<LineupDrag>();drag.Index=index;drag.Move=(from,to)=>{var token=draft[from].DeepClone();draft.RemoveAt(from);draft.Insert(to,token);modal.Refresh();};}
                ui.Paragraph(parent,"카드를 끌어 다른 칸 사이에 놓으면 끼워 넣습니다. 카드 선택 후 방향키로도 이동할 수 있습니다.",14);
                var actions=ui.Row(parent);ui.Button(actions,"취소",modal.Back);ui.Button(actions,"적용",()=>Run(async()=>{
                    var changingCurrent=selected=="idle"&&game.Mode=="idle";
                    await game.Command("lineup.set",new JObject{["mode"]=selected,["index"]=indexes[selected],["sequence"]=drafts[selected].DeepClone()});
                    modal.Close();if(changingCurrent){await game.LeaveBattle();await game.StartBattle(selected,Math.Max(1,game.StageId));}
                }));
            }
            void Pick(int index)
            {
                modal.Show($"{index+1}번 동료",parent=>{
                    ui.Button(parent,"빈 칸",()=>{drafts[selected][index]=JValue.CreateNull();modal.Back();});
                    foreach(var definition in game.Catalog.Units.Where(d=>(bool?)game.Account["owned"]?[(string)d["id"]]==true)){
                        string id=(string)definition["id"];bool allowed=(int?)game.Account["highestCleared"]>=10||((JArray)game.Catalog.Raw["banners"]).OfType<JObject>().First(b=>(string)b["id"]=="forest")["units"].Values<string>().Contains(id);
                        var row=ui.Row(parent,55);ui.Portrait(row,id,50);ui.Button(row,(string)definition["name"],()=>{drafts[selected][index]=id;modal.Back();},allowed);
                    }
                });
            }
        }
    }
    public sealed class LineupDrag : MonoBehaviour,IBeginDragHandler,IDragHandler,IEndDragHandler,IDropHandler,ISelectHandler,IMoveHandler
    {
        public int Index;public Action<int,int> Move;static LineupDrag active;Vector2 origin;bool dragging;CanvasGroup group;
        public void OnBeginDrag(PointerEventData data){active=this;group=GetComponent<CanvasGroup>()??gameObject.AddComponent<CanvasGroup>();group.blocksRaycasts=false;origin=((RectTransform)transform).anchoredPosition;dragging=true;}
        public void OnDrag(PointerEventData data){if(dragging)((RectTransform)transform).anchoredPosition+=data.delta/(GetComponentInParent<Canvas>().scaleFactor);}
        public void OnEndDrag(PointerEventData data){if(!this)return;((RectTransform)transform).anchoredPosition=origin;dragging=false;if(group)group.blocksRaycasts=true;if(active==this)active=null;}
        public void OnDrop(PointerEventData data){if(active&&active!=this){var from=active.Index;active.dragging=false;if(active.group)active.group.blocksRaycasts=true;active=null;Move?.Invoke(from,Index);}}
        public void OnSelect(BaseEventData data){}
        public void OnMove(AxisEventData data){int next=Index+(data.moveDir==MoveDirection.Left?-1:data.moveDir==MoveDirection.Right?1:data.moveDir==MoveDirection.Up?-5:data.moveDir==MoveDirection.Down?5:0);if(next>=0&&next<10&&next!=Index)Move?.Invoke(Index,next);}
    }
}
