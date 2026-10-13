using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEditor.Build;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
namespace TinyLegion.Editor
{
    public static class ProjectSetup
    {
        [MenuItem("Tiny Legion/Prepare project")]
        public static void Prepare()
        {
            const string directory="Assets/TinyLegion/Settings";
            Directory.CreateDirectory(directory);AssetDatabase.Refresh();
            var renderer=AssetDatabase.LoadAssetAtPath<Renderer2DData>(directory+"/Renderer2D.asset");
            if(!renderer){renderer=ScriptableObject.CreateInstance<Renderer2DData>();AssetDatabase.CreateAsset(renderer,directory+"/Renderer2D.asset");}
            var pipeline=AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(directory+"/UniversalRP.asset");
            if(!pipeline){pipeline=UniversalRenderPipelineAsset.Create(renderer);AssetDatabase.CreateAsset(pipeline,directory+"/UniversalRP.asset");}
            pipeline.supportsHDR=false;pipeline.supportsCameraDepthTexture=false;pipeline.supportsCameraOpaqueTexture=false;
            GraphicsSettings.defaultRenderPipeline=pipeline;QualitySettings.renderPipeline=pipeline;
            PlayerSettings.companyName="Tiny Legion";PlayerSettings.productName="Tiny Legion";
            PlayerSettings.defaultScreenWidth=1280;PlayerSettings.defaultScreenHeight=720;
            PlayerSettings.defaultInterfaceOrientation=UIOrientation.LandscapeLeft;
            PlayerSettings.allowedAutorotateToPortrait=false;PlayerSettings.allowedAutorotateToPortraitUpsideDown=false;
            PlayerSettings.allowedAutorotateToLandscapeLeft=true;PlayerSettings.allowedAutorotateToLandscapeRight=true;
            PlayerSettings.WebGL.template="PROJECT:TinyLegion";
            PlayerSettings.WebGL.compressionFormat=WebGLCompressionFormat.Disabled;
            PlayerSettings.WebGL.dataCaching=true;
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.WebGL,ScriptingImplementation.IL2CPP);
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            var camera=new GameObject("Main Camera").AddComponent<Camera>();camera.tag="MainCamera";camera.orthographic=true;
            camera.transform.position=new Vector3(0,0,-10);camera.gameObject.AddComponent<UniversalAdditionalCameraData>();camera.gameObject.AddComponent<AudioListener>();
            EditorSceneManager.SaveScene(scene,"Assets/TinyLegion/Scenes/Main.unity");
            EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene("Assets/TinyLegion/Scenes/Main.unity",true)};
            AssetDatabase.SaveAssets();
        }
        [MenuItem("Tiny Legion/Build Web")]
        public static void BuildWeb()
        {
            Prepare();
            var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=new[]{"Assets/TinyLegion/Scenes/Main.unity"},locationPathName="Builds/Web",target=BuildTarget.WebGL,options=BuildOptions.None});
            if(report.summary.result!=UnityEditor.Build.Reporting.BuildResult.Succeeded)throw new System.Exception("Unity web build failed: "+report.summary.result);
        }
    }
    public sealed class ArtImporter : AssetPostprocessor
    {
        void OnPreprocessTexture()
        {
            if(assetPath.StartsWith("Assets/TinyLegion/Resources/Scenery/"))
            {
                var scenery=(TextureImporter)assetImporter;
                scenery.textureType=TextureImporterType.Default;
                scenery.textureShape=TextureImporterShape.Texture2D;
                scenery.alphaIsTransparency=true;scenery.mipmapEnabled=false;
                scenery.wrapMode=TextureWrapMode.Clamp;
                scenery.textureCompression=TextureImporterCompression.Uncompressed;
                return;
            }
            if(!assetPath.StartsWith("Assets/TinyLegion/Resources/Art/"))return;
            var importer=(TextureImporter)assetImporter;importer.textureType=TextureImporterType.Sprite;
            importer.spriteImportMode=SpriteImportMode.Single;importer.spritePixelsPerUnit=384;
            importer.alphaIsTransparency=true;importer.mipmapEnabled=false;importer.textureCompression=TextureImporterCompression.Uncompressed;
            var settings=new TextureImporterSettings();importer.ReadTextureSettings(settings);settings.spriteAlignment=(int)SpriteAlignment.BottomCenter;importer.SetTextureSettings(settings);
        }
    }
}
