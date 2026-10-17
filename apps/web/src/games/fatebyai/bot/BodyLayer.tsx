import { memo } from 'react';
import type { Palette } from './colors';
import { BODY_PATH, NOTCHES, VIEW_H, VIEW_W } from './geometry';

type Props = { palette: Palette; uid: string };

/**
 * The cloud itself. Fully static, so the browser rasterises the filters once.
 *
 * Volume comes from five cheap cues, all lit from the upper left:
 *  1. radial base gradient (light -> base -> shade)
 *  2. inner shadow (lower right) + inner glow (upper left) via one filter
 *  3. ambient occlusion pooling along the bottom
 *  4. soft creases inside every notch between lobes
 *  5. a cool bounce-light rim on the shadow side
 */
export const BodyLayer = memo(function BodyLayer({ palette: p, uid }: Props) {
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
        <radialGradient id={id('body')} cx="0.34" cy="0.22" r="0.95">
          <stop offset="0" stopColor={p.light} />
          <stop offset="0.42" stopColor={p.base} />
          <stop offset="1" stopColor={p.shade} />
        </radialGradient>

        <linearGradient id={id('ao')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.58" stopColor={p.deep} stopOpacity="0" />
          <stop offset="1" stopColor={p.deep} stopOpacity="0.42" />
        </linearGradient>

        <radialGradient id={id('notch')}>
          <stop offset="0" stopColor={p.deep} stopOpacity="0.34" />
          <stop offset="1" stopColor={p.deep} stopOpacity="0" />
        </radialGradient>

        <radialGradient id={id('bounce')}>
          <stop offset="0" stopColor={p.rim} stopOpacity="0.5" />
          <stop offset="1" stopColor={p.rim} stopOpacity="0" />
        </radialGradient>

        <linearGradient id={id('rim')} gradientUnits="userSpaceOnUse" x1="150" y1="80" x2="400" y2="340">
          <stop offset="0.5" stopColor={p.rim} stopOpacity="0" />
          <stop offset="1" stopColor={p.rim} stopOpacity="0.65" />
        </linearGradient>

        <clipPath id={id('clip')}>
          <path d={BODY_PATH} />
        </clipPath>

        <filter id={id('inner')} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feComponentTransfer in="SourceAlpha" result="outside">
            <feFuncA type="table" tableValues="1 0" />
          </feComponentTransfer>
          {/* inner shadow, lower right */}
          <feGaussianBlur in="outside" stdDeviation="17" result="b1" />
          <feOffset in="b1" dx="-11" dy="-17" result="o1" />
          <feFlood floodColor={p.deep} floodOpacity="0.55" result="c1" />
          <feComposite in="c1" in2="o1" operator="in" result="s1" />
          <feComposite in="s1" in2="SourceAlpha" operator="in" result="shadow" />
          {/* inner glow, upper left */}
          <feGaussianBlur in="outside" stdDeviation="7" result="b2" />
          <feOffset in="b2" dx="8" dy="11" result="o2" />
          <feFlood floodColor={p.lighter} floodOpacity="0.6" result="c2" />
          <feComposite in="c2" in2="o2" operator="in" result="s2" />
          <feComposite in="s2" in2="SourceAlpha" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="shadow" />
            <feMergeNode in="glow" />
          </feMerge>
        </filter>
      </defs>

      <path d={BODY_PATH} fill={url('body')} filter={url('inner')} />

      <g clipPath={url('clip')}>
        <path d={BODY_PATH} fill={url('ao')} />
        {NOTCHES.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="38" fill={url('notch')} />
        ))}
        <ellipse cx="372" cy="296" rx="110" ry="46" fill={url('bounce')} />
        <path d={BODY_PATH} fill="none" stroke={url('rim')} strokeWidth="10" />
      </g>
    </svg>
  );
});
