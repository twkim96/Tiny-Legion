using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
namespace TinyLegion.Unity
{
    public sealed class UiKit
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        [System.Runtime.InteropServices.DllImport("__Internal")] static extern float TL_DisplayScale();
        public static float DisplayScale => Mathf.Max(.1f,TL_DisplayScale());
#else
        public static float DisplayScale => 1;
#endif
        public readonly Font Font = Resources.Load<Font>("Fonts/Korean") ?? Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
        public readonly Color Ink=new Color32(53,55,46,255), Paper=new Color32(249,247,235,255), Green=new Color32(101,121,80,255);
        static readonly Dictionary<string,Sprite> surfaces=new Dictionary<string,Sprite>();
        public static Sprite Surface(Color top,Color bottom,Color border,int radius=12)
        {
            string key=$"{top}-{bottom}-{border}-{radius}";
            if(surfaces.TryGetValue(key,out var found))return found;
            const int size=64;var texture=new Texture2D(size,size,TextureFormat.RGBA32,false);texture.wrapMode=TextureWrapMode.Clamp;
            float edge=Mathf.Max(2,radius);
            for(int y=0;y<size;y++)for(int x=0;x<size;x++)
            {
                float dx=Mathf.Max(edge-x-.5f,x+.5f-(size-edge)),dy=Mathf.Max(edge-y-.5f,y+.5f-(size-edge));
                float distance=Mathf.Sqrt(Mathf.Max(0,dx)*Mathf.Max(0,dx)+Mathf.Max(0,dy)*Mathf.Max(0,dy))-edge;
                var color=distance>-1.5f?border:Color.Lerp(bottom,top,y/(float)(size-1));color.a*=Mathf.Clamp01(.5f-distance);texture.SetPixel(x,y,color);
            }
            texture.Apply();var sprite=Sprite.Create(texture,new Rect(0,0,size,size),new Vector2(.5f,.5f),100,0,SpriteMeshType.FullRect,new Vector4(edge,edge,edge,edge));surfaces[key]=sprite;return sprite;
        }
        public void Style(RectTransform rect,Color top,Color bottom,Color border,int radius=12)
        {var image=rect.GetComponent<Image>();image.sprite=Surface(top,bottom,border,radius);image.type=Image.Type.Sliced;image.color=Color.white;}
        public Image Icon(Transform parent,string name,int size=18,Color? tint=null)
        {var rect=Node("Icon "+name,parent);var image=rect.gameObject.AddComponent<Image>();image.sprite=Resources.Load<Sprite>("Icons/"+(name=="acorn"?name:"white-"+name))??Resources.Load<Sprite>("Icons/"+name);image.color=name=="acorn"?Color.white:tint??Ink;image.preserveAspect=true;image.raycastTarget=false;var layout=rect.gameObject.AddComponent<LayoutElement>();layout.minWidth=layout.preferredWidth=size;layout.minHeight=layout.preferredHeight=size;layout.flexibleWidth=0;return image;}
        readonly Dictionary<string,Sprite> sprites=new Dictionary<string,Sprite>();
        public RectTransform Node(string name,Transform parent)
        {var rect=new GameObject(name,typeof(RectTransform)).GetComponent<RectTransform>();rect.SetParent(parent,false);return rect;}
        public static void Fill(RectTransform rect,float left=0,float bottom=0,float right=0,float top=0)
        {rect.anchorMin=Vector2.zero;rect.anchorMax=Vector2.one;rect.offsetMin=new Vector2(left,bottom);rect.offsetMax=new Vector2(-right,-top);}
        public RectTransform Panel(Transform parent,Color? color=null)
        {var rect=Node("Panel",parent);rect.gameObject.AddComponent<Image>().color=color??Paper;return rect;}
        public Text Label(Transform parent,string value,int size=18,TextAnchor alignment=TextAnchor.MiddleLeft)
        {var rect=Node("Text",parent);var text=rect.gameObject.AddComponent<Text>();text.font=Font;text.text=value;text.fontSize=size;text.color=Ink;text.alignment=alignment;text.fontStyle=FontStyle.Normal;text.horizontalOverflow=HorizontalWrapMode.Wrap;text.verticalOverflow=VerticalWrapMode.Overflow;text.raycastTarget=false;return text;}
        public Button Button(Transform parent,string title,Action action,bool enabled=true)
        {var rect=Panel(parent);Style(rect,new Color32(246,244,233,255),new Color32(240,237,222,255),new Color32(205,210,185,255),10);var button=rect.gameObject.AddComponent<Button>();button.interactable=enabled;var text=Label(rect,title,16,TextAnchor.MiddleCenter);Fill(text.rectTransform,7,3,7,3);text.fontSize=14;text.fontStyle=FontStyle.Bold;var colors=button.colors;colors.disabledColor=new Color(1,1,1,.45f);colors.highlightedColor=new Color(.94f,.97f,.9f);button.colors=colors;button.onClick.AddListener(()=>action?.Invoke());var element=rect.gameObject.AddComponent<LayoutElement>();element.minHeight=38;element.preferredHeight=38;element.flexibleWidth=1;return button;}
        public Button Button(Transform parent,string title,Action action,Func<bool> available)
        {
            var button=Button(parent,title,action,available());
            var binding=button.gameObject.AddComponent<ButtonAvailability>();binding.Condition=available;
            return button;
        }
        public Button IconButton(Transform parent,string icon,string title,Action action,bool enabled=true)
        {
            var button=Button(parent,title,action,enabled);button.GetComponent<Image>().sprite=null;button.GetComponent<Image>().color=Color.clear;
            var label=button.GetComponentInChildren<Text>();label.fontSize=11;label.fontStyle=FontStyle.Bold;label.color=Color.white;label.rectTransform.anchorMin=new Vector2(0,0);label.rectTransform.anchorMax=new Vector2(1,.2f);label.rectTransform.offsetMin=label.rectTransform.offsetMax=Vector2.zero;
            var badge=Panel(button.transform);badge.name="Menu medallion";badge.anchorMin=badge.anchorMax=new Vector2(.5f,1);badge.pivot=new Vector2(.5f,1);badge.anchoredPosition=Vector2.zero;badge.sizeDelta=new Vector2(51,51);
            Color top=new Color32(255,251,237,255),bottom=new Color32(222,218,181,255),ink=new Color32(120,129,107,255);
            if(icon=="units"){top=new Color32(238,241,215,255);bottom=new Color32(189,209,162,255);ink=new Color32(85,118,66,255);}
            if(icon=="envelope"){top=new Color32(255,241,200,255);bottom=new Color32(224,204,137,255);ink=new Color32(159,125,62,255);}
            Style(badge,top,bottom,new Color32(112,118,89,255),15);badge.GetComponent<Image>().raycastTarget=false;
            var image=Icon(badge,icon,29,ink);Fill(image.rectTransform,10,10,10,10);
            var element=button.GetComponent<LayoutElement>();element.minHeight=70;element.preferredHeight=70;element.minWidth=51;element.preferredWidth=51;element.flexibleWidth=0;
            return button;
        }
        public void Primary(Button button)
        {Style((RectTransform)button.transform,Green,Green,Green,11);button.GetComponentInChildren<Text>().color=Color.white;}
        public Button MenuItem(Transform parent,string icon,string title,Action action,bool enabled=true)
        {var button=Button(parent,title,action,enabled);Style((RectTransform)button.transform,new Color(1,1,1,.05f),new Color(1,1,1,.05f),Color.clear,8);var label=button.GetComponentInChildren<Text>();label.color=new Color32(241,241,231,255);label.fontSize=12;label.rectTransform.anchorMax=new Vector2(1,.35f);var picture=Icon(button.transform,icon,28,new Color32(214,228,197,255));picture.rectTransform.anchorMin=new Vector2(.25f,.42f);picture.rectTransform.anchorMax=new Vector2(.75f,.85f);picture.rectTransform.offsetMin=picture.rectTransform.offsetMax=Vector2.zero;var layout=button.GetComponent<LayoutElement>();layout.minHeight=layout.preferredHeight=Screen.height/UiKit.DisplayScale<=560?68:85;layout.flexibleWidth=1;return button;}
        public RectTransform Column(Transform parent,int spacing=8)
        {var rect=Node("Column",parent);var layout=rect.gameObject.AddComponent<VerticalLayoutGroup>();layout.spacing=spacing;layout.padding=new RectOffset(10,10,10,10);layout.childControlHeight=true;layout.childControlWidth=true;layout.childForceExpandHeight=false;return rect;}
        public RectTransform Row(Transform parent,int height=42)
        {var rect=Node("Row",parent);var layout=rect.gameObject.AddComponent<HorizontalLayoutGroup>();layout.spacing=7;layout.childControlHeight=true;layout.childControlWidth=true;layout.childForceExpandWidth=true;var element=rect.gameObject.AddComponent<LayoutElement>();element.preferredHeight=height;element.minHeight=height;element.flexibleHeight=0;return rect;}
        public Text Paragraph(Transform parent,string value,int size=16)
        {var label=Label(parent,value,size);var element=label.gameObject.AddComponent<LayoutElement>();element.minHeight=size+5;return label;}
        public Sprite Art(string id)
        {if(!sprites.TryGetValue(id??"",out var sprite)){sprite=Resources.Load<Sprite>("Art/"+id);sprites[id??""]=sprite;}return sprite;}
        public Image Portrait(Transform parent,string id,int width=64)
        {var rect=Node("Portrait",parent);var image=rect.gameObject.AddComponent<Image>();image.sprite=Art(id);image.preserveAspect=true;image.raycastTarget=false;var element=rect.gameObject.AddComponent<LayoutElement>();element.preferredWidth=width;element.minWidth=width;element.preferredHeight=width;return image;}
        public InputField Input(Transform parent,string placeholder,bool password=false)
        {var rect=Panel(parent,Color.white);var input=rect.gameObject.AddComponent<InputField>();var label=Label(rect,"",16);Fill(label.rectTransform,8,3,8,3);input.textComponent=label;var hint=Label(rect,placeholder,16);hint.color=new Color(.4f,.4f,.4f,.6f);Fill(hint.rectTransform,8,3,8,3);input.placeholder=hint;input.contentType=password?InputField.ContentType.Password:InputField.ContentType.Standard;rect.gameObject.AddComponent<LayoutElement>().preferredHeight=38;return input;}
        public Toggle Toggle(Transform parent,string label,bool value,Action<bool> action)
        {
            var row=Row(parent,30);row.GetComponent<HorizontalLayoutGroup>().childForceExpandWidth=false;var toggle=row.gameObject.AddComponent<Toggle>();var box=Panel(row);Style(box,Color.white,Color.white,new Color32(174,181,160,255),2);var size=box.gameObject.AddComponent<LayoutElement>();size.minWidth=size.preferredWidth=18;size.flexibleWidth=0;
            var check=Icon(box,"check",14,Green);Fill(check.rectTransform,2,2,2,2);toggle.targetGraphic=box.GetComponent<Image>();toggle.graphic=check;var caption=Paragraph(row,label,12);caption.GetComponent<LayoutElement>().flexibleWidth=1;toggle.isOn=value;toggle.onValueChanged.AddListener(x=>action?.Invoke(x));return toggle;
        }
        public Slider Slider(Transform parent,float value,Action<float> action)
        {var rect=Panel(parent,new Color32(223,217,194,255));rect.gameObject.AddComponent<LayoutElement>().preferredHeight=28;var slider=rect.gameObject.AddComponent<Slider>();var handle=Panel(rect,Green);handle.sizeDelta=new Vector2(20,28);slider.handleRect=handle;slider.targetGraphic=handle.GetComponent<Image>();slider.minValue=0;slider.maxValue=1;slider.value=value;slider.onValueChanged.AddListener(x=>action?.Invoke(x));return slider;}
        public static void Clear(Transform parent){for(int i=parent.childCount-1;i>=0;i--){var child=parent.GetChild(i);child.gameObject.SetActive(false);if(Application.isPlaying)UnityEngine.Object.Destroy(child.gameObject);else UnityEngine.Object.DestroyImmediate(child.gameObject);}}
    }
    public sealed class ModalNavigation
    {
        sealed class Page { public string Title,Presentation;public Action<RectTransform> Render;public float Scroll=1;public bool Required; }
        readonly UiKit ui; readonly RectTransform overlay,panel,body,header;readonly Text title;readonly Stack<Page> pages=new Stack<Page>();
        ScrollRect scroll;Button closeButton;RectTransform content;Vector2 lastSize;
        public bool Open=>pages.Count>0;
        public string CurrentTitle=>Open?pages.Peek().Title:null;
        public event Action<bool> OpenChanged;
        public ModalNavigation(UiKit ui,RectTransform root)
        {
            this.ui=ui;overlay=ui.Panel(root,new Color32(48,56,42,102));UiKit.Fill(overlay);
            panel=ui.Panel(overlay);panel.anchorMin=new Vector2(.025f,.025f);panel.anchorMax=new Vector2(.975f,.96f);panel.offsetMin=panel.offsetMax=Vector2.zero;
            ui.Style(panel,ui.Paper,ui.Paper,new Color32(137,153,110,255),18);
            header=ui.Panel(panel);header.anchorMin=new Vector2(0,1);header.anchorMax=Vector2.one;header.offsetMin=new Vector2(2,-72);header.offsetMax=new Vector2(-2,-2);ui.Style(header,new Color32(233,237,215,255),new Color32(224,231,202,255),new Color32(194,205,171,255),16);
            title=ui.Label(panel,"",19);title.fontStyle=FontStyle.Bold;title.rectTransform.anchorMin=new Vector2(0,1);title.rectTransform.anchorMax=Vector2.one;title.rectTransform.offsetMin=new Vector2(24,-65);title.rectTransform.offsetMax=new Vector2(-64,-8);
            closeButton=ui.Button(panel,"×",Close);var cr=(RectTransform)closeButton.transform;cr.anchorMin=cr.anchorMax=Vector2.one;cr.pivot=Vector2.one;cr.anchoredPosition=new Vector2(-24,-20);cr.sizeDelta=new Vector2(35,35);
            body=ui.Node("Body",panel);UiKit.Fill(body,15,15,15,84);overlay.gameObject.SetActive(false);
        }
        public void Show(string title,Action<RectTransform> render,bool replace=false,bool required=false,string presentation="panel")
        {if(presentation=="panel"){if(new[]{"동료 성장","동료 모집","모집 결과","보석","도감","적 도감","동료 도감"}.Contains(title))presentation="collection";if(new[]{"복귀 수익","저장 불러오기","전투 나가기"}.Contains(title))presentation="message";}if(Open&&scroll)pages.Peek().Scroll=scroll.verticalNormalizedPosition;if(replace&&Open)pages.Pop();pages.Push(new Page{Title=title,Render=render,Required=required,Presentation=presentation});Refresh(false);}
        public void Resize(bool force=false)
        {
            if(!Open)return;var size=((RectTransform)overlay.parent).rect.size;if(!force&&size==lastSize)return;lastSize=size;
            string kind=pages.Peek().Presentation;bool drawer=kind=="drawer",entry=kind=="entry";
            panel.anchorMin=panel.anchorMax=panel.pivot=new Vector2(drawer?1:.5f,.5f);
            panel.anchoredPosition=new Vector2(drawer?-12:0,0);
            bool compact=Screen.height/UiKit.DisplayScale<=560||Screen.width/UiKit.DisplayScale<=1000;bool message=kind=="message";
            float width=Mathf.Min(Mathf.Max(100,size.x-32),entry?300:drawer?Mathf.Min(280,size.x*.42f,size.y*.7f):message?440:kind=="collection"?800:640);
            float maxHeight=Mathf.Min(size.y-24,message?400:kind=="collection"?640:560);
            panel.anchoredPosition=new Vector2(drawer?0:0,0);panel.sizeDelta=new Vector2(width,drawer?size.y:maxHeight);
            float headerHeight=compact?52:72;header.offsetMin=new Vector2(2,-headerHeight);title.rectTransform.offsetMin=new Vector2(compact?14:24,-headerHeight);closeButton.GetComponent<RectTransform>().anchoredPosition=new Vector2(compact?-14:-24,compact?-8:-20);
            UiKit.Fill(body,compact?6:15,compact?6:15,compact?6:15,headerHeight+10);
            if(content){Canvas.ForceUpdateCanvases();float preferred=LayoutUtility.GetPreferredHeight(content)+headerHeight+30;panel.sizeDelta=new Vector2(width,drawer?size.y:Mathf.Min(maxHeight,Mathf.Max(120,preferred)));}
            if(drawer){panel.GetComponent<Image>().sprite=null;panel.GetComponent<Image>().color=new Color32(38,50,46,238);header.gameObject.SetActive(false);title.color=Color.white;}
            else {header.gameObject.SetActive(true);ui.Style(panel,ui.Paper,ui.Paper,new Color32(137,153,110,255),18);title.color=ui.Ink;}
            overlay.GetComponent<Image>().color=entry?new Color32(36,39,30,245):drawer?new Color32(20,37,26,34):new Color32(48,56,42,102);
            if(entry){UiKit.Fill(body,0,0,0,headerHeight+10);content.GetComponent<VerticalLayoutGroup>().padding=new RectOffset();panel.GetComponent<Image>().color=Color.clear;header.gameObject.SetActive(false);title.text="Tiny Legion";title.alignment=TextAnchor.MiddleCenter;title.color=Color.white;title.fontSize=28;title.rectTransform.offsetMax=new Vector2(-12,-8);}
            else {title.fontSize=19;title.alignment=TextAnchor.MiddleLeft;title.rectTransform.offsetMax=new Vector2(-64,-8);}
            closeButton.gameObject.SetActive(!pages.Peek().Required&&!entry);

        }
        public void Refresh(bool capture=true)
        {
            if(!Open){overlay.gameObject.SetActive(false);OpenChanged?.Invoke(false);return;}
            if(capture&&scroll)pages.Peek().Scroll=scroll.verticalNormalizedPosition;OpenChanged?.Invoke(true);overlay.gameObject.SetActive(true);overlay.SetAsLastSibling();title.text=pages.Peek().Title;closeButton.interactable=!pages.Peek().Required;UiKit.Clear(body);
            var viewport=ui.Panel(body,new Color(0,0,0,0));UiKit.Fill(viewport);viewport.gameObject.AddComponent<RectMask2D>();
            content=ui.Column(viewport);content.anchorMin=new Vector2(0,1);content.anchorMax=Vector2.one;content.pivot=new Vector2(.5f,1);content.offsetMin=content.offsetMax=Vector2.zero;
            content.gameObject.AddComponent<ContentSizeFitter>().verticalFit=ContentSizeFitter.FitMode.PreferredSize;
            scroll=viewport.gameObject.AddComponent<ScrollRect>();scroll.viewport=viewport;scroll.content=content;scroll.horizontal=false;scroll.scrollSensitivity=30;scroll.movementType=ScrollRect.MovementType.Clamped;
            pages.Peek().Render(content);Resize(true);Canvas.ForceUpdateCanvases();scroll.verticalNormalizedPosition=pages.Peek().Scroll;
            if(pages.Count>1&&pages.Peek().Presentation!="message"&&pages.Peek().Presentation!="entry")ui.Button(content,"뒤로",Back);
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
