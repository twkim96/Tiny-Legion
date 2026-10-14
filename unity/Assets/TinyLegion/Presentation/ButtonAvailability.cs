using System;
using UnityEngine;
using UnityEngine.UI;

namespace TinyLegion.Unity
{
    [RequireComponent(typeof(Button))]
    public sealed class ButtonAvailability : MonoBehaviour
    {
        public Func<bool> Condition;
        Button button;
        public void Refresh()
        {
            if(!button)button=GetComponent<Button>();
            if(Condition!=null)button.interactable=Condition();
        }
        void Update()=>Refresh();
    }
}
