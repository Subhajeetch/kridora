import { useEffect, useId, useMemo, useRef, useState, type ComponentPropsWithoutRef, type CSSProperties } from 'react';
import { animate, motion, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { BEHAVIORS } from './behaviors';
import { BodyLayer } from './BodyLayer';
import { createPalette, DEFAULT_ACCENT_COLOR, DEFAULT_FACE_COLOR } from './colors';
import { EXPRESSIONS } from './expressions';
import { FaceLayer } from './FaceLayer';
import { STAGE_H, VIEW_H, VIEW_W } from './geometry';
import { applyExpression, computeBody, computeFace, createRig, settleFx } from './rig';
import { Runner } from './runner';
import type { CloudBotState } from './types';

export type CloudBotProps = Omit<ComponentPropsWithoutRef<'div'>, 'color' | 'children'> & {
  /** Which expression to show. */
  state?: CloudBotState;
  /** Face colour. Highlights, shadows and rim light are derived from it. Hex only (#rgb / #rrggbb). */
  color?: string;
  /** Eye colour. Defaults to a near-black tinted by the face colour. */
  eyeColor?: string;
  /** Heart-eye colour (the `love` state). */
  accentColor?: string;
  /** Rendered width. A number is pixels; a string is any CSS length. Height follows. */
  size?: number | string;
  /** Eyes (and a little of the body) follow the pointer. */
  followPointer?: boolean;
  /** Idle blinking. */
  blink?: boolean;
  /** Specular highlights and eye glints. */
  glossy?: boolean;
  /** Soft contact shadow under the bot. */
  shadow?: boolean;
  /** Squish when clicked or tapped. */
  poke?: boolean;
  /** Accessible name. Defaults to a description of the current state. */
  label?: string;
};

const POINTER_SPRING = { stiffness: 110, damping: 17, mass: 0.8 };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * An expressive cloud face. Pick a `state`, and the bot springs into that
 * expression and starts its behaviour (blinking, hopping, glancing, talking...).
 *
 * Needs `framer-motion` (v12+). No stylesheet, no other dependencies.
 */
export function CloudBot({
  state = 'resting',
  color = DEFAULT_FACE_COLOR,
  eyeColor,
  accentColor = DEFAULT_ACCENT_COLOR,
  size = 360,
  followPointer = true,
  blink = true,
  glossy = true,
  shadow = true,
  poke = true,
  label,
  className,
  style,
  onPointerDown,
  ...rest
}: CloudBotProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId().replace(/:/g, '');
  const palette = useMemo(() => createPalette(color, eyeColor, accentColor), [color, eyeColor, accentColor]);
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);

  const ptrX = useSpring(0, POINTER_SPRING);
  const ptrY = useSpring(0, POINTER_SPRING);
  const [rig] = useState(() => createRig(EXPRESSIONS[state], ptrX, ptrY));

  // Derived, per-frame values. `useTransform(() => ...)` re-runs whenever any MotionValue read inside it changes.
  const body = useTransform(() => computeBody(rig));
  const face = useTransform(() => computeFace(rig));
  const x = useTransform(() => `${body.get().x}%`);
  const y = useTransform(() => `${body.get().y}%`);
  const shadowX = useTransform(() => `${body.get().x * 0.7}%`);
  const shadowScale = useTransform(() => clamp(1 + body.get().y * 0.03, 0.7, 1.25));
  const shadowOpacity = useTransform(() => clamp(0.95 + body.get().y * 0.05, 0.5, 1));
  const rotate = useTransform(() => body.get().rot);
  const scaleX = useTransform(() => body.get().sx);
  const scaleY = useTransform(() => body.get().sy);
  const rotateX = useTransform(() => body.get().rx);
  const rotateY = useTransform(() => body.get().ry);
  const opacity = useTransform(() => body.get().opacity);

  // 1. Pose + behaviour for the current state.
  useEffect(() => {
    stateRef.current = state;
    const stopPose = applyExpression(rig, EXPRESSIONS[state], reduced);
    settleFx(rig, reduced);
    const runner = new Runner();
    const behave = BEHAVIORS[state];
    if (behave && !reduced) void behave({ r: runner, rig });
    return () => {
      runner.cancel();
      stopPose();
    };
  }, [rig, state, reduced]);

  // 2. Idle hover.
  useEffect(() => {
    if (reduced) {
      rig.float.set(0);
      return;
    }
    const loop = animate(rig.float, [0, 1, 0], { duration: 3.6, ease: 'easeInOut', repeat: Infinity });
    return () => loop.stop();
  }, [rig, reduced]);

  // 3. Blinking, on its own clock so it survives state changes.
  useEffect(() => {
    if (!blink || reduced) return;
    const r = new Runner();
    void r.loop(async () => {
      await r.wait(r.rand(2.2, 5.2));
      if (!EXPRESSIONS[stateRef.current].blink) return;
      const closes = r.chance(0.18) ? 2 : 1;
      for (let i = 0; i < closes && r.alive; i++) {
        await r.to(rig.blink, 1, { duration: 0.07, ease: 'easeOut' });
        await r.to(rig.blink, 0, { duration: 0.14, ease: 'easeIn' });
        if (i < closes - 1) await r.wait(0.08);
      }
    });
    return () => {
      r.cancel();
      rig.blink.set(0);
    };
  }, [rig, blink, reduced]);

  // 4. Entrance.
  useEffect(() => {
    if (reduced) {
      rig.intro.set(1);
      return;
    }
    const pop = animate(rig.intro, 1, { type: 'spring', stiffness: 150, damping: 12 });
    return () => pop.stop();
  }, [rig, reduced]);

  // 5. Pointer tracking.
  useEffect(() => {
    const reset = () => {
      ptrX.set(0);
      ptrY.set(0);
    };
    const el = containerRef.current;
    if (!followPointer || reduced || !el) {
      reset();
      return;
    }
    const onMove = (e: PointerEvent) => {
      const b = el.getBoundingClientRect();
      const dx = (e.clientX - (b.left + b.width / 2)) / Math.max(b.width, 280);
      const dy = (e.clientY - (b.top + b.height * 0.42)) / Math.max(b.height, 220);
      ptrX.set(clamp(dx * 1.7, -1, 1));
      ptrY.set(clamp(dy * 1.7, -1, 1));
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('blur', reset);
    document.documentElement.addEventListener('pointerleave', reset);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('blur', reset);
      document.documentElement.removeEventListener('pointerleave', reset);
      reset();
    };
  }, [followPointer, reduced, ptrX, ptrY]);

  const handlePointerDown: CloudBotProps['onPointerDown'] = (e) => {
    onPointerDown?.(e);
    if (!poke || reduced) return;
    animate(rig.poke, [0, 1, -0.45, 0.18, 0], { duration: 0.62, ease: 'easeOut', times: [0, 0.18, 0.45, 0.72, 1] });
  };

  const box: CSSProperties = {
    position: 'relative',
    width: typeof size === 'number' ? `${size}px` : size,
    aspectRatio: `${VIEW_W} / ${STAGE_H}`,
    containerType: 'inline-size',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    ...style,
  };

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={label ?? `Cloud bot, feeling ${state}`}
      className={className}
      style={box}
      onPointerDown={handlePointerDown}
      {...rest}
    >
      {shadow && (
        <motion.div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '17%',
            width: '66%',
            top: '84.5%',
            height: '9.5%',
            borderRadius: '50%',
            background: `radial-gradient(closest-side, rgba(${palette.shadowRgb},0.55), rgba(${palette.shadowRgb},0))`,
            x: shadowX,
            scaleX: shadowScale,
            scaleY: shadowScale,
            opacity: shadowOpacity,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* perspective lives on the parent so the body can yaw/pitch toward its gaze */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: `${(VIEW_H / STAGE_H) * 100}%`, perspective: '240cqw' }}>
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            x,
            y,
            rotate,
            scaleX,
            scaleY,
            rotateX,
            rotateY,
            opacity,
            transformOrigin: '50% 92%',
          }}
        >
          <BodyLayer palette={palette} uid={uid} />
          <FaceLayer frame={face} palette={palette} uid={uid} glossy={glossy} />
        </motion.div>
      </div>
    </div>
  );
}
