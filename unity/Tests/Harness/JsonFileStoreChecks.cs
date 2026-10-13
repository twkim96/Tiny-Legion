using System;
using System.IO;
using System.Linq;
using System.Text;
using Newtonsoft.Json.Linq;
using TinyLegion.Domain.Services;

static class JsonFileStoreChecks
{
    public static void Run()
    {
        string directory = Path.Combine(Path.GetTempPath(), "tiny-legion-json-store-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        try
        {
            string path = Path.Combine(directory, "nested", "account.json");
            var store = new JsonFileStore(path);
            if (store.Read() != null || store.RecoveryRequired) throw new Exception("Missing store did not read as empty");
            store.Write(new JObject { ["gold"] = 1 });
            if (!File.Exists(path)) throw new Exception("New save directory was not created");
            File.WriteAllBytes(path, Array.Empty<byte>());
            if (store.Read() != null || store.RecoveryRequired) throw new Exception("Empty store did not read as empty");

            var first = new JObject { ["gold"] = 125, ["name"] = "동료" };
            store.Write(first);
            if (!JToken.DeepEquals(store.Read(), first)) throw new Exception("Normal JSON store round trip failed");

            File.WriteAllBytes(path, Encoding.UTF8.GetBytes("{ malformed old snapshot"));
            byte[] original = File.ReadAllBytes(path);
            try
            {
                store.Read();
                throw new Exception("Malformed store JSON was accepted");
            }
            catch (Newtonsoft.Json.JsonException) { }
            if (!store.RecoveryRequired) throw new Exception("Malformed read did not require recovery");

            try
            {
                store.Write(new JObject { ["gold"] = 200 });
                throw new Exception("Default write replaced an unreadable snapshot");
            }
            catch (InvalidOperationException) { }
            if (!File.ReadAllBytes(path).SequenceEqual(original)) throw new Exception("Rejected write changed unreadable bytes");

            store.Write(new JObject { ["gold"] = 200 }, replaceUnreadable: true);
            string backupPath = store.RecoveryBackupPath;
            if (string.IsNullOrEmpty(backupPath) || !File.Exists(backupPath) || !File.ReadAllBytes(backupPath).SequenceEqual(original))
                throw new Exception("Explicit recovery did not preserve exact unreadable bytes");
            if (store.RecoveryRequired || (int)store.Read()["gold"] != 200) throw new Exception("Recovery snapshot was not written");

            store.Write(new JObject { ["gold"] = 250 });
            if (!File.Exists(backupPath) || !File.ReadAllBytes(backupPath).SequenceEqual(original))
                throw new Exception("Ordinary write changed the recovery backup");
            Console.WriteLine("JSON file store read/write and unreadable-file recovery passed");
        }
        finally
        {
            if (Directory.Exists(directory)) Directory.Delete(directory, recursive: true);
        }
    }
}
