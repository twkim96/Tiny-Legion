using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
namespace TinyLegion.Unity
{
    // A long press shows detail and suppresses the subsequent summon click.
    public sealed class SummonCardInput : MonoBehaviour,IPointerDownHandler,IPointerUpHandler,IPointerExitHandler,IPointerEnterHandler
    {
        public Action Summon,Explain;
        public Action<string> Hover;
        public string Description;
        bool held,longPress;float pressedAt;
        void Awake(){GetComponent<Button>().onClick.AddListener(()=>{if(!longPress)Summon?.Invoke();});}
        public void OnPointerDown(PointerEventData data){held=true;longPress=false;pressedAt=Time.unscaledTime;}
        public void OnPointerUp(PointerEventData data){held=false;}
        public void OnPointerExit(PointerEventData data){held=false;}
        public void OnPointerEnter(PointerEventData data){if(data.pointerId<0)Hover?.Invoke(Description);}
        void Update(){if(held&&!longPress&&Time.unscaledTime-pressedAt>=.5f){longPress=true;held=false;Explain?.Invoke();}}
    }
}
