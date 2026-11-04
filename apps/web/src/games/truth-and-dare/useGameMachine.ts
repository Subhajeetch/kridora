import { useCallback, useEffect, useReducer, useRef } from "react";
import type { TruthAndDareAgeGroup, TruthAndDareMode } from "@kridora/shared";
import promptJson from "./prompts.json";

export type GamePhase =
  | "idle"
  | "spinning"
  | "selected"
  | "choosing"
  | "card"
  | "performing"
  | "voting"
  | "reward"
  | "next-turn";
export type PromptType = "truth" | "dare";
export type VoteReaction = "👍" | "👎" | "😂" | "🔥";
export type TurnResult = "skipped" | "counted" | "not-counted";

export interface LocalGamePlayer {
  id: string;
  name: string;
  avatar: string;
  score: number;
  streak: number;
}

export interface LocalPrompt {
  id: string;
  type: PromptType;
  text: string;
}

export interface LocalGameState {
  active: boolean;
  phase: GamePhase;
  players: LocalGamePlayer[];
  mode: TruthAndDareMode;
  ageGroup: TruthAndDareAgeGroup;
  adultConfirmed: boolean;
  currentPlayerIndex: number;
  selectedPlayerIndex: number | null;
  spinAngle: number;
  spinCycle: number;
  currentPrompt: LocalPrompt | null;
  promptHistory: string[];
  timerSeconds: number;
  voteOrder: string[];
  voteIndex: number;
  votes: Record<string, VoteReaction>;
  turnResult: TurnResult | null;
  notice: string | null;
}

type PromptPack = { truth: string[]; dare: string[] };
type PromptPackDefinition = PromptPack | { extends: TruthAndDareAgeGroup };
type PromptCatalog = {
  packs: Partial<
    Record<
      TruthAndDareMode,
      Partial<Record<TruthAndDareAgeGroup, PromptPackDefinition>>
    >
  >;
};

const PROMPTS = promptJson as unknown as PromptCatalog;
const DARE_SECONDS = 30;
const SPIN_DURATION_MS = 4200;
const PICK_REACTIONS: VoteReaction[] = ["👍", "👎", "😂", "🔥"];
const ADULT_ONLY_MODES = new Set<TruthAndDareMode>(["couples", "spicy"]);
const AVATARS = ["🧑‍🚀", "👩", "👨", "🧑‍🎤", "👧", "🧑", "👦", "👩‍🎨"];

const INITIAL_STATE: LocalGameState = {
  active: false,
  phase: "idle",
  players: [],
  mode: "funny",
  ageGroup: "family",
  adultConfirmed: false,
  currentPlayerIndex: 0,
  selectedPlayerIndex: null,
  spinAngle: 0,
  spinCycle: 0,
  currentPrompt: null,
  promptHistory: [],
  timerSeconds: DARE_SECONDS,
  voteOrder: [],
  voteIndex: 0,
  votes: {},
  turnResult: null,
  notice: null,
};

type Action =
  | {
      type: "START";
      players: LocalGamePlayer[];
      mode: TruthAndDareMode;
      ageGroup: TruthAndDareAgeGroup;
      adultConfirmed: boolean;
    }
  | { type: "SPIN"; selectedPlayerIndex: number; angle: number }
  | { type: "SPIN_FINISHED" }
  | { type: "OPEN_CHOICES" }
  | { type: "USE_PROMPT"; prompt: LocalPrompt }
  | { type: "NO_PROMPT"; message: string }
  | { type: "PROMPT_READY" }
  | { type: "TICK" }
  | { type: "DONE" }
  | { type: "SKIP" }
  | { type: "VOTE"; playerId: string; reaction: VoteReaction }
  | { type: "ADVANCE" }
  | { type: "BEGIN_NEXT" }
  | { type: "END" };

function reducer(state: LocalGameState, action: Action): LocalGameState {
  switch (action.type) {
    case "START": {
      if (
        action.players.length < 2 ||
        action.players.length > 8 ||
        (ADULT_ONLY_MODES.has(action.mode) && action.ageGroup !== "adult") ||
        ((action.ageGroup === "adult" || ADULT_ONLY_MODES.has(action.mode)) &&
          !action.adultConfirmed)
      ) {
        return state;
      }
      return {
        ...INITIAL_STATE,
        active: true,
        players: action.players.map((player) => ({ ...player })),
        mode: action.mode,
        ageGroup: action.ageGroup,
        adultConfirmed: action.adultConfirmed,
      };
    }
    case "SPIN":
      if (!state.active || state.phase !== "idle") return state;
      return {
        ...state,
        phase: "spinning",
        selectedPlayerIndex: action.selectedPlayerIndex,
        spinAngle: action.angle,
        spinCycle: state.spinCycle + 1,
        currentPrompt: null,
        votes: {},
        voteOrder: [],
        voteIndex: 0,
        turnResult: null,
        notice: null,
      };
    case "SPIN_FINISHED":
      return state.phase === "spinning"
        ? { ...state, phase: "selected" }
        : state;
    case "OPEN_CHOICES":
      return state.phase === "selected"
        ? { ...state, phase: "choosing" }
        : state;
    case "USE_PROMPT":
      if (
        state.phase !== "choosing" ||
        state.promptHistory.includes(action.prompt.id)
      ) {
        return state;
      }
      return {
        ...state,
        phase: "card",
        currentPrompt: action.prompt,
        promptHistory: [...state.promptHistory, action.prompt.id],
        timerSeconds: DARE_SECONDS,
        notice: null,
      };
    case "NO_PROMPT":
      return state.phase === "choosing"
        ? { ...state, notice: action.message }
        : state;
    case "PROMPT_READY":
      return state.phase === "card"
        ? { ...state, phase: "performing" }
        : state;
    case "TICK":
      return state.phase === "performing" &&
        state.currentPrompt?.type === "dare" &&
        state.timerSeconds > 0
        ? { ...state, timerSeconds: state.timerSeconds - 1 }
        : state;
    case "DONE": {
      if (state.phase !== "performing" || !state.currentPrompt) return state;
      const target = state.players[state.selectedPlayerIndex ?? -1];
      const voteOrder = state.players
        .filter((player) => player.id !== target?.id)
        .map((player) => player.id);
      return {
        ...state,
        phase: "voting",
        voteOrder,
        voteIndex: 0,
        votes: {},
        notice: null,
      };
    }
    case "SKIP": {
      if (state.phase !== "performing") return state;
      const targetIndex = state.selectedPlayerIndex;
      return {
        ...state,
        phase: "reward",
        players: state.players.map((player, index) =>
          index === targetIndex
            ? { ...player, score: player.score - 1, streak: 0 }
            : player,
        ),
        turnResult: "skipped",
        notice: null,
      };
    }
    case "VOTE": {
      if (state.phase !== "voting") return state;
      const expectedVoter = state.voteOrder[state.voteIndex];
      if (action.playerId !== expectedVoter) return state;
      const votes = { ...state.votes, [action.playerId]: action.reaction };
      const voteIndex = state.voteIndex + 1;
      if (voteIndex < state.voteOrder.length) {
        return { ...state, votes, voteIndex };
      }
      const yesVotes = Object.values(votes).filter((vote) => vote !== "👎").length;
      const noVotes = Object.values(votes).filter((vote) => vote === "👎").length;
      const accepted = yesVotes > noVotes;
      const targetIndex = state.selectedPlayerIndex;
      return {
        ...state,
        phase: "reward",
        votes,
        voteIndex,
        players: state.players.map((player, index) =>
          index === targetIndex
            ? {
                ...player,
                score: player.score + (accepted ? 1 : 0),
                streak: accepted ? player.streak + 1 : 0,
              }
            : player,
        ),
        turnResult: accepted ? "counted" : "not-counted",
        notice: null,
      };
    }
    case "ADVANCE": {
      if (state.phase !== "reward" || state.players.length === 0) return state;
      const lastIndex = state.selectedPlayerIndex ?? state.currentPlayerIndex;
      return {
        ...state,
        phase: "next-turn",
        currentPlayerIndex: (lastIndex + 1) % state.players.length,
        selectedPlayerIndex: null,
      };
    }
    case "BEGIN_NEXT":
      return state.phase === "next-turn"
        ? {
            ...state,
            phase: "idle",
            currentPrompt: null,
            selectedPlayerIndex: null,
            timerSeconds: DARE_SECONDS,
            votes: {},
            voteOrder: [],
            voteIndex: 0,
            turnResult: null,
            notice: null,
          }
        : state;
    case "END":
      return { ...INITIAL_STATE };
    default:
      return state;
  }
}

function getPack(
  mode: TruthAndDareMode,
  ageGroup: TruthAndDareAgeGroup,
): PromptPack | null {
  const agePacks = PROMPTS.packs[mode];
  const definition = agePacks?.[ageGroup];
  if (!definition) return null;
  if ("extends" in definition) {
    const inherited = agePacks?.[definition.extends];
    return inherited && !("extends" in inherited) ? inherited : null;
  }
  return definition;
}

function promptId(
  mode: TruthAndDareMode,
  ageGroup: TruthAndDareAgeGroup,
  type: PromptType,
  text: string,
) {
  return `${mode}:${ageGroup}:${type}:${text}`;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function vibrate(duration: number) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(duration);
  } catch {
    // Vibration is optional on this device.
  }
}

function playTick(context: AudioContext | null, frequency: number) {
  if (!context || context.state !== "running") return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.04);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.045);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
}

export function buildLocalPlayers(
  players: Array<{ userId: string; name: string }>,
  currentUserName: string,
): LocalGamePlayer[] {
  const current = players.find(
    (player) => player.name.toLowerCase() === currentUserName.toLowerCase(),
  );
  const friends = players.filter((player) => player !== current);
  const result: LocalGamePlayer[] = [
    {
      id: "local-you",
      name: "You",
      avatar: AVATARS[0]!,
      score: 0,
      streak: 0,
    },
    ...friends.slice(0, 7).map((player, index) => ({
      id: `local-${player.userId}`,
      name: player.name,
      avatar: AVATARS[(index + 1) % AVATARS.length]!,
      score: 0,
      streak: 0,
    })),
  ];
  if (result.length === 1) {
    result.push({
      id: "local-friend",
      name: "Friend",
      avatar: AVATARS[1]!,
      score: 0,
      streak: 0,
    });
  }
  return result.slice(0, 8);
}

export function useGameMachine(soundEnabled: boolean) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const audioContext = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (state.phase === "spinning") {
      const timeout = window.setTimeout(
        () => {
          dispatch({ type: "SPIN_FINISHED" });
          vibrate(42);
        },
        prefersReducedMotion() ? 40 : SPIN_DURATION_MS,
      );
      return () => window.clearTimeout(timeout);
    }
    if (state.phase === "selected" || state.phase === "card") {
      const nextAction =
        state.phase === "selected" ? "OPEN_CHOICES" : "PROMPT_READY";
      const timeout = window.setTimeout(
        () => dispatch({ type: nextAction }),
        prefersReducedMotion() ? 40 : state.phase === "selected" ? 850 : 650,
      );
      return () => window.clearTimeout(timeout);
    }
  }, [state.phase, state.spinCycle, state.currentPrompt?.id]);

  useEffect(() => {
    if (state.phase !== "performing" || state.currentPrompt?.type !== "dare")
      return;
    const interval = window.setInterval(() => dispatch({ type: "TICK" }), 1000);
    return () => window.clearInterval(interval);
  }, [state.phase, state.currentPrompt?.id, state.currentPrompt?.type]);

  useEffect(() => {
    if (state.phase !== "spinning" || !soundEnabled) return;
    let tick = 0;
    let timeout = 0;
    const playNextTick = () => {
      playTick(audioContext.current, 820 - Math.min(tick * 28, 500));
      tick += 1;
      if (tick < 10) timeout = window.setTimeout(playNextTick, 50 + tick * 65);
    };
    playNextTick();
    return () => window.clearTimeout(timeout);
  }, [state.phase, state.spinCycle, soundEnabled]);

  useEffect(
    () => () => {
      if (audioContext.current) void audioContext.current.close();
    },
    [],
  );

  const start = useCallback(
    (
      players: LocalGamePlayer[],
      mode: TruthAndDareMode,
      ageGroup: TruthAndDareAgeGroup,
      adultConfirmed: boolean,
    ) => {
      if (
        (ADULT_ONLY_MODES.has(mode) && ageGroup !== "adult") ||
        ((ageGroup === "adult" || ADULT_ONLY_MODES.has(mode)) &&
          !adultConfirmed)
      ) {
        return false;
      }
      dispatch({ type: "START", players, mode, ageGroup, adultConfirmed });
      return true;
    },
    [],
  );

  const spin = useCallback(() => {
    if (!state.active || state.phase !== "idle" || state.players.length < 2)
      return;
    if (typeof window !== "undefined" && window.AudioContext) {
      if (!audioContext.current) audioContext.current = new window.AudioContext();
      if (audioContext.current.state === "suspended")
        void audioContext.current.resume().catch(() => undefined);
    }
    const selectedPlayerIndex = Math.floor(Math.random() * state.players.length);
    const angle =
      360 * (4 + Math.floor(Math.random() * 3)) +
      (selectedPlayerIndex * 360) / state.players.length;
    vibrate(16);
    dispatch({ type: "SPIN", selectedPlayerIndex, angle });
  }, [state.active, state.phase, state.players.length]);

  const choose = useCallback(
    (type: PromptType) => {
      if (state.phase !== "choosing") return;
      if (
        (state.ageGroup === "adult" || ADULT_ONLY_MODES.has(state.mode)) &&
        (state.ageGroup !== "adult" || !state.adultConfirmed)
      ) {
        dispatch({
          type: "NO_PROMPT",
          message: "Confirm the 18+ age pack before showing adult prompts.",
        });
        return;
      }
      const pack = getPack(state.mode, state.ageGroup);
      const texts = pack?.[type] ?? [];
      const unused = texts
        .map((text) => ({
          id: promptId(state.mode, state.ageGroup, type, text),
          type,
          text,
        }))
        .filter((prompt) => !state.promptHistory.includes(prompt.id));
      if (unused.length === 0) {
        dispatch({
          type: "NO_PROMPT",
          message: `All ${type === "truth" ? "Truth" : "Dare"} prompts in this pack have been played. Choose the other type or finish this session.`,
        });
        return;
      }
      dispatch({
        type: "USE_PROMPT",
        prompt: unused[Math.floor(Math.random() * unused.length)]!,
      });
    },
    [
      state.phase,
      state.ageGroup,
      state.mode,
      state.adultConfirmed,
      state.promptHistory,
    ],
  );

  const randomChoice = useCallback(() => {
    const pack = getPack(state.mode, state.ageGroup);
    const available = (["truth", "dare"] as const).filter((type) =>
      (pack?.[type] ?? []).some(
        (text) =>
          !state.promptHistory.includes(
            promptId(state.mode, state.ageGroup, type, text),
          ),
      ),
    );
    if (available.length === 0) {
      dispatch({
        type: "NO_PROMPT",
        message: "This pack has no unused prompts left. Finish the session to choose a new pack.",
      });
      return;
    }
    choose(available[Math.floor(Math.random() * available.length)]!);
  }, [state.mode, state.ageGroup, state.promptHistory, choose]);

  const availableCount = useCallback(
    (type: PromptType) => {
      const pack = getPack(state.mode, state.ageGroup);
      return (pack?.[type] ?? []).filter(
        (text) =>
          !state.promptHistory.includes(
            promptId(state.mode, state.ageGroup, type, text),
          ),
      ).length;
    },
    [state.mode, state.ageGroup, state.promptHistory],
  );

  const vote = useCallback(
    (playerId: string, reaction: VoteReaction) => {
      if (PICK_REACTIONS.includes(reaction))
        dispatch({ type: "VOTE", playerId, reaction });
    },
    [],
  );

  return {
    state,
    start,
    spin,
    choose,
    randomChoice,
    availableCount,
    complete: useCallback(() => dispatch({ type: "DONE" }), []),
    skip: useCallback(() => dispatch({ type: "SKIP" }), []),
    vote,
    advance: useCallback(() => dispatch({ type: "ADVANCE" }), []),
    beginNext: useCallback(() => dispatch({ type: "BEGIN_NEXT" }), []),
    end: useCallback(() => dispatch({ type: "END" }), []),
  };
}
