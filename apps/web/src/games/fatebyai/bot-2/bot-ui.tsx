import React, { useEffect, useMemo, useRef, useState, useCallback, useId } from 'react';
import { CHIP_COLOR_THEMES, createChipPaletteFromHex, type ChipColorPalette } from './bot-palettes';
// Preserve the original module's public palette exports.
// eslint-disable-next-line react-refresh/only-export-components
export { CHIP_COLOR_THEMES, createChipPaletteFromHex, type ChipColorPalette } from './bot-palettes';

// ============================================================================
// 2. EXPRESSION STATES & TYPES
// ============================================================================

export type ChipExpressionState =
  | 'resting'
  | 'talking'
  | 'angry'
  | 'looking-left'
  | 'looking-right'
  | 'look-around'
  | 'suspicious'
  | 'sad'
  | 'happy'
  | 'surprised'
  | 'sleepy'
  | 'confused'
  | 'thinking'
  | 'excited'
  | 'love'
  | 'wink'
  | 'dizzy';

export interface ChipFaceProps {
  /** Current expression state of the chip bot */
  state?: ChipExpressionState;
  /** Pass a preset key, a hex string (e.g. "#46998A"), or a full ChipColorPalette object */
  color?: string | ChipColorPalette;
  /** Size in pixels (width & height) */
  size?: number;
  /** Show the 16 3D cylindrical IC pins around the chip (default: true) */
  showPins?: boolean;
  /** Show the 3D recessed mouth in non-resting states (default: true). When false, uses eyes-only mode. */
  showMouth?: boolean;
  /** Animation speed multiplier (default: 1) */
  speed?: number;
  /** Optional subtle interactive mouse-tracking 3D tilt */
  interactiveTilt?: boolean;
  /** Optional glowing LED eye/mouth interior vs reference matte-carved cavity */
  eyeStyle?: 'carved-matte' | 'glowing-led';
  /** Trigger a manual blink when incremented */
  blinkTrigger?: number;
  /** Custom className for wrapper */
  className?: string;
}

// Internal interpolated physics vector for 60fps spring animation
interface AnimatedPose {
  // Whole-body 3D transforms
  rotateX: number;    // Pitch (nod up/down)
  rotateY: number;    // Yaw (turn left/right)
  rotateZ: number;    // Roll (head tilt)
  translateX: number; // Horizontal shift
  translateY: number; // Vertical bounce/slump
  scaleX: number;     // Squash & stretch X
  scaleY: number;     // Squash & stretch Y

  // Left Eye parameters
  leftEyeX: number;       // Gaze X offset
  leftEyeY: number;       // Gaze Y offset
  leftEyeScaleX: number;  // Eye width multiplier
  leftEyeScaleY: number;  // Eye height multiplier
  leftTopLid: number;     // 0 = open, 1 = fully closed from top
  leftBottomLid: number;  // 0 = open, 1 = fully closed from bottom
  leftLidAngle: number;   // Slant angle in degrees (+ = angry inward, - = sad outward)

  // Right Eye parameters
  rightEyeX: number;
  rightEyeY: number;
  rightEyeScaleX: number;
  rightEyeScaleY: number;
  rightTopLid: number;
  rightBottomLid: number;
  rightLidAngle: number;

  // Special eye shape morphs (0 to 1)
  happyCurve: number;     // Morphs capsule eyes into cheerful ^ ^ arcs
  heartMorph: number;     // Morphs capsule eyes into 3D recessed hearts
  winkRight: number;      // Pinches right eye into a cheeky wink arc

  // 3D Recessed Mouth parameters (Visible in all states EXCEPT 'resting')
  mouthVisibility: number; // 0 in resting, 1 in all other states
  mouthX: number;          // Horizontal mouth offset
  mouthY: number;          // Vertical mouth offset
  mouthWidth: number;      // Half-width of mouth cavity (10 = tight O, 26 = wide grin)
  mouthOpen: number;       // Vertical cavity opening (4 = carved line, 28 = wide open)
  mouthCurve: number;      // +1 = happy smile D-shape, 0 = oval/O, -1 = sad/angry frown
  mouthSkew: number;       // Asymmetrical corner tilt (smirk / skeptical / confused)
  mouthWave: number;       // Wavy S-curve distortion for confused / dizzy states
}

const DEFAULT_POSE: AnimatedPose = {
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  translateX: 0,
  translateY: 0,
  scaleX: 1,
  scaleY: 1,
  leftEyeX: 0,
  leftEyeY: 0,
  leftEyeScaleX: 1,
  leftEyeScaleY: 1,
  leftTopLid: 0,
  leftBottomLid: 0,
  leftLidAngle: 0,
  rightEyeX: 0,
  rightEyeY: 0,
  rightEyeScaleX: 1,
  rightEyeScaleY: 1,
  rightTopLid: 0,
  rightBottomLid: 0,
  rightLidAngle: 0,
  happyCurve: 0,
  heartMorph: 0,
  winkRight: 0,
  mouthVisibility: 0,
  mouthX: 0,
  mouthY: 0,
  mouthWidth: 16,
  mouthOpen: 0,
  mouthCurve: 0,
  mouthSkew: 0,
  mouthWave: 0,
};

// ============================================================================
// 3. CORE <ChipFace /> 3D COMPONENT
// ============================================================================

export const ChipFace: React.FC<ChipFaceProps> = ({
  state = 'resting',
  color = CHIP_COLOR_THEMES.originalJade,
  size = 280,
  showPins = true,
  showMouth = true,
  speed = 1,
  interactiveTilt = true,
  eyeStyle = 'carved-matte',
  blinkTrigger = 0,
  className = '',
}) => {
  // Resolve color prop into a complete 3D palette
  const palette: ChipColorPalette = useMemo(() => {
    if (typeof color === 'string') {
      if (CHIP_COLOR_THEMES[color]) return CHIP_COLOR_THEMES[color];
      return createChipPaletteFromHex(color);
    }
    return color;
  }, [color]);

  // Current interpolated pose state rendered at 60fps
  const [pose, setPose] = useState<AnimatedPose>(DEFAULT_POSE);
  const currentPoseRef = useRef<AnimatedPose>({ ...DEFAULT_POSE });
  const velocityRef = useRef<Record<keyof AnimatedPose, number>>(
    Object.keys(DEFAULT_POSE).reduce((acc, key) => {
      acc[key as keyof AnimatedPose] = 0;
      return acc;
    }, {} as Record<keyof AnimatedPose, number>)
  );

  // Mouse tracking state for subtle 3D parallax
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseTargetRef = useRef({ x: 0, y: 0 });

  // Blink state tracking
  const blinkStateRef = useRef({
    isBlinking: false,
    blinkProgress: 0,
    nextBlinkTime: 0,
    doubleBlinkPending: false,
  });
  useEffect(() => {
    blinkStateRef.current.nextBlinkTime = performance.now() + 2400;
  }, []);

  // Trigger manual blink when prop changes
  useEffect(() => {
    if (blinkTrigger > 0) {
      blinkStateRef.current.isBlinking = true;
      blinkStateRef.current.blinkProgress = 0;
    }
  }, [blinkTrigger]);

  // Reset state timer on expression change so choreographed sequences (like look-around) start fresh
  const stateStartTimeRef = useRef<number>(0);
  useEffect(() => {
    stateStartTimeRef.current = performance.now();
  }, [state]);

  // 60FPS Procedural Choreography + Spring Physics Engine
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const updateAnimation = (now: number) => {
      const rawDt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const elapsed = ((now - stateStartTimeRef.current) / 1000) * speed;

      // Start from neutral target pose
      const target: AnimatedPose = { ...DEFAULT_POSE };

      // ----------------------------------------------------------------------
      // STATE CHOREOGRAPHY (Eyes + 3D Mouth in all states except 'resting')
      // ----------------------------------------------------------------------
      switch (state) {
        case 'resting': {
          // Gentle 3D breathing float + subtle autonomous micro-glances
          // NO MOUTH in resting state (matches exact reference image)
          target.mouthVisibility = 0;
          target.mouthOpen = 0;
          target.mouthWidth = 12;

          target.translateY = Math.sin(elapsed * 2.2) * 4;
          target.rotateX = Math.sin(elapsed * 2.2 - 0.4) * 3.5;
          target.rotateZ = Math.cos(elapsed * 1.1) * 1.5;
          target.scaleX = 1 + Math.sin(elapsed * 2.2) * 0.012;
          target.scaleY = 1 - Math.sin(elapsed * 2.2) * 0.012;

          // Subtle idle micro-saccade every few seconds
          const glanceCycle = Math.sin(elapsed * 0.7) + Math.sin(elapsed * 1.9);
          if (Math.abs(glanceCycle) > 1.35) {
            const dir = Math.sign(glanceCycle) * 3.5;
            target.leftEyeX = dir;
            target.rightEyeX = dir;
            target.rotateY = dir * 1.2;
          }
          break;
        }

        case 'talking': {
          // Energetic syllable cadence using layered harmonics
          const syllableWave =
            Math.abs(Math.sin(elapsed * 11.5)) * 0.65 +
            Math.abs(Math.cos(elapsed * 7.2)) * 0.35 +
            Math.sin(elapsed * 18.0) * 0.2;
          const vowelRound = Math.sin(elapsed * 6.4);

          // Whole body bounces, pitches, and squashes/stretches with every syllable
          target.translateY = -syllableWave * 11 + 3;
          target.rotateX = syllableWave * 12 - 4;
          target.rotateZ = Math.sin(elapsed * 5.5) * 4.5;
          target.rotateY = Math.cos(elapsed * 3.8) * 6;
          target.scaleY = 0.94 + syllableWave * 0.13;
          target.scaleX = 1.05 - syllableWave * 0.09;

          // Eyes expressively pulse vertically & horizontally in sync with speech
          // (Boosted slightly when in eyes-only mode so talking remains super expressive)
          const eyeBoost = showMouth ? 0.36 : 0.52;
          const eyePulse = (showMouth ? 0.78 : 0.72) + syllableWave * eyeBoost;
          target.leftEyeScaleY = eyePulse;
          target.rightEyeScaleY = eyePulse;
          target.leftEyeScaleX = 1.08 - (eyePulse - 1) * 0.28;
          target.rightEyeScaleX = 1.08 - (eyePulse - 1) * 0.28;
          target.leftBottomLid = Math.max(0, (1 - syllableWave) * (showMouth ? 0.18 : 0.28));
          target.rightBottomLid = Math.max(0, (1 - syllableWave) * (showMouth ? 0.18 : 0.28));

          // Expressive multi-syllable lip-syncing 3D mouth
          target.mouthVisibility = 1;
          target.mouthOpen = 5 + syllableWave * 22;
          target.mouthWidth = 16 + vowelRound * 7;
          target.mouthCurve = 0.35 + Math.sin(elapsed * 4.5) * 0.35;
          target.mouthY = syllableWave * 2;
          break;
        }

        case 'angry': {
          // Aggressive forward 3D lean + boiling high-frequency tremor
          const tremorX = Math.sin(elapsed * 42) * 1.4;
          const tremorY = Math.cos(elapsed * 38) * 1.1;
          const breathe = Math.sin(elapsed * 5) * 2.5;

          target.rotateX = -15 + breathe * 0.5;
          target.rotateZ = Math.sin(elapsed * 3.2) * 2;
          target.translateX = tremorX;
          target.translateY = 6 + tremorY;
          target.scaleX = 1.05;
          target.scaleY = 0.95;

          // Sharp inward-slanted upper eyelids (\ /) + tight lower squint
          target.leftTopLid = 0.48;
          target.rightTopLid = 0.48;
          target.leftBottomLid = 0.22;
          target.rightBottomLid = 0.22;
          target.leftLidAngle = 24;   // Slants down toward center
          target.rightLidAngle = -24; // Slants down toward center
          target.leftEyeY = 2;
          target.rightEyeY = 2;

          // Fierce downturned scowl / gritted growling mouth
          target.mouthVisibility = 1;
          target.mouthWidth = 22;
          target.mouthOpen = 9 + Math.abs(breathe) * 2.5;
          target.mouthCurve = -0.95;
          target.mouthSkew = Math.sin(elapsed * 9) * 1.5;
          target.mouthY = 2;
          break;
        }

        case 'looking-left': {
          // Whole 3D body yaws left + eyes shift left with perspective compression
          const sway = Math.sin(elapsed * 2.4) * 2;
          target.rotateY = -26 + sway;
          target.rotateZ = -3;
          target.rotateX = 2;
          target.translateX = -10;

          target.leftEyeX = -13;
          target.rightEyeX = -13;
          target.leftEyeScaleX = 0.86;
          target.rightEyeScaleX = 1.04;

          // Curious side-shifted smirk mouth following the gaze left
          target.mouthVisibility = 1;
          target.mouthX = -10;
          target.mouthWidth = 15;
          target.mouthOpen = 6;
          target.mouthCurve = 0.35;
          target.mouthSkew = -4;
          break;
        }

        case 'looking-right': {
          // Whole 3D body yaws right + eyes shift right with perspective compression
          const sway = Math.sin(elapsed * 2.4) * 2;
          target.rotateY = 26 + sway;
          target.rotateZ = 3;
          target.rotateX = 2;
          target.translateX = 10;

          target.leftEyeX = 13;
          target.rightEyeX = 13;
          target.rightEyeScaleX = 0.86;
          target.leftEyeScaleX = 1.04;

          // Curious side-shifted smirk mouth following the gaze right
          target.mouthVisibility = 1;
          target.mouthX = 10;
          target.mouthWidth = 15;
          target.mouthOpen = 6;
          target.mouthCurve = 0.35;
          target.mouthSkew = 4;
          break;
        }

        case 'look-around': {
          // Choreographed 4.4-second loop: Look Left -> Pause -> Look Right -> Pause -> Snap Front!
          const cycle = elapsed % 4.4;
          target.mouthVisibility = 1;

          if (cycle < 1.1) {
            // Dart Left
            target.rotateY = -28;
            target.rotateZ = -4;
            target.translateX = -11;
            target.leftEyeX = -14;
            target.rightEyeX = -14;
            target.leftTopLid = 0.18;
            target.rightTopLid = 0.18;
            target.leftEyeScaleX = 0.85;

            target.mouthX = -10;
            target.mouthWidth = 13;
            target.mouthOpen = 7;
            target.mouthCurve = 0.1;
            target.mouthSkew = -3.5;
          } else if (cycle < 1.45) {
            // Quick transition dip
            target.translateY = 5;
            target.scaleY = 0.95;
            target.scaleX = 1.04;
            target.leftTopLid = 0.65;
            target.rightTopLid = 0.65;

            target.mouthWidth = 11;
            target.mouthOpen = 5;
          } else if (cycle < 2.65) {
            // Dart Right
            target.rotateY = 28;
            target.rotateZ = 4;
            target.translateX = 11;
            target.leftEyeX = 14;
            target.rightEyeX = 14;
            target.leftTopLid = 0.18;
            target.rightTopLid = 0.18;
            target.rightEyeScaleX = 0.85;

            target.mouthX = 10;
            target.mouthWidth = 13;
            target.mouthOpen = 7;
            target.mouthCurve = 0.1;
            target.mouthSkew = 3.5;
          } else if (cycle < 3.0) {
            // Snap back transition
            target.translateY = -6;
            target.scaleY = 1.05;
            target.scaleX = 0.96;

            target.mouthWidth = 14;
            target.mouthOpen = 12;
          } else {
            // Front and center alert grin
            target.rotateY = 0;
            target.rotateX = Math.sin((cycle - 3.0) * 6) * 3;
            target.leftEyeX = 0;
            target.rightEyeX = 0;
            target.leftEyeScaleY = 1.08;
            target.rightEyeScaleY = 1.08;

            target.mouthX = 0;
            target.mouthWidth = 20;
            target.mouthOpen = 10;
            target.mouthCurve = 0.65;
          }
          break;
        }

        case 'suspicious': {
          // Skeptical asymmetrical squint + side-eye + head tilt
          const drift = Math.sin(elapsed * 1.8) * 2;
          target.rotateY = -14 + drift;
          target.rotateZ = 8;
          target.rotateX = -6;
          target.translateX = -4;

          // Left eye narrowed tight, right eye half squinted
          target.leftTopLid = 0.62;
          target.leftBottomLid = 0.42;
          target.leftLidAngle = 8;

          target.rightTopLid = 0.26;
          target.rightBottomLid = 0.34;
          target.rightLidAngle = -4;

          // Side-eye gaze
          target.leftEyeX = 9;
          target.rightEyeX = 9;

          // Tight, skeptical side-shifted crooked mouth line
          target.mouthVisibility = 1;
          target.mouthX = -5;
          target.mouthWidth = 17;
          target.mouthOpen = 4.5;
          target.mouthCurve = -0.25;
          target.mouthSkew = -5;
          break;
        }

        case 'sad': {
          // Heavy slumped posture + outward drooping eyelids (/ \) + slow sigh
          const sigh = Math.sin(elapsed * 1.6);
          target.rotateX = -18 + sigh * 3;
          target.rotateZ = -5 + Math.cos(elapsed * 1.2) * 2;
          target.translateY = 12 - sigh * 3;
          target.scaleX = 1.04 - sigh * 0.02;
          target.scaleY = 0.94 + sigh * 0.02;

          target.leftTopLid = 0.52;
          target.rightTopLid = 0.52;
          target.leftLidAngle = -22;  // Droops outward
          target.rightLidAngle = 22;  // Droops outward
          target.leftEyeY = 8;
          target.rightEyeY = 8;
          target.leftEyeScaleY = 0.9;
          target.rightEyeScaleY = 0.9;

          // Quivering downturned frown arc
          target.mouthVisibility = 1;
          target.mouthWidth = 20;
          target.mouthOpen = 6.5 + Math.max(0, sigh) * 2;
          target.mouthCurve = -0.9;
          target.mouthY = 5;
          target.mouthWave = Math.sin(elapsed * 18) * 0.8;
          break;
        }

        case 'happy': {
          // Cheerful upward crescent eyes (^ ^) + buoyant happy bounce & rock
          const bounce = Math.abs(Math.sin(elapsed * 5.2));
          const rock = Math.sin(elapsed * 2.6);

          target.translateY = -bounce * 12 + 3;
          target.rotateZ = rock * 7;
          target.rotateX = bounce * 8;
          target.scaleY = 0.96 + bounce * 0.08;
          target.scaleX = 1.04 - bounce * 0.06;

          target.happyCurve = 1;
          target.leftEyeY = -2;
          target.rightEyeY = -2;

          // Wide cheerful 3D carved D-smile
          target.mouthVisibility = 1;
          target.mouthWidth = 24;
          target.mouthOpen = 15 + bounce * 5;
          target.mouthCurve = 0.95;
          target.mouthY = -1;
          break;
        }

        case 'surprised': {
          // Startled backward recoil + huge wide-open capsule eyes
          const shockDecay = Math.exp(-elapsed * 3.5);
          const jitter = Math.sin(elapsed * 32) * shockDecay * 3;

          target.rotateX = 14 * shockDecay + Math.sin(elapsed * 3) * 2;
          target.translateY = -10 * shockDecay + Math.sin(elapsed * 4) * 2;
          target.translateX = jitter;
          target.scaleY = 1.07 + shockDecay * 0.06;
          target.scaleX = 0.93 - shockDecay * 0.04;

          target.leftEyeScaleX = 1.24;
          target.leftEyeScaleY = 1.28;
          target.rightEyeScaleX = 1.24;
          target.rightEyeScaleY = 1.28;
          target.leftEyeY = -2;
          target.rightEyeY = -2;

          // Tall rounded 'O' gasp mouth
          target.mouthVisibility = 1;
          target.mouthWidth = 12 + shockDecay * 3;
          target.mouthOpen = 24 + Math.sin(elapsed * 6) * 2;
          target.mouthCurve = 0;
          target.mouthY = 2;
          break;
        }

        case 'sleepy': {
          // Heavy nodding-off cycle: slowly sinks down, then jerks slightly back up
          const nodCycle = (elapsed * 0.65) % 1;
          const nodDrop = nodCycle < 0.82
            ? Math.pow(nodCycle / 0.82, 1.8)
            : 1 - Math.pow((nodCycle - 0.82) / 0.18, 0.5);

          target.rotateX = -8 - nodDrop * 16;
          target.rotateZ = 6 + nodDrop * 6;
          target.translateY = 6 + nodDrop * 10;
          target.scaleX = 1.03;
          target.scaleY = 0.96;

          target.leftTopLid = 0.72 + nodDrop * 0.18;
          target.rightTopLid = 0.72 + nodDrop * 0.18;
          target.leftBottomLid = 0.12;
          target.rightBottomLid = 0.12;
          target.leftLidAngle = -6;
          target.rightLidAngle = 6;
          target.leftEyeY = 5;
          target.rightEyeY = 5;

          // Slow rhythmic yawning / breathing oval mouth
          const yawnWave = Math.max(0, Math.sin(elapsed * 1.8));
          target.mouthVisibility = 1;
          target.mouthWidth = 10 + yawnWave * 5;
          target.mouthOpen = 7 + yawnWave * 16;
          target.mouthCurve = -0.1;
          target.mouthY = 3;
          break;
        }

        case 'confused': {
          // Puzzled head tilt + one eye wide & high, the other squinted & low
          const wobble = Math.sin(elapsed * 2.5);
          target.rotateZ = 16 + wobble * 3;
          target.rotateY = -8 + Math.cos(elapsed * 1.8) * 4;
          target.rotateX = 4;

          // Left eye squinted & angled
          target.leftTopLid = 0.48;
          target.leftBottomLid = 0.25;
          target.leftLidAngle = 14;
          target.leftEyeY = 4;

          // Right eye wide & raised
          target.rightEyeScaleY = 1.18;
          target.rightEyeScaleX = 1.12;
          target.rightEyeY = -6;
          target.rightLidAngle = 10;

          // Asymmetrical wavy squiggle mouth
          target.mouthVisibility = 1;
          target.mouthWidth = 19;
          target.mouthOpen = 6;
          target.mouthCurve = -0.2;
          target.mouthSkew = 5;
          target.mouthWave = 7 + Math.sin(elapsed * 3) * 2;
          break;
        }

        case 'thinking': {
          // Pondering upward-left gaze + chin-up rhythmic sway
          const sway = Math.sin(elapsed * 2.0);
          target.rotateX = 12 + sway * 2;
          target.rotateY = -14 + Math.cos(elapsed * 1.5) * 3;
          target.rotateZ = -7;
          target.translateY = -3;

          // Looking up and left
          target.leftEyeX = -9;
          target.rightEyeX = -9;
          target.leftEyeY = -10;
          target.rightEyeY = -10;

          // Concentrating lower lids pushed up
          target.leftBottomLid = 0.34;
          target.rightBottomLid = 0.34;

          // Pursed 'hmm' mouth shifted to the side with subtle chewing/pondering motion
          target.mouthVisibility = 1;
          target.mouthX = -8 + Math.sin(elapsed * 3.2) * 3;
          target.mouthWidth = 11;
          target.mouthOpen = 7.5;
          target.mouthCurve = -0.15;
          target.mouthSkew = -3;
          break;
        }

        case 'excited': {
          // High-energy rapid bouncing + wide sparkling eyes
          const fastJump = Math.abs(Math.sin(elapsed * 9.5));
          const wiggle = Math.sin(elapsed * 19);

          target.translateY = -fastJump * 16 + 4;
          target.rotateZ = wiggle * 6;
          target.rotateX = (fastJump - 0.5) * 14;
          target.scaleY = 0.92 + fastJump * 0.16;
          target.scaleX = 1.08 - fastJump * 0.14;

          const eyeBeat = 1.14 + Math.sin(elapsed * 19) * 0.1;
          target.leftEyeScaleX = eyeBeat;
          target.leftEyeScaleY = eyeBeat + 0.08;
          target.rightEyeScaleX = eyeBeat;
          target.rightEyeScaleY = eyeBeat + 0.08;
          target.happyCurve = 0.25;

          // Huge ecstatic open laughing D-mouth
          target.mouthVisibility = 1;
          target.mouthWidth = 26;
          target.mouthOpen = 21 + fastJump * 6;
          target.mouthCurve = 1.0;
          target.mouthY = -1;
          break;
        }

        case 'love': {
          // Recessed 3D heart-shaped eyes that pulse with a heartbeat + dreamy sway
          const sway = Math.sin(elapsed * 2.8);
          const heartBeat = Math.pow(Math.max(0, Math.sin(elapsed * 6.5)), 3);

          target.rotateZ = sway * 9;
          target.rotateY = Math.cos(elapsed * 2.8) * 8;
          target.rotateX = 5 + heartBeat * 5;
          target.translateY = Math.sin(elapsed * 5.6) * 5 - heartBeat * 4;

          target.heartMorph = 1;
          const pulseScale = 1.05 + heartBeat * 0.24;
          target.leftEyeScaleX = pulseScale;
          target.leftEyeScaleY = pulseScale;
          target.rightEyeScaleX = pulseScale;
          target.rightEyeScaleY = pulseScale;

          // Adoring sweet curved smile that pulses with the heartbeat
          target.mouthVisibility = 1;
          target.mouthWidth = 20 + heartBeat * 3;
          target.mouthOpen = 11 + heartBeat * 5;
          target.mouthCurve = 0.9;
          break;
        }

        case 'wink': {
          // Playful cheeky tilt + right eye pinches into a crisp wink arc
          const bounce = Math.sin(elapsed * 4);
          target.rotateZ = -11 + bounce * 2;
          target.rotateY = 12;
          target.rotateX = 5;
          target.translateY = -3 + Math.abs(bounce) * 3;

          target.winkRight = 1;
          target.leftEyeScaleY = 1.12;
          target.leftEyeScaleX = 1.06;
          target.leftEyeY = -2;

          // Cheeky asymmetrical upward smirk pulled toward the winking side
          target.mouthVisibility = 1;
          target.mouthX = 4;
          target.mouthWidth = 21;
          target.mouthOpen = 11;
          target.mouthCurve = 0.75;
          target.mouthSkew = 6;
          break;
        }

        case 'dizzy': {
          // Gyroscopic 3D wobble + out-of-phase orbiting eyes
          target.rotateZ = Math.sin(elapsed * 7) * 14;
          target.rotateX = Math.cos(elapsed * 7) * 14;
          target.rotateY = Math.sin(elapsed * 3.5) * 18;
          target.translateX = Math.cos(elapsed * 14) * 5;
          target.translateY = Math.sin(elapsed * 14) * 5;

          target.leftEyeX = Math.cos(elapsed * 10) * 8;
          target.leftEyeY = Math.sin(elapsed * 10) * 8;
          target.rightEyeX = Math.cos(elapsed * 10 + Math.PI) * 8;
          target.rightEyeY = Math.sin(elapsed * 10 + Math.PI) * 8;

          target.leftEyeScaleY = 0.75 + Math.sin(elapsed * 8) * 0.35;
          target.rightEyeScaleY = 0.75 + Math.cos(elapsed * 8) * 0.35;

          // Wobbly oscillating S-wave dizzy mouth
          target.mouthVisibility = 1;
          target.mouthWidth = 21;
          target.mouthOpen = 9 + Math.sin(elapsed * 9) * 3;
          target.mouthCurve = 0;
          target.mouthWave = Math.sin(elapsed * 11) * 10;
          break;
        }
      }

      // ----------------------------------------------------------------------
      // MOUTH TOGGLE OVERRIDE (Smoothly springs mouth closed when toggled OFF)
      // ----------------------------------------------------------------------
      if (!showMouth) {
        target.mouthVisibility = 0;
        target.mouthOpen = 0;
      }

      // ----------------------------------------------------------------------
      // INTERACTIVE MOUSE 3D PARALLAX OVERLAY
      // ----------------------------------------------------------------------
      if (interactiveTilt) {
        target.rotateY += mouseTargetRef.current.x * 14;
        target.rotateX -= mouseTargetRef.current.y * 12;
        target.leftEyeX += mouseTargetRef.current.x * 4.5;
        target.rightEyeX += mouseTargetRef.current.x * 4.5;
        target.leftEyeY += mouseTargetRef.current.y * 4.5;
        target.rightEyeY += mouseTargetRef.current.y * 4.5;
        target.mouthX += mouseTargetRef.current.x * 3.2;
        target.mouthY += mouseTargetRef.current.y * 2.5;
      }

      // ----------------------------------------------------------------------
      // AUTONOMOUS NATURAL BLINKING ENGINE
      // ----------------------------------------------------------------------
      const bState = blinkStateRef.current;
      const canAutoBlink = !['happy', 'love', 'sleepy', 'wink'].includes(state);

      if (canAutoBlink && !bState.isBlinking && now >= bState.nextBlinkTime) {
        bState.isBlinking = true;
        bState.blinkProgress = 0;
        // 25% chance of a natural quick double-blink
        if (!bState.doubleBlinkPending && Math.random() < 0.25) {
          bState.doubleBlinkPending = true;
        }
      }

      if (bState.isBlinking) {
        bState.blinkProgress += rawDt * 7.5; // Fast 130ms blink
        if (bState.blinkProgress >= 1) {
          bState.isBlinking = false;
          bState.blinkProgress = 0;
          if (bState.doubleBlinkPending) {
            bState.doubleBlinkPending = false;
            bState.nextBlinkTime = now + 140;
          } else {
            bState.nextBlinkTime = now + 2200 + Math.random() * 2800;
          }
        } else {
          const blinkCurve = Math.sin(bState.blinkProgress * Math.PI);
          target.leftTopLid = Math.max(target.leftTopLid, blinkCurve * 0.95);
          target.rightTopLid = Math.max(target.rightTopLid, blinkCurve * 0.95);
          target.leftBottomLid = Math.max(target.leftBottomLid, blinkCurve * 0.25);
          target.rightBottomLid = Math.max(target.rightBottomLid, blinkCurve * 0.25);
        }
      }

      // ----------------------------------------------------------------------
      // DAMPED SPRING PHYSICS SOLVER (Smooth transitions between any states)
      // ----------------------------------------------------------------------
      const stiffness = state === 'talking' || state === 'excited' ? 260 : 170;
      const damping = state === 'surprised' ? 14 : 20;

      const cur = currentPoseRef.current;
      const vel = velocityRef.current;
      const nextPose: AnimatedPose = { ...cur };

      (Object.keys(DEFAULT_POSE) as Array<keyof AnimatedPose>).forEach((key) => {
        const displacement = target[key] - cur[key];
        const springForce = displacement * stiffness;
        const dampingForce = -vel[key] * damping;
        const acceleration = springForce + dampingForce;

        vel[key] += acceleration * rawDt;
        nextPose[key] = cur[key] + vel[key] * rawDt;
      });

      currentPoseRef.current = nextPose;
      setPose(nextPose);

      animationFrameId = requestAnimationFrame(updateAnimation);
    };

    animationFrameId = requestAnimationFrame(updateAnimation);
    return () => cancelAnimationFrame(animationFrameId);
  }, [state, speed, interactiveTilt, showMouth]);

  // Mouse handlers for optional 3D cursor tracking
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!interactiveTilt || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const normX = Math.max(-1, Math.min(1, (e.clientX - centerX) / (rect.width * 0.7)));
      const normY = Math.max(-1, Math.min(1, (e.clientY - centerY) / (rect.height * 0.7)));
      mouseTargetRef.current = { x: normX, y: normY };
    },
    [interactiveTilt]
  );

  const handleMouseLeave = useCallback(() => {
    mouseTargetRef.current = { x: 0, y: 0 };
  }, []);

  // Unique SVG gradient/filter IDs per component instance
  const uid = useId();

  // Compute dynamic 3D lighting offset from body rotation
  const lightShiftX = -pose.rotateY * 0.8;
  const lightShiftY = pose.rotateX * 0.8;

  // Compute dynamic 3D side-extrusion offset so rotating the face reveals solid 3D thickness
  const extrudeX = -pose.rotateY * 0.42;
  const extrudeY = pose.rotateX * 0.42 + 4;

  // Helper to render each recessed 3D eye with eyelids, happy arcs, or heart morph
  const renderRecessedEye = (side: 'left' | 'right') => {
    const isLeft = side === 'left';
    const baseCx = isLeft ? 114 : 186;
    const baseCy = 122;
    const eyeW = 30;
    const eyeH = 66;
    const eyeRx = 15;

    const offsetX = isLeft ? pose.leftEyeX : pose.rightEyeX;
    const offsetY = isLeft ? pose.leftEyeY : pose.rightEyeY;
    const scaleX = isLeft ? pose.leftEyeScaleX : pose.rightEyeScaleX;
    const scaleY = isLeft ? pose.leftEyeScaleY : pose.rightEyeScaleY;
    const topLid = Math.min(1, Math.max(0, isLeft ? pose.leftTopLid : pose.rightTopLid));
    const bottomLid = Math.min(1, Math.max(0, isLeft ? pose.leftBottomLid : pose.rightBottomLid));
    const lidAngle = isLeft ? pose.leftLidAngle : pose.rightLidAngle;

    const clipId = `${uid}-${side}-eye-clip`;
    const winkAmount = !isLeft ? pose.winkRight : 0;
    const happyAmount = Math.max(pose.happyCurve, winkAmount);
    const heartAmount = pose.heartMorph;

    // Heart path centered around (baseCx, baseCy)
    const heartPath = `
      M ${baseCx} ${baseCy + 26}
      C ${baseCx - 8} ${baseCy + 18}, ${baseCx - 26} ${baseCy + 4}, ${baseCx - 26} ${baseCy - 12}
      C ${baseCx - 26} ${baseCy - 24}, ${baseCx - 16} ${baseCy - 31}, ${baseCx - 6} ${baseCy - 31}
      C ${baseCx - 1} ${baseCy - 31}, ${baseCx + 0} ${baseCy - 26}, ${baseCx} ${baseCy - 21}
      C ${baseCx} ${baseCy - 26}, ${baseCx + 1} ${baseCy - 31}, ${baseCx + 6} ${baseCy - 31}
      C ${baseCx + 16} ${baseCy - 31}, ${baseCx + 26} ${baseCy - 24}, ${baseCx + 26} ${baseCy - 12}
      C ${baseCx + 26} ${baseCy + 4}, ${baseCx + 8} ${baseCy + 18}, ${baseCx} ${baseCy + 26}
      Z
    `;

    return (
      <g
        key={side}
        transform={`translate(${baseCx + offsetX}, ${baseCy + offsetY}) scale(${scaleX}, ${scaleY}) translate(${-baseCx}, ${-baseCy})`}
      >
        <defs>
          <clipPath id={clipId}>
            {heartAmount > 0.5 ? (
              <path d={heartPath} />
            ) : (
              <rect
                x={baseCx - eyeW / 2}
                y={baseCy - eyeH / 2}
                width={eyeW}
                height={eyeH}
                rx={eyeRx}
                ry={eyeRx}
              />
            )}
          </clipPath>
        </defs>

        {/* 1. Standard or Heart 3D Carved Eye Socket (fades out when morphing into full happy crescent arc) */}
        <g opacity={Math.max(0, 1 - happyAmount * 1.15)}>
          {/* Outer Rim Bottom-Right Specular Catch-Light (simulates light hitting the lower lip of the carved hole) */}
          {heartAmount > 0.5 ? (
            <path
              d={heartPath}
              transform="translate(1.5, 2.2)"
              fill="none"
              stroke={palette.eyeRimHighlight}
              strokeWidth="3.5"
              opacity="0.7"
            />
          ) : (
            <rect
              x={baseCx - eyeW / 2 + 1}
              y={baseCy - eyeH / 2 + 2}
              width={eyeW}
              height={eyeH}
              rx={eyeRx}
              ry={eyeRx}
              fill="none"
              stroke={palette.eyeRimHighlight}
              strokeWidth="3.5"
              opacity="0.75"
            />
          )}

          {/* Outer Rim Top-Left Bevel Shadow */}
          {heartAmount > 0.5 ? (
            <path
              d={heartPath}
              transform="translate(-1.2, -1.8)"
              fill="none"
              stroke={palette.deepShadow}
              strokeWidth="3.5"
              opacity="0.85"
            />
          ) : (
            <rect
              x={baseCx - eyeW / 2 - 1}
              y={baseCy - eyeH / 2 - 1.5}
              width={eyeW}
              height={eyeH}
              rx={eyeRx}
              ry={eyeRx}
              fill="none"
              stroke={palette.deepShadow}
              strokeWidth="3.5"
              opacity="0.85"
            />
          )}

          {/* Main Recessed Eye Cavity Interior */}
          <g clipPath={`url(#${clipId})`}>
            {/* Base Dark Cavity Fill */}
            <rect
              x={baseCx - 45}
              y={baseCy - 55}
              width={90}
              height={110}
              fill={eyeStyle === 'glowing-led' ? palette.eyeGlow : palette.eyeCavity}
            />

            {/* Deep 3D Inner Socket Wall Shadow (Top & Left interior depth) */}
            {eyeStyle === 'carved-matte' && (
              <>
                <rect
                  x={baseCx - eyeW / 2 - 4}
                  y={baseCy - eyeH / 2 - 4}
                  width={eyeW + 8}
                  height={eyeH + 8}
                  rx={eyeRx + 2}
                  fill="none"
                  stroke={palette.eyeDeepSocket}
                  strokeWidth="10"
                  transform="translate(3, 5)"
                  opacity="0.9"
                />
                {/* Soft vertical depth gradient inside cavity */}
                <rect
                  x={baseCx - 40}
                  y={baseCy - 50}
                  width={80}
                  height={100}
                  fill={`url(#${uid}-eye-depth)`}
                  opacity="0.7"
                />
              </>
            )}

            {/* -------------------------------------------------------------- */}
            {/* 3D MOLDED EYELID SHUTTERS (Rotate & slide to form expressions) */}
            {/* -------------------------------------------------------------- */}
            <g transform={`rotate(${lidAngle}, ${baseCx}, ${baseCy})`}>
              {/* Upper Eyelid (Same 3D surface color as face, with bottom rim shadow) */}
              {topLid > 0.01 && (
                <g
                  transform={`translate(0, ${
                    -eyeH + topLid * (eyeH + 8)
                  })`}
                >
                  {/* Eyelid drop shadow onto the dark eye cavity */}
                  <rect
                    x={baseCx - 45}
                    y={baseCy - eyeH / 2 - 20}
                    width={90}
                    height={eyeH + 26}
                    fill={palette.eyeDeepSocket}
                    opacity="0.65"
                  />
                  {/* Eyelid 3D surface body */}
                  <rect
                    x={baseCx - 45}
                    y={baseCy - eyeH / 2 - 24}
                    width={90}
                    height={eyeH + 24}
                    fill={palette.base}
                  />
                  {/* Eyelid bottom bevel edge */}
                  <line
                    x1={baseCx - 45}
                    y1={baseCy + eyeH / 2}
                    x2={baseCx + 45}
                    y2={baseCy + eyeH / 2}
                    stroke={palette.shadow}
                    strokeWidth="3.5"
                  />
                </g>
              )}

              {/* Lower Eyelid (Rises from bottom for squints, thinking, happy, suspicious) */}
              {bottomLid > 0.01 && (
                <g
                  transform={`translate(0, ${
                    eyeH - bottomLid * (eyeH + 8)
                  })`}
                >
                  <rect
                    x={baseCx - 45}
                    y={baseCy - eyeH / 2}
                    width={90}
                    height={eyeH + 25}
                    fill={palette.base}
                  />
                  {/* Lower lid top catch-light */}
                  <line
                    x1={baseCx - 45}
                    y1={baseCy - eyeH / 2}
                    x2={baseCx + 45}
                    y2={baseCy - eyeH / 2}
                    stroke={palette.highlight}
                    strokeWidth="2.5"
                    opacity="0.75"
                  />
                </g>
              )}
            </g>
          </g>
        </g>

        {/* 2. Carved 3D Happy / Wink Crescent Arc (^ ^) when happy or winking */}
        {happyAmount > 0.05 && (
          <g
            opacity={Math.min(1, happyAmount * 1.2)}
            transform={`translate(0, ${(1 - happyAmount) * 6})`}
          >
            {/* Bottom bevel highlight of the carved arc */}
            <path
              d={`M ${baseCx - 17} ${baseCy + 8} Q ${baseCx} ${baseCy - 24} ${baseCx + 17} ${baseCy + 8}`}
              fill="none"
              stroke={palette.eyeRimHighlight}
              strokeWidth="15"
              strokeLinecap="round"
              transform="translate(0, 2.5)"
              opacity="0.65"
            />
            {/* Top bevel shadow of the carved arc */}
            <path
              d={`M ${baseCx - 17} ${baseCy + 8} Q ${baseCx} ${baseCy - 24} ${baseCx + 17} ${baseCy + 8}`}
              fill="none"
              stroke={palette.deepShadow}
              strokeWidth="15"
              strokeLinecap="round"
              transform="translate(0, -1.5)"
              opacity="0.85"
            />
            {/* Deep recessed interior of the happy arc */}
            <path
              d={`M ${baseCx - 17} ${baseCy + 8} Q ${baseCx} ${baseCy - 24} ${baseCx + 17} ${baseCy + 8}`}
              fill="none"
              stroke={eyeStyle === 'glowing-led' ? palette.eyeGlow : palette.eyeCavity}
              strokeWidth="13"
              strokeLinecap="round"
            />
          </g>
        )}
      </g>
    );
  };

  // Helper to render the 3D Recessed Mouth (Active in all states EXCEPT 'resting')
  const renderRecessedMouth = () => {
    if (pose.mouthVisibility <= 0.01 || pose.mouthOpen <= 0.4) return null;

    const vis = Math.min(1, Math.max(0, pose.mouthVisibility));
    const cx = 150 + pose.mouthX;
    const cy = 194 + pose.mouthY;
    const w = Math.max(8, pose.mouthWidth) * (0.65 + 0.35 * vis);
    const open = Math.max(1.5, pose.mouthOpen * vis);
    const curve = pose.mouthCurve; // +1 = smile, 0 = oval, -1 = frown
    const skew = pose.mouthSkew;   // corner tilt
    const wave = pose.mouthWave;   // S-curve wave

    // Left & Right mouth corners
    const leftX = cx - w;
    const rightX = cx + w;
    const leftY = cy - curve * 4 + skew;
    const rightY = cy - curve * 4 - skew;

    // Top & Bottom lip apexes
    let topMidY: number;
    let botMidY: number;

    if (curve >= 0) {
      // Smile / D-mouth / Oval: Top lip stays gently curved or flat while bottom lip drops into a deep D-cup
      topMidY = cy - open * (0.48 - curve * 0.36) + curve * 2;
      botMidY = cy + open * (0.52 + curve * 0.48) + curve * 5;
    } else {
      // Frown / Scowl: Center arches upward while corners droop down
      const f = -curve;
      topMidY = cy - open * 0.48 - f * 9;
      botMidY = cy + open * 0.52 - f * 5;
    }

    const cpOffset = w * 0.56;
    const mouthPath = `
      M ${leftX} ${leftY}
      C ${cx - cpOffset} ${topMidY + wave}, ${cx + cpOffset} ${topMidY - wave}, ${rightX} ${rightY}
      C ${cx + cpOffset} ${botMidY - wave}, ${cx - cpOffset} ${botMidY + wave}, ${leftX} ${leftY}
      Z
    `;

    const mouthClipId = `${uid}-mouth-clip`;

    return (
      <g opacity={vis}>
        <defs>
          <clipPath id={mouthClipId}>
            <path d={mouthPath} />
          </clipPath>
        </defs>

        {/* 1. Bottom-Right Outer Rim Catch-Light (simulates light catching the lower carved lip of the mouth) */}
        <path
          d={mouthPath}
          transform="translate(1.2, 2.2)"
          fill="none"
          stroke={palette.eyeRimHighlight}
          strokeWidth="3.8"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.78"
        />

        {/* 2. Top-Left Outer Rim Bevel Shadow */}
        <path
          d={mouthPath}
          transform="translate(-1.2, -1.8)"
          fill="none"
          stroke={palette.deepShadow}
          strokeWidth="3.8"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.88"
        />

        {/* 3. Main Recessed 3D Mouth Cavity Interior */}
        <g clipPath={`url(#${mouthClipId})`}>
          {/* Base Cavity Fill (matches the recessed eyes) */}
          <rect
            x={cx - w - 25}
            y={cy - 45}
            width={(w + 25) * 2}
            height={90}
            fill={eyeStyle === 'glowing-led' ? palette.eyeGlow : palette.eyeCavity}
          />

          {/* Deep 3D Inner Top/Left Socket Wall Shadow */}
          {eyeStyle === 'carved-matte' && (
            <>
              <path
                d={mouthPath}
                fill="none"
                stroke={palette.eyeDeepSocket}
                strokeWidth="10"
                strokeLinejoin="round"
                transform="translate(2.5, 4.5)"
                opacity="0.92"
              />
              <rect
                x={cx - w - 20}
                y={cy - 40}
                width={(w + 20) * 2}
                height={80}
                fill={`url(#${uid}-eye-depth)`}
                opacity="0.65"
              />
            </>
          )}
        </g>
      </g>
    );
  };

  // 16 3D Cylindrical Metallic-Grey IC Pins (4 Top, 4 Bottom, 4 Left, 4 Right)
  // Matches the exact close-up reference image with cylindrical shading, rounded dome tips, and contact shadows
  const render3DPins = () => {
    if (!showPins) return null;
    // Pin centers align with the corner grooves: Pin 3 (173) and Pin 4 (218) frame the double groove (183..201)
    const pinPositions = [82, 127, 173, 218];
    const pinParallaxX = extrudeX * 0.45;
    const pinParallaxY = extrudeY * 0.45;

    return (
      <g>
        {/* 3D Depth Extrusion Under-Layer for all 16 Pins */}
        <g
          transform={`translate(${extrudeX * 0.95}, ${extrudeY * 0.95})`}
          fill="#3E4246"
          opacity="0.9"
        >
          {pinPositions.map((pos, i) => (
            <React.Fragment key={`pin-extrude-${i}`}>
              <rect x={pos - 10.5} y={8} width={21} height={44} rx={10.5} />
              <rect x={pos - 10.5} y={248} width={21} height={44} rx={10.5} />
              <rect x={8} y={pos - 10.5} width={44} height={21} rx={10.5} />
              <rect x={248} y={pos - 10.5} width={44} height={21} rx={10.5} />
            </React.Fragment>
          ))}
        </g>

        {/* Main 3D Molded Cylindrical Pins */}
        <g transform={`translate(${pinParallaxX}, ${pinParallaxY})`}>
          {/* TOP 4 PINS */}
          {pinPositions.map((x, i) => (
            <g key={`top-${i}`}>
              {/* Cylindrical Body */}
              <rect
                x={x - 10.5}
                y={8}
                width={21}
                height={44}
                rx={10.5}
                fill={`url(#${uid}-pin-v)`}
              />
              {/* 3D Spherical Dome Tip Shading */}
              <circle cx={x} cy={18.5} r={10.5} fill={`url(#${uid}-pin-tip-top)`} />
              {/* Cylindrical Specular Ridge Highlight */}
              <rect
                x={x - 6.5}
                y={12}
                width={5.5}
                height={32}
                rx={2.75}
                fill="#FFFFFF"
                opacity="0.48"
              />
              {/* Base Ambient Occlusion Contact Shadow where pin meets green chip body */}
              <rect
                x={x - 10.5}
                y={39}
                width={21}
                height={8}
                fill={`url(#${uid}-ao-top)`}
              />
            </g>
          ))}

          {/* BOTTOM 4 PINS */}
          {pinPositions.map((x, i) => (
            <g key={`bot-${i}`}>
              {/* Cylindrical Body */}
              <rect
                x={x - 10.5}
                y={248}
                width={21}
                height={44}
                rx={10.5}
                fill={`url(#${uid}-pin-v)`}
              />
              {/* 3D Spherical Dome Tip Shading */}
              <circle cx={x} cy={281.5} r={10.5} fill={`url(#${uid}-pin-tip-bot)`} />
              {/* Cylindrical Specular Ridge Highlight */}
              <rect
                x={x - 6.5}
                y={255}
                width={5.5}
                height={31}
                rx={2.75}
                fill="#FFFFFF"
                opacity="0.42"
              />
              {/* Base Ambient Occlusion Contact Shadow where pin meets green chip body */}
              <rect
                x={x - 10.5}
                y={253}
                width={21}
                height={9}
                fill={`url(#${uid}-ao-bot)`}
              />
            </g>
          ))}

          {/* LEFT 4 PINS */}
          {pinPositions.map((y, i) => (
            <g key={`left-${i}`}>
              {/* Cylindrical Body */}
              <rect
                x={8}
                y={y - 10.5}
                width={44}
                height={21}
                rx={10.5}
                fill={`url(#${uid}-pin-h)`}
              />
              {/* 3D Spherical Dome Tip Shading */}
              <circle cx={18.5} cy={y} r={10.5} fill={`url(#${uid}-pin-tip-left)`} />
              {/* Cylindrical Top Specular Ridge Highlight */}
              <rect
                x={12}
                y={y - 6.5}
                width={32}
                height={5.5}
                rx={2.75}
                fill="#FFFFFF"
                opacity="0.48"
              />
              {/* Base Ambient Occlusion Contact Shadow where pin meets green chip body */}
              <rect
                x={39}
                y={y - 10.5}
                width={8}
                height={21}
                fill={`url(#${uid}-ao-left)`}
              />
            </g>
          ))}

          {/* RIGHT 4 PINS (Matches close-up reference image 1000023089.webp) */}
          {pinPositions.map((y, i) => (
            <g key={`right-${i}`}>
              {/* Cylindrical Body */}
              <rect
                x={248}
                y={y - 10.5}
                width={44}
                height={21}
                rx={10.5}
                fill={`url(#${uid}-pin-h)`}
              />
              {/* 3D Spherical Dome Tip Shading */}
              <circle cx={281.5} cy={y} r={10.5} fill={`url(#${uid}-pin-tip-right)`} />
              {/* Cylindrical Top Specular Ridge Highlight */}
              <rect
                x={255}
                y={y - 6.5}
                width={31}
                height={5.5}
                rx={2.75}
                fill="#FFFFFF"
                opacity="0.48"
              />
              {/* Base Ambient Occlusion Contact Shadow where pin meets green chip body */}
              <rect
                x={253}
                y={y - 10.5}
                width={9}
                height={21}
                fill={`url(#${uid}-ao-right)`}
              />
            </g>
          ))}
        </g>
      </g>
    );
  };

  // ViewBox includes all 16 pins by default
  const viewBox = showPins ? '0 0 300 300' : '32 32 236 236';

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative select-none inline-flex items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        perspective: '900px',
      }}
    >
      {/* Dynamic 3D Floor Ambient Contact Shadow (moves & scales with body bounce/tilt) */}
      <div
        className="pointer-events-none absolute rounded-full transition-transform duration-75"
        style={{
          width: '68%',
          height: '13%',
          bottom: showPins ? '2%' : '3%',
          background: 'radial-gradient(ellipse at center, rgba(15, 23, 20, 0.42) 0%, rgba(15, 23, 20, 0) 72%)',
          transform: `translateX(${pose.translateX * 0.9 + pose.rotateY * 0.45}px) scale(${
            1 - pose.translateY * 0.008
          }, ${1 - Math.abs(pose.translateY) * 0.01})`,
          filter: 'blur(6px)',
        }}
      />

      {/* Main 3D Transformed Character Rig */}
      <div
        className="w-full h-full will-change-transform"
        style={{
          transformStyle: 'preserve-3d',
          transform: `
            translate3d(${pose.translateX}px, ${pose.translateY}px, 0px)
            rotateX(${pose.rotateX}deg)
            rotateY(${pose.rotateY}deg)
            rotateZ(${pose.rotateZ}deg)
            scale3d(${pose.scaleX}, ${pose.scaleY}, 1)
          `,
        }}
      >
        <svg
          viewBox={viewBox}
          className="w-full h-full overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* 1. Primary 3D Matte-Clay Body Surface Gradient */}
            <linearGradient
              id={`${uid}-body-surface`}
              x1={`${15 + lightShiftX}%`}
              y1={`${10 + lightShiftY}%`}
              x2={`${90 + lightShiftX}%`}
              y2={`${92 + lightShiftY}%`}
            >
              <stop offset="0%" stopColor={palette.surfaceLight} />
              <stop offset="48%" stopColor={palette.base} />
              <stop offset="100%" stopColor={palette.shadow} />
            </linearGradient>

            {/* 2. Top-Left 3D Rim Specular Bevel Gradient */}
            <linearGradient id={`${uid}-bevel-light`} x1="0%" y1="0%" x2="85%" y2="85%">
              <stop offset="0%" stopColor={palette.highlight} stopOpacity="0.95" />
              <stop offset="38%" stopColor={palette.highlight} stopOpacity="0.35" />
              <stop offset="65%" stopColor={palette.base} stopOpacity="0" />
            </linearGradient>

            {/* 3. Bottom-Right 3D Rim Shadow Bevel Gradient */}
            <linearGradient id={`${uid}-bevel-shadow`} x1="15%" y1="15%" x2="100%" y2="100%">
              <stop offset="35%" stopColor={palette.base} stopOpacity="0" />
              <stop offset="75%" stopColor={palette.shadow} stopOpacity="0.65" />
              <stop offset="100%" stopColor={palette.deepShadow} stopOpacity="0.95" />
            </linearGradient>

            {/* 4. Soft Corner 3D Specular Sheen (Matches top-right & top-left soft clay shine in photo) */}
            <radialGradient id={`${uid}-corner-specular-tr`} cx="82%" cy="18%" r="32%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.38" />
              <stop offset="45%" stopColor={palette.highlight} stopOpacity="0.22" />
              <stop offset="100%" stopColor={palette.base} stopOpacity="0" />
            </radialGradient>

            <radialGradient id={`${uid}-corner-specular-tl`} cx="18%" cy="18%" r="36%">
              <stop offset="0%" stopColor={palette.highlight} stopOpacity="0.55" />
              <stop offset="55%" stopColor={palette.surfaceLight} stopOpacity="0.18" />
              <stop offset="100%" stopColor={palette.base} stopOpacity="0" />
            </radialGradient>

            {/* 5. Eye Cavity Vertical Depth Gradient */}
            <linearGradient id={`${uid}-eye-depth`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.65" />
              <stop offset="45%" stopColor="#000000" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.06" />
            </linearGradient>

            {/* 6. Clip Path for the Green 3D Squircle Face */}
            <clipPath id={`${uid}-face-clip`}>
              <rect x="44" y="44" width="212" height="212" rx="34" ry="34" />
            </clipPath>

            {/* 7. Soft Blur Filter for 3D Molded Bevels */}
            <filter id={`${uid}-soft-bevel`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4.5" />
            </filter>

            {/* 8. Realistic 3D Cylindrical Pin Gradients & Contact Shadows */}
            <linearGradient id={`${uid}-pin-v`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#A6ACB0" />
              <stop offset="26%" stopColor="#D8DCDF" />
              <stop offset="55%" stopColor="#9A9FA4" />
              <stop offset="84%" stopColor="#61666A" />
              <stop offset="100%" stopColor="#484C50" />
            </linearGradient>

            <linearGradient id={`${uid}-pin-h`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#A6ACB0" />
              <stop offset="26%" stopColor="#D8DCDF" />
              <stop offset="55%" stopColor="#9A9FA4" />
              <stop offset="84%" stopColor="#61666A" />
              <stop offset="100%" stopColor="#484C50" />
            </linearGradient>

            {/* Spherical 3D Dome Cap Gradients for Pin Tips */}
            <radialGradient id={`${uid}-pin-tip-right`} cx="32%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#E2E6E9" stopOpacity="0.7" />
              <stop offset="55%" stopColor="#9A9FA4" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#3B3F42" stopOpacity="0.75" />
            </radialGradient>
            <radialGradient id={`${uid}-pin-tip-left`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#E6EAEC" stopOpacity="0.75" />
              <stop offset="55%" stopColor="#9A9FA4" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#3B3F42" stopOpacity="0.65" />
            </radialGradient>
            <radialGradient id={`${uid}-pin-tip-top`} cx="32%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#E6EAEC" stopOpacity="0.75" />
              <stop offset="55%" stopColor="#9A9FA4" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#3B3F42" stopOpacity="0.65" />
            </radialGradient>
            <radialGradient id={`${uid}-pin-tip-bot`} cx="32%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#DDE1E4" stopOpacity="0.6" />
              <stop offset="55%" stopColor="#9A9FA4" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#35393C" stopOpacity="0.8" />
            </radialGradient>

            {/* Pin-to-Body Ambient Occlusion Contact Shadows */}
            <linearGradient id={`${uid}-ao-right`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#14231F" stopOpacity="0.62" />
              <stop offset="100%" stopColor="#14231F" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${uid}-ao-left`} x1="100%" y1="0%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#14231F" stopOpacity="0.52" />
              <stop offset="100%" stopColor="#14231F" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${uid}-ao-top`} x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#14231F" stopOpacity="0.52" />
              <stop offset="100%" stopColor="#14231F" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${uid}-ao-bot`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#14231F" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#14231F" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* 16 3D Cylindrical Metallic-Grey IC Pins */}
          {render3DPins()}

          {/* ================================================================ */}
          {/* 3D EXTRUSION BACK-PLATES (Gives real physical 3D thickness)      */}
          {/* ================================================================ */}
          <rect
            x={44 + extrudeX * 1.15}
            y={44 + extrudeY * 1.15}
            width="212"
            height="212"
            rx="34"
            ry="34"
            fill={palette.deepShadow}
          />
          <rect
            x={44 + extrudeX * 0.6}
            y={44 + extrudeY * 0.6}
            width="212"
            height="212"
            rx="34"
            ry="34"
            fill={palette.shadow}
          />

          {/* ================================================================ */}
          {/* MAIN GREEN 3D MOLDED CHIP FACE                                   */}
          {/* ================================================================ */}
          <g clipPath={`url(#${uid}-face-clip)`}>
            {/* Base 3D Shaded Squircle Body */}
            <rect
              x="44"
              y="44"
              width="212"
              height="212"
              rx="34"
              ry="34"
              fill={`url(#${uid}-body-surface)`}
            />

            {/* Soft 3D Corner Cushion Highlights (Top-Left & Top-Right Specular Sheen) */}
            <rect
              x="44"
              y="44"
              width="212"
              height="212"
              rx="34"
              ry="34"
              fill={`url(#${uid}-corner-specular-tl)`}
            />
            <rect
              x="44"
              y="44"
              width="212"
              height="212"
              rx="34"
              ry="34"
              fill={`url(#${uid}-corner-specular-tr)`}
            />

            {/* Inner 3D Molded Cushion Bevel — Bottom-Right Deep Shadow */}
            <rect
              x="40"
              y="40"
              width="220"
              height="220"
              rx="38"
              ry="38"
              fill="none"
              stroke={`url(#${uid}-bevel-shadow)`}
              strokeWidth="18"
              filter={`url(#${uid}-soft-bevel)`}
              transform="translate(-4, -4)"
            />

            {/* Inner 3D Molded Cushion Bevel — Top-Left Bright Rim Light */}
            <rect
              x="48"
              y="48"
              width="204"
              height="204"
              rx="30"
              ry="30"
              fill="none"
              stroke={`url(#${uid}-bevel-light)`}
              strokeWidth="10"
              filter={`url(#${uid}-soft-bevel)`}
              transform="translate(2, 2)"
            />

            {/* ============================================================== */}
            {/* CARVED 3D BOTTOM-CORNER CIRCUIT GROOVES (Matches Reference)    */}
            {/* ============================================================== */}
            <g strokeLinecap="round" strokeLinejoin="round" fill="none">
              {/* Bottom-Left Outer Groove (Highlight + Recessed Trench) */}
              <path
                d="M 42 184.5 L 80 184.5 L 106 210.5 L 106 258"
                stroke={palette.grooveHighlight}
                strokeWidth="5.5"
                opacity="0.55"
              />
              <path
                d="M 42 183 L 81 183 L 107 209 L 107 258"
                stroke={palette.grooveShadow}
                strokeWidth="4.5"
                opacity="0.9"
              />

              {/* Bottom-Left Inner Groove (Highlight + Recessed Trench) */}
              <path
                d="M 42 198.5 L 74 198.5 L 93 217.5 L 93 258"
                stroke={palette.grooveHighlight}
                strokeWidth="5"
                opacity="0.55"
              />
              <path
                d="M 42 197 L 75 197 L 94 216 L 94 258"
                stroke={palette.grooveShadow}
                strokeWidth="4"
                opacity="0.9"
              />

              {/* Bottom-Right Outer Groove (Highlight + Recessed Trench) */}
              <path
                d="M 258 184.5 L 220 184.5 L 194 210.5 L 194 258"
                stroke={palette.grooveHighlight}
                strokeWidth="5.5"
                opacity="0.55"
              />
              <path
                d="M 258 183 L 219 183 L 193 209 L 193 258"
                stroke={palette.grooveShadow}
                strokeWidth="4.5"
                opacity="0.9"
              />

              {/* Bottom-Right Inner Groove (Highlight + Recessed Trench) */}
              <path
                d="M 258 198.5 L 226 198.5 L 207 217.5 L 207 258"
                stroke={palette.grooveHighlight}
                strokeWidth="5"
                opacity="0.55"
              />
              <path
                d="M 258 197 L 225 197 L 206 216 L 206 258"
                stroke={palette.grooveShadow}
                strokeWidth="4"
                opacity="0.9"
              />
            </g>

            {/* ============================================================== */}
            {/* RECESSED 3D EYES & MOUTH (Mouth hidden in 'resting' or if off) */}
            {/* ============================================================== */}
            {renderRecessedEye('left')}
            {renderRecessedEye('right')}
            {renderRecessedMouth()}

            {/* Outer Subtle Edge Contour Rim */}
            <rect
              x="44.75"
              y="44.75"
              width="210.5"
              height="210.5"
              rx="33.5"
              ry="33.5"
              fill="none"
              stroke={palette.deepShadow}
              strokeWidth="1.5"
              opacity="0.35"
            />
          </g>
        </svg>
      </div>
    </div>
  );
};
