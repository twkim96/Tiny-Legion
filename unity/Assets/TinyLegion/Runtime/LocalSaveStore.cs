using System;
using System.IO;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;
namespace TinyLegion.Unity
{
    public sealed class LocalSaveStore
    {
        readonly string path;
        const string Key = "tiny-legion.unity.save.v1";
        public LocalSaveStore() { path = Path.Combine(Application.persistentDataPath, "tiny-legion-save.json"); }
        public JObject Read()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            var text = PlayerPrefs.GetString(Key, "");
#else
            var text = File.Exists(path) ? File.ReadAllText(path) : "";
#endif
            return string.IsNullOrEmpty(text) ? null : JObject.Parse(text);
        }
        public void Write(JObject account)
        {
            var json = account.ToString(Formatting.None);
#if UNITY_WEBGL && !UNITY_EDITOR
            PlayerPrefs.SetString(Key, json); PlayerPrefs.Save();
#else
            Directory.CreateDirectory(Path.GetDirectoryName(path));
            var temporary = path + ".pending";
            File.WriteAllText(temporary, json);
            if (File.Exists(path)) File.Replace(temporary, path, null); else File.Move(temporary, path);
#endif
        }
    }
}
