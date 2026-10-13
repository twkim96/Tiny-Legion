using NUnit.Framework;
using TinyLegion.Unity;
using UnityEngine;

public sealed class ModalNavigationTests
{
    GameObject root;
    ModalNavigation modal;
    [SetUp]
    public void Setup()
    {
        root=new GameObject("Modal test",typeof(RectTransform));
        modal=new ModalNavigation(new UiKit(),root.GetComponent<RectTransform>());
    }
    [TearDown]
    public void Cleanup(){Object.DestroyImmediate(root);}
    [Test]
    public void ClosingOptionalChildKeepsMandatoryParent()
    {
        modal.Show("저장 복구",p=>{},required:true);
        modal.Show("가져오기 확인",p=>{});
        modal.Close();
        Assert.That(modal.Open,Is.True);
        Assert.That(modal.CurrentTitle,Is.EqualTo("저장 복구"));
        modal.Close();
        Assert.That(modal.CurrentTitle,Is.EqualTo("저장 복구"));
    }
    [Test]
    public void ClosingOptionalStackClosesEverything()
    {
        modal.Show("설정",p=>{});
        modal.Show("파일 확인",p=>{});
        modal.Close();
        Assert.That(modal.Open,Is.False);
    }
    [Test]
    public void BackReturnsToMandatoryParentAndCannotDismissIt()
    {
        modal.Show("첫 안내",p=>{},required:true);
        modal.Show("동료 상세",p=>{});
        modal.Back();
        modal.Back();
        Assert.That(modal.CurrentTitle,Is.EqualTo("첫 안내"));
        Assert.That(modal.Open,Is.True);
    }
}
