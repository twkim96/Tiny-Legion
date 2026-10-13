using System;
using System.IO;
using System.Text;
using Newtonsoft.Json.Linq;
namespace TinyLegion.Domain.Services
{
    public static class SaveDocument
    {
        public const int MaxByteCount = 1000000;
        public static string ReadUtf8(Stream source)
        {
            if(source==null)throw new ArgumentNullException(nameof(source));
            if(source.CanSeek&&source.Length-source.Position>MaxByteCount)throw new ArgumentException("저장 파일은 1MB까지 불러올 수 있습니다");
            using var content=new MemoryStream();
            var buffer=new byte[8192];
            int read;
            while((read=source.Read(buffer,0,buffer.Length))>0)
            {
                if(content.Length+read>MaxByteCount)throw new ArgumentException("저장 파일은 1MB까지 불러올 수 있습니다");
                content.Write(buffer,0,read);
            }
            try
            {
                var json=new UTF8Encoding(false,true).GetString(content.GetBuffer(),0,(int)content.Length);
                return json.Length>0&&json[0]=='\uFEFF'?json.Substring(1):json;
            }
            catch(DecoderFallbackException) { throw new ArgumentException("UTF-8 JSON 저장 파일을 선택해 주세요"); }
        }
        public static JObject Parse(string json)
        {
            if(json==null||Encoding.UTF8.GetByteCount(json)>MaxByteCount)throw new ArgumentException("저장 파일은 1MB까지 불러올 수 있습니다");
            var raw=JObject.Parse(json);
            if(raw["version"]?.Type!=JTokenType.Integer||(int)raw["version"]!=1||!(raw["levels"] is JObject)||
                (raw["gold"]?.Type!=JTokenType.Integer&&raw["gold"]?.Type!=JTokenType.Float))throw new ArgumentException("저장 파일을 확인해 주세요");
            double gold=raw["gold"].Value<double>();if(double.IsNaN(gold)||double.IsInfinity(gold))throw new ArgumentException("저장 파일을 확인해 주세요");
            return raw;
        }
    }
}
