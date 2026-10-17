import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  MessageSquare,
  Flame,
  ArrowLeft,
  ArrowRight,
  ScanEye,
  Eye,
  Frown,
  Smile,
  Zap,
  Moon,
  HelpCircle,
  Brain,
  Heart,
  RefreshCw,
  Code2,
  Palette,
  Sliders,
  Play,
  Pause,
  Copy,
  Check,
  Volume2,
  Layers,
  Cpu,
  MousePointer,
  RotateCcw,
  EyeOff,
} from 'lucide-react';
import { ChipFace, type ChipExpressionState } from './bot-ui';
import {
  CHIP_COLOR_THEMES,
  createChipPaletteFromHex,
} from './bot-palettes';

// ============================================================================
// 4. INTERACTIVE SHOWCASE & STATE CONTROLLER STUDIO
// ============================================================================

interface ExpressionMeta {
  id: ChipExpressionState;
  label: string;
  category: 'Core' | 'Gaze & Motion' | 'Emotions';
  description: string;
  icon: React.ReactNode;
}

const EXPRESSION_LIST: ExpressionMeta[] = [
  {
    id: 'resting',
    label: 'Resting',
    category: 'Core',
    description: 'Reference state (eyes only, no mouth) with 3D breathing float & natural blinks',
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    id: 'talking',
    label: 'Talking',
    category: 'Core',
    description: 'Lip-synced 3D recessed mouth & pulsing eyes with syllable-driven 3D bounce',
    icon: <MessageSquare className="w-4 h-4" />,
  },
  {
    id: 'happy',
    label: 'Happy',
    category: 'Emotions',
    description: 'Carved 3D upward eye arcs (^ ^) + cheerful open D-smile & joyful bounce',
    icon: <Smile className="w-4 h-4" />,
  },
  {
    id: 'angry',
    label: 'Angry',
    category: 'Emotions',
    description: 'Inward-slanted eyelids + downturned 3D scowl mouth & boiling forward tremor',
    icon: <Flame className="w-4 h-4" />,
  },
  {
    id: 'looking-left',
    label: 'Look Left',
    category: 'Gaze & Motion',
    description: 'Eyes & curious side-smirk shift left as the 3D chip body yaws left',
    icon: <ArrowLeft className="w-4 h-4" />,
  },
  {
    id: 'looking-right',
    label: 'Look Right',
    category: 'Gaze & Motion',
    description: 'Eyes & curious side-smirk shift right as the 3D chip body yaws right',
    icon: <ArrowRight className="w-4 h-4" />,
  },
  {
    id: 'look-around',
    label: 'Left → Right → Front',
    category: 'Gaze & Motion',
    description: 'Darts left & right with reactive mouth, then snaps front with an alert grin',
    icon: <ScanEye className="w-4 h-4" />,
  },
  {
    id: 'suspicious',
    label: 'Suspicious',
    category: 'Emotions',
    description: 'Asymmetrical tight eye squint + skeptical side-shifted crooked mouth',
    icon: <Eye className="w-4 h-4" />,
  },
  {
    id: 'sad',
    label: 'Sad',
    category: 'Emotions',
    description: 'Outward-drooping eyelids + quivering downturned 3D frown & heavy sigh',
    icon: <Frown className="w-4 h-4" />,
  },
  {
    id: 'surprised',
    label: 'Surprised',
    category: 'Emotions',
    description: 'Sudden 3D recoil jolt with wide eyes & tall rounded "O" gasp mouth',
    icon: <Zap className="w-4 h-4" />,
  },
  {
    id: 'sleepy',
    label: 'Sleepy',
    category: 'Emotions',
    description: 'Heavy drooping eyelids + slow rhythmic yawning oval mouth & head nod',
    icon: <Moon className="w-4 h-4" />,
  },
  {
    id: 'confused',
    label: 'Confused',
    category: 'Emotions',
    description: 'Asymmetrical eyes + wavy S-curve squiggle mouth & puzzled 3D head tilt',
    icon: <HelpCircle className="w-4 h-4" />,
  },
  {
    id: 'thinking',
    label: 'Thinking',
    category: 'Gaze & Motion',
    description: 'Upward-left pondering gaze + side-pursed "hmm" mouth & chin-up sway',
    icon: <Brain className="w-4 h-4" />,
  },
  {
    id: 'excited',
    label: 'Excited',
    category: 'Emotions',
    description: 'Rapid squash-and-stretch 3D jumping with wide pulsing eyes & big open laugh',
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    id: 'love',
    label: 'Love (Heart Eyes)',
    category: 'Emotions',
    description: '3D carved beating heart eyes + sweet adoring curved smile & dreamy sway',
    icon: <Heart className="w-4 h-4" />,
  },
  {
    id: 'wink',
    label: 'Cheeky Wink',
    category: 'Emotions',
    description: 'Playful 3D tilt while right eye winks & mouth pulls into a cheeky smirk',
    icon: <Smile className="w-4 h-4" />,
  },
  {
    id: 'dizzy',
    label: 'Dizzy / Glitch',
    category: 'Gaze & Motion',
    description: 'Orbiting eyes + oscillating wavy mouth & gyroscopic 3D body wobble',
    icon: <RefreshCw className="w-4 h-4" />,
  },
];

export function BotShowcase() {
  // Active Bot State & Appearance Configuration
  const [activeState, setActiveState] = useState<ChipExpressionState>('resting');
  const [selectedThemeKey, setSelectedThemeKey] = useState<string>('originalJade');
  const [customHex, setCustomHex] = useState<string>('#46998A');
  const [useCustomHex, setUseCustomHex] = useState<boolean>(false);

  const [showPins, setShowPins] = useState<boolean>(true);
  const [showMouth, setShowMouth] = useState<boolean>(true);
  const [eyeStyle, setEyeStyle] = useState<'carved-matte' | 'glowing-led'>('carved-matte');
  const [speed, setSpeed] = useState<number>(1);
  const [botSize, setBotSize] = useState<number>(280);
  const [interactiveTilt, setInteractiveTilt] = useState<boolean>(true);
  const [stageTheme, setStageTheme] = useState<'light' | 'dark' | 'blueprint'>('light');
  const [blinkTrigger, setBlinkTrigger] = useState<number>(0);

  // Auto-Cycle Demo Mode
  const [autoCycle, setAutoCycle] = useState<boolean>(false);
  useEffect(() => {
    if (!autoCycle) return;
    const interval = setInterval(() => {
      setActiveState((prev) => {
        const idx = EXPRESSION_LIST.findIndex((item) => item.id === prev);
        const nextIdx = (idx + 1) % EXPRESSION_LIST.length;
        return EXPRESSION_LIST[nextIdx].id;
      });
    }, 3200);
    return () => clearInterval(interval);
  }, [autoCycle]);

  // Simulated Speech Input for "Talking" state
  const [speechText, setSpeechText] = useState<string>(
    'Hello! I am ChipBot, your 3D tactile AI assistant!'
  );
  const [isSpeakingSentence, setIsSpeakingSentence] = useState<boolean>(false);
  const speakTimeoutRef = useRef<number | null>(null);

  const cancelSpeech = () => {
    if (speakTimeoutRef.current !== null) {
      window.clearTimeout(speakTimeoutRef.current);
      speakTimeoutRef.current = null;
    }
    setIsSpeakingSentence(false);
  };

  const triggerSpeakSentence = () => {
    if (!speechText.trim()) return;
    cancelSpeech();
    setAutoCycle(false);
    setActiveState('talking');
    setIsSpeakingSentence(true);

    // Estimate speaking duration from character count
    const durationMs = Math.max(1800, Math.min(8000, speechText.length * 75));
    speakTimeoutRef.current = window.setTimeout(() => {
      speakTimeoutRef.current = null;
      setIsSpeakingSentence(false);
      setActiveState('happy');
      speakTimeoutRef.current = window.setTimeout(() => {
        speakTimeoutRef.current = null;
        setActiveState('resting');
      }, 1400);
    }, durationMs);
  };

  // Code Modal state
  const [showCodeModal, setShowCodeModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [copyError, setCopyError] = useState<boolean>(false);
  const copyResetTimeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (speakTimeoutRef.current !== null) {
        window.clearTimeout(speakTimeoutRef.current);
      }
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    },
    []
  );

  const activePalette = useMemo(() => {
    if (useCustomHex) {
      return createChipPaletteFromHex(customHex, 'Custom Hex Palette');
    }
    return CHIP_COLOR_THEMES[selectedThemeKey] || CHIP_COLOR_THEMES.originalJade;
  }, [useCustomHex, customHex, selectedThemeKey]);

  const currentMeta = useMemo(
    () => EXPRESSION_LIST.find((item) => item.id === activeState) || EXPRESSION_LIST[0],
    [activeState]
  );

  const usageSnippet = `import { ChipFace, CHIP_COLOR_THEMES, createChipPaletteFromHex } from './ChipFace';

// 1. Separate Color Config (Preset or Custom Hex)
const customFaceColor = createChipPaletteFromHex('${activePalette.base}', 'Custom Face');

export function MyBotWidget() {
  return (
    <ChipFace
      state="${activeState}"
      color={customFaceColor} // or "${activePalette.base}" or CHIP_COLOR_THEMES.originalJade
      size={${botSize}}
      showPins={${showPins}} // true = 16 3D cylindrical IC pins
      showMouth={${showMouth}} // true = 3D mouth in all non-resting states, false = eyes-only mode
      eyeStyle="${eyeStyle}"
      speed={${speed}}
      interactiveTilt={${interactiveTilt}}
    />
  );
}`;

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(usageSnippet);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
    if (copyResetTimeoutRef.current !== null) {
      window.clearTimeout(copyResetTimeoutRef.current);
    }
    copyResetTimeoutRef.current = window.setTimeout(() => {
      setCopied(false);
      setCopyError(false);
      copyResetTimeoutRef.current = null;
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-inner border border-white/15"
              style={{ backgroundColor: activePalette.base }}
            >
              <Cpu className="w-5 h-5 text-white drop-shadow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  ChipFace 3D
                </h1>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  React + Vite (.tsx)
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Tactile 3D Molded Chip Character • Eye-Only Expressions & Full-Body Physics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowMouth((m) => !m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                showMouth
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
              title="Toggle 3D animated mouth on or off across non-resting expressions"
            >
              <Smile className="w-3.5 h-3.5 text-emerald-400" />
              {showMouth ? 'Mouth: ON' : 'Mouth: OFF (Eyes Only)'}
            </button>

            <button
              onClick={() => setBlinkTrigger((c) => c + 1)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <EyeOff className="w-3.5 h-3.5 text-emerald-400" />
              Trigger Blink
            </button>

            <button
              onClick={() => {
                cancelSpeech();
                setAutoCycle((prev) => !prev);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer ${
                autoCycle
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              }`}
            >
              {autoCycle ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {autoCycle ? 'Stop Demo Loop' : 'Auto-Cycle States'}
            </button>

            <button
              onClick={() => setShowCodeModal(true)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5" />
              Usage & Props
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT / CENTER COLUMN: Live 3D Bot Stage + Expression Deck */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* 1. LIVE 3D CHARACTER STAGE */}
          <section
            className={`relative rounded-3xl border overflow-hidden transition-colors duration-500 flex flex-col items-center justify-between min-h-[410px] p-6 ${
              stageTheme === 'light'
                ? 'bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 border-slate-300 text-slate-800'
                : stageTheme === 'dark'
                ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-slate-800 text-slate-100'
                : 'bg-[#0c192c] border-sky-900/60 text-sky-100'
            }`}
            style={
              stageTheme === 'blueprint'
                ? {
                    backgroundImage:
                      'radial-gradient(rgba(56, 189, 248, 0.18) 1px, transparent 1px), linear-gradient(to right, rgba(56, 189, 248, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(56, 189, 248, 0.05) 1px, transparent 1px)',
                    backgroundSize: '24px 24px, 24px 24px, 24px 24px',
                  }
                : undefined
            }
          >
            {/* Stage Top Overlay Bar */}
            <div className="w-full flex flex-wrap items-center justify-between gap-2 z-10">
              <div
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border ${
                  stageTheme === 'light'
                    ? 'bg-white/85 border-slate-300/80 text-slate-800 shadow-sm'
                    : 'bg-slate-900/80 border-slate-700/80 text-slate-100'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full animate-pulse"
                  style={{ backgroundColor: activePalette.base }}
                />
                <span>State:</span>
                <span className="font-bold uppercase tracking-wider text-emerald-500">
                  {currentMeta.label}
                </span>
              </div>

              {/* Stage Backdrop Switcher */}
              <div
                className={`inline-flex items-center p-1 rounded-xl border text-xs backdrop-blur-md ${
                  stageTheme === 'light'
                    ? 'bg-white/80 border-slate-300 text-slate-700'
                    : 'bg-slate-900/80 border-slate-700 text-slate-300'
                }`}
              >
                {(['light', 'dark', 'blueprint'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setStageTheme(mode)}
                    className={`px-2.5 py-1 rounded-lg font-medium capitalize transition cursor-pointer ${
                      stageTheme === mode
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'hover:opacity-80'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* THE 3D CHIP BOT COMPONENT */}
            <div className="my-auto py-4 flex flex-col items-center justify-center relative">
              {/* Optional speech bubble when talking */}
              {activeState === 'talking' && (
                <div
                  className={`mb-3 px-4 py-2 rounded-2xl text-xs font-semibold max-w-xs text-center shadow-lg border animate-bounce ${
                    stageTheme === 'light'
                      ? 'bg-white text-slate-800 border-slate-200'
                      : 'bg-slate-800 text-white border-slate-700'
                  }`}
                >
                  "{speechText}"
                </div>
              )}

              <ChipFace
                state={activeState}
                color={activePalette}
                size={botSize}
                showPins={showPins}
                showMouth={showMouth}
                speed={speed}
                interactiveTilt={interactiveTilt}
                eyeStyle={eyeStyle}
                blinkTrigger={blinkTrigger}
              />
            </div>

            {/* Stage Bottom Caption */}
            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2 text-xs z-10">
              <p
                className={
                  stageTheme === 'light' ? 'text-slate-600 font-medium' : 'text-slate-400'
                }
              >
                {currentMeta.description}
              </p>
              <span
                className={`text-[11px] flex items-center gap-1 ${
                  stageTheme === 'light' ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                <MousePointer className="w-3 h-3" />
                {interactiveTilt ? 'Move cursor over face for 3D parallax' : '3D parallax off'}
              </span>
            </div>
          </section>

          {/* 2. INTERACTIVE STATE CONTROLLER BUTTON DECK (Below the Bot) */}
          <section className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 sm:p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  Expression State Controller ({EXPRESSION_LIST.length} States)
                </h2>
                <p className="text-xs text-slate-400">
                  Click any state below to smoothly transition the 3D eyes and body posture using spring physics.
                </p>
              </div>
              <button
                onClick={() => {
                  cancelSpeech();
                  setAutoCycle(false);
                  setActiveState('resting');
                }}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/80 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reset to Resting
              </button>
            </div>

            {/* State Buttons Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {EXPRESSION_LIST.map((item) => {
                const isSelected = activeState === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      cancelSpeech();
                      setAutoCycle(false);
                      setActiveState(item.id);
                    }}
                    className={`group relative flex items-center gap-2.5 px-3.5 py-3 rounded-2xl text-left text-xs font-semibold transition-all duration-150 border cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-400 text-white shadow-lg shadow-emerald-950/50 scale-[1.01]'
                        : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/70 text-slate-300 hover:text-white'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-700/70 text-slate-300 group-hover:bg-slate-700'
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="truncate">
                      <div className="truncate">{item.label}</div>
                      <div className="text-[10px] font-normal text-slate-400 truncate">
                        {item.category}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick Speech Simulator Bar for Talking State */}
            <div className="mt-5 pt-4 border-t border-slate-800/90 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 shrink-0">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>Test Talking Cadence:</span>
              </div>
              <input
                type="text"
                value={speechText}
                onChange={(e) => setSpeechText(e.target.value)}
                placeholder="Type something for ChipBot to say..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={triggerSpeakSentence}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shrink-0 cursor-pointer"
              >
                {isSpeakingSentence ? 'Speaking...' : 'Speak Sentence'}
              </button>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Separate Face Color Values & 3D Rig Customizer */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* 1. FACE COLOR PALETTE PANEL */}
          <section className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Palette className="w-4 h-4 text-emerald-400" />
                Face Color Configuration
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700">
                {activePalette.base}
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Separated color values automatically compute matching 3D specular highlights, corner bevel shadows, and carved circuit grooves.
            </p>

            {/* Preset Color Swatches */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {Object.entries(CHIP_COLOR_THEMES).map(([key, theme]) => {
                const active = !useCustomHex && selectedThemeKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setUseCustomHex(false);
                      setSelectedThemeKey(key);
                    }}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left text-xs font-medium transition cursor-pointer ${
                      active
                        ? 'bg-slate-800 border-emerald-400 text-white shadow-sm'
                        : 'bg-slate-950/60 hover:bg-slate-800/60 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-lg shrink-0 shadow-inner border border-white/20"
                      style={{
                        background: `linear-gradient(135deg, ${theme.highlight} 0%, ${theme.base} 55%, ${theme.shadow} 100%)`,
                      }}
                    />
                    <span className="truncate">{theme.name.replace(' (Reference)', '')}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Hex Color Picker */}
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/90 mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-300">
                  Custom Face Hex Color
                </label>
                {useCustomHex && (
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    Active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <input
                  type="color"
                  value={customHex}
                  onChange={(e) => {
                    setCustomHex(e.target.value);
                    setUseCustomHex(true);
                  }}
                  className="w-10 h-9 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={customHex}
                  onChange={(e) => {
                    setCustomHex(e.target.value);
                    setUseCustomHex(true);
                  }}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                />
              </div>
            </div>

            {/* Live Computed 3D Shading Tokens Breakdown */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Active `ChipColorPalette` Tokens
              </div>
              {[
                { label: 'base (Face Surface)', val: activePalette.base },
                { label: 'highlight (Top-Left 3D Bevel)', val: activePalette.highlight },
                { label: 'shadow (Bottom-Right Bevel)', val: activePalette.shadow },
                { label: 'grooveShadow (Corner Traces)', val: activePalette.grooveShadow },
                { label: 'eyeCavity (Recessed Socket)', val: activePalette.eyeCavity },
              ].map((token) => (
                <div
                  key={token.label}
                  className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-slate-950/50 border border-slate-800/60"
                >
                  <span className="text-slate-400">{token.label}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded border border-white/20"
                      style={{ backgroundColor: token.val }}
                    />
                    <span className="font-mono text-[11px] text-slate-200">{token.val}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 2. 3D HARDWARE & MOTION SETTINGS */}
          <section className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 sm:p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              3D Geometry & Rig Controls
            </h2>

            {/* 16 3D IC Pins Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div>
                <div className="text-xs font-semibold text-white">16 3D Cylindrical IC Pins</div>
                <div className="text-[11px] text-slate-400">
                  {showPins ? 'Showing 16 3D metallic-grey pins' : 'Hiding outer IC pins'}
                </div>
              </div>
              <button
                onClick={() => setShowPins((p) => !p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  showPins
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                {showPins ? 'Pins ON (16)' : 'Pins Hidden'}
              </button>
            </div>

            {/* Animated 3D Mouth Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div>
                <div className="text-xs font-semibold text-white">Animated 3D Mouth</div>
                <div className="text-[11px] text-slate-400">
                  {showMouth
                    ? 'Active in all states except Resting'
                    : 'Eyes-only mode across all states'}
                </div>
              </div>
              <button
                onClick={() => setShowMouth((m) => !m)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  showMouth
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                {showMouth ? 'Mouth ON' : 'Mouth OFF'}
              </button>
            </div>

            {/* Eye Cavity Style Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div>
                <div className="text-xs font-semibold text-white">Recessed Eye Socket Mode</div>
                <div className="text-[11px] text-slate-400">
                  Reference carved matte vs glowing LED
                </div>
              </div>
              <button
                onClick={() =>
                  setEyeStyle((s) => (s === 'carved-matte' ? 'glowing-led' : 'carved-matte'))
                }
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition cursor-pointer"
              >
                {eyeStyle === 'carved-matte' ? 'Carved Matte' : 'Glowing LED'}
              </button>
            </div>

            {/* Mouse 3D Parallax Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div>
                <div className="text-xs font-semibold text-white">Interactive 3D Cursor Tilt</div>
                <div className="text-[11px] text-slate-400">
                  Subtle gaze & 3D perspective tracking
                </div>
              </div>
              <button
                onClick={() => setInteractiveTilt((t) => !t)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  interactiveTilt
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {interactiveTilt ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            {/* Animation Speed Slider */}
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-300">Animation Speed</span>
                <span className="font-mono text-emerald-400">{speed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.4"
                max="2.0"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Component Size Slider */}
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-300">Component Size</span>
                <span className="font-mono text-emerald-400">{botSize}px</span>
              </div>
              <input
                type="range"
                min="140"
                max="340"
                step="10"
                value={botSize}
                onChange={(e) => setBotSize(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </section>
        </div>
      </main>

      {/* CODE & INTEGRATION MODAL */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  Using &lt;ChipFace /&gt; in Your React + Vite Project
                </h3>
              </div>
              <button
                onClick={() => setShowCodeModal(false)}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 cursor-pointer"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              The <code className="text-emerald-300">&lt;ChipFace /&gt;</code> component and{' '}
              <code className="text-emerald-300">CHIP_COLOR_THEMES</code> configuration at the top of{' '}
              <code className="text-emerald-300">App.tsx</code> are zero-dependency React + TypeScript
              code. Copy the component directly into your Vite project (e.g.{' '}
              <code className="text-emerald-300">src/components/ChipFace.tsx</code>) and control its
              state and color via props:
            </p>

            <div className="relative">
              <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto">
                {usageSnippet}
              </pre>
              <button
                onClick={handleCopySnippet}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Copied!
                  </>
                ) : copyError ? (
                  <span role="status" className="text-rose-300">
                    Copy failed
                  </span>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Snippet
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BotShowcase;
