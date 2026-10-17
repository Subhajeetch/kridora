# CloudBot

An expressive cloud mascot. Eyes do the acting; the body hops, shakes, nods and turns.

```tsx
import { CloudBot } from './components/CloudBot';

<CloudBot state="angry" color="#26B7A6" size={360} />
```

Requires `framer-motion` v12+. No stylesheet, no other dependencies.

## Props

| Prop | Default | |
| --- | --- | --- |
| `state` | `'resting'` | `resting` `talking` `angry` `sad` `suspicious` `lookLeft` `lookRight` `scanning` `happy` `surprised` `sleepy` `confused` `thinking` `excited` `love` `wink` `dizzy` |
| `color` | `#26B7A6` | Face colour (hex). Highlights, shadows and rim light are derived from it. |
| `eyeColor` | tinted near-black | Override the eye colour. |
| `accentColor` | `#FF4D7D` | Heart-eye colour. |
| `size` | `360` | Width. Number = px, string = any CSS length. |
| `followPointer` | `true` | Eyes (and a bit of the body) follow the cursor. |
| `blink` | `true` | Idle blinking. |
| `glossy` | `true` | Specular highlights + eye glints. |
| `shadow` | `true` | Contact shadow. |
| `poke` | `true` | Squish on click/tap. |

Respects `prefers-reduced-motion` (poses still change; loops, hops and pointer tracking stop).

## Files

| File | Edit it when you want to... |
| --- | --- |
| `expressions.ts` | change what a state *looks like* (eye shape, lids, body pose, spring feel) |
| `behaviors.ts` | change what a state *does* over time (hops, shakes, glances, talking rhythm) |
| `colors.ts` | change the default colour, presets, or how shading is derived |
| `geometry.ts` | change the cloud outline, eye position (`EYE_ANCHOR`) or resting tilt (`REST_TILT`) |
| `BodyLayer.tsx` / `FaceLayer.tsx` | change the 3D lighting / eye rendering |
| `rig.ts`, `runner.ts` | the animation plumbing; rarely needs touching |

## Adding a state

1. Add its name to `CloudBotState` in `types.ts`.
2. Add a `make({...})` entry in `expressions.ts`.
3. (Optional) add a behaviour in `behaviors.ts`.
