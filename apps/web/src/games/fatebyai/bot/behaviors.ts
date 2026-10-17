import type { ValueAnimationTransition } from 'framer-motion';
import type { Rig } from './rig';
import type { Runner } from './runner';
import type { CloudBotState } from './types';

/**
 * Behaviours: what each state DOES over time, on top of the pose it springs into.
 * They only write to `rig.fx` (and the dizzy `phase`), which is reset on every state change.
 */

type Ctx = { r: Runner; rig: Rig };
type Behavior = (ctx: Ctx) => Promise<void>;

const GLANCE = { type: 'spring', stiffness: 150, damping: 19 } as const;
const SACCADE = { type: 'spring', stiffness: 520, damping: 34 } as const;
const LAZY = { type: 'spring', stiffness: 70, damping: 16 } as const;

const look = (
  { r, rig }: Ctx,
  x: number,
  y: number,
  t: ValueAnimationTransition<number> = GLANCE,
): Promise<unknown> => Promise.all([r.to(rig.fx.lookX, x, t), r.to(rig.fx.lookY, y, t)]);

const HOP_TIMES = [0, 0.16, 0.5, 0.84, 1];

/** Squash, launch, stretch, land: a little cartoon hop. */
const hop = ({ r, rig }: Ctx, height = 5, duration = 0.7): Promise<unknown> => {
  const o: ValueAnimationTransition<number> = { duration, times: HOP_TIMES, ease: 'easeInOut' };
  return Promise.all([
    r.to(rig.fx.bodyY, [0, 0, -height, 0, 0], o),
    r.to(rig.fx.bodySy, [1, 0.9, 1.1, 0.91, 1], o),
    r.to(rig.fx.bodySx, [1, 1.07, 0.95, 1.06, 1], o),
  ]);
};

export const BEHAVIORS: Partial<Record<CloudBotState, Behavior>> = {
  // Alive but calm: an occasional curious glance, then back to centre.
  resting: async (c) => {
    const { r } = c;
    await r.loop(async () => {
      await r.wait(r.rand(1.8, 4.5));
      if (!r.chance(0.7)) return;
      await look(c, r.rand(-0.6, 0.6), r.rand(-0.3, 0.2));
      await r.wait(r.rand(0.5, 1.4));
      await look(c, 0, 0);
    });
  },

  // Speech rhythm: random syllables, short pauses between "words". Eyes and body ride the same envelope.
  talking: async ({ r, rig }) => {
    await r.loop(async () => {
      const syllables = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < syllables && r.alive; i++) {
        await r.to(rig.fx.talk, r.rand(0.45, 1), { duration: r.rand(0.07, 0.12), ease: 'easeOut' });
        await r.to(rig.fx.talk, r.rand(0, 0.18), { duration: r.rand(0.08, 0.14), ease: 'easeIn' });
      }
      await r.to(rig.fx.talk, 0, { duration: 0.18 });
      await r.wait(r.rand(0.25, 0.7));
    });
  },

  // Tense, with short bursts of trembling.
  angry: async ({ r, rig }) => {
    await r.loop(async () => {
      await r.wait(r.rand(0.5, 1.4));
      await Promise.all([
        r.to(rig.fx.bodyX, [0, -1.1, 1.1, -0.8, 0.8, -0.4, 0.4, 0], { duration: 0.42, ease: 'linear' }),
        r.to(rig.fx.lid, [0, 0.07, 0], { duration: 0.42 }),
      ]);
    });
  },

  // Heavy, with the odd sob.
  sad: async (c) => {
    const { r, rig } = c;
    await r.loop(async () => {
      await r.wait(r.rand(2.5, 4.5));
      await Promise.all([
        r.to(rig.fx.bodyY, [0, 1.1, 0.2, 0.9, 0], { duration: 0.6, ease: 'easeInOut' }),
        r.to(rig.fx.lookY, [0, 0.2, 0], { duration: 0.6 }),
      ]);
      if (r.chance(0.35)) {
        await look(c, r.rand(-0.5, 0.5), 0.2, LAZY);
        await r.wait(1.2);
        await look(c, 0, 0, LAZY);
      }
    });
  },

  // Sideways glances held a beat too long.
  suspicious: async (c) => {
    const { r } = c;
    await r.loop(async () => {
      const dir = r.chance(0.5) ? -1 : 1;
      await look(c, dir * r.rand(0.5, 0.9), 0, SACCADE);
      await r.wait(r.rand(1.4, 2.4));
      await look(c, -dir * r.rand(0.5, 0.9), 0, SACCADE);
      await r.wait(r.rand(1, 1.8));
      await look(c, 0, 0, GLANCE);
      await r.wait(r.rand(0.5, 1));
    });
  },

  lookLeft: async (c) => {
    const { r } = c;
    await r.loop(async () => {
      await r.wait(r.rand(2, 4));
      await look(c, r.rand(-0.1, 0.12), r.rand(-0.12, 0.12), GLANCE);
    });
  },
  lookRight: async (c) => {
    const { r } = c;
    await r.loop(async () => {
      await r.wait(r.rand(2, 4));
      await look(c, r.rand(-0.12, 0.1), r.rand(-0.12, 0.12), GLANCE);
    });
  },

  // Left, right, then back to the front.
  scanning: async (c) => {
    const { r } = c;
    await r.loop(async () => {
      await look(c, 0, 0);
      await r.wait(0.7);
      await look(c, -1, 0);
      await r.wait(1.1);
      await look(c, 1, 0, { type: 'spring', stiffness: 120, damping: 17 });
      await r.wait(1.1);
      await look(c, 0, 0);
      await r.wait(1.5);
    });
  },

  // Bouncy, with a happy wiggle between hops.
  happy: async (c) => {
    const { r, rig } = c;
    await hop(c, 3.5, 0.6);
    await r.loop(async () => {
      await r.wait(r.rand(1.1, 2.2));
      if (r.chance(0.5)) await hop(c, 3.5, 0.6);
      else await r.to(rig.fx.bodyRot, [0, -3, 3, -2, 0], { duration: 0.7, ease: 'easeInOut' });
    });
  },

  // A jump on arrival, then held-breath tremors.
  surprised: async (c) => {
    const { r, rig } = c;
    await Promise.all([hop(c, 6, 0.55), r.to(rig.fx.eyeScale, [1, 1.12, 1], { duration: 0.55 })]);
    await r.loop(async () => {
      await r.wait(r.rand(1.5, 3));
      await r.to(rig.fx.bodyX, [0, 0.3, -0.3, 0.25, 0], { duration: 0.3, ease: 'linear' });
    });
  },

  // Nods off, jerks awake, drifts down again.
  sleepy: async ({ r, rig }) => {
    await r.loop(async () => {
      await Promise.all([
        r.to(rig.fx.lid, 0.32, { duration: 2.6, ease: 'easeIn' }),
        r.to(rig.fx.bodyRot, 6, { duration: 2.6, ease: 'easeIn' }),
        r.to(rig.fx.bodyY, 1.8, { duration: 2.6, ease: 'easeIn' }),
      ]);
      await r.wait(0.25);
      await Promise.all([
        r.to(rig.fx.lid, -0.35, { duration: 0.14, ease: 'easeOut' }),
        r.to(rig.fx.bodyRot, -2, { duration: 0.18, ease: 'easeOut' }),
        r.to(rig.fx.bodyY, -1.2, { duration: 0.18, ease: 'easeOut' }),
      ]);
      await r.wait(0.5);
      await Promise.all([
        r.to(rig.fx.lid, 0, { duration: 0.6 }),
        r.to(rig.fx.bodyRot, 0, { duration: 0.6 }),
        r.to(rig.fx.bodyY, 0, { duration: 0.6 }),
      ]);
      await r.wait(r.rand(0.4, 1));
    });
  },

  // Head-tilt wobble with "huh?" glances.
  confused: async (c) => {
    const { r, rig } = c;
    await r.loop(async () => {
      await Promise.all([
        r.to(rig.fx.bodyRot, [0, 5, -3, 4, 0], { duration: 1.8, ease: 'easeInOut' }),
        r.to(rig.fx.lookX, [0, -0.6, 0.6, 0], { duration: 1.8, ease: 'easeInOut' }),
      ]);
      await r.wait(r.rand(0.8, 2));
    });
  },

  // Eyes up and away, with a sudden dart to the other side.
  thinking: async ({ r, rig }) => {
    await r.loop(async () => {
      await r.wait(r.rand(1.6, 3));
      await Promise.all([
        r.to(rig.fx.lookX, -1.4, SACCADE),
        r.to(rig.fx.lookY, 0.1, SACCADE),
        r.to(rig.fx.bodyRot, -2.5, { duration: 0.5 }),
      ]);
      await r.wait(r.rand(0.8, 1.4));
      await Promise.all([
        r.to(rig.fx.lookX, 0, GLANCE),
        r.to(rig.fx.lookY, 0, GLANCE),
        r.to(rig.fx.bodyRot, 0, { duration: 0.6 }),
      ]);
    });
  },

  // Can't keep still.
  excited: async (c) => {
    const { r, rig } = c;
    await r.loop(async () => {
      await Promise.all([
        hop(c, 5.5, 0.62),
        r.to(rig.fx.eyeScale, [1, 1.1, 1], { duration: 0.62 }),
        r.to(rig.fx.bodyRot, [0, -3, 3, 0], { duration: 0.62, ease: 'easeInOut' }),
      ]);
      await r.wait(r.rand(0.1, 0.4));
    });
  },

  // Lub-dub heartbeat; the whole body pulses with it.
  love: async ({ r, rig }) => {
    const beat: ValueAnimationTransition<number> = { duration: 0.9, times: [0, 0.15, 0.3, 0.45, 1], ease: 'easeOut' };
    await r.loop(async () => {
      await Promise.all([
        r.to(rig.fx.beat, [1, 1.2, 1, 1.13, 1], beat),
        r.to(rig.fx.bodySx, [1, 1.035, 1, 1.02, 1], beat),
        r.to(rig.fx.bodySy, [1, 1.035, 1, 1.02, 1], beat),
      ]);
      await r.wait(0.3);
    });
  },

  // A cheeky hop, then a slow sway.
  wink: async (c) => {
    const { r, rig } = c;
    await hop(c, 2.5, 0.5);
    await r.loop(() => r.to(rig.fx.bodyRot, [0, 2.5, 0, -1.5, 0], { duration: 3.2, ease: 'easeInOut' }));
  },

  // Eyes circle in opposite directions while the body wobbles.
  dizzy: async ({ r, rig }) => {
    void r.to(rig.phase, [0, Math.PI * 2], { duration: 1.15, ease: 'linear', repeat: Infinity });
    void r.to(rig.fx.orbit, 15, { type: 'spring', stiffness: 90, damping: 14 });
    await r.loop(() => r.to(rig.fx.bodyRot, [0, 6, 0, -6, 0], { duration: 2.2, ease: 'easeInOut' }));
  },
};
