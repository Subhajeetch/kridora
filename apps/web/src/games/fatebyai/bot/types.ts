/** Every expression the bot can show. Add a new one here, then define it in `expressions.ts`. */
export type CloudBotState =
  | 'resting'
  | 'talking'
  | 'angry'
  | 'sad'
  | 'suspicious'
  | 'lookLeft'
  | 'lookRight'
  | 'scanning'
  | 'happy'
  | 'surprised'
  | 'sleepy'
  | 'confused'
  | 'thinking'
  | 'excited'
  | 'love'
  | 'wink'
  | 'dizzy';

/**
 * Shape of a single eye. An eye is a thick round-capped stroke along a
 * quadratic curve, so one parameter set covers pills, arches (^ ^), smiles and
 * half-closed lids. All lengths are in SVG units (the bot is drawn in a 480x360 box).
 */
export type EyeParams = {
  /** Horizontal offset. Positive moves the eye toward the middle of the face. */
  x: number;
  /** Vertical offset. Positive moves the eye down. */
  y: number;
  /** Distance between the two cap centres (the "length" of the pill). */
  len: number;
  /** Stroke thickness (the "width" of the pill). */
  thick: number;
  /** Rotation in degrees. */
  rot: number;
  /** Curve of the stroke. 0 = straight pill, +/- bends it into an arch or a smile. */
  bend: number;
  /** Top eyelid coverage, 0 (open) to 1 (closed). */
  lid: number;
  /** Slant of that lid in degrees. Positive = inner end lower (angry), negative = outer end lower (sad). */
  slant: number;
  /** Glint intensity, 0 = matte. */
  shine: number;
  /** 0 = normal eye, 1 = heart eye. */
  heart: number;
  /** Extra scale on each axis. */
  sx: number;
  sy: number;
};

/** Whole-body pose. `x` and `y` are percentages of the bot's size. */
export type BodyParams = { x: number; y: number; rot: number; sx: number; sy: number };

/** Where the face is turned: -1..1 on each axis. */
export type LookParams = { x: number; y: number };

/** `follow`: how much the pointer pulls the gaze. `float`: idle hover amplitude. */
export type CtlParams = { follow: number; float: number };

export type SpringConfig = { stiffness: number; damping: number; mass: number };

export type Expression = {
  left: EyeParams;
  right: EyeParams;
  body: BodyParams;
  look: LookParams;
  ctl: CtlParams;
  /** Whether the idle auto-blink is allowed in this state. */
  blink: boolean;
  /** How the bot springs into this expression. */
  spring: SpringConfig;
};
