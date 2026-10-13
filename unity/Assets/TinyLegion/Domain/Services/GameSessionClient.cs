using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
namespace TinyLegion.Domain.Services
{
    public interface IGameTransport
    {
        Task<TransportResponse> Post(string path, JObject body, string session);
    }
    public sealed class TransportResponse
    {
        public int Status { get; }
        public JObject Body { get; }
        public TransportResponse(int status, JObject body) { Status = status; Body = body; }
    }
    public sealed class SessionError : Exception
    {
        public string Code { get; }
        public int Status { get; }
        public bool Uncertain { get; }
        public SessionError(string code, int status = 0, bool uncertain = false) : base(code)
        { Code = code; Status = status; Uncertain = uncertain; }
    }
    // A lost response retains the exact request and blocks subsequent mutations.
    public sealed class GameSessionClient
    {
        sealed class Pending
        {
            public string Path;
            public JObject Body;
            public int Epoch;
            public TaskCompletionSource<JObject> Completion = new TaskCompletionSource<JObject>();
        }
        readonly IGameTransport transport;
        readonly Queue<Pending> queue = new Queue<Pending>();
        readonly Func<long> clock;
        readonly Action<string> saveSession;
        int epoch;
        bool running;
        Func<Task<JObject>> retryEstablishment;
        long receivedAt, serverNow;
        public string Token { get; private set; }
        public string Status { get; private set; } = "idle";
        public JObject Account { get; private set; }
        public JObject Identity { get; private set; }
        public long Revision { get; private set; }
        public long Now => serverNow == 0 ? clock() : serverNow + clock() - receivedAt;
        public event Action Changed;
        public event Action<SessionError> Failed;
        public GameSessionClient(IGameTransport transport, string token = null, Action<string> saveSession = null, Func<long> clock = null)
        {
            this.transport = transport; Token = token; this.saveSession = saveSession ?? (_ => { });
            this.clock = clock ?? (() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        }
        void SetStatus(string value) { Status = value; Changed?.Invoke(); }
        void RejectQueue(SessionError error)
        {
            while (queue.Count > 0) queue.Dequeue().Completion.TrySetException(error);
        }
        public Task<JObject> Bootstrap() => Establish(Token == null ? "/api/game/session/start" : "/api/game/session/resume", new JObject(), Token);
        public Task<JObject> Start(string identity)
        {
            if (identity != "guest" && identity != "account") throw new ArgumentException(nameof(identity));
            return Establish("/api/game/session/start", new JObject { ["identity"] = identity }, null);
        }
        public Task<JObject> TestLogin(string username, string password) => Establish("/api/game/test/login", new JObject { ["username"] = username, ["password"] = password }, null);
        async Task<JObject> Establish(string path, JObject body, string token)
        {
            int serial = ++epoch;
            string previousStatus=Status;
            retryEstablishment=null;
            RejectQueue(new SessionError("session_replaced", 409));
            SetStatus("connecting");
            try
            {
                var result = await Receive(path, body, token);
                if (serial != epoch) throw new SessionError("session_replaced", 409);
                Token = (string)result["session"]; saveSession(Token);
                Accept(result); retryEstablishment=null; SetStatus("connected"); return result;
            }
            catch (SessionError error)
            {
                if (serial == epoch) {
                    if(path.EndsWith("/test/login",StringComparison.Ordinal)&&!error.Uncertain) SetStatus(previousStatus);
                    else { if(error.Uncertain) retryEstablishment=()=>Establish(path,(JObject)body.DeepClone(),token); SetStatus(IsAuth(error) ? "auth-required" : error.Code == "session_replaced" ? "replaced" : "offline"); }
                    Failed?.Invoke(error);
                }
                throw;
            }
        }
        public Task<JObject> Command(string type, JObject args = null)
        {
            return Enqueue("/api/game/command", new JObject { ["requestId"] = Guid.NewGuid().ToString("N"), ["type"] = type, ["args"] = args?.DeepClone() ?? new JObject() });
        }
        public Task<JObject> Resume() => Enqueue("/api/game/session/resume", new JObject());
        public Task<JObject> Link() => Enqueue("/api/game/account/link", new JObject());
        Task<JObject> Enqueue(string path, JObject body)
        {
            if (Status != "connected") return Task.FromException<JObject>(new SessionError("session_unavailable"));
            var pending = new Pending { Path = path, Body = body, Epoch = epoch };
            queue.Enqueue(pending); _ = Pump(); return pending.Completion.Task;
        }
        public Task<JObject> Retry()
        {
            if (Status != "offline") return Task.FromResult<JObject>(null);
            if(retryEstablishment!=null){var retry=retryEstablishment;retryEstablishment=null;return retry();}
            if (queue.Count == 0) return Bootstrap();
            var head = queue.Peek(); SetStatus("retrying"); _ = Pump(); return head.Completion.Task;
        }
        static bool IsAuth(SessionError error) => (error.Status == 401 && error.Code == "login_required") || (error.Status == 403 && error.Code == "test_login_disabled");
        async Task<JObject> Receive(string path, JObject body, string token)
        {
            TransportResponse response;
            try { response = await transport.Post(path, (JObject)body.DeepClone(), token); }
            catch (SessionError) { throw; }
            catch { throw new SessionError("server_result_unconfirmed", uncertain: true); }
            var payload = response.Body;
            if (response.Status < 200 || response.Status >= 300)
                throw new SessionError((string)payload?["error"] ?? "invalid_server_result", response.Status, response.Status >= 500 || payload?["error"]?.Type != JTokenType.String);
            bool sessionResponse = path.Contains("/session/") || path.EndsWith("/test/login", StringComparison.Ordinal);
            if (!(payload?["account"] is JObject) || payload["revision"]?.Type != JTokenType.Integer || (long)payload["revision"] < 0 ||
                (sessionResponse && string.IsNullOrEmpty((string)payload["session"])) || (path.EndsWith("/command", StringComparison.Ordinal) && !payload.ContainsKey("result")))
                throw new SessionError("invalid_server_result", uncertain: true);
            return payload;
        }
        void Accept(JObject payload)
        {
            Account = (JObject)payload["account"].DeepClone(); Revision = (long)payload["revision"];
            Identity = payload["identity"] as JObject;
            var now = payload["serverNow"];
            if (now?.Type == JTokenType.Integer || now?.Type == JTokenType.Float)
            { serverNow = (long)((double)now < 1e12 ? (double)now * 1000 : (double)now); receivedAt = clock(); }
            else if (DateTimeOffset.TryParse((string)now, out var parsed)) { serverNow = parsed.ToUnixTimeMilliseconds(); receivedAt = clock(); }
        }
        async Task Pump()
        {
            if (running || (Status != "connected" && Status != "retrying")) return;
            running = true;
            try
            {
                while (queue.Count > 0 && (Status == "connected" || Status == "retrying"))
                {
                    var item = queue.Peek();
                    try
                    {
                        var payload = await Receive(item.Path, item.Body, Token);
                        if (item.Epoch != epoch) continue;
                        Accept(payload); queue.Dequeue(); item.Completion.TrySetResult(payload); SetStatus("connected");
                    }
                    catch (SessionError error)
                    {
                        if (item.Epoch != epoch) continue;
                        if (error.Code == "session_replaced") { epoch++; RejectQueue(error); SetStatus("replaced"); }
                        else if (IsAuth(error) && item.Path != "/api/game/account/link") { RejectQueue(error); SetStatus("auth-required"); }
                        else if (error.Uncertain) SetStatus("offline");
                        else { queue.Dequeue(); item.Completion.TrySetException(error); SetStatus("connected"); }
                        Failed?.Invoke(error);
                    }
                }
            }
            finally { running = false; if (queue.Count > 0 && Status == "connected") _ = Pump(); }
        }
    }
}
