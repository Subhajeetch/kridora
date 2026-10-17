import { animate, motionValue, type MotionValue, type ValueAnimationTransition } from 'framer-motion';
import { curveD, eyeCurve, EYE_ANCHOR, glintD, lidPoints, LOOK_REACH } from './geometry';
import type { BodyParams, CtlParams, EyeParams, Expression, LookParams } from './types';

/**
 * The rig is the bot's nervous system: a bag of MotionValues in three layers.
 *
 *  1. EXPRESSION layer (left/right/body/look/ctl): spring-tweened to the pose of the current state.
 *  2. FX layer (fx): additive/multiplicative offsets driven by behaviours (hops, shakes, glances).
 *     Reset smoothly on every state change.
 *  3. SYSTEM layer (blink, float, poke, phase, intro, pointer): independent loops and inputs.
 *
 * `computeBody` / `computeFace` flatten all three layers into plain numbers each frame.
 */

type MVs<T extends object> = { [K in keyof T]: MotionValue<number> };

const makeMVs = <T extends { [K in keyof T]: number }>(init: T): MVs<T> => {
  const out = {} as MVs<T>;
  (Object.keys(init) as (keyof T)[]).forEach((k) => {
    out[k] = motionValue<number>(init[k]);
  });
  return out;
};

export type FxValues = {
  talk: number; // 0..1 speech envelope
  lid: number; // added to every eye's lid
  eyeScale: number; // multiplies both eyes
  orbit: number; // radius of circling eyes (dizzy)
  lookX: number;
  lookY: number;
  bodyX: number;
  bodyY: number;
  bodyRot: number;
  bodySx: number;
  bodySy: number;
  beat: number; // heart pulse multiplier
};

export const FX_DEFAULTS: FxValues = {
  talk: 0, lid: 0, eyeScale: 1, orbit: 0, lookX: 0, lookY: 0,
  bodyX: 0, bodyY: 0, bodyRot: 0, bodySx: 1, bodySy: 1, beat: 1,
};

export type Rig = {
  left: MVs<EyeParams>;
  right: MVs<EyeParams>;
  body: MVs<BodyParams>;
  look: MVs<LookParams>;
  ctl: MVs<CtlParams>;
  fx: MVs<FxValues>;
  blink: MotionValue<number>;
  phase: MotionValue<number>;
  float: MotionValue<number>;
  poke: MotionValue<number>;
  intro: MotionValue<number>;
  ptrX: MotionValue<number>;
  ptrY: MotionValue<number>;
};

export function createRig(expr: Expression, ptrX: MotionValue<number>, ptrY: MotionValue<number>): Rig {
  return {
    left: makeMVs(expr.left),
    right: makeMVs(expr.right),
    body: makeMVs(expr.body),
    look: makeMVs(expr.look),
    ctl: makeMVs(expr.ctl),
    fx: makeMVs(FX_DEFAULTS),
    blink: motionValue(0),
    phase: motionValue(0),
    float: motionValue(0),
    poke: motionValue(0),
    intro: motionValue(0),
    ptrX,
    ptrY,
  };
}

const keys = <T extends object>(o: T) => Object.keys(o) as (keyof T)[];

/** Spring every expression-layer value toward `expr`. Returns a function that stops the tweens. */
export function applyExpression(rig: Rig, expr: Expression, reduced: boolean): () => void {
  const transition: ValueAnimationTransition<number> = reduced
    ? { type: 'tween', duration: 0.2, ease: 'easeOut' }
    : { type: 'spring', ...expr.spring };
  const running: { stop(): void }[] = [];
  const go = (mv: MotionValue<number>, to: number) => running.push(animate(mv, to, transition));

  keys(expr.left).forEach((k) => go(rig.left[k], expr.left[k]));
  keys(expr.right).forEach((k) => go(rig.right[k], expr.right[k]));
  keys(expr.body).forEach((k) => go(rig.body[k], expr.body[k]));
  keys(expr.look).forEach((k) => go(rig.look[k], expr.look[k]));
  keys(expr.ctl).forEach((k) => go(rig.ctl[k], expr.ctl[k]));

  return () => running.forEach((c) => c.stop());
}

/** Ease every behaviour offset back to neutral (called on each state change). */
export function settleFx(rig: Rig, reduced: boolean): void {
  const t: ValueAnimationTransition<number> = reduced
    ? { type: 'tween', duration: 0.15 }
    : { type: 'spring', stiffness: 180, damping: 22 };
  keys(FX_DEFAULTS).forEach((k) => animate(rig.fx[k], FX_DEFAULTS[k], t));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Combined gaze: expression + behaviour + pointer. */
export function readLook(rig: Rig): { x: number; y: number } {
  const follow = rig.ctl.follow.get();
  return {
    x: clamp(rig.look.x.get() + rig.fx.lookX.get() + rig.ptrX.get() * follow, -1.4, 1.4),
    y: clamp(rig.look.y.get() + rig.fx.lookY.get() + rig.ptrY.get() * follow, -1.4, 1.4),
  };
}

export type BodyFrame = { x: number; y: number; rot: number; sx: number; sy: number; rx: number; ry: number; opacity: number };

export function computeBody(rig: Rig): BodyFrame {
  const { body, fx, ctl } = rig;
  const look = readLook(rig);
  const talk = fx.talk.get();
  const bob = rig.float.get() * ctl.float.get();
  const poke = rig.poke.get();
  const intro = rig.intro.get();
  const grow = 0.55 + 0.45 * intro;

  return {
    x: body.x.get() + fx.bodyX.get() + look.x * 1.4,
    y: body.y.get() + fx.bodyY.get() - bob * 2.4 - talk * 1.3 + look.y * 0.6,
    rot: body.rot.get() + fx.bodyRot.get() + look.x * 1.8,
    sx: body.sx.get() * fx.bodySx.get() * (1 - bob * 0.008) * (1 + talk * 0.03) * (1 + poke * 0.1) * grow,
    sy: body.sy.get() * fx.bodySy.get() * (1 + bob * 0.012) * (1 + talk * 0.04) * (1 - poke * 0.14) * grow,
    ry: look.x * 16, // yaw: the whole cloud turns toward where it looks
    rx: -look.y * 11,
    opacity: clamp(intro * 3, 0, 1),
  };
}

export type EyeFrame = {
  x: number; y: number; sx: number; sy: number;
  d: string; thick: number;
  glint: string; glintWidth: number; glintOpacity: number;
  lid: string;
  pill: number; // opacity of the pill (fades out as it becomes a heart)
  heart: number; // heart scale (0 = hidden)
  heartOpacity: number;
};

export type FaceFrame = { face: [number, number]; gloss: [number, number]; left: EyeFrame; right: EyeFrame };

function computeEye(rig: Rig, side: 'left' | 'right', look: { x: number; y: number }): EyeFrame {
  const p = side === 'left' ? rig.left : rig.right;
  const { fx } = rig;
  const inner = side === 'left' ? 1 : -1;

  const len = Math.max(p.len.get(), 0);
  const thick = clamp(p.thick.get(), 4, 140);
  const bend = p.bend.get();
  const rot = p.rot.get();
  const shine = clamp(p.shine.get(), 0, 2);
  const heart = clamp(p.heart.get(), -0.2, 1.3);

  const phase = rig.phase.get() + (side === 'right' ? Math.PI : 0);
  const orbit = fx.orbit.get();
  const talk = fx.talk.get();
  const pulse = fx.eyeScale.get();
  const blink = rig.blink.get();
  // The eye nearest the turning edge is foreshortened, like a surface curving away.
  const edge = side === 'left' ? Math.max(0, -look.x) : Math.max(0, look.x);

  const cv = eyeCurve(len, bend, rot);
  const lid = clamp(p.lid.get() + fx.lid.get(), 0, 0.98);

  return {
    x: EYE_ANCHOR[side] + p.x.get() * inner + Math.cos(phase) * orbit,
    y: EYE_ANCHOR.y + p.y.get() + Math.sin(phase) * orbit,
    sx: p.sx.get() * (1 - edge * 0.2) * (1 + talk * 0.07) * pulse,
    sy: p.sy.get() * (1 - blink * 0.94) * (1 - talk * 0.12) * pulse,
    d: curveD(cv),
    thick,
    glint: glintD(cv, thick),
    glintWidth: thick * 0.17,
    glintOpacity: clamp(0.2 * shine, 0, 0.5),
    lid: lidPoints(len, thick, lid, p.slant.get(), inner),
    pill: clamp(1 - heart * 1.7, 0, 1),
    heart: Math.max(0, heart) * fx.beat.get() * 1.15,
    heartOpacity: clamp(heart * 1.6, 0, 1),
  };
}

export function computeFace(rig: Rig): FaceFrame {
  const look = readLook(rig);
  return {
    face: [look.x * LOOK_REACH.x, look.y * LOOK_REACH.y],
    gloss: [-look.x * 16, -look.y * 10], // light stays put while the body turns
    left: computeEye(rig, 'left', look),
    right: computeEye(rig, 'right', look),
  };
}
