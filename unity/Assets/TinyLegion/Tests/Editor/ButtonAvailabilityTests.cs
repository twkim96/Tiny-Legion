using NUnit.Framework;
using TinyLegion.Unity;
using UnityEngine;

public sealed class ButtonAvailabilityTests
{
    [Test]
    public void PendingSettlementCanFinishWithoutRecreatingTheDialogOrItsDraft()
    {
        var root=new GameObject("Dialog",typeof(RectTransform));
        try
        {
            bool pending=true,unlocked=true;
            var ui=new UiKit();var draft=ui.Input(root.transform,"편성 이름");draft.text="작성 중";
            var button=ui.Button(root.transform,"모집",()=>{},()=>!pending&&unlocked);
            Assert.That(button.interactable,Is.False);
            pending=false;button.GetComponent<ButtonAvailability>().Refresh();
            Assert.That(button.interactable,Is.True);
            Assert.That(draft.text,Is.EqualTo("작성 중"));
            unlocked=false;button.GetComponent<ButtonAvailability>().Refresh();
            Assert.That(button.interactable,Is.False);
        }
        finally {Object.DestroyImmediate(root);}
    }
}
