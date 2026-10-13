using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using TinyLegion.Domain.Account;
using TinyLegion.Domain.Combat;
using TinyLegion.Domain.Data;
using TinyLegion.Domain.Services;
using UnityEngine;
namespace TinyLegion.Unity
{
    public sealed class GameController : MonoBehaviour, IGameController
    {
        public GameCatalog Catalog { get; private set; }
        public JObject Account { get; private set; }
        public BattleEngine Battle { get; private set; }
        public string Mode { get; private set; } = "challenge";
        public int StageId { get; private set; }
        public bool Paused { get; private set; }
        public double CannonRemaining=>cannonRemaining;
        public bool Busy { get; private set; }
        public bool Online => session != null;
        public bool TestLoginAvailable=>Online&&WebPlatform.TestLoginAvailable;
        readonly System.Threading.SemaphoreSlim localCommands=new System.Threading.SemaphoreSlim(1,1);
        public string ConnectionStatus => session?.Status ?? "local";
        public JObject Identity => session?.Identity;
        public JObject ReturnIncome { get; private set; }
        public long Now => session?.Now ?? DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        public event Action Changed;
        public event Action AccountReplaced;
        public event Action<string> SaveImportRequested;
        public event Action<string> Notice;
        public event Action<JObject> BattleFinished;
        public event Action<JObject> BattleEvent;
        public event Action<string> AudioCue;
        public event Action<string> CommandCompleted;
        AccountRules rules;
        LocalSaveStore saves;
        GameSessionClient session;
        JObject snapshot;
        string battleId;
        long startedAt;
        double accumulator, settleAt, restartAt, cannonRemaining;
        bool resultHandled, focused = true, modalOpen;
        readonly JArray actions = new JArray();
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Bootstrap()
        {
            if (FindFirstObjectByType<GameController>() == null) new GameObject("Tiny Legion").AddComponent<GameController>();
        }
        async void Awake()
        {
            try
            {
                string startupWarning=null;
                Catalog = new GameCatalog(JObject.Parse(Resources.Load<TextAsset>("Data/catalog").text));
                rules = new AccountRules(Catalog); saves = new LocalSaveStore();
                if (WebPlatform.Hosted)
                {
                    var origin = new Uri(Application.absoluteURL).GetLeftPart(UriPartial.Authority);
                    session = new GameSessionClient(new UnityGameTransport(origin), WebPlatform.Session, WebPlatform.StoreSession);
                    session.Changed += OnSessionChanged;
                    session.Failed += error => Notice?.Invoke(error.Code);
                    // Bootstrap after presentation is ready so authentication failures remain actionable.
                }
                else
                {
                    JObject saved=null;
                    try{saved=saves.Read();}catch(Exception){startupWarning="저장 파일을 읽지 못했습니다. 진행도 파일을 내보내 보관해 주세요.";}
                    Account = rules.NormalizeAccount(saved, Now);
                    ReturnIncome = rules.CollectReturnIncome(Account,Now);
                    if(startupWarning==null)try{saves.Write(Account);}catch(Exception){startupWarning="기기 내 저장을 사용할 수 없습니다. 진행도 파일을 내려받아 보관해 주세요.";}
                }
                gameObject.AddComponent<GameView>().Initialize(this);
                gameObject.AddComponent<GameSound>().Initialize(this);
                if(startupWarning!=null)Notice?.Invoke(startupWarning);
                Changed?.Invoke();
                if(Online&&!string.IsNullOrEmpty(session.Token)) {try{var envelope=await session.Bootstrap();ReturnIncome=envelope["returnIncome"] as JObject;Changed?.Invoke();}catch(SessionError error){Notice?.Invoke(error.Code);}}
            }
            catch (Exception error) { Debug.LogException(error); Notice?.Invoke(error.Message); }
        }
        void OnSessionChanged() { if (session.Account != null) Account = session.Account; Changed?.Invoke(); }
        public async Task<JObject> Command(string type, JObject args = null)
        {
            args ??= new JObject();
            try
            {
                JObject envelope;
                if (Online) envelope = await session.Command(type, args);
                else
                {
                    await localCommands.WaitAsync();
                    try
                    {
                        var next = (JObject)Account.DeepClone();
                        if(type!="settle")rules.Execute(next, "settle", new JObject(), Now);
                        var result = rules.Execute(next, type, args, Now);
                        saves.Write(next); Account = next;
                        envelope = new JObject { ["account"] = next.DeepClone(), ["result"] = result?.DeepClone(), ["serverNow"] = Now, ["revision"] = 0 };
                    }
                    finally {localCommands.Release();}
                }
                if (Online) Account = session.Account;
                if(type=="account.reset"){Battle=null;actions.Clear();restartAt=0;ReturnIncome=null;AccountReplaced?.Invoke();}
                Changed?.Invoke(); CommandCompleted?.Invoke(type); return envelope;
            }
            catch (Exception error) { Notice?.Invoke(error.Message); throw; }
        }
        public async Task StartBattle(string mode, int stageId)
        {
            if (Busy || Account == null) return;
            Busy = true; Changed?.Invoke();
            try
            {
                JObject options;
                if (Online)
                {
                    var envelope = await Command("battle.start", new JObject { ["mode"] = mode, ["stageId"] = stageId });
                    var started = (JObject)envelope["result"];
                    snapshot = (JObject)started["snapshot"]; battleId = (string)started["battleId"]; options = (JObject)started["options"];
                    if ((string)snapshot["balanceVersion"] != Catalog.BalanceVersion) throw new SessionError("battle_version_mismatch",409);
                }
                else
                {
                    options = rules.BattleOptions(Account, mode, stageId);
                    battleId = Guid.NewGuid().ToString("N");
                    snapshot = new JObject { ["stageId"] = stageId, ["balanceVersion"] = Catalog.BalanceVersion, ["levels"] = options["levels"]?.DeepClone(),
                        ["abilities"] = options["abilities"]?.DeepClone(), ["sequence"] = options["sequence"]?.DeepClone(), ["gemEquipment"] = Account["gemEquipment"]?.DeepClone(),
                        ["gemEffects"] = options["modifiers"]?.DeepClone(), ["dailyKey"] = Account["daily"]?["key"]?.DeepClone(), ["speedrunStageId"] = mode == "speedrun" ? stageId : (JToken)null };
                }
                Battle = new BattleEngine(Catalog, options); Mode = Battle.State.Mode; StageId = Battle.State.StageId;
                snapshot["duration"] = Battle.State.Duration; snapshot["mode"] = mode; snapshot["options"] = options.DeepClone(); startedAt = Now;
                actions.Clear(); accumulator = 0; cannonRemaining = 0; resultHandled = false; Paused = false; restartAt = 0;
            }
            finally { Busy = false; Changed?.Invoke(); }
        }
        public void Summon(string id)
        {
            if (Busy || Paused || modalOpen || Battle == null || Mode == "idle" || !CanAdvance) return;
            int previousEvents=Battle.State.Events.Count;
            if (Battle.Summon(id)) actions.Add(new JObject { ["step"] = (int)GameNumbers.Round(Battle.State.Time * 30), ["type"] = "summon", ["id"] = id });
            EmitBattleEvents(previousEvents);
        }
        public void FireCannon()
        {
            if (Busy || Paused || modalOpen || Battle == null || Mode == "idle" || cannonRemaining > 0 || (string)Account?["onboarding"]?["phase"] != "complete" || !CanAdvance) return;
            int previousEvents=Battle.State.Events.Count;
            if (Battle.FireCannon()) { actions.Add(new JObject { ["step"] = (int)GameNumbers.Round(Battle.State.Time * 30), ["type"] = "cannon" }); cannonRemaining = 25; AudioCue?.Invoke("summon"); }
            EmitBattleEvents(previousEvents);
        }
        void EmitBattleEvents(int from)
        {for(int i=from;i<Battle.State.Events.Count;i++)BattleEvent?.Invoke((JObject)Battle.State.Events[i]);}
        bool CanAdvance => focused && (!Online || ConnectionStatus == "connected");
        public void SetModalOpen(bool open){modalOpen=open;}
        public void TogglePause() { Paused = !Paused; Changed?.Invoke(); }
        void Update()
        {
            if (Account == null || !CanAdvance || Busy) return;
            if (Time.unscaledTimeAsDouble >= settleAt) { settleAt = Time.unscaledTimeAsDouble + 15; _ = Settle(); }
            if (Battle == null || Paused || (modalOpen&&Mode!="idle")) return;
            if (Battle.State.Finished)
            {
                if (!resultHandled) { resultHandled = true; _ = FinishBattle(); }
                if (restartAt > 0 && Time.unscaledTimeAsDouble >= restartAt) { restartAt = 0; _ = StartBattle("idle",StageId); }
                return;
            }
            double speed = Mode == "idle" ? 1 : (double?)Account["settings"]?["speed"] ?? 1;
            accumulator += Time.unscaledDeltaTime * speed;
            // Catch-up is bounded per frame, retaining the remainder; don't skip simulation steps.
            int budget = 120;
            while (accumulator >= 1.0 / 30 && budget-- > 0 && !Battle.State.Finished)
            { Battle.Step(1.0 / 30); EmitBattleEvents(0); cannonRemaining = Math.Max(0,cannonRemaining-1.0/30); accumulator -= 1.0/30; }
        }
        async Task Settle()
        {
            try { await Command("settle"); } catch (Exception) { /* Connection state owns recovery. */ }
        }
        async Task FinishBattle()
        {
            Busy = true; Changed?.Invoke();
            try
            {
                JObject result;
                if (Online) result = (JObject)(await Command("battle.finish",new JObject { ["battleId"] = battleId,["actions"] = actions.DeepClone() }))["result"];
                else
                {
                    var next=(JObject)Account.DeepClone();
                    var income=rules.Execute(next,"settle",new JObject(),Now);
                    var outcome=rules.RecordBattle(next,Battle.State.Result,snapshot,startedAt,Now);
                    if(outcome is JObject receipt)receipt["income"]=income?.DeepClone();
                    saves.Write(next);Account=next;
                    result=outcome as JObject ?? new JObject { ["battleResult"] = Battle.State.Result.DeepClone(),["rewards"] = outcome?.DeepClone() };
                }
                BattleFinished?.Invoke(result); Changed?.Invoke();
                if (Mode == "idle") restartAt = Time.unscaledTimeAsDouble + .8;
            }
            catch (Exception error) { Notice?.Invoke(error.Message); }
            finally { Busy = false; Changed?.Invoke(); }
        }
        public async Task LeaveBattle()
        {
            if (Busy) return;
            if (Online && battleId != null) await Command("battle.abandon",new JObject{["battleId"]=battleId});
            Battle=null;actions.Clear();restartAt=0;Changed?.Invoke();
        }
        public async Task StartSession(string identity)
        { if(!Online) return; var envelope=await session.Start(identity);Account=session.Account;ReturnIncome=envelope["returnIncome"] as JObject;Battle=null;AccountReplaced?.Invoke();Changed?.Invoke(); }
        public async Task TestLogin(string username,string password)
        { if(!Online) return;await session.TestLogin(username,password);Account=session.Account;Battle=null;AccountReplaced?.Invoke();Changed?.Invoke(); }
        public async Task LinkAccount() { if(Online){await session.Link();Account=session.Account;Changed?.Invoke();} }
        public async Task RetryConnection() { if(Online) await session.Retry(); }
        public void SignIn() => WebPlatform.SignIn();
        public void SetFullscreen() => WebPlatform.Fullscreen();
        public string ExportSave() => Account?.ToString(Formatting.Indented);
        public Task ImportSave(string json)
        {
            if(Online) throw new InvalidOperationException("온라인 진행도는 파일에서 복원할 수 없습니다");
            var raw=SaveDocument.Parse(json);
            var next=rules.NormalizeAccount(raw,Now);rules.CollectReturnIncome(next,Now);saves.Write(next);Account=next;Battle=null;ReturnIncome=null;AccountReplaced?.Invoke();Changed?.Invoke();return Task.CompletedTask;
        }
        public void ImportFromBrowser(string json) { try { if(Online)throw new InvalidOperationException("온라인 진행도는 파일에서 복원할 수 없습니다");SaveDocument.Parse(json);SaveImportRequested?.Invoke(json); } catch(Exception error){Notice?.Invoke(error.Message);} }
        public void ImportFailure(string message) => Notice?.Invoke(message);
        async void OnApplicationFocus(bool focus)
        {
            focused=focus;accumulator=0;
            if(focus&&Account!=null)try { if(Online&&ConnectionStatus=="connected"){var envelope=await session.Resume();ReturnIncome=envelope["returnIncome"] as JObject;Changed?.Invoke();}else if(!Online){ReturnIncome=rules.CollectReturnIncome(Account,Now);saves.Write(Account);Changed?.Invoke();} }catch(Exception error){Notice?.Invoke(error.Message);}
        }
        void OnApplicationQuit() { if(!Online&&Account!=null) saves.Write(Account); }
        void OnDestroy() { if(session!=null)session.Changed-=OnSessionChanged; }
    }
}
