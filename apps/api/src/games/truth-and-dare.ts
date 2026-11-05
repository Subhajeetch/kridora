import {
  emptySchema,
  truthAndDareCharacterSchema,
  truthAndDareChoiceSchema,
  truthAndDareConfigureSchema,
  truthAndDareFinishSchema,
  TRUTH_AND_DARE_AGE_GROUPS,
  TRUTH_AND_DARE_CHARACTERS,
  TRUTH_AND_DARE_MODES,
  TRUTH_AND_DARE_SPINNERS,
  type TruthAndDareAgeGroup,
  type TruthAndDareChoice,
  type TruthAndDareMode,
  type TruthAndDareState,
} from "@kridora/shared";
import { ApiError } from "../lib/errors";
import type { ServerGameModule } from "./types";

type PromptDeck = Record<TruthAndDareChoice, string[]>;

const PROMPTS: Record<TruthAndDareAgeGroup, PromptDeck> = {
  family: {
    truth: [
      "What is a small thing that always makes your day better?",
      "What is the funniest misunderstanding you have ever had?",
      "Which skill would you love to learn, and why?",
      "What is a song you know all the words to?",
      "What food combination do you enjoy that other people might find unusual?",
      "What is something you were proud of as a kid?",
      "What fictional place would you like to visit for a day?",
      "What is your favorite way to spend a rainy afternoon?",
    ],
    dare: [
      "Give everyone a 10-second weather report for the room.",
      "Make up a new handshake and teach it to the group.",
      "Do your best impression of a robot ordering a snack.",
      "Invent a two-line jingle for the nearest object.",
      "Show your best dramatic movie-poster pose.",
      "Hum a song and let the group guess it.",
      "Tell a 15-second story that includes a penguin and a tiny hat.",
      "Do a 10-second celebration dance from your seat.",
    ],
  },
  teen: {
    truth: [
      "What is a song that instantly changes your mood?",
      "What is a trend you secretly hope comes back?",
      "What is something you wish you were better at?",
      "Which fictional character would make the best teammate?",
      "What is the funniest thing that happened at school or work?",
      "What is one goal you would love to reach this year?",
      "What is a compliment you still remember?",
      "If your friends made a movie about you, what would it be called?",
    ],
    dare: [
      "Read a made-up text like it is from an action movie trailer.",
      "Invent a new emoji and explain what it means.",
      "Give a 10-second award speech for your favorite snack.",
      "Do your best impression of a video game victory screen.",
      "Let the group pick a harmless pose for your next profile photo—no need to post it.",
      "Describe your day like a movie trailer narrator.",
      "Make up a team name and a one-line chant for everyone here.",
      "Try to make the group laugh in 15 seconds.",
    ],
  },
  adult: {
    truth: [
      "What is a decision that turned out better than you expected?",
      "What is a hobby you would try if you had a free weekend?",
      "What is a tiny luxury that makes everyday life better?",
      "What is a story about you that sounds made up but is true?",
      "What is a skill you picked up from someone you admire?",
      "What is a place you would happily visit again and again?",
      "What is the most useful thing you have learned recently?",
      "What would your friends say is your most reliable superpower?",
    ],
    dare: [
      "Pitch an ordinary object as if it were a luxury product.",
      "Give the person to your left a sincere, specific compliment.",
      "Create a 10-second theme song for this group.",
      "Tell a story from your week using the voice of a nature documentary.",
      "Do a seated victory dance like you just finished a marathon.",
      "Give a one-minute travel recommendation for somewhere you love.",
      "Invent a toast to the best thing that happened this week.",
      "Describe your ideal day in exactly five words.",
    ],
  },
};

const MODE_PROMPTS: Record<TruthAndDareMode, PromptDeck> = {
  chill: {
    truth: [
      "What little thing helps you relax after a long day?",
      "Which place would you revisit just to unwind?",
      "What song feels like a deep breath to you?",
      "What is your ideal slow weekend morning?",
    ],
    dare: [
      "Take one slow breath, then give the group a peaceful weather report.",
      "Describe your perfect cozy corner in three words.",
      "Lead everyone in a 5-second shoulder stretch.",
      "Give the nearest object a calm, fancy introduction.",
    ],
  },
  funny: {
    truth: [
      "What silly thing are you surprisingly competitive about?",
      "If your pet could review you, what would it say?",
      "What is your most harmless weird habit?",
      "Which fictional character would be the worst roommate?",
    ],
    dare: [
      "Give a dramatic award speech for your favorite snack.",
      "Pretend to be a robot that has just discovered a chair.",
      "Sell an ordinary object like it is the latest luxury gadget.",
      "Make up a tiny jingle for the person on your left.",
    ],
  },
  family: {
    truth: PROMPTS.family.truth,
    dare: PROMPTS.family.dare,
  },
  couples: {
    truth: [
      "What small thing makes you feel appreciated?",
      "What would your perfect low-key date night include?",
      "Which shared memory always makes you smile?",
      "What kind gesture do you notice more than people expect?",
    ],
    dare: [
      "Give your partner a sincere compliment about something they chose.",
      "Plan a pretend dream date in exactly ten words.",
      "Recreate your first hello in a playful movie-trailer voice.",
      "Share a 10-second victory dance together.",
    ],
  },
  spicy: {
    truth: [
      "What quality do you find instantly charming?",
      "What is your idea of a perfect first date?",
      "What is a flirty compliment you would actually enjoy hearing?",
      "What romantic movie moment secretly works on you?",
    ],
    dare: [
      "Give someone a playful, respectful compliment.",
      "Deliver your best charming introduction to the group.",
      "Describe your dream date like a dramatic movie preview.",
      "Send a heart-shaped air kiss to the camera, if you like.",
    ],
  },
};

const DEFAULT_SETTINGS: TruthAndDareState["settings"] = {
  ageGroup: "family",
  spinner: "bottle",
  mode: "funny",
};

function normalizeState(state: TruthAndDareState): boolean {
  let changed = false;
  if (!state.settings) {
    state.settings = { ...DEFAULT_SETTINGS };
    changed = true;
  }
  if (!TRUTH_AND_DARE_AGE_GROUPS.includes(state.settings.ageGroup)) {
    state.settings.ageGroup = "family";
    changed = true;
  }
  if (
    !(TRUTH_AND_DARE_SPINNERS as readonly string[]).includes(
      state.settings.spinner,
    )
  ) {
    state.settings.spinner = "bottle";
    changed = true;
  }
  if (
    !(TRUTH_AND_DARE_MODES as readonly string[]).includes(state.settings.mode)
  ) {
    state.settings.mode = "funny";
    changed = true;
  }
  if (
    (state.settings.mode === "couples" || state.settings.mode === "spicy") &&
    state.settings.ageGroup !== "adult"
  ) {
    state.settings.ageGroup = "adult";
    changed = true;
  }
  for (const player of state.players) {
    if (
      !(TRUTH_AND_DARE_CHARACTERS as readonly string[]).includes(
        player.character,
      )
    ) {
      player.character = "mystery";
      changed = true;
    }
  }
  if (!Array.isArray(state.history)) {
    state.history = [];
    changed = true;
  } else {
    state.history = state.history.map((entry) => {
      const legacy = entry as TruthAndDareState["history"][number] & {
        ageGroup?: TruthAndDareAgeGroup;
        spinnerName?: string;
      };
      if (legacy.ageGroup && legacy.spinnerName && legacy.mode) return entry;
      changed = true;
      return {
        ...legacy,
        ageGroup: legacy.ageGroup ?? "family",
        spinnerName: legacy.spinnerName ?? legacy.playerName,
        mode: legacy.mode ?? "family",
      };
    });
  }
  if (state.challenge) {
    const legacy = state.challenge as TruthAndDareState["challenge"] & {
      playerId?: string;
      spinnerName?: string;
    };
    if (!legacy.spinnerId || !legacy.targetId || !legacy.spinnerName) {
      const oldPlayerId =
        legacy.playerId ??
        state.players[state.currentPlayerIndex]?.userId ??
        "";
      const oldPlayerName =
        state.players.find((player) => player.userId === oldPlayerId)?.name ??
        "Player";
      state.challenge = {
        type: legacy.type,
        text: legacy.text,
        spinnerId: legacy.spinnerId ?? oldPlayerId,
        spinnerName: legacy.spinnerName ?? oldPlayerName,
        targetId: legacy.targetId ?? oldPlayerId,
        createdAt: legacy.createdAt ?? Date.now(),
      };
      changed = true;
    }
  }
  if (state.players.length === 0) {
    state.currentPlayerIndex = 0;
  } else if (
    state.currentPlayerIndex < 0 ||
    state.currentPlayerIndex >= state.players.length
  ) {
    state.currentPlayerIndex = 0;
    changed = true;
  }
  if (!state.selection) state.selection = null;
  const expectedPhase = state.challenge
    ? "challenge"
    : state.selection
      ? "selecting"
      : state.phase === "setup"
        ? "setup"
        : "choosing";
  if (state.phase !== expectedPhase) {
    state.phase = expectedPhase;
    changed = true;
  }
  return changed;
}

function choosePrompt(
  ageGroup: TruthAndDareAgeGroup,
  mode: TruthAndDareMode,
  type: TruthAndDareChoice,
  history: TruthAndDareState["history"],
): string {
  const used = new Set(
    history
      .filter(
        (item) =>
          item.ageGroup === ageGroup &&
          item.mode === mode &&
          item.type === type,
      )
      .map((item) => item.prompt),
  );
  const allPrompts =
    mode === "family" ? PROMPTS.family[type] : MODE_PROMPTS[mode][type];
  const available = allPrompts.filter((prompt) => !used.has(prompt));
  const pool = available.length ? available : allPrompts;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function currentPlayer(state: TruthAndDareState) {
  return state.players[state.currentPlayerIndex];
}

function requirePlayer(state: TruthAndDareState, userId: string) {
  const player = state.players.find((item) => item.userId === userId);
  if (!player)
    throw new ApiError("FORBIDDEN", "You are not part of this match.");
  return player;
}

function requireCurrentTurn(state: TruthAndDareState, userId: string): void {
  requirePlayer(state, userId);
  if (currentPlayer(state)?.userId !== userId) {
    throw new ApiError("FORBIDDEN", "Wait for your turn to spin.");
  }
}

export const truthAndDareGameModule: ServerGameModule<TruthAndDareState> = {
  slug: "truth-and-dare",
  eventPrefix: "truth-and-dare",
  stateEvent: "truth-and-dare:state",

  createInitialState(players) {
    return {
      players: players.map(({ userId, name, image }) => ({
        userId,
        name,
        image,
        character: "mystery",
      })),
      currentPlayerIndex: 0,
      round: 1,
      phase: "setup",
      settings: { ...DEFAULT_SETTINGS },
      selection: null,
      challenge: null,
      history: [],
      updatedAt: Date.now(),
    };
  },

  onPlayerRenamed(state, userId, newName) {
    normalizeState(state);
    const player = state.players.find((item) => item.userId === userId);
    if (!player) return false;
    player.name = newName;
    state.updatedAt = Date.now();
    return true;
  },

  onPlayerLeft(state, userId) {
    normalizeState(state);
    const index = state.players.findIndex((item) => item.userId === userId);
    if (index < 0) return false;
    const wasCurrent = index === state.currentPlayerIndex;
    state.players.splice(index, 1);
    if (index < state.currentPlayerIndex) state.currentPlayerIndex -= 1;
    if (state.players.length === 0) {
      state.currentPlayerIndex = 0;
    } else if (wasCurrent) {
      state.currentPlayerIndex %= state.players.length;
    }
    if (
      state.challenge?.spinnerId === userId ||
      state.challenge?.targetId === userId
    ) {
      state.challenge = null;
      state.phase = "choosing";
    }
    if (
      state.selection?.spinnerId === userId ||
      state.selection?.targetId === userId
    ) {
      state.selection = null;
      state.phase = "choosing";
    }
    state.updatedAt = Date.now();
    return true;
  },

  handleAction(ctx, action, rawPayload) {
    const { state, user } = ctx;
    const normalized = normalizeState(state);
    if (action === "get-state") {
      emptySchema.parse(rawPayload);
      if (normalized) {
        state.updatedAt = Date.now();
        ctx.setState(state);
        ctx.broadcastState();
      }
      return state;
    }

    switch (action) {
      case "configure": {
        const isOwner = ctx.ownerId ? user.id === ctx.ownerId : true;
        if (!isOwner) {
          throw new ApiError(
            "FORBIDDEN",
            "Only the room owner can change party settings.",
          );
        }
        const settings = truthAndDareConfigureSchema.parse(rawPayload);
        requirePlayer(state, user.id);
        if (
          (settings.mode === "couples" || settings.mode === "spicy") &&
          settings.ageGroup !== "adult"
        ) {
          throw new ApiError(
            "VALIDATION_ERROR",
            "Couples and Spicy modes require the Adult 18+ pack.",
          );
        }
        if (state.history.length > 0) {
          throw new ApiError(
            "VALIDATION_ERROR",
            "Party settings lock after the first spin.",
          );
        }
        state.settings = settings;
        break;
      }
      case "start-game": {
        emptySchema.parse(rawPayload);
        const isOwner = ctx.ownerId ? user.id === ctx.ownerId : true;
        if (!isOwner) {
          throw new ApiError(
            "FORBIDDEN",
            "Only the room owner can start the game.",
          );
        }
        if (state.phase !== "setup") {
          throw new ApiError(
            "VALIDATION_ERROR",
            "Game is already in progress.",
          );
        }
        state.phase = "choosing";
        break;
      }
      case "set-character": {
        const { character } = truthAndDareCharacterSchema.parse(rawPayload);
        const player = requirePlayer(state, user.id);
        player.character = character;
        break;
      }
      case "spin": {
        emptySchema.parse(rawPayload);
        if (state.phase === "setup") {
          throw new ApiError(
            "VALIDATION_ERROR",
            "Waiting for the host to start the game.",
          );
        }
        requireCurrentTurn(state, user.id);
        if (state.phase !== "choosing") {
          throw new ApiError(
            "VALIDATION_ERROR",
            "Finish the current turn before spinning again.",
          );
        }
        const spinner = currentPlayer(state);
        if (!spinner)
          throw new ApiError(
            "VALIDATION_ERROR",
            "There are no players in this match.",
          );
        const otherPlayers = state.players.filter(
          (player) => player.userId !== spinner.userId,
        );
        const targetPool =
          otherPlayers.length > 0 ? otherPlayers : state.players;
        const target =
          targetPool[Math.floor(Math.random() * targetPool.length)]!;
        state.selection = {
          spinnerId: spinner.userId,
          spinnerName: spinner.name,
          targetId: target.userId,
          createdAt: Date.now(),
        };
        state.phase = "selecting";
        break;
      }
      case "choose": {
        const { choice } = truthAndDareChoiceSchema.parse(rawPayload);
        const player = requirePlayer(state, user.id);
        if (state.phase !== "selecting" || !state.selection) {
          throw new ApiError(
            "VALIDATION_ERROR",
            "Spin the table before choosing a prompt.",
          );
        }
        if (state.selection.targetId !== player.userId) {
          throw new ApiError(
            "FORBIDDEN",
            "The selected player chooses Truth or Dare.",
          );
        }
        const selection = state.selection;
        state.challenge = {
          type: choice,
          text: choosePrompt(
            state.settings.ageGroup,
            state.settings.mode,
            choice,
            state.history,
          ),
          spinnerId: selection.spinnerId,
          spinnerName: selection.spinnerName,
          targetId: selection.targetId,
          createdAt: Date.now(),
        };
        state.selection = null;
        state.phase = "challenge";
        break;
      }
      case "finish": {
        const { result } = truthAndDareFinishSchema.parse(rawPayload);
        const player = requirePlayer(state, user.id);
        if (state.phase !== "challenge" || !state.challenge) {
          throw new ApiError("VALIDATION_ERROR", "Spin the table first.");
        }
        if (state.challenge.targetId !== player.userId) {
          throw new ApiError(
            "FORBIDDEN",
            "The selected player completes or skips this prompt.",
          );
        }
        state.history.unshift({
          playerId: player.userId,
          playerName: player.name,
          spinnerName: state.challenge.spinnerName,
          ageGroup: state.settings.ageGroup,
          mode: state.settings.mode,
          type: state.challenge.type,
          result,
          prompt: state.challenge.text,
        });
        state.history = state.history.slice(0, 40);
        const spinnerIndex = state.players.findIndex(
          (item) => item.userId === state.challenge?.spinnerId,
        );
        state.challenge = null;
        state.selection = null;
        state.phase = "choosing";
        if (state.players.length > 0) {
          const baseIndex =
            spinnerIndex >= 0 ? spinnerIndex : state.currentPlayerIndex;
          state.currentPlayerIndex = (baseIndex + 1) % state.players.length;
          if (state.currentPlayerIndex === 0) state.round += 1;
        }
        break;
      }
      default:
        throw new ApiError(
          "VALIDATION_ERROR",
          `Unknown Truth and Dare action "${action}".`,
        );
    }
    state.updatedAt = Date.now();
    ctx.setState(state);
    ctx.broadcastState();
    return state;
  },
};
