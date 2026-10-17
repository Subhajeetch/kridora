import { REST_TILT } from './geometry';
import type { CloudBotState, EyeParams, Expression, SpringConfig } from './types';

/**
 * One definition per state. Behaviours (hops, shakes, glances, talking rhythm...)
 * live in `behaviors.ts`; this file only describes the pose the bot springs INTO.
 *
 * Reading the numbers: eyes are 480x360-space units, `x`/`rot` mirror automatically
 * where noted, body `x`/`y` are % of the bot's size.
 */

export const SPRINGS = {
  soft: { stiffness: 210, damping: 20, mass: 1 },
  snappy: { stiffness: 460, damping: 27, mass: 1 },
  pop: { stiffness: 380, damping: 13, mass: 1 },
  bouncy: { stiffness: 260, damping: 14, mass: 1 },
  slow: { stiffness: 80, damping: 15, mass: 1.1 },
} satisfies Record<string, SpringConfig>;

const BASE_EYE: EyeParams = {
  x: 0, y: 0, len: 84, thick: 50, rot: REST_TILT, bend: 0,
  lid: 0, slant: 0, shine: 1, heart: 0, sx: 1, sy: 1,
};

type Opts = {
  /** Applied to both eyes. */
  both?: Partial<EyeParams>;
  left?: Partial<EyeParams>;
  right?: Partial<EyeParams>;
  body?: Partial<Expression['body']>;
  look?: Partial<Expression['look']>;
  follow?: number;
  float?: number;
  blink?: boolean;
  spring?: SpringConfig;
};

const make = (o: Opts = {}): Expression => ({
  left: { ...BASE_EYE, ...o.both, ...o.left },
  right: { ...BASE_EYE, ...o.both, ...o.right },
  body: { x: 0, y: 0, rot: 0, sx: 1, sy: 1, ...o.body },
  look: { x: 0, y: 0, ...o.look },
  ctl: { follow: o.follow ?? 0.8, float: o.float ?? 1 },
  blink: o.blink ?? true,
  spring: o.spring ?? SPRINGS.soft,
});

export const EXPRESSIONS: Record<CloudBotState, Expression> = {
  resting: make({ follow: 1 }),

  talking: make({
    both: { thick: 52, len: 80, shine: 1.1 },
    follow: 0.55,
    float: 1.2,
    spring: SPRINGS.bouncy,
  }),

  angry: make({
    both: { thick: 56, len: 80, y: 10, x: 5, lid: 0.3, slant: 26, shine: 0.15 },
    left: { rot: -9 },
    right: { rot: 9 },
    body: { y: 1.2, sx: 1.03, sy: 0.96 },
    follow: 0.3,
    float: 0.35,
    spring: SPRINGS.snappy,
  }),

  sad: make({
    both: { thick: 50, len: 68, y: 14, x: -3, lid: 0.18, slant: -22, shine: 1.6 },
    left: { rot: 10 },
    right: { rot: -10 },
    body: { y: 3.2, sx: 1.03, sy: 0.95 },
    look: { y: 0.55 },
    follow: 0.2,
    float: 0.35,
    spring: SPRINGS.slow,
  }),

  suspicious: make({
    both: { thick: 58, y: 6, shine: 0.5 },
    left: { len: 44, lid: 0.46, slant: 8, rot: -4 },
    right: { len: 54, lid: 0.36, slant: 6, rot: -4 },
    body: { rot: -2.5, x: -0.8 },
    look: { x: -0.5, y: 0.05 },
    follow: 0.35,
    float: 0.5,
  }),

  lookLeft: make({ both: { len: 88, thick: 48 }, look: { x: -1 }, follow: 0 }),
  lookRight: make({ both: { len: 88, thick: 48 }, look: { x: 1 }, follow: 0 }),
  scanning: make({ both: { len: 88, thick: 48 }, follow: 0 }),

  happy: make({
    both: { rot: -90, len: 64, thick: 32, bend: 44, x: -8, y: -2, shine: 0.4 },
    body: { y: -0.6, sx: 0.99, sy: 1.03 },
    follow: 0.8,
    float: 1.1,
    blink: false,
    spring: SPRINGS.bouncy,
  }),

  surprised: make({
    both: { thick: 68, len: 42, rot: 0, y: -4, x: -6, shine: 1.4 },
    body: { y: -2.2, sx: 0.97, sy: 1.07 },
    follow: 0.5,
    float: 0.8,
    blink: false,
    spring: SPRINGS.pop,
  }),

  sleepy: make({
    both: { thick: 54, len: 76, y: 12, lid: 0.62, shine: 0.35 },
    body: { y: 2, sx: 1.02, sy: 0.97 },
    follow: 0.1,
    float: 0.5,
    blink: false,
    spring: SPRINGS.slow,
  }),

  confused: make({
    left: { thick: 52, len: 92, rot: -6, y: -6, shine: 1.2 },
    right: { thick: 44, len: 44, rot: -12, y: 10, shine: 0.8 },
    body: { rot: 5, x: 0.8 },
    look: { x: 0.2, y: -0.15 },
    follow: 0.35,
    float: 0.8,
  }),

  thinking: make({
    left: { thick: 48, len: 70, rot: -10 },
    right: { thick: 46, len: 56, rot: -10, y: 4 },
    body: { rot: 3.5, x: 1.2 },
    look: { x: 0.8, y: -0.8 },
    follow: 0.15,
    float: 0.7,
  }),

  excited: make({
    both: { thick: 56, len: 98, y: -4, rot: 0, shine: 1.7 },
    left: { rot: -7 },
    right: { rot: 7 },
    body: { y: -1, sx: 0.98, sy: 1.05 },
    follow: 0.6,
    float: 1.4,
    blink: false,
    spring: SPRINGS.pop,
  }),

  love: make({
    both: { heart: 1 },
    body: { y: -0.8 },
    follow: 0.7,
    float: 1.2,
    blink: false,
    spring: SPRINGS.bouncy,
  }),

  wink: make({
    left: { thick: 54, len: 90, y: -2, shine: 1.3 },
    right: { rot: -90, thick: 30, len: 50, bend: 30, x: -4, y: 4, shine: 0.4 },
    body: { rot: -3, y: -0.4 },
    follow: 0.6,
    blink: false,
    spring: SPRINGS.bouncy,
  }),

  dizzy: make({
    both: { thick: 46, len: 42, rot: 0, shine: 0 },
    follow: 0,
    float: 0.8,
    blink: false,
  }),
};

/** Every state, in a sensible display order. */
export const CLOUD_BOT_STATES = Object.keys(EXPRESSIONS) as CloudBotState[];
