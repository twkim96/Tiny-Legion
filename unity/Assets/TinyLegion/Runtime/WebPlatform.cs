using System;
using System.IO;
using System.Runtime.InteropServices;
using TinyLegion.Domain.Services;
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
        public static string Download(string name,string text,string originalFile=null)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            TL_Download(name,text);
            return null;
#elif UNITY_EDITOR
            var path=UnityEditor.EditorUtility.SaveFilePanel("저장 파일 내보내기",Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),name,"json");
            if(string.IsNullOrEmpty(path))return null;
            if(originalFile==null)File.WriteAllText(path,text);else File.Copy(originalFile,path,true);
            return path;
#else
            var directory=Path.Combine(Application.persistentDataPath,"exports");
            Directory.CreateDirectory(directory);
            var path=Path.Combine(directory,name);
            if(originalFile==null)File.WriteAllText(path,text);else File.Copy(originalFile,path,true);
            return path;
#endif
        }
        public static void ChooseImport(string target,Action<string> selected,Action<string> failed)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            TL_Import(target);
#elif UNITY_EDITOR
            var path=UnityEditor.EditorUtility.OpenFilePanel("저장 파일 불러오기",Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),"json");
            if(string.IsNullOrEmpty(path))return;
            try { using var file=File.OpenRead(path); selected(SaveDocument.ReadUtf8(file)); }
            catch(Exception error) { failed(error.Message); }
#else
            failed("이 환경에서는 저장 JSON을 붙여넣어 불러와 주세요.");
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
