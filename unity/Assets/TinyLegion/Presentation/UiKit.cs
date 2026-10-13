using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
namespace TinyLegion.Unity
{
    public sealed class UiKit
    {
        public readonly Font Font = Resources.Load<Font>("Fonts/Korean") ?? Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        public readonly Color Ink=new Color32(52,62,44,255), Paper=new Color32(251,248,236,255), Green=new Color32(101,125,76,255);
        readonly Dictionary<string,Sprite> sprites=new Dictionary<string,Sprite>();
        public RectTransform Node(string name,Transform parent)
        {var rect=new GameObject(name,typeof(RectTransform)).GetComponent<RectTransform>();rect.SetParent(parent,false);return rect;}
        public static void Fill(RectTransform rect,float left=0,float bottom=0,float right=0,float top=0)
        {rect.anchorMin=Vector2.zero;rect.anchorMax=Vector2.one;rect.offsetMin=new Vector2(left,bottom);rect.offsetMax=new Vector2(-right,-top);}
        public RectTransform Panel(Transform parent,Color? color=null)
        {var rect=Node("Panel",parent);rect.gameObject.AddComponent<Image>().color=color??Paper;return rect;}
        public Text Label(Transform parent,string value,int size=18,TextAnchor alignment=TextAnchor.MiddleLeft)
        {var rect=Node("Text",parent);var text=rect.gameObject.AddComponent<Text>();text.font=Font;text.text=value;text.fontSize=size;text.color=Ink;text.alignment=alignment;text.horizontalOverflow=HorizontalWrapMode.Wrap;text.verticalOverflow=VerticalWrapMode.Overflow;text.raycastTarget=false;return text;}
        public Button Button(Transform parent,string title,Action action,bool enabled=true)
        {var rect=Panel(parent,new Color32(239,232,211,255));var button=rect.gameObject.AddComponent<Button>();button.interactable=enabled;var text=Label(rect,title,16,TextAnchor.MiddleCenter);Fill(text.rectTransform,7,3,7,3);button.onClick.AddListener(()=>action?.Invoke());var element=rect.gameObject.AddComponent<LayoutElement>();element.minHeight=38;element.preferredHeight=38;element.flexibleWidth=1;return button;}
        public RectTransform Column(Transform parent,int spacing=8)
        {var rect=Node("Column",parent);var layout=rect.gameObject.AddComponent<VerticalLayoutGroup>();layout.spacing=spacing;layout.padding=new RectOffset(10,10,10,10);layout.childControlHeight=true;layout.childControlWidth=true;layout.childForceExpandHeight=false;return rect;}
        public RectTransform Row(Transform parent,int height=42)
        {var rect=Node("Row",parent);var layout=rect.gameObject.AddComponent<HorizontalLayoutGroup>();layout.spacing=7;layout.childControlHeight=true;layout.childControlWidth=true;layout.childForceExpandWidth=true;var element=rect.gameObject.AddComponent<LayoutElement>();element.preferredHeight=height;element.minHeight=height;return rect;}
        public Text Paragraph(Transform parent,string value,int size=16)
        {var label=Label(parent,value,size);label.gameObject.AddComponent<LayoutElement>().minHeight=size+5;return label;}
        public Sprite Art(string id)
        {if(!sprites.TryGetValue(id??"",out var sprite)){sprite=Resources.Load<Sprite>("Art/"+id);sprites[id??""]=sprite;}return sprite;}
        public Image Portrait(Transform parent,string id,int width=64)
        {var rect=Node("Portrait",parent);var image=rect.gameObject.AddComponent<Image>();image.sprite=Art(id);image.preserveAspect=true;image.raycastTarget=false;var element=rect.gameObject.AddComponent<LayoutElement>();element.preferredWidth=width;element.minWidth=width;element.preferredHeight=width;return image;}
        public InputField Input(Transform parent,string placeholder,bool password=false)
        {var rect=Panel(parent,Color.white);var input=rect.gameObject.AddComponent<InputField>();var label=Label(rect,"",16);Fill(label.rectTransform,8,3,8,3);input.textComponent=label;var hint=Label(rect,placeholder,16);hint.color=new Color(.4f,.4f,.4f,.6f);Fill(hint.rectTransform,8,3,8,3);input.placeholder=hint;input.contentType=password?InputField.ContentType.Password:InputField.ContentType.Standard;rect.gameObject.AddComponent<LayoutElement>().preferredHeight=38;return input;}
        public Toggle Toggle(Transform parent,string label,bool value,Action<bool> action)
        {var row=Row(parent,38);var toggle=row.gameObject.AddComponent<Toggle>();var box=Panel(row,Paper);box.gameObject.AddComponent<LayoutElement>().preferredWidth=28;var check=Label(box,"✓",20,TextAnchor.MiddleCenter);Fill(check.rectTransform);toggle.targetGraphic=box.GetComponent<Image>();toggle.graphic=check;Paragraph(row,label);toggle.isOn=value;toggle.onValueChanged.AddListener(x=>action?.Invoke(x));return toggle;}
        public Slider Slider(Transform parent,float value,Action<float> action)
        {var rect=Panel(parent,new Color32(223,217,194,255));rect.gameObject.AddComponent<LayoutElement>().preferredHeight=28;var slider=rect.gameObject.AddComponent<Slider>();var handle=Panel(rect,Green);handle.sizeDelta=new Vector2(20,28);slider.handleRect=handle;slider.targetGraphic=handle.GetComponent<Image>();slider.minValue=0;slider.maxValue=1;slider.value=value;slider.onValueChanged.AddListener(x=>action?.Invoke(x));return slider;}
        public static void Clear(Transform parent){for(int i=parent.childCount-1;i>=0;i--){var child=parent.GetChild(i);child.gameObject.SetActive(false);if(Application.isPlaying)UnityEngine.Object.Destroy(child.gameObject);else UnityEngine.Object.DestroyImmediate(child.gameObject);}}
    }
    public sealed class ModalNavigation
    {
        sealed class Page { public string Title;public Action<RectTransform> Render;public float Scroll=1;public bool Required; }
        readonly UiKit ui; readonly RectTransform overlay,panel,body;readonly Text title;readonly Stack<Page> pages=new Stack<Page>();
        ScrollRect scroll;Button closeButton;
        public bool Open=>pages.Count>0;
        public string CurrentTitle=>Open?pages.Peek().Title:null;
        public event Action<bool> OpenChanged;
        public ModalNavigation(UiKit ui,RectTransform root)
        {
            this.ui=ui;overlay=ui.Panel(root,new Color(0,0,0,.22f));UiKit.Fill(overlay);
            panel=ui.Panel(overlay);panel.anchorMin=new Vector2(.025f,.025f);panel.anchorMax=new Vector2(.975f,.96f);panel.offsetMin=panel.offsetMax=Vector2.zero;
            title=ui.Label(panel,"",22);title.rectTransform.anchorMin=new Vector2(0,1);title.rectTransform.anchorMax=Vector2.one;title.rectTransform.offsetMin=new Vector2(20,-52);title.rectTransform.offsetMax=new Vector2(-110,-8);
            closeButton=ui.Button(panel,"닫기",Close);var cr=(RectTransform)closeButton.transform;cr.anchorMin=cr.anchorMax=Vector2.one;cr.pivot=Vector2.one;cr.anchoredPosition=new Vector2(-10,-10);cr.sizeDelta=new Vector2(80,35);
            body=ui.Node("Body",panel);UiKit.Fill(body,12,12,12,58);overlay.gameObject.SetActive(false);
        }
        public void Show(string title,Action<RectTransform> render,bool replace=false,bool required=false)
        {if(Open&&scroll)pages.Peek().Scroll=scroll.verticalNormalizedPosition;if(replace&&Open)pages.Pop();pages.Push(new Page{Title=title,Render=render,Required=required});Refresh(false);}
        public void Refresh(bool capture=true)
        {
            if(!Open){overlay.gameObject.SetActive(false);OpenChanged?.Invoke(false);return;}
            if(capture&&scroll)pages.Peek().Scroll=scroll.verticalNormalizedPosition;OpenChanged?.Invoke(true);overlay.gameObject.SetActive(true);overlay.SetAsLastSibling();title.text=pages.Peek().Title;closeButton.interactable=!pages.Peek().Required;UiKit.Clear(body);
            var viewport=ui.Panel(body,new Color(0,0,0,0));UiKit.Fill(viewport);viewport.gameObject.AddComponent<RectMask2D>();
            var content=ui.Column(viewport);content.anchorMin=new Vector2(0,1);content.anchorMax=Vector2.one;content.pivot=new Vector2(.5f,1);content.offsetMin=content.offsetMax=Vector2.zero;
            content.gameObject.AddComponent<ContentSizeFitter>().verticalFit=ContentSizeFitter.FitMode.PreferredSize;
            scroll=viewport.gameObject.AddComponent<ScrollRect>();scroll.viewport=viewport;scroll.content=content;scroll.horizontal=false;scroll.movementType=ScrollRect.MovementType.Clamped;
            pages.Peek().Render(content);Canvas.ForceUpdateCanvases();scroll.verticalNormalizedPosition=pages.Peek().Scroll;
            if(pages.Count>1)ui.Button(content,"뒤로",Back);
        }
        public void Back(){if(!Open||pages.Peek().Required)return;pages.Pop();Refresh(false);}
        public void Close()
        {
            if(pages.Any(page=>page.Required))
            {
                if(pages.Peek().Required)return;
                while(Open&&!pages.Peek().Required)pages.Pop();
                Refresh(false);return;
            }
            ForceClose();
        }
        public void ForceClose(){pages.Clear();Refresh();}
    }
}
