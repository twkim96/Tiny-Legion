using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using TinyLegion.Domain.Services;
using UnityEngine;
namespace TinyLegion.Unity
{
    public sealed class GameSound : MonoBehaviour
    {
        IGameController game;
        AudioSource music, sfx;
        string track;
        bool unlocked;
        readonly MusicPlaybackState playback = new MusicPlaybackState();
        readonly Dictionary<string, AudioClip> clips = new Dictionary<string, AudioClip>();
        static readonly Dictionary<string, string> commandCues = new Dictionary<string, string>
        {
            ["recruit.units"] = "win", ["recruit.gem"] = "win", ["mission.claim"] = "win", ["speedrun.claim"] = "win",
            ["unit.grow"] = "tap", ["unit.ability"] = "tap", ["unit.refund"] = "tap",
            ["gem.equip"] = "tap", ["gem.unequip"] = "tap", ["gem.upgrade"] = "tap", ["gem.reroll"] = "tap",
            ["idle.select"] = "tap"
        };
        bool Visible => Application.isFocused && (!game.Online || game.ConnectionStatus == "connected");
        public void Initialize(IGameController game)
        {
            this.game = game;
            music = gameObject.AddComponent<AudioSource>(); music.loop = true; music.playOnAwake = false;
            sfx = gameObject.AddComponent<AudioSource>(); sfx.playOnAwake = false;
            foreach (string cue in new[] { "tap", "summon", "win" }) clips[cue] = Resources.Load<AudioClip>("Sounds/" + cue);
            game.Changed += Sync; game.BattleEvent += OnBattleEvent; game.BattleFinished += OnBattleFinished;
            game.AudioCue += PlayCue; game.CommandCompleted += OnCommandCompleted;
            Sync();
        }
        void Update()
        {
            if (!unlocked && (Input.GetMouseButtonDown(0) || Input.touchCount > 0 || Input.anyKeyDown)) { unlocked = true; Sync(); }
        }
        void Sync()
        {
            var audio = game.Account?["settings"]?["audio"] as JObject;
            string next = (string)game.Catalog.Raw["musicByStage"]?[game.StageId.ToString()] ?? "journey";
            bool changed = next != track;
            if (changed) { track = next; music.Stop(); music.clip = Resources.Load<AudioClip>("Music/" + track); }
            music.volume = (float?)audio?["musicVolume"] ?? .3f;
            sfx.volume = (float?)audio?["sfxVolume"] ?? .6f;
            bool audible = unlocked && ((bool?)audio?["musicEnabled"] ?? true) && music.volume > 0 && Visible;
            switch (playback.Next(audible, music.isPlaying, changed))
            {
                case MusicPlaybackAction.Play: if (music.clip) music.Play(); break;
                case MusicPlaybackAction.Resume: music.UnPause(); break;
                case MusicPlaybackAction.Pause: music.Pause(); break;
            }
        }
        void OnBattleEvent(JObject evt) { if (game.Mode != "idle" && (string)evt["type"] == "summon") PlayCue("summon"); }
        void OnBattleFinished(JObject outcome) { if ((bool?)outcome["battleResult"]?["won"] == true) PlayCue("win"); }
        void OnCommandCompleted(string command) { if (commandCues.TryGetValue(command, out var cue)) PlayCue(cue); }
        void PlayCue(string cue)
        {
            if (unlocked && Visible && sfx.volume > 0 && ((bool?)game.Account?["settings"]?["audio"]?["sfxEnabled"] ?? true)
                && clips.TryGetValue(cue, out var clip) && clip) sfx.PlayOneShot(clip);
        }
        void OnApplicationFocus(bool focus) { if (game != null) Sync(); }
        void OnDestroy()
        {
            if (game == null) return;
            game.Changed -= Sync; game.BattleEvent -= OnBattleEvent; game.BattleFinished -= OnBattleFinished;
            game.AudioCue -= PlayCue; game.CommandCompleted -= OnCommandCompleted;
        }
    }
}
