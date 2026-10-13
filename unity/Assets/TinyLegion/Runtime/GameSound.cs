using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using UnityEngine;
namespace TinyLegion.Unity
{
    public sealed class GameSound : MonoBehaviour
    {
        IGameController game; AudioSource music,sfx; string track; bool unlocked;
        readonly Dictionary<string,AudioClip> clips = new Dictionary<string,AudioClip>();
        public void Initialize(IGameController game)
        {
            this.game=game;music=gameObject.AddComponent<AudioSource>();music.loop=true;music.playOnAwake=false;sfx=gameObject.AddComponent<AudioSource>();sfx.playOnAwake=false;
            var samples=new float[6615];for(int i=0;i<samples.Length;i++)samples[i]=(float)(Math.Sin(2*Math.PI*(440-190.0*i/samples.Length)*i/44100)*.08*(1.0-i/(double)samples.Length));
            var clip=AudioClip.Create("tap",samples.Length,1,44100,false);clip.SetData(samples,0);clips["tap"]=clip;game.Changed+=Sync;game.BattleEvent+=OnBattleEvent;game.BattleFinished+=OnBattleFinished;Sync();
        }
        void Update(){if(!unlocked&&(Input.GetMouseButtonDown(0)||Input.touchCount>0||Input.anyKeyDown)){unlocked=true;Sync();}}
        void Sync()
        {
            var audio=game.Account?["settings"]?["audio"] as JObject;
            var next=game.StageId==0?"journey":game.StageId%5==0?"boss":game.StageId>10?"workshop":"meadow";
            if(next!=track){track=next;music.Stop();music.clip=Resources.Load<AudioClip>("Music/"+track);}
            music.volume=(float?)audio?["musicVolume"]??.3f;sfx.volume=(float?)audio?["sfxVolume"]??.6f;
            if(unlocked&&((bool?)audio?["musicEnabled"]??true)&&Application.isFocused){if(!music.isPlaying&&music.clip)music.Play();}else music.Pause();
        }
        void OnBattleEvent(JObject evt){string type=(string)evt["type"];if(type=="summon"||type=="castle-hit")Tap();}
        void OnBattleFinished(JObject outcome){if((bool?)outcome["battleResult"]?["won"]==true)Tap();}
        public void Tap(){if(unlocked&&((bool?)game.Account?["settings"]?["audio"]?["sfxEnabled"]??true))sfx.PlayOneShot(clips["tap"]);}
        void OnApplicationFocus(bool focus){Sync();}
        void OnDestroy(){if(game!=null){game.Changed-=Sync;game.BattleEvent-=OnBattleEvent;game.BattleFinished-=OnBattleFinished;}foreach(var clip in clips.Values)Destroy(clip);}
    }
}
