import { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import '@fontsource-variable/fredoka';
import {
  CloudBot,
  DEFAULT_FACE_COLOR,
  FACE_PRESETS,
  readableInk,
  stageTint,
  type CloudBotState,
} from './index';
import './CloudBotShowcase.css';

const STATE_INFO: Record<CloudBotState, { label: string; note: string }> = {
  resting: { label: 'Resting', note: 'Calm and blinking, with the odd curious glance.' },
  happy: { label: 'Happy', note: 'Arched eyes and a little hop every now and then.' },
  excited: { label: 'Excited', note: 'Wide eyes, nonstop bouncing.' },
  love: { label: 'In love', note: 'Heart eyes that beat along with the body.' },
  wink: { label: 'Wink', note: 'One eye open, one eye smiling.' },
  surprised: { label: 'Surprised', note: 'Jumps on arrival, then holds its breath.' },
  confused: { label: 'Confused', note: 'Mismatched eyes, a head tilt and a “huh?” look around.' },
  angry: { label: 'Angry', note: 'Slanted lids, a low crouch and short bursts of shaking.' },
  sad: { label: 'Sad', note: 'Drooping lids, glassy eyes and an occasional sob.' },
  talking: { label: 'Talking', note: 'Eyes and body follow a random speech rhythm.' },
  thinking: { label: 'Thinking', note: 'Eyes up and away, with a sudden dart to the other side.' },
  suspicious: { label: 'Suspicious', note: 'Narrowed eyes and sideways glances held a beat too long.' },
  lookLeft: { label: 'Look left', note: 'The whole face turns left, the near eye foreshortens.' },
  lookRight: { label: 'Look right', note: 'The whole face turns right.' },
  scanning: { label: 'Scanning', note: 'Left, right, then back to the front. On repeat.' },
  sleepy: { label: 'Sleepy', note: 'Nods off, jerks awake, drifts down again.' },
  dizzy: { label: 'Dizzy', note: 'Eyes circle in opposite directions while it wobbles.' },
};

const GROUPS: { title: string; states: CloudBotState[] }[] = [
  { title: 'Moods', states: ['resting', 'happy', 'excited', 'love', 'wink'] },
  { title: 'Reactions', states: ['surprised', 'confused', 'angry', 'sad'] },
  { title: 'Attention', states: ['talking', 'thinking', 'suspicious'] },
  { title: 'Gaze', states: ['lookLeft', 'lookRight', 'scanning'] },
  { title: 'Low energy', states: ['sleepy', 'dizzy'] },
];
const ORDER = GROUPS.flatMap((g) => g.states);

function Switch({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: string }) {
  return (
    <label className="cbs-switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="cbs-switch__track" aria-hidden="true" />
      {children}
    </label>
  );
}

export function CloudBotShowcase() {
  const reduced = useReducedMotion() ?? false;
  const customId = useId();
  const [state, setState] = useState<CloudBotState>('resting');
  const [color, setColor] = useState<string>(DEFAULT_FACE_COLOR);
  const [follow, setFollow] = useState(true);
  const [blink, setBlink] = useState(true);
  const [glossy, setGlossy] = useState(true);
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => setState((s) => ORDER[(ORDER.indexOf(s) + 1) % ORDER.length]), 3600);
    return () => window.clearInterval(id);
  }, [auto]);

  const tint = stageTint(color);
  const isPreset = FACE_PRESETS.some((p) => p.value.toLowerCase() === color.toLowerCase());
  const info = STATE_INFO[state];

  const pick = (s: CloudBotState) => {
    setAuto(false);
    setState(s);
  };

  return (
    <section
      className="cbs"
      aria-labelledby="cbs-title"
      style={
        {
          '--page': tint.page,
          '--stage': tint.stage,
          '--stage-hi': tint.stageHi,
          '--word': tint.word,
          '--accent': color,
          '--accent-ink': readableInk(color),
        } as React.CSSProperties
      }
    >
      <div className="cbs__inner">
        <header className="cbs__head">
          <h1 id="cbs-title">CloudBot</h1>
          <p>
            A cloud mascot that emotes with its eyes alone. Pick an expression, recolor the face, or move your cursor
            and watch it follow.
          </p>
        </header>

        <div className="cbs-stage">
          <div className="cbs-stage__word" aria-hidden="true" style={{ '--chars': info.label.length } as React.CSSProperties}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={state}
                initial={reduced ? false : { opacity: 0, y: 36, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={reduced ? undefined : { opacity: 0, y: -36, filter: 'blur(10px)' }}
                transition={{ duration: reduced ? 0 : 0.28, ease: 'easeOut' }}
              >
                {info.label.toLowerCase()}
              </motion.span>
            </AnimatePresence>
          </div>

          <p className="cbs-stage__note" aria-live="polite">
            <strong>{info.label}.</strong> {info.note}
          </p>

          <CloudBot
            className="cbs-stage__bot"
            state={state}
            color={color}
            size="min(max(54cqw, 250px), 420px)"
            followPointer={follow}
            blink={blink}
            glossy={glossy}
          />

        </div>

        <div className="cbs__controls">
          <div className="cbs-states">
            {GROUPS.map((g) => (
              <div className="cbs-group" role="group" aria-label={g.title} key={g.title}>
                <h2>{g.title}</h2>
                <div className="cbs-group__row">
                  {g.states.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="cbs-btn"
                      aria-pressed={state === s}
                      onClick={() => pick(s)}
                    >
                      {STATE_INFO[s].label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <aside className="cbs-look" aria-label="Appearance">
            <div className="cbs-group" role="group" aria-label="Face color">
              <h2>Face color</h2>
              <div className="cbs-swatches">
                {FACE_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className="cbs-swatch"
                    style={{ '--c': p.value } as React.CSSProperties}
                    aria-label={p.name}
                    aria-pressed={color.toLowerCase() === p.value.toLowerCase()}
                    title={p.name}
                    onClick={() => setColor(p.value)}
                  />
                ))}
                <label className="cbs-custom" data-active={!isPreset} style={{ '--c': color } as React.CSSProperties} title="Custom color">
                  <input
                    id={customId}
                    type="color"
                    value={color}
                    aria-label="Custom face color"
                    onChange={(e) => setColor(e.target.value)}
                  />
                  <span aria-hidden="true" />
                </label>
              </div>
            </div>

            <div className="cbs-group" role="group" aria-label="Options">
              <h2>Behavior</h2>
              <div className="cbs-switches">
                <Switch checked={follow} onChange={setFollow}>Follow cursor</Switch>
                <Switch checked={blink} onChange={setBlink}>Blinking</Switch>
                <Switch checked={glossy} onChange={setGlossy}>Gloss</Switch>
                <Switch checked={auto} onChange={setAuto}>Auto-play</Switch>
              </div>
            </div>

            <pre className="cbs-code" aria-label="Usage">
              <code>{`<CloudBot\n  state="${state}"\n  color="${color.toLowerCase()}"\n/>`}</code>
            </pre>
          </aside>
        </div>
      </div>
    </section>
  );
}
