using NUnit.Framework;
using System.IO;
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
    [TestCase("player-castle")]
    [TestCase("enemy-castle")]
    [TestCase("background-normal")]
    public void ImportPreservesOriginalImageDimensions(string name)
    {
        var raw=File.ReadAllBytes("Assets/TinyLegion/Resources/Scenery/"+name+".png");
        int width=(raw[16]<<24)|(raw[17]<<16)|(raw[18]<<8)|raw[19];
        int height=(raw[20]<<24)|(raw[21]<<16)|(raw[22]<<8)|raw[23];
        var texture=Resources.Load<Texture2D>("Scenery/"+name);
        Assert.That(texture.width,Is.EqualTo(width));
        Assert.That(texture.height,Is.EqualTo(height));
    }
}
