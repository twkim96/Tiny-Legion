using System.Linq;
using System.Reflection;
using Newtonsoft.Json.Linq;
using NUnit.Framework;
using TinyLegion.Domain.Data;
using TinyLegion.Domain.Services;
using TinyLegion.Unity;
using UnityEngine;
using UnityEngine.UI;

public sealed class ConnectionPresentationTests
{
    [Test]
    public void PendingSessionDoesNotReportFailureAndOfflineSessionOffersRetry()
    {
        var host=new GameObject("Connection test");
        var existingObjects=Object.FindObjectsByType<GameObject>(FindObjectsSortMode.None).ToHashSet();
        try
        {
            var game=host.AddComponent<GameController>();
            const BindingFlags flags=BindingFlags.Instance|BindingFlags.NonPublic;
            typeof(GameController).GetField("<Catalog>k__BackingField",flags).SetValue(game,new GameCatalog(JObject.Parse(Resources.Load<TextAsset>("Data/catalog").text)));
            var session=new GameSessionClient(null);
            typeof(GameController).GetField("session",flags).SetValue(game,session);
            var status=typeof(GameSessionClient).GetField("<Status>k__BackingField",flags);
            status.SetValue(session,"connecting");
            var view=host.AddComponent<GameView>();view.Initialize(game);
            var modal=(ModalNavigation)typeof(GameView).GetField("modal",flags).GetValue(view);
            var refresh=typeof(GameView).GetMethod("Refresh",flags);
            Assert.That(modal.CurrentTitle,Is.EqualTo("계정 접속"));
            status.SetValue(session,"retrying");refresh.Invoke(view,null);
            Assert.That(modal.CurrentTitle,Is.EqualTo("계정 접속"));
            status.SetValue(session,"offline");refresh.Invoke(view,null);
            Assert.That(modal.CurrentTitle,Is.EqualTo("온라인 연결"));
            Assert.That(host.GetComponentsInChildren<Button>().Any(b=>b.GetComponentInChildren<Text>()?.text=="다시 연결"),Is.True);
        }
        finally
        {
            Object.DestroyImmediate(host);
            foreach(var item in Object.FindObjectsByType<GameObject>(FindObjectsSortMode.None))
                if(!existingObjects.Contains(item))Object.DestroyImmediate(item);
        }
    }
}
