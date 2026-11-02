# Ludo sound slots

The default sounds are original Web Audio effects. No downloaded game audio or audio service is required.

To replace a sound, put your MP3, OGG or WAV file in `apps/web/public/audio/ludo/`, then set that event's `src` in `LUDO_SOUNDS` in `audio.ts`. For example: `step: { src: "/audio/ludo/step.mp3", volume: .55 }`.

| Slot | When it plays |
| --- | --- |
| roll / land / six | Dice tumble, landing, six |
| step | Each tile landing |
| unlock | Piece leaves its yard |
| capture / return | Impact and captured piece returning |
| safe | Arrival on a protected square |
| home | Piece reaches the center |
| turn | Your next turn begins |
| victory | Match finishes |
| join / leave / emote / hover / invalid | Small interface cues |

`volume` is per event; the app's saved volume and mute apply to every sound. Files preload after the first user interaction. Missing or undecodable files fall back to synthesis. Browsers require an interaction to enable audio; sounds are not queued to play late. Motion sounds follow the visible move, including on the opponent's screen.
