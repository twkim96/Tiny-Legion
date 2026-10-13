using System;
using TinyLegion.Domain.Services;

static class MusicPlaybackChecks
{
    public static void Run()
    {
        var state = new MusicPlaybackState();
        Expect(state.Next(false, false, true), MusicPlaybackAction.None);
        Expect(state.Next(true, false), MusicPlaybackAction.Play);
        Expect(state.Next(true, true), MusicPlaybackAction.None);
        Expect(state.Next(false, true), MusicPlaybackAction.Pause);
        Expect(state.Next(false, false), MusicPlaybackAction.None);
        Expect(state.Next(true, false), MusicPlaybackAction.Resume);
        // Muting preserves the same clip; switching tracks while hidden starts the new clip.
        Expect(state.Next(false, true), MusicPlaybackAction.Pause);
        Expect(state.Next(false, false, true), MusicPlaybackAction.None);
        Expect(state.Next(true, false), MusicPlaybackAction.Play);
        Expect(state.Next(true, false, true), MusicPlaybackAction.Play);
        Console.WriteLine("Music pause/resume and hidden track replacement passed");
    }
    static void Expect(MusicPlaybackAction actual, MusicPlaybackAction expected)
    {
        if (actual != expected) throw new Exception($"Music playback: expected {expected}, got {actual}");
    }
}
