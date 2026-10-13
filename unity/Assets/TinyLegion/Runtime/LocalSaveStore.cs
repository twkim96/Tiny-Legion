using System;
using System.IO;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using TinyLegion.Domain.Services;
using UnityEngine;
namespace TinyLegion.Unity
{
    public sealed class LocalSaveStore
    {
        const string Key = "tiny-legion.unity.save.v1";
#if UNITY_WEBGL && !UNITY_EDITOR
        public bool RecoveryRequired { get; private set; }
        public string RecoveryBackupPath { get; private set; }
        public string OriginalFilePath => null;
#else
        readonly string path;
        readonly JsonFileStore files;
        public bool RecoveryRequired => files.RecoveryRequired;
        public string RecoveryBackupPath => files.RecoveryBackupPath;
        public string OriginalFilePath => path;
        public LocalSaveStore()
        {
#if UNITY_EDITOR
            var testDirectory = Environment.GetEnvironmentVariable("TINY_LEGION_TEST_SAVE_DIRECTORY");
#else
            string testDirectory = null;
#endif
            path = Path.Combine(string.IsNullOrEmpty(testDirectory) ? Application.persistentDataPath : Path.GetFullPath(testDirectory), "tiny-legion-save.json");
            files = new JsonFileStore(path);
        }
#endif
        public string ReadRaw()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            return PlayerPrefs.GetString(Key, "");
#else
            return File.Exists(path) ? File.ReadAllText(path) : "";
#endif
        }
        public JObject Read()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            try { var text = ReadRaw(); var result = string.IsNullOrEmpty(text) ? null : JObject.Parse(text); RecoveryRequired = false; return result; }
            catch { RecoveryRequired = true; throw; }
#else
            return files.Read();
#endif
        }
        public void Write(JObject account, bool replaceUnreadable = false)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            if (RecoveryRequired)
            {
                if (!replaceUnreadable) throw new InvalidOperationException("기존 저장을 읽지 못했습니다. 복구 또는 초기화를 확인해 주세요.");
                var backup = Key + ".recovery." + Guid.NewGuid().ToString("N");
                PlayerPrefs.SetString(backup, ReadRaw()); PlayerPrefs.Save(); RecoveryBackupPath = backup;
            }
            PlayerPrefs.SetString(Key, account.ToString(Formatting.None)); PlayerPrefs.Save(); RecoveryRequired = false;
#else
            files.Write(account, replaceUnreadable);
#endif
        }
    }
}
