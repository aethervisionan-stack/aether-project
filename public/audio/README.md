# Medieval ambience

Preferred lobby loop for `MedievalAudioPlayer`:

- Path: `/audio/dark-and-darker-lobby.mp3`
- Behavior: `loop` + `preload="auto"`, fade-in 0 → selected volume (default `0.35`) over **1.5s**

If this file is missing, the UI shows a discrete tip  
`Adicione dark-and-darker-lobby.mp3 em public/audio/`  
and falls back to a continuous Web Audio plucked lute arpeggio:  
**Gm → Eb → F → Ebmaj7** at **63 BPM** (no crash).
