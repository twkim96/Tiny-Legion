namespace TinyLegion.Domain.Services
{
    public enum MusicPlaybackAction { None, Play, Resume, Pause }

    // Preserve paused playback while settings/focus change; a new track starts at zero.
    public sealed class MusicPlaybackState
    {
        bool paused;
        public MusicPlaybackAction Next(bool audible, bool playing, bool trackChanged = false)
        {
            if (trackChanged) paused = false;
            if (!audible)
            {
                if (playing && !trackChanged) { paused = true; return MusicPlaybackAction.Pause; }
                return MusicPlaybackAction.None;
            }
            if (paused) { paused = false; return MusicPlaybackAction.Resume; }
            return trackChanged || !playing ? MusicPlaybackAction.Play : MusicPlaybackAction.None;
        }
    }
}
