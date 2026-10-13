using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using TinyLegion.Domain.Data;
using TinyLegion.Domain.Services;
if (args.Length == 0) { Console.Error.WriteLine("Usage: checks <catalog.json>"); return 2; }
var catalog = new GameCatalog(JObject.Parse(File.ReadAllText(args[0])));
if (catalog.Units.Count() != 15 || catalog.Enemies.Count() != 13) throw new Exception("Catalog roster missing");
var transport = new LostResponseTransport();
var client = new GameSessionClient(transport, clock: () => 1791900000000L);
await client.Start("guest");
var offline = new TaskCompletionSource<bool>();
client.Changed += () => { if (client.Status == "offline") offline.TrySetResult(true); };
var first = client.Command("unit.grow", new JObject { ["id"] = "sheep" });
var second = client.Command("mission.claim");
transport.ReleaseFailure.SetResult(true);
await offline.Task;
if (client.Status != "offline" || first.IsCompleted || second.IsCompleted) throw new Exception("Uncertain result did not preserve queue");
await client.Retry(); await second;
if (transport.Ids[0] != transport.Ids[1] || transport.Types[0] != "unit.grow" || transport.Types[2] != "mission.claim") throw new Exception("Retry changed ID/order");
Console.WriteLine("Catalog and lost-response request identity/order passed");
var expiredTransport=new ExpiredTransport();var expired=new GameSessionClient(expiredTransport);await expired.Start("account");
var a=expired.Command("unit.grow",new JObject{["id"]="sheep"});var b=expired.Command("mission.claim");expiredTransport.Release.SetResult(true);
try{await a;throw new Exception("Expired auth accepted mutation");}catch(SessionError error){if(error.Code!="login_required")throw;}
try{await b;throw new Exception("Expired auth forwarded subsequent command");}catch(SessionError error){if(error.Code!="login_required")throw;}
if(expired.Status!="auth-required"||expiredTransport.Calls!=1)throw new Exception("Expired auth failed to stop queue");
Console.WriteLine("Authentication expiry stops current and queued commands");
foreach(string invalid in new[]{"{\"version\":1}","{\"version\":1,\"levels\":{},\"gold\":\"100\"}"}){try{SaveDocument.Parse(invalid);throw new Exception("Incomplete import accepted");}catch(ArgumentException){}}
SaveDocument.Parse("{\"version\":1,\"levels\":{},\"gold\":100}");
Console.WriteLine("Save import rejects incomplete/nonnumeric documents");
Console.WriteLine($"Account regression checks: {TinyLegion.Tests.Account.AccountRegressionChecks.Run(catalog)}");
Console.WriteLine($"Combat regression checks: {TinyLegion.Tests.Combat.CombatRegressionChecks.Run(catalog)}");
if(args.Length>1) Console.WriteLine($"Combat parity states: {TinyLegion.Tests.Combat.CombatParityChecks.Run(catalog,JObject.Parse(File.ReadAllText(args[1])))}");
if(args.Length>2) Console.WriteLine($"Account parity cases: {TinyLegion.Tests.Account.AccountParityChecks.Run(catalog,JObject.Parse(File.ReadAllText(args[2])))}");
MusicPlaybackChecks.Run();
SaveFileReadChecks.Run();
JsonFileStoreChecks.Run();
return 0;
sealed class LostResponseTransport : IGameTransport
{
 public readonly List<string> Ids = new(); public readonly List<string> Types = new();
 public readonly TaskCompletionSource<bool> ReleaseFailure = new();
 public async Task<TransportResponse> Post(string path,JObject body,string session)
 {
  if(path.EndsWith("/command")) { Ids.Add((string)body["requestId"]);Types.Add((string)body["type"]);if(Ids.Count==1) { await ReleaseFailure.Task; throw new IOException("response lost"); } }
  return new TransportResponse(200,new JObject{["account"]=new JObject(),["revision"]=1,["session"]="token",["serverNow"]=1791900000000L,["result"]=true});
 }
}

sealed class ExpiredTransport : IGameTransport
{
 public readonly TaskCompletionSource<bool> Release=new();public int Calls;
 public async Task<TransportResponse> Post(string path,JObject body,string session)
 {
  if(path.EndsWith("/command")){Calls++;await Release.Task;return new TransportResponse(401,new JObject{["error"]="login_required"});}
  return new TransportResponse(200,new JObject{["account"]=new JObject(),["revision"]=1,["session"]="token",["serverNow"]=1791900000000L,["result"]=true});
 }
}
