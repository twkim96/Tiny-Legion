using NUnit.Framework;
using UnityEngine;

public sealed class SceneryResourceTests
{
    [TestCase("player-castle")]
    [TestCase("enemy-castle")]
    [TestCase("background-normal")]
    [TestCase("background-creek")]
    [TestCase("background-quarry")]
    [TestCase("background-moon")]
    [TestCase("background-sunset")]
    public void BattlefieldCanLoadItsTexture(string name)
    {
        Assert.That(Resources.Load<Texture2D>("Scenery/" + name), Is.Not.Null,
            "BattleView requires a Texture2D resource to create its scenery sprite.");
    }
}
