# Medieval ambience

Bundled lobby loop for `MedievalAudioPlayer`:

- Path: `/audio/dark-and-darker-lobby.mp3` (filename kept for player compatibility)
- Source: **Medieval: Minstrel Dance** by RandomMind — [OpenGameArt](https://opengameart.org/content/medieval-minstrel-dance)
- License: **CC0 1.0** (public domain dedication) — not Dark and Darker OST
- Behavior: `loop` + `preload="auto"`, fade-in 0 → selected volume (default `0.35`) over **1.5s**

If the MP3 is missing at runtime, the player falls back to a Web Audio
plucked lute arpeggio (**Gm → Eb → F → Ebmaj7** @ 63 BPM) without crashing.
