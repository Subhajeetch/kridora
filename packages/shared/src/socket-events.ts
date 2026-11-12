import { z } from "zod";
import type { AckFn } from "./errors";
import type { RoomSnapshot } from "./room";
import { roomCodeSchema } from "./validation";
import type { LudoColor, LudoGameState } from "./games/ludo";
import {
  TRUTH_AND_DARE_AGE_GROUPS,
  TRUTH_AND_DARE_CHARACTERS,
  TRUTH_AND_DARE_MODES,
  TRUTH_AND_DARE_SPINNERS,
  type TruthAndDareState,
} from "./games/truth-and-dare";
import type {
  BusinessActionPayload,
  BusinessState,
  BusinessUpdateSettingsPayload,
} from "./games/business";

export const createRoomSchema = z.object({
  gameSlug: z.string().min(1).max(40),
  visibility: z.enum(["private", "public"]).default("private"),
});

export const joinRoomSchema = z.object({ code: roomCodeSchema });
export const joinPublicSchema = z.object({
  gameSlug: z.string().min(1).max(40),
});
export const emptySchema = z.object({});
export const setVisibilitySchema = z.object({
  visibility: z.enum(["private", "public"]),
});
export const setReadySchema = z.object({ ready: z.boolean() });
export const targetPlayerSchema = z.object({
  userId: z.string().min(1).max(128),
});
export const ludoMoveSchema = z.object({
  tokenIndex: z.number().int().min(0).max(3),
});
export const ludoEmoteSchema = z.object({
  emoji: z.string().min(1).max(10),
});
export const truthAndDareChoiceSchema = z.object({
  choice: z.enum(["truth", "dare"]),
});
export const truthAndDareFinishSchema = z.object({
  result: z.enum(["done", "skip"]),
});
export const truthAndDareCharacterSchema = z.object({
  character: z.enum(TRUTH_AND_DARE_CHARACTERS),
});
export const truthAndDareConfigureSchema = z.object({
  ageGroup: z.enum(TRUTH_AND_DARE_AGE_GROUPS),
  spinner: z.enum(TRUTH_AND_DARE_SPINNERS),
  mode: z.enum(TRUTH_AND_DARE_MODES).default("funny"),
});
export const ludoDebugEnableSchema = z.object({
  enabled: z.boolean(),
});
export const ludoDebugSetDiceSchema = z.object({
  dice: z.number().int().min(1).max(6),
});
export const ludoDebugSetPieceSchema = z.object({
  playerIndex: z.number().int().min(0).max(3),
  tokenIndex: z.number().int().min(0).max(3),
  step: z.number().int().min(-1).max(56),
});
export const ludoDebugSetTurnSchema = z.object({
  playerIndex: z.number().int().min(0).max(3),
});
export const ludoDebugSetupCutSchema = z.object({
  attackerPlayerIndex: z.number().int().min(0).max(3),
  attackerTokenIndex: z.number().int().min(0).max(3),
  defenderPlayerIndex: z.number().int().min(0).max(3),
  defenderTokenIndex: z.number().int().min(0).max(3),
  distance: z.number().int().min(1).max(6),
});
export const ludoDebugScenarioSchema = z.object({
  scenario: z.enum([
    "all_yard",
    "all_track",
    "near_win",
    "instant_win",
    "scatter",
  ]),
});
export const inviteUserSchema = z.object({
  targetNumericId: z
    .string()
    .trim()
    .regex(/^[0-9]{4,10}$/, "Invalid User ID. Must be 4-10 digits."),
});
export const changeGameSchema = z.object({
  gameSlug: z.string().min(1).max(40),
});

export const businessUpdateSettingsSchema = z.object({
  targetNetWorth: z
    .union([z.literal(5000), z.literal(7000), z.literal(10000)])
    .optional(),
  startingCash: z
    .union([z.literal(1000), z.literal(1500), z.literal(2000)])
    .optional(),
});

export const businessActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("roll-die") }),
  z.object({ type: z.literal("pay-bail") }),
  z.object({ type: z.literal("pass-jail-turn") }),
  z.object({ type: z.literal("buy-property") }),
  z.object({ type: z.literal("pass-property") }),
  z.object({ type: z.literal("upgrade-property") }),
  z.object({ type: z.literal("skip-upgrade") }),
  z.object({
    type: z.literal("sell-property"),
    tileIndex: z.number().int().min(0).max(27),
  }),
  z.object({ type: z.literal("acknowledge-mystery") }),
  z.object({ type: z.literal("pay-debt") }),
  z.object({ type: z.literal("declare-bankruptcy") }),
  z.object({ type: z.literal("send-emote"), emoji: z.string().min(1).max(8) }),
]);

export type CreateRoomPayload = z.input<typeof createRoomSchema>;
export type JoinRoomPayload = z.input<typeof joinRoomSchema>;
export type JoinPublicPayload = z.input<typeof joinPublicSchema>;
export type SetVisibilityPayload = z.input<typeof setVisibilitySchema>;
export type SetReadyPayload = z.input<typeof setReadySchema>;
export type TargetPlayerPayload = z.input<typeof targetPlayerSchema>;
export type LudoMovePayload = z.input<typeof ludoMoveSchema>;
export type LudoEmotePayload = z.input<typeof ludoEmoteSchema>;
export type TruthAndDareChoicePayload = z.input<
  typeof truthAndDareChoiceSchema
>;
export type TruthAndDareFinishPayload = z.input<
  typeof truthAndDareFinishSchema
>;
export type TruthAndDareCharacterPayload = z.input<
  typeof truthAndDareCharacterSchema
>;
export type TruthAndDareConfigurePayload = z.input<
  typeof truthAndDareConfigureSchema
>;
export type LudoDebugEnablePayload = z.input<typeof ludoDebugEnableSchema>;
export type LudoDebugSetDicePayload = z.input<typeof ludoDebugSetDiceSchema>;
export type LudoDebugSetPiecePayload = z.input<typeof ludoDebugSetPieceSchema>;
export type LudoDebugSetTurnPayload = z.input<typeof ludoDebugSetTurnSchema>;
export type LudoDebugSetupCutPayload = z.input<typeof ludoDebugSetupCutSchema>;
export type LudoDebugScenarioPayload = z.input<typeof ludoDebugScenarioSchema>;
export type InviteUserPayload = z.input<typeof inviteUserSchema>;
export type ChangeGamePayload = z.input<typeof changeGameSchema>;
export type EmptyPayload = z.input<typeof emptySchema>;

export interface ClientToServerEvents {
  "room:create": (payload: CreateRoomPayload, ack: AckFn<RoomSnapshot>) => void;
  "room:join": (payload: JoinRoomPayload, ack: AckFn<RoomSnapshot>) => void;
  "room:join-public": (
    payload: JoinPublicPayload,
    ack: AckFn<RoomSnapshot>,
  ) => void;
  "room:leave": (payload: EmptyPayload, ack: AckFn<null>) => void;
  "room:set-visibility": (
    payload: SetVisibilityPayload,
    ack: AckFn<RoomSnapshot>,
  ) => void;
  "room:set-ready": (
    payload: SetReadyPayload,
    ack: AckFn<RoomSnapshot>,
  ) => void;
  "room:transfer-owner": (
    payload: TargetPlayerPayload,
    ack: AckFn<RoomSnapshot>,
  ) => void;
  "room:kick": (payload: TargetPlayerPayload, ack: AckFn<RoomSnapshot>) => void;
  "room:end-game": (payload: EmptyPayload, ack: AckFn<RoomSnapshot>) => void;
  "room:start": (payload: EmptyPayload, ack: AckFn<RoomSnapshot>) => void;
  "room:get-invite-token": (
    payload: EmptyPayload,
    ack: AckFn<{ token: string; inviteUrl: string }>,
  ) => void;
  "room:invite-user": (
    payload: InviteUserPayload,
    ack: AckFn<{ ok: boolean; targetName: string }>,
  ) => void;
  "room:change-game": (
    payload: ChangeGamePayload,
    ack: AckFn<RoomSnapshot>,
  ) => void;
  "ludo:get-state": (payload: EmptyPayload, ack: AckFn<LudoGameState>) => void;
  "ludo:roll": (payload: EmptyPayload, ack: AckFn<LudoGameState>) => void;
  "ludo:move": (payload: LudoMovePayload, ack: AckFn<LudoGameState>) => void;
  "ludo:pass": (payload: EmptyPayload, ack: AckFn<LudoGameState>) => void;
  "ludo:emote": (
    payload: LudoEmotePayload,
    ack: AckFn<{ ok: boolean }>,
  ) => void;
  "truth-and-dare:get-state": (
    payload: EmptyPayload,
    ack: AckFn<TruthAndDareState>,
  ) => void;
  "truth-and-dare:spin": (
    payload: EmptyPayload,
    ack: AckFn<TruthAndDareState>,
  ) => void;
  "truth-and-dare:choose": (
    payload: TruthAndDareChoicePayload,
    ack: AckFn<TruthAndDareState>,
  ) => void;
  "truth-and-dare:finish": (
    payload: TruthAndDareFinishPayload,
    ack: AckFn<TruthAndDareState>,
  ) => void;
  "truth-and-dare:set-character": (
    payload: TruthAndDareCharacterPayload,
    ack: AckFn<TruthAndDareState>,
  ) => void;
  "truth-and-dare:configure": (
    payload: TruthAndDareConfigurePayload,
    ack: AckFn<TruthAndDareState>,
  ) => void;
  "truth-and-dare:start-game": (
    payload: EmptyPayload,
    ack: AckFn<TruthAndDareState>,
  ) => void;
  "ludo:debug-enable": (
    payload: LudoDebugEnablePayload,
    ack: AckFn<LudoGameState>,
  ) => void;
  "ludo:debug-set-dice": (
    payload: LudoDebugSetDicePayload,
    ack: AckFn<LudoGameState>,
  ) => void;
  "ludo:debug-set-piece": (
    payload: LudoDebugSetPiecePayload,
    ack: AckFn<LudoGameState>,
  ) => void;
  "ludo:debug-set-turn": (
    payload: LudoDebugSetTurnPayload,
    ack: AckFn<LudoGameState>,
  ) => void;
  "ludo:debug-setup-cut": (
    payload: LudoDebugSetupCutPayload,
    ack: AckFn<LudoGameState>,
  ) => void;
  "ludo:debug-scenario": (
    payload: LudoDebugScenarioPayload,
    ack: AckFn<LudoGameState>,
  ) => void;
  "business:get-state": (
    payload: EmptyPayload,
    ack: AckFn<BusinessState>,
  ) => void;
  "business:update-settings": (
    payload: BusinessUpdateSettingsPayload,
    ack: AckFn<BusinessState>,
  ) => void;
  "business:start-match": (
    payload: EmptyPayload,
    ack: AckFn<BusinessState>,
  ) => void;
  "business:action": (
    payload: BusinessActionPayload,
    ack: AckFn<BusinessState>,
  ) => void;
}

export type ClientToServerEventName = keyof ClientToServerEvents;

export interface ServerToClientEvents {
  /** Full room state. Sent after every change and when a socket (re)connects while the user is in a room. */
  "room:state": (room: RoomSnapshot) => void;
  /** The room no longer exists (everyone was offline for too long). */
  "room:closed": (payload: { code: string }) => void;
  /** The owner removed you from the room. */
  "room:kicked": (payload: { code: string }) => void;
  /** Direct real-time invitation from another player. */
  "room:invitation-received": (payload: {
    senderName: string;
    gameSlug: string;
    gameName: string;
    inviteToken: string;
  }) => void;
  "ludo:state": (state: LudoGameState) => void;
  "ludo:rolling": (payload: { color: LudoColor; userId: string }) => void;
  "ludo:emote": (payload: { userId: string; emoji: string }) => void;
  "ludo:debug-enabled": (payload: { enabled: boolean }) => void;
  "truth-and-dare:state": (state: TruthAndDareState) => void;
  "business:state": (state: BusinessState) => void;
}

export type InterServerEvents = Record<never, never>;

export interface SocketUser {
  id: string;
  name: string;
  image: string | null;
  isAnonymous: boolean;
}

export interface SocketData {
  user: SocketUser;
}
