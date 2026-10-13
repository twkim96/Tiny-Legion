using System.Runtime.InteropServices;
using UnityEngine;
namespace TinyLegion.Unity
{
    public static class WebPlatform
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] static extern int TL_Hosted();
        [DllImport("__Internal")] static extern int TL_TestLogin();
        [DllImport("__Internal")] static extern string TL_Session();
        [DllImport("__Internal")] static extern void TL_StoreSession(string session);
        [DllImport("__Internal")] static extern void TL_Download(string name,string text);
        [DllImport("__Internal")] static extern void TL_Import(string target);
        [DllImport("__Internal")] static extern void TL_Fullscreen();
#endif
        public static bool Hosted
        {
            get {
#if UNITY_WEBGL && !UNITY_EDITOR
                return TL_Hosted() != 0;
#else
                return false;
#endif
            }
        }
        public static bool TestLoginAvailable
        {get{
#if UNITY_WEBGL && !UNITY_EDITOR
            return TL_TestLogin()!=0;
#else
            return false;
#endif
        }}
        public static string Session
        {
            get {
#if UNITY_WEBGL && !UNITY_EDITOR
                return TL_Session();
#else
                return null;
#endif
            }
        }
        public static void StoreSession(string session)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            TL_StoreSession(session);
#endif
        }
        public static void Download(string name,string text)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            TL_Download(name,text);
#else
            System.IO.File.WriteAllText(System.IO.Path.Combine(Application.persistentDataPath,name),text);
#endif
        }
        public static void ChooseImport(string target)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            TL_Import(target);
#endif
        }
        public static void Fullscreen()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            TL_Fullscreen();
#else
            Screen.fullScreen = !Screen.fullScreen;
#endif
        }
        public static void SignIn()
        {
            var url = Application.absoluteURL;
            if(System.Uri.TryCreate(url,System.UriKind.Absolute,out var origin)) Application.OpenURL(origin.GetLeftPart(System.UriPartial.Authority)+"/signin-with-chatgpt");
        }
    }
}
