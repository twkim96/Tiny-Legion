using System;
using System.IO;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace TinyLegion.Domain.Services
{
    public sealed class JsonFileStore
    {
        readonly object sync = new object();
        readonly string path;

        public bool RecoveryRequired { get; private set; }
        public string RecoveryBackupPath { get; private set; }

        public JsonFileStore(string path)
        {
            if (string.IsNullOrWhiteSpace(path)) throw new ArgumentException("A file path is required", nameof(path));
            this.path = Path.GetFullPath(path);
        }

        public JObject Read()
        {
            lock (sync)
            {
                byte[] bytes;
                try
                {
                    bytes = File.ReadAllBytes(path);
                }
                catch (FileNotFoundException)
                {
                    RecoveryRequired = false;
                    return null;
                }
                catch (DirectoryNotFoundException)
                {
                    RecoveryRequired = false;
                    return null;
                }
                catch (IOException)
                {
                    RecoveryRequired = true;
                    throw;
                }
                catch (UnauthorizedAccessException)
                {
                    RecoveryRequired = true;
                    throw;
                }

                if (bytes.Length == 0)
                {
                    RecoveryRequired = false;
                    return null;
                }

                try
                {
                    string json = new UTF8Encoding(false, true).GetString(bytes);
                    if (json.Length > 0 && json[0] == '\uFEFF') json = json.Substring(1);
                    JObject result = JObject.Parse(json);
                    RecoveryRequired = false;
                    return result;
                }
                catch (JsonException)
                {
                    RecoveryRequired = true;
                    throw;
                }
                catch (DecoderFallbackException)
                {
                    RecoveryRequired = true;
                    throw;
                }
            }
        }

        public void Write(JObject document, bool replaceUnreadable = false)
        {
            if (document == null) throw new ArgumentNullException(nameof(document));
            lock (sync)
            {
                if (RecoveryRequired && !replaceUnreadable)
                    throw new InvalidOperationException("기존 저장을 읽지 못했습니다. 복구 또는 초기화를 확인해 주세요.");

                byte[] bytes = new UTF8Encoding(false).GetBytes(document.ToString(Formatting.None));
                string directory = Path.GetDirectoryName(path);
                Directory.CreateDirectory(directory);
                string temporaryPath = MakeSiblingPath(directory, Path.GetFileName(path), ".tmp");
                bool ownsTemporary = false;
                try
                {
                    using (var output = new FileStream(temporaryPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                    {
                        ownsTemporary = true;
                        output.Write(bytes, 0, bytes.Length);
                        output.Flush();
                    }

                    if (File.Exists(path))
                    {
                        string backup = RecoveryRequired && replaceUnreadable
                            ? MakeSiblingPath(directory, Path.GetFileName(path), ".recovery") : null;
                        File.Replace(temporaryPath, path, backup);
                        if (backup != null) RecoveryBackupPath = backup;
                    }
                    else
                    {
                        File.Move(temporaryPath, path);
                    }
                    ownsTemporary = false;
                    RecoveryRequired = false;
                }
                finally
                {
                    if (ownsTemporary && File.Exists(temporaryPath)) File.Delete(temporaryPath);
                }
            }
        }

        static string MakeSiblingPath(string directory, string fileName, string suffix)
        {
            return Path.Combine(directory, fileName + "." + Guid.NewGuid().ToString("N") + suffix);
        }
    }
}
