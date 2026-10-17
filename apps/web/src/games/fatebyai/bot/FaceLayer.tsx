import { memo, useLayoutEffect, useRef } from 'react';
import { useMotionValueEvent, type MotionValue } from 'framer-motion';
import type { Palette } from './colors';
import { BODY_PATH, HEART_PATH, VIEW_H, VIEW_W } from './geometry';
import type { EyeFrame, FaceFrame } from './rig';

type Props = { frame: MotionValue<FaceFrame>; palette: Palette; uid: string; glossy: boolean };

const SIDES = ['left', 'right'] as const;
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Everything that moves on the face: the eyes and the light on the surface.
 *
 * The SVG markup is rendered once; per-frame changes are written straight to the
 * DOM from a MotionValue, so React never re-renders while the bot animates.
 */
export const FaceLayer = memo(function FaceLayer({ frame, palette: p, uid, glossy }: Props) {
  const nodes = useRef<Record<string, Element | null>>({});
  const ref = (key: string) => (el: Element | null) => {
    nodes.current[key] = el;
  };

  const apply = (f: FaceFrame) => {
    const q = (k: string) => nodes.current[k];
    const set = (k: string, attr: string, v: string | number) => q(k)?.setAttribute(attr, String(v));

    set('face', 'transform', `translate(${r2(f.face[0])} ${r2(f.face[1])})`);
    set('gloss', 'transform', `translate(${r2(f.gloss[0])} ${r2(f.gloss[1])})`);

    for (const side of SIDES) {
      const e: EyeFrame = f[side];
      const k = (s: string) => `${side}.${s}`;
      set(k('root'), 'transform', `translate(${r2(e.x)} ${r2(e.y)}) scale(${r3(e.sx)} ${r3(e.sy)})`);
      set(k('shape'), 'opacity', r2(e.pill));
      for (const part of ['pill', 'bevel']) {
        set(k(part), 'd', e.d);
        set(k(part), 'stroke-width', r2(e.thick));
      }
      set(k('glint'), 'd', e.glint);
      set(k('glint'), 'stroke-width', r2(e.glintWidth));
      set(k('glint'), 'stroke-opacity', r2(e.glintOpacity));
      set(k('lid'), 'points', e.lid);
      set(k('heart'), 'transform', `scale(${r3(e.heart)})`);
      set(k('heart'), 'opacity', r2(e.heartOpacity));
    }
  };

  // Paint the first frame before the browser does, then follow the motion value.
  useLayoutEffect(() => {
    apply(frame.get());
  });
  useMotionValueEvent(frame, 'change', apply);

  const id = (s: string) => `${uid}-${s}`;
  const url = (s: string) => `url(#${id(s)})`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      aria-hidden="true"
      focusable="false"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
    >
      <defs>
        <linearGradient id={id('eye')} gradientUnits="userSpaceOnUse" x1="0" y1="-85" x2="0" y2="85">
          <stop offset="0" stopColor={p.eyeTop} />
          <stop offset="1" stopColor={p.eyeBottom} />
        </linearGradient>
        <linearGradient id={id('heart')} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0" stopColor={p.heartTop} />
          <stop offset="1" stopColor={p.heartBottom} />
        </linearGradient>
        <radialGradient id={id('sheen')}>
          <stop offset="0" stopColor="#fff" stopOpacity="0.46" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={id('fclip')}>
          <path d={BODY_PATH} />
        </clipPath>
        {SIDES.map((side) => (
          <mask key={side} id={id(`mask-${side}`)} maskUnits="userSpaceOnUse" x="-220" y="-220" width="440" height="440">
            <rect x="-220" y="-220" width="440" height="440" fill="#fff" />
            <polygon ref={ref(`${side}.lid`)} fill="#000" />
          </mask>
        ))}
      </defs>

      {/* Light on the surface. It slides opposite to the turn, because the light itself stays put. */}
      {glossy && (
        <g clipPath={url('fclip')}>
          <g ref={ref('gloss')}>
            <ellipse cx="190" cy="88" rx="135" ry="62" transform="rotate(-14 190 88)" fill={url('sheen')} />
            <path d="M109 87A50 50 0 0 1 149 54.5" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="9" strokeLinecap="round" />
            <circle cx="104" cy="101" r="4.6" fill="#fff" fillOpacity="0.55" />
            <path d="M208.5 57A74 74 0 0 1 247.7 38.7" fill="none" stroke="#fff" strokeOpacity="0.34" strokeWidth="7" strokeLinecap="round" />
          </g>
        </g>
      )}

      {/* The eyes sit slightly "in front" of the body and slide further than it when it turns. */}
      <g ref={ref('face')}>
        {SIDES.map((side) => (
          <g key={side} ref={ref(`${side}.root`)}>
            <g ref={ref(`${side}.shape`)} mask={url(`mask-${side}`)}>
              {/* a thin lit edge under the eye makes it read as carved into the surface */}
              <path ref={ref(`${side}.bevel`)} fill="none" stroke={p.eyeBevel} strokeOpacity="0.4" strokeLinecap="round" transform="translate(0 4)" />
              <path ref={ref(`${side}.pill`)} fill="none" stroke={url('eye')} strokeLinecap="round" />
              {glossy && <path ref={ref(`${side}.glint`)} fill="none" stroke="#fff" strokeLinecap="round" />}
            </g>
            <g ref={ref(`${side}.heart`)}>
              <path d={HEART_PATH} fill={url('heart')} />
              {glossy && <path d="M-28-34C-36-28-38-16-33-8" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="6" strokeLinecap="round" />}
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
});

