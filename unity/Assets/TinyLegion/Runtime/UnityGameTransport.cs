using System;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using TinyLegion.Domain.Services;
using UnityEngine;
using UnityEngine.Networking;
namespace TinyLegion.Unity
{
    public sealed class UnityGameTransport : IGameTransport
    {
        readonly string origin;
        public UnityGameTransport(string origin) { this.origin = origin.TrimEnd('/'); }
        public async Task<TransportResponse> Post(string path, JObject body, string session)
        {
            using (var request = new UnityWebRequest(origin + path, "POST"))
            {
                request.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(body.ToString(Newtonsoft.Json.Formatting.None)));
                request.downloadHandler = new DownloadHandlerBuffer(); request.timeout = 15;
                request.SetRequestHeader("Content-Type", "application/json");
                if (!string.IsNullOrEmpty(session)) request.SetRequestHeader("X-Game-Session", session);
                var operation = request.SendWebRequest();
                var completion = new TaskCompletionSource<bool>();
                operation.completed += _ => completion.TrySetResult(true);
                if (operation.isDone) completion.TrySetResult(true);
                await completion.Task;
                if (request.result == UnityWebRequest.Result.ConnectionError || request.result == UnityWebRequest.Result.DataProcessingError)
                    throw new SessionError("server_result_unconfirmed", uncertain: true);
                JObject payload;
                try { payload = JObject.Parse(request.downloadHandler.text); }
                catch { throw new SessionError("invalid_server_result", (int)request.responseCode, true); }
                return new TransportResponse((int)request.responseCode, payload);
            }
        }
    }
}
