using System;
using System.Text;
using Newtonsoft.Json.Linq;
namespace TinyLegion.Domain.Services
{
    public static class SaveDocument
    {
        public static JObject Parse(string json)
        {
            if(json==null||Encoding.UTF8.GetByteCount(json)>1000000)throw new ArgumentException("저장 파일은 1MB까지 불러올 수 있습니다");
            var raw=JObject.Parse(json);
            if(raw["version"]?.Type!=JTokenType.Integer||(int)raw["version"]!=1||!(raw["levels"] is JObject)||
                (raw["gold"]?.Type!=JTokenType.Integer&&raw["gold"]?.Type!=JTokenType.Float))throw new ArgumentException("저장 파일을 확인해 주세요");
            double gold=raw["gold"].Value<double>();if(double.IsNaN(gold)||double.IsInfinity(gold))throw new ArgumentException("저장 파일을 확인해 주세요");
            return raw;
        }
    }
}
