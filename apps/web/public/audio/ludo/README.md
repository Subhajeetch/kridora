# Ludo sound clips

Add replacement MP3 clips in this folder, then set the matching path in `apps/web/src/games/ludo/sounds.ts` under `LUDO_SOUND_FILES`.

| Event | Suggested filename | When it plays |
| --- | --- | --- |
| Your turn | `your-turn.mp3` | Your turn begins, including an extra roll |
| Dice roll | `dice-roll.mp3` | A player rolls |
| Token step | `token-step.mp3` | A token lands on each square |
| Token unlock | `token-unlock.mp3` | A token leaves its yard |
| Token capture | `token-capture.mp3` | A rival token is sent back to its yard |
| Token home | `token-home.mp3` | A token reaches the finish |
| Win | `game-win.mp3` | The game ends with a winner |

For example, set `step: "/audio/ludo/token-step.mp3"`. Leave an event set to `null` to keep its synthesized fallback sound.
