import { animate, type MotionValue, type ValueAnimationTransition } from 'framer-motion';

type Stopper = () => void;

/**
 * Tiny cancellable timeline. A behaviour is an async function that awaits
 * `wait()` / `to()` calls; `cancel()` stops every pending timer and tween and
 * resolves every pending promise, so loops end cleanly on state change/unmount.
 */
export class Runner {
  private dead = false;
  private stoppers = new Set<Stopper>();

  get alive(): boolean {
    return !this.dead;
  }

  cancel(): void {
    this.dead = true;
    for (const stop of [...this.stoppers]) stop();
    this.stoppers.clear();
  }

  wait(seconds: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.dead) return resolve();
      const done = () => {
        clearTimeout(timer);
        this.stoppers.delete(done);
        resolve();
      };
      const timer = setTimeout(done, seconds * 1000);
      this.stoppers.add(done);
    });
  }

  /** Animate a value (to a number or through keyframes) and resolve when it lands. */
  to(
    value: MotionValue<number>,
    target: number | number[],
    transition: ValueAnimationTransition<number> = { duration: 0.35, ease: 'easeInOut' },
  ): Promise<void> {
    return new Promise((resolve) => {
      if (this.dead) return resolve();
      const controls = animate(value, target, transition);
      const done = () => {
        this.stoppers.delete(stop);
        resolve();
      };
      const stop = () => {
        controls.stop();
        done();
      };
      this.stoppers.add(stop);
      controls.then(done);
    });
  }

  /** Repeat `body` until cancelled. Always yields a frame between runs, so it can never spin. */
  async loop(body: () => Promise<void>): Promise<void> {
    while (this.alive) {
      await body();
      await this.wait(0.016);
    }
  }

  rand(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  chance(p: number): boolean {
    return Math.random() < p;
  }
}
