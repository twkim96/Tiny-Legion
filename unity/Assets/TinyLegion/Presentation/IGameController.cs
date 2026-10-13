using System;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using TinyLegion.Domain.Data;
using TinyLegion.Domain.Combat;
namespace TinyLegion.Unity
{
    public interface IGameController
    {
        GameCatalog Catalog { get; }
        JObject Account { get; }
        BattleEngine Battle { get; }
        string Mode { get; }
        int StageId { get; }
        bool Paused { get; }
        double CannonRemaining { get; }
        bool Busy { get; }
        bool Online { get; }
        bool TestLoginAvailable { get; }
        string ConnectionStatus { get; }
        JObject Identity { get; }
        JObject ReturnIncome { get; }
        long Now { get; }
        event Action Changed;
        event Action AccountReplaced;
        event Action<string> SaveImportRequested;
        event Action<string> Notice;
        event Action<JObject> BattleFinished;
        event Action<JObject> BattleEvent;
        Task<JObject> Command(string type, JObject args = null);
        Task StartBattle(string mode, int stageId);
        Task LeaveBattle();
        void Summon(string id);
        void FireCannon();
        void TogglePause();
        void SetModalOpen(bool open);
        Task StartSession(string identity);
        Task TestLogin(string username, string password);
        Task LinkAccount();
        Task RetryConnection();
        void SignIn();
        void SetFullscreen();
        string ExportSave();
        Task ImportSave(string json);
    }
}
