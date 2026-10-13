using System;
using System.Linq;
using UnityEngine;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using UnityEngine.UI;
namespace TinyLegion.Unity
{
    public sealed partial class GameView
    {
        bool recoveryPresented;
        void ShowSaveRecovery()
        {
            if(recoveryPresented)return;
            recoveryPresented=true;
            modal.Show("저장 복구",p=>{
                ui.Paragraph(p,"기존 저장을 읽지 못했습니다. 진행을 멈추고 원본을 유지했습니다. 파일을 보관한 뒤 정상 저장을 불러오거나 새로 시작해 주세요.");
                ui.Button(p,"기존 파일 보관",()=>game.DownloadSave());
                ui.Button(p,"저장 파일 불러오기",()=>game.ChooseSaveImport());
                var paste=ui.Input(p,"저장 JSON 붙여넣기");
                ui.Button(p,"붙여넣은 저장 적용",()=>ConfirmImport(paste.text));
                ui.Button(p,"새로 시작",()=>Confirm("새로 시작","읽지 못한 원본을 별도 보관한 뒤 새 계정을 저장합니다.",async()=>{await game.Command("account.reset");}));
            },replace:true,required:true);
        }
        void ShowConnection()
        {
            if(shownConnection==game.ConnectionStatus)return;shownConnection=game.ConnectionStatus;
            modal.Show("온라인 연결",p=>{ui.Paragraph(p,game.ConnectionStatus=="auth-required"?"로그인이 만료되었습니다. 다시 로그인한 뒤 필요한 행동을 선택해 주세요.":game.ConnectionStatus=="replaced"?"다른 곳에서 접속하여 현재 세션이 종료되었습니다.":"서버 처리 결과를 확인하지 못했습니다. 재연결하면 같은 요청으로 결과를 확인합니다.");
                if(game.ConnectionStatus=="offline")ui.Button(p,"다시 연결",()=>Run(()=>game.RetryConnection()));
                ui.Button(p,"계정 접속",ShowLogin);
            },true);
        }
        void ShowLogin()
        {
            modal.Show("계정 접속",p=>{
                ui.Paragraph(p,"계정으로 이어서 플레이하거나 게스트로 시작할 수 있습니다.");
                ui.Button(p,"ChatGPT 계정 로그인",()=>Run(async()=>{modal.Close();await game.StartSession("account");Refresh();}),game.Online);
                ui.Button(p,"ChatGPT 로그인 페이지",()=>game.SignIn(),game.Online);
                ui.Button(p,"게스트로 시작",()=>Run(async()=>{modal.Close();await game.StartSession("guest");Refresh();}),game.Online);
                if(game.TestLoginAvailable)ui.Button(p,"테스트 로그인",ShowTestLogin);
            });
        }
        void ShowTestLogin()
        {
            modal.Show("테스트 로그인",p=>{
                var id=ui.Input(p,"아이디");var password=ui.Input(p,"비밀번호",true);
                ui.Button(p,"로그인",()=>Run(async()=>{string value=password.text;password.text="";modal.Close();await game.TestLogin(id.text,value);Refresh();}));
            });
        }
        void ShowAdmin()
        {
            modal.Show("관리자 기능",p=>{
                if((bool?)game.Identity?["isAdmin"]!=true)return;
                foreach(string c in new[]{"gold","diamonds"}){string currency=c;ui.Paragraph(p,$"{(currency=="gold"?"도토리":"다이아")} {N(game.Account[currency])}");var row=ui.Row(p);foreach(int a in new[]{1000,10000}){int amount=a;ui.Button(row,$"+{amount:N0}",()=>Run(async()=>await game.Command("admin.grant",new JObject{["currency"]=currency,["amount"]=amount})));}}
            });
        }
        void ShowSettings()
        {
            modal.Show("설정",p=>{
                if(game.Account==null){ui.Button(p,"계정 접속",ShowLogin);ui.Button(p,"다시 연결",()=>Run(()=>game.RetryConnection()));return;}
                ui.Paragraph(p,game.Online?$"온라인 · {game.ConnectionStatus}\n{(string)game.Identity?["displayName"]??(string)game.Identity?["kind"]}":"기기 내 저장");
                if(game.Online){ui.Button(p,"계정 접속",ShowLogin);if((bool?)game.Identity?["canLink"]==true)ui.Button(p,"게스트 진행도 연결",()=>Confirm("계정 연결","현재 게스트의 진행도를 로그인한 계정에 연결합니다. 기존 계정과 합산하지 않습니다.",()=>game.LinkAccount()));ui.Button(p,"다시 연결",()=>Run(()=>game.RetryConnection()));}
                ui.Button(p,"전체화면",()=>game.SetFullscreen());
                var audio=(JObject)game.Account["settings"]["audio"];
                foreach(string k in new[]{"musicEnabled","sfxEnabled"}){string key=k;ui.Toggle(p,key=="musicEnabled"?"배경 음악":"효과음",(bool?)audio[key]??true,value=>Run(async()=>await game.Command("settings",new JObject{["audio"]=new JObject{[key]=value}})));}
                foreach(string k in new[]{"musicVolume","sfxVolume"}){string key=k;ui.Paragraph(p,key=="musicVolume"?"음악 음량":"효과음 음량");float draft=(float?)audio[key]??.3f;ui.Slider(p,draft,value=>draft=value);ui.Button(p,"음량 적용",()=>Run(async()=>await game.Command("settings",new JObject{["audio"]=new JObject{[key]=draft}})));}
                var speed=ui.Row(p);ui.Button(speed,"수동 전투 1×",()=>Run(async()=>await game.Command("settings",new JObject{["speed"]=1})));ui.Button(speed,"수동 전투 2×",()=>Run(async()=>await game.Command("settings",new JObject{["speed"]=2})));ui.Paragraph(p,"방치는 항상 1×로 진행됩니다.");
                ui.Button(p,"숨긴 방치 결과 모두 복원",()=>Run(async()=>await game.Command("idle.popup.reset")));
                ui.Button(p,game.Online?"진행도 기록 내려받기":"저장 파일 내려받기",()=>game.DownloadSave());
                if(!game.Online){ui.Button(p,"저장 파일 불러오기",()=>game.ChooseSaveImport());var paste=ui.Input(p,"저장 JSON 붙여넣기");ui.Button(p,"붙여넣은 저장 적용",()=>Confirm("저장 불러오기","현재 진행도를 파일의 내용으로 교체합니다.",()=>game.ImportSave(paste.text)));}
                ui.Button(p,"계정 초기화",()=>Confirm("계정 초기화",game.Online?"현재 게임 계정을 새로 시작합니다. 내려받은 기록 파일로 복원할 수 없습니다.":"현재 계정을 새로 시작합니다. 미리 내려받은 저장 파일로 복원할 수 있습니다.",async()=>{await game.LeaveBattle();await game.Command("account.reset");shownGuide=null;ResumeGuide();}));
            });
        }
    }
}
