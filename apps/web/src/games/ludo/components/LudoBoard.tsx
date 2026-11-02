import { LUDO_HOME_STEP, isLudoSafeSquare, type LudoColor, type LudoGameState } from "@kridora/shared";
import { memo, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { AudioSettings } from "@/lib/audio-settings";
import { ludoAudio } from "../audio";
import { COLOR_ORDER, SEAT_DEFINITIONS, STATIC_BOARD_CELLS } from "../constants";
import { boardTurns, CAPTURE_MS, HOP_MS, LAUNCH_MS, rotateCoord, tokenCoord, tokenLayout, tokenRoute, tokenTransform } from "../motion";
import styles from "../table.module.css";

interface LudoBoardProps {
  state: LudoGameState;
  userId: string;
  onMoveToken: (index: number) => void;
  audioSettings?: AudioSettings;
  disabled?: boolean;
  reducedMotion?: boolean;
  onAnimationComplete?: () => void;
}

const Star = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.3.9-4.55 4.4 1.1 6.3L12 17.3l-5.65 3 1.1-6.3L2.9 9.6l6.3-.9Z" /></svg>;

const BoardSurface = memo(function BoardSurface({ turns }: { turns: number }) {
  return <div className={styles.boardGrid} style={{ transform: `rotate(${turns * 90}deg)` }} aria-hidden="true">
    {COLOR_ORDER.map((color) => {
      const seat = SEAT_DEFINITIONS[color];
      return <div key={color} className={styles.yard} style={{
        gridRow: seat.id < 2 ? "1 / 7" : "10 / 16",
        gridColumn: seat.id === 0 || seat.id === 3 ? "1 / 7" : "10 / 16",
        "--seat-color": seat.boardHex,
      } as CSSProperties}>
        <div className={styles.yardInset} />
        {seat.yardCoords.map(([r, c], index) => <span key={index} className={styles.socket} style={{
          top: `${((r % 9) / 6) * 100}%`, left: `${((c % 9) / 6) * 100}%`,
        }} />)}
      </div>;
    })}
    {STATIC_BOARD_CELLS.map(cell => <div key={cell.key} className={`${styles.cell} ${cell.kind === "star" ? styles.safeCell : ""}`} style={{
      gridRow: cell.row + 1, gridColumn: cell.col + 1,
      backgroundColor: cell.kind === "star" ? "#eef3f7" : cell.bg,
      color: cell.kind === "start" ? "#ffffff" : "#617489",
    }}>
      {(cell.kind === "star" || cell.kind === "start") && <Star />}
      {cell.kind === "arrow" && <svg viewBox="0 0 24 24" style={{ transform: `rotate(${cell.arrowRot}deg)`, color: cell.arrowHex }} aria-hidden="true"><path d="M5 10h8V6l6 6-6 6v-4H5Z" fill="currentColor" stroke="none" /></svg>}
    </div>)}
    <svg className={styles.goal} viewBox="0 0 100 100">
      <path d="M0 0 50 50 0 100Z" fill={SEAT_DEFINITIONS.coral.boardHex} />
      <path d="M0 0 100 0 50 50Z" fill={SEAT_DEFINITIONS.mint.boardHex} />
      <path d="M100 0 100 100 50 50Z" fill={SEAT_DEFINITIONS.sunshine.boardHex} />
      <path d="M0 100 100 100 50 50Z" fill={SEAT_DEFINITIONS.sky.boardHex} />
      <path d="m0 0 100 100M0 100 100 0" fill="none" stroke="#163149" strokeOpacity=".4" strokeWidth=".8" />
      <path d="m50 40 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="#fff" fillOpacity=".9" />
    </svg>
  </div>;
});

function Pawn({ color, gradientId }: { color: LudoColor; gradientId: string }) {
  const seat = SEAT_DEFINITIONS[color];
  return <svg viewBox="0 0 64 72" aria-hidden="true" className={styles.pawn}>
    <defs><radialGradient id={gradientId} cx="30%" cy="22%" r="80%">
      <stop offset="0" stopColor={seat.pawnLight} /><stop offset=".48" stopColor={seat.pawnMid} /><stop offset="1" stopColor={seat.pawnDark} />
    </radialGradient></defs>
    <ellipse cx="32" cy="63" rx="18" ry="4" fill="#10233b" opacity=".24" />
    <ellipse cx="32" cy="57" rx="17" ry="7" fill={seat.pawnDark} stroke="#203147" strokeWidth="2" />
    <path d="M17 52c1-12 8-17 9-28-5-3-5-15 6-15s11 12 6 15c1 11 8 16 9 28 0 9-30 9-30 0Z" fill={`url(#${gradientId})`} stroke="#253548" strokeWidth="2.3" />
    <path d="M23 49c0-8 5-14 5-20" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="3" strokeLinecap="round" />
    <ellipse cx="29" cy="16" rx="4" ry="2.5" fill="#fff" opacity=".85" transform="rotate(-25 29 16)" />
    <path d="M21 54q11 5 22 0" fill="none" stroke={seat.pawnLight} strokeWidth="2" />
  </svg>;
}

/** Position, travel bounce and selectable pulse have separate transform layers. */
export function LudoBoard({ state, userId, onMoveToken, audioSettings, disabled = false, reducedMotion = false, onAnimationComplete }: LudoBoardProps) {
  const local = state.players.find(p => p.userId === userId);
  const turns = boardTurns(local?.color);
  const reduced = reducedMotion;
  const uid = useId().replace(/:/g, "");
  const boardRef = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLButtonElement>());
  const previous = useRef<{ players: LudoGameState["players"]; turns: number } | null>(null);
  const running = useRef<Animation[]>([]);
  const timers = useRef<number[]>([]);
  const generation = useRef(0);
  const latest = useRef({ audioSettings, onAnimationComplete });
  useLayoutEffect(() => { latest.current = { audioSettings, onAnimationComplete }; });
  const [moving, setMoving] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const drag = useRef<{ node: HTMLButtonElement; x: number; y: number; moved: boolean; index: number } | null>(null);
  const suppressClick = useRef(false);
  const layout = tokenLayout(state.players, turns);
  const active = state.players[state.currentPlayerIndex];
  const canChoose = !disabled && !moving && !state.winnerId && active?.userId === userId && state.dice !== null;
  const selectable = canChoose ? state.movableTokens : [];

  useLayoutEffect(() => {
    const layout = tokenLayout(state.players, turns);
    const prior = previous.current;
    previous.current = { players: state.players, turns };
    if (!prior || prior.turns !== turns) { latest.current.onAnimationComplete?.(); return; }
    const oldLayout = tokenLayout(prior.players, turns);
    const changes = state.players.flatMap(p => p.tokens.flatMap((step, index) => {
      const from = prior.players.find(old => old.userId === p.userId)?.tokens[index];
      return from !== undefined && from !== step ? [{ p, index, from, to: step, id: `${p.userId}:${index}` }] : [];
    }));
    if (!changes.length) return;
    const seq = ++generation.current;
    running.current.forEach(a => a.cancel());
    timers.current.forEach(window.clearTimeout);
    running.current = []; timers.current = [];
    setMoving(true);
    const schedule = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
    const forwards = changes.filter(c => c.to > c.from);
    const durationFor = (from: number, to: number) => reduced ? 80 : from < 0 ? LAUNCH_MS : (to - from) * HOP_MS;
    const arrival = Math.max(0, ...forwards.map(c => durationFor(c.from, c.to)));
    const captures = changes.some(c => c.to < 0);
    if (captures) schedule(() => { ludoAudio.captureHit(latest.current.audioSettings); ludoAudio.returnZip(latest.current.audioSettings); }, arrival);

    for (const change of changes) {
      const { p, from, to, index, id } = change;
      const node = nodes.current.get(id);
      const start = oldLayout.get(id);
      const end = layout.get(id);
      if (!node || !start || !end) continue;
      const returning = to < 0;
      const launching = from < 0;
      const duration = returning ? (reduced ? 80 : CAPTURE_MS) : durationFor(from, to);
      const delay = returning ? arrival : 0;
      let route = tokenRoute(p.color, index, from, to).map(c => rotateCoord(c, turns));
      if (reduced) route = [start.coord, end.coord];
      route[0] = start.coord;
      route[route.length - 1] = end.coord;
      const frames: Keyframe[] = [{ transform: tokenTransform(start.coord, start.scale), offset: 0 }];
      for (let i = 1; i < route.length; i++) {
        const last = i === route.length - 1;
        const t = i / (route.length - 1);
        frames.push({ transform: tokenTransform(route[i]!, last ? end.scale : 1), offset: returning || launching || reduced ? t : (i - .15) / (route.length - 1), easing: "ease-out" });
        if (!returning && !launching && !reduced) frames.push({ transform: tokenTransform(route[i]!, last ? end.scale : 1), offset: t });
      }
      node.style.zIndex = returning ? "12" : "14";
      const travel = node.animate(frames, { duration, delay, easing: returning || launching ? "cubic-bezier(.2,.65,.3,1)" : "linear", fill: "backwards" });
      running.current.push(travel);
      const visual = node.querySelector<HTMLElement>("[data-flight]");
      if (visual && !reduced) {
        const bounce = visual.animate(launching || returning ? [
          { transform: "scale(1)" }, { transform: "translateY(-18%) scale(1.08)", offset: .5 }, { transform: "scale(1)" },
        ] : [
          { transform: "translateY(0) scale(1)" },
          { transform: "translateY(-22%) scale(.94,1.06)", offset: .38 },
          { transform: "translateY(0) scale(1.07,.94)", offset: .82 },
          { transform: "translateY(0) scale(1)", offset: 1 },
        ], { duration: launching || returning ? duration : HOP_MS, delay, iterations: launching || returning ? 1 : to - from, fill: "backwards" });
        running.current.push(bounce);
      }
      if (launching) ludoAudio.unlockBase(latest.current.audioSettings);
      if (!returning) {
        if (!reduced && !launching) for (let i = 1; i <= to - from; i++) schedule(() => ludoAudio.hop(i, latest.current.audioSettings), i * HOP_MS - 20);
        schedule(() => {
          if (to === LUDO_HOME_STEP) ludoAudio.homeFinish(latest.current.audioSettings);
          else if (!captures && isLudoSafeSquare(p.color, to)) ludoAudio.safeZone(latest.current.audioSettings);
          if (state.winnerId) ludoAudio.victory(latest.current.audioSettings);
        }, duration);
      }
    }
    // Existing occupants gently make room for the arriving piece instead of snapping.
    for (const [id, end] of layout) {
      if (changes.some(c => c.id === id)) continue;
      const start = oldLayout.get(id), node = nodes.current.get(id);
      if (start && node && tokenTransform(start.coord, start.scale) !== tokenTransform(end.coord, end.scale)) {
        running.current.push(node.animate([
          { transform: tokenTransform(start.coord, start.scale) }, { transform: tokenTransform(end.coord, end.scale) },
        ], { duration: reduced ? 80 : 140, delay: Math.max(0, arrival - 140), easing: "ease-out", fill: "backwards" }));
      }
    }
    void Promise.all(running.current.map(a => a.finished.catch(() => {}))).then(() => {
      if (generation.current !== seq) return;
      nodes.current.forEach(node => { node.style.zIndex = ""; });
      setMoving(false);
      latest.current.onAnimationComplete?.();
    });
  }, [state.players, state.winnerId, turns, reduced]);

  useEffect(() => () => {
    generation.current++;
    running.current.forEach(a => a.cancel());
    timers.current.forEach(window.clearTimeout);
  }, []);

  const previewIndex = canChoose && hovered !== null && selectable.includes(hovered) ? hovered : null;
  const destination = previewIndex !== null && local && state.dice !== null
    ? rotateCoord(tokenCoord(local.color, previewIndex, local.tokens[previewIndex]! < 0 ? 0 : local.tokens[previewIndex]! + state.dice), turns) : null;

  return <div className={styles.boardFrame} ref={boardRef} role="group" aria-label="Ludo board with all four houses">
    <BoardSurface turns={turns} />
    <div className={styles.tokensLayer}>
      {destination && <span aria-hidden="true" className={styles.destination} style={{ top: `${(destination[0] - .5) / 15 * 100}%`, left: `${(destination[1] - .5) / 15 * 100}%` }} />}
      {state.players.flatMap(p => p.tokens.map((step, index) => {
        const id = `${p.userId}:${index}`;
        const pos = layout.get(id)!;
        const playable = p.userId === userId && selectable.includes(index);
        return <button key={id} type="button" ref={node => { if (node) nodes.current.set(id, node); else nodes.current.delete(id); }}
          className={`${styles.token} ${playable ? styles.playable : ""}`} data-token={id} data-step={step} aria-disabled={!playable} tabIndex={playable ? 0 : -1}
          aria-label={`${p.name}'s piece ${index + 1}${step === LUDO_HOME_STEP ? ", home" : playable ? ", available to move" : ""}`}
          style={{ transform: tokenTransform(pos.coord, pos.scale), "--piece-color": SEAT_DEFINITIONS[p.color].boardHex } as CSSProperties}
          onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } if (playable) { setHovered(null); onMoveToken(index); } }}
          onPointerEnter={() => { if (playable) setHovered(index); }} onPointerLeave={() => { if (!drag.current) setHovered(null); }}
          onFocus={() => { if (playable) setHovered(index); }} onBlur={() => setHovered(null)}
          onPointerDown={e => { if (!playable || e.button !== 0) return; suppressClick.current = false; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { node: e.currentTarget, x: e.clientX, y: e.clientY, moved: false, index }; setHovered(index); }}
          onPointerMove={e => {
            const d = drag.current; if (!d || d.node !== e.currentTarget) return;
            const dx = e.clientX - d.x, dy = e.clientY - d.y;
            if (Math.hypot(dx, dy) > 6) d.moved = true;
            if (d.moved) { const el = d.node.querySelector<HTMLElement>("[data-drag]"); if (el) el.style.transform = `translate(${dx / pos.scale}px,${dy / pos.scale}px)`; d.node.style.zIndex = "20"; }
          }}
          onPointerUp={e => {
            const d = drag.current; if (!d) return;
            drag.current = null; d.node.style.zIndex = "";
            const el = d.node.querySelector<HTMLElement>("[data-drag]"); if (el) el.style.transform = "";
            if (d.moved) {
              suppressClick.current = true;
              const rect = boardRef.current?.getBoundingClientRect();
              if (rect && destination && Math.hypot((e.clientX - rect.left) / rect.width * 15 - destination[1], (e.clientY - rect.top) / rect.height * 15 - destination[0]) < 1) onMoveToken(d.index);
            }
            setHovered(null);
          }}
          onPointerCancel={() => { const d = drag.current; if (d) { const el = d.node.querySelector<HTMLElement>("[data-drag]"); if (el) el.style.transform = ""; d.node.style.zIndex = ""; } drag.current = null; setHovered(null); }}
        ><span data-drag className={styles.tokenDrag}><span data-flight className={styles.tokenFlight}><span className={styles.tokenPulse}>
          {playable && <span className={styles.selectionRing} />}<Pawn color={p.color} gradientId={`${uid}-${p.color}-${index}`} />
        </span></span></span></button>;
      }))}
    </div>
  </div>;
}
