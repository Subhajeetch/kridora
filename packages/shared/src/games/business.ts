export type BusinessPhase = "setup" | "playing" | "game_over";

export type BusinessTurnSubPhase =
  | "awaiting_roll"
  | "buy_or_pass"
  | "upgrade_or_skip"
  | "mystery_card"
  | "jail_choice"
  | "debt_resolution"
  | "turn_end";

export type BusinessTileType =
  "start" | "city" | "transit" | "utility" | "chance" | "jail" | "auction_tax";

export type BusinessColorGroup =
  | "lime"
  | "sky"
  | "crimson"
  | "orange"
  | "emerald"
  | "brown"
  | "purple"
  | "coral";

export type BusinessPuckColor =
  | "#ef4444" // Red
  | "#3b82f6" // Blue
  | "#10b981" // Green
  | "#f59e0b"; // Golden Amber

export const BUSINESS_PUCK_COLORS: readonly BusinessPuckColor[] = [
  "#ef4444",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
] as const;

export interface BusinessTileDefinition {
  index: number;
  name: string;
  type: BusinessTileType;
  colorGroup?: BusinessColorGroup;
  topBgHex?: string;
  bottomBgHex?: string;
  cost?: number;
  /** Rent tiers: [base, level1, level2, skyscraper] */
  rent?: [number, number, number, number];
  upgradeCost?: number;
}

const makeRent = (cost: number): [number, number, number, number] => [
  Math.round(cost * 0.2),
  Math.round(cost * 0.5),
  Math.round(cost * 1.1),
  Math.round(cost * 2.0),
];

/**
 * 28-Tile 8x8 Perimeter Board matching the exact cities & layout of the reference UI:
 * 0 = Bottom-Left (START)
 * 1..6 = Left column going UP
 * 7 = Top-Left (?)
 * 8..13 = Top row going RIGHT
 * 14 = Top-Right (JAIL)
 * 15..20 = Right column going DOWN
 * 21 = Bottom-Right (AUCTION)
 * 22..27 = Bottom row going LEFT
 */
export const BUSINESS_BOARD: readonly BusinessTileDefinition[] = [
  // 0: Bottom-Left Corner
  { index: 0, name: "START", type: "start" },

  // Left Column (Bottom to Top: 1..6)
  {
    index: 1,
    name: "RIO",
    type: "city",
    colorGroup: "lime",
    topBgHex: "#b5d66c",
    bottomBgHex: "#9bc53d",
    cost: 100,
    rent: makeRent(100),
    upgradeCost: 60,
  },
  {
    index: 2,
    name: "DELHI",
    type: "city",
    colorGroup: "lime",
    topBgHex: "#b5d66c",
    bottomBgHex: "#9bc53d",
    cost: 100,
    rent: makeRent(100),
    upgradeCost: 60,
  },
  {
    index: 3,
    name: "BANGKOK",
    type: "city",
    colorGroup: "sky",
    topBgHex: "#9ad1f5",
    bottomBgHex: "#5bc0be",
    cost: 130,
    rent: makeRent(130),
    upgradeCost: 80,
  },
  {
    index: 4,
    name: "HARBOR",
    type: "transit",
    cost: 150,
    rent: [40, 80, 140, 220],
  },
  {
    index: 5,
    name: "CAIRO",
    type: "city",
    colorGroup: "sky",
    topBgHex: "#9ad1f5",
    bottomBgHex: "#5aa9e6",
    cost: 150,
    rent: makeRent(150),
    upgradeCost: 90,
  },
  {
    index: 6,
    name: "MADRID",
    type: "city",
    colorGroup: "sky",
    topBgHex: "#9ad1f5",
    bottomBgHex: "#5aa9e6",
    cost: 150,
    rent: makeRent(150),
    upgradeCost: 90,
  },

  // 7: Top-Left Corner
  { index: 7, name: "MYSTERY", type: "chance" },

  // Top Row (Left to Right: 8..13)
  {
    index: 8,
    name: "JAKARTA",
    type: "city",
    colorGroup: "crimson",
    topBgHex: "#d95d85",
    bottomBgHex: "#b8336a",
    cost: 170,
    rent: makeRent(170),
    upgradeCost: 100,
  },
  {
    index: 9,
    name: "BERLIN",
    type: "city",
    colorGroup: "crimson",
    topBgHex: "#d95d85",
    bottomBgHex: "#b8336a",
    cost: 180,
    rent: makeRent(180),
    upgradeCost: 100,
  },
  {
    index: 10,
    name: "MOSCOW",
    type: "city",
    colorGroup: "orange",
    topBgHex: "#f9c762",
    bottomBgHex: "#f39c12",
    cost: 200,
    rent: makeRent(200),
    upgradeCost: 120,
  },
  {
    index: 11,
    name: "RAILWAY",
    type: "transit",
    cost: 150,
    rent: [40, 80, 140, 220],
  },
  {
    index: 12,
    name: "TORONTO",
    type: "city",
    colorGroup: "orange",
    topBgHex: "#f9c762",
    bottomBgHex: "#f39c12",
    cost: 200,
    rent: makeRent(200),
    upgradeCost: 120,
  },
  {
    index: 13,
    name: "SEOUL",
    type: "city",
    colorGroup: "orange",
    topBgHex: "#f9c762",
    bottomBgHex: "#f39c12",
    cost: 200,
    rent: makeRent(200),
    upgradeCost: 120,
  },

  // 14: Top-Right Corner
  { index: 14, name: "JAIL", type: "jail" },

  // Right Column (Top to Bottom: 15..20)
  {
    index: 15,
    name: "ZURICH",
    type: "city",
    colorGroup: "emerald",
    topBgHex: "#68c79c",
    bottomBgHex: "#1b8a5a",
    cost: 250,
    rent: makeRent(250),
    upgradeCost: 150,
  },
  {
    index: 16,
    name: "RIYADH",
    type: "city",
    colorGroup: "emerald",
    topBgHex: "#68c79c",
    bottomBgHex: "#1b8a5a",
    cost: 250,
    rent: makeRent(250),
    upgradeCost: 150,
  },
  {
    index: 17,
    name: "SYDNEY",
    type: "city",
    colorGroup: "brown",
    topBgHex: "#c99b68",
    bottomBgHex: "#8d5b28",
    cost: 300,
    rent: makeRent(300),
    upgradeCost: 170,
  },
  {
    index: 18,
    name: "ELECTRICITY",
    type: "utility",
    cost: 150,
    rent: [35, 75, 120, 180],
  },
  {
    index: 19,
    name: "BEIJING",
    type: "city",
    colorGroup: "brown",
    topBgHex: "#c99b68",
    bottomBgHex: "#8d5b28",
    cost: 300,
    rent: makeRent(300),
    upgradeCost: 170,
  },
  {
    index: 20,
    name: "DUBAI",
    type: "city",
    colorGroup: "brown",
    topBgHex: "#c99b68",
    bottomBgHex: "#8d5b28",
    cost: 300,
    rent: makeRent(300),
    upgradeCost: 170,
  },

  // 21: Bottom-Right Corner
  { index: 21, name: "AUCTION", type: "auction_tax" },

  // Bottom Row (Right to Left: 22..27)
  {
    index: 22,
    name: "PARIS",
    type: "city",
    colorGroup: "purple",
    topBgHex: "#9b87f5",
    bottomBgHex: "#5c4b99",
    cost: 350,
    rent: makeRent(350),
    upgradeCost: 200,
  },
  {
    index: 23,
    name: "HONG KONG",
    type: "city",
    colorGroup: "purple",
    topBgHex: "#9b87f5",
    bottomBgHex: "#5c4b99",
    cost: 350,
    rent: makeRent(350),
    upgradeCost: 200,
  },
  {
    index: 24,
    name: "LONDON",
    type: "city",
    colorGroup: "coral",
    topBgHex: "#f78e69",
    bottomBgHex: "#e65132",
    cost: 420,
    rent: makeRent(420),
    upgradeCost: 240,
  },
  {
    index: 25,
    name: "AIRPORT",
    type: "transit",
    cost: 150,
    rent: [40, 80, 140, 220],
  },
  {
    index: 26,
    name: "TOKYO",
    type: "city",
    colorGroup: "coral",
    topBgHex: "#f78e69",
    bottomBgHex: "#e65132",
    cost: 420,
    rent: makeRent(420),
    upgradeCost: 240,
  },
  {
    index: 27,
    name: "NEW YORK",
    type: "city",
    colorGroup: "coral",
    topBgHex: "#f78e69",
    bottomBgHex: "#e65132",
    cost: 450,
    rent: makeRent(450),
    upgradeCost: 260,
  },
] as const;

export interface BusinessSettings {
  targetNetWorth: 5000 | 7000 | 10000;
  startingCash: 1000 | 1500 | 2000;
}

export interface BusinessPlayer {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  color: BusinessPuckColor;
  cash: number;
  netWorth: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  isBankrupt: boolean;
  isConnected: boolean;
  lastEmote?: { emoji: string; timestamp: number } | null;
}

export interface BusinessPropertyState {
  tileIndex: number;
  ownerId: string | null;
  /** 0 = base deed, 1 = 1 house, 2 = 2 houses, 3 = skyscraper */
  level: number;
}

export interface BusinessDieRoll {
  value: number; // 1..6
  rollId: string;
  rollerId: string;
  fromTile: number;
  toTile: number;
}

export interface BusinessMysteryNotice {
  title: string;
  description: string;
  cashDelta: number;
}

export interface BusinessPendingDebt {
  amount: number;
  creditorId: string | "bank";
  reason: string;
}

export interface BusinessRentTransaction {
  payerId: string;
  payerName: string;
  payeeId: string;
  payeeName: string;
  amount: number;
  tileName: string;
  timestamp: number;
}

export interface BusinessState {
  phase: BusinessPhase;
  turnSubPhase: BusinessTurnSubPhase;
  hostUserId: string;
  settings: BusinessSettings;
  players: BusinessPlayer[];
  turnIndex: number;
  properties: Record<number, BusinessPropertyState>;
  lastRoll: BusinessDieRoll | null;
  mysteryNotice: BusinessMysteryNotice | null;
  pendingDebt: BusinessPendingDebt | null;
  lastTransaction: BusinessRentTransaction | null;
  statusMessage: string;
  winnerUserId: string | null;
  winReason: string | null;
}

export type BusinessActionPayload =
  | { type: "roll-die" }
  | { type: "pay-bail" }
  | { type: "pass-jail-turn" }
  | { type: "buy-property" }
  | { type: "pass-property" }
  | { type: "upgrade-property" }
  | { type: "skip-upgrade" }
  | { type: "sell-property"; tileIndex: number }
  | { type: "acknowledge-mystery" }
  | { type: "pay-debt" }
  | { type: "declare-bankruptcy" }
  | { type: "send-emote"; emoji: string };

export interface BusinessUpdateSettingsPayload {
  targetNetWorth?: 5000 | 7000 | 10000;
  startingCash?: 1000 | 1500 | 2000;
}
