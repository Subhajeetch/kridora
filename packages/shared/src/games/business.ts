export type BusinessPhase = "setup" | "playing" | "game_over";

export type BusinessTurnSubPhase =
  | "awaiting_roll"
  | "buy_or_pass"
  | "upgrade_or_skip"
  | "jail_choice"
  | "auction_trade"
  | "debt_resolution";

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
  | "#f59e0b" // Warm Gold
  | "#3b82f6" // Sky Blue
  | "#10b981"; // Emerald

export const BUSINESS_PUCK_COLORS: readonly BusinessPuckColor[] = [
  "#ef4444",
  "#f59e0b",
  "#3b82f6",
  "#10b981",
] as const;

export const BUSINESS_CHAT_MAX_LENGTH = 160;
export const BUSINESS_CHAT_MAX_HISTORY = 250;
export const BUSINESS_START_SALARY = 200;
export const BUSINESS_BAIL_COST = 100;
export const BUSINESS_AUCTION_BONUS = 100;
export const BUSINESS_SELL_REFUND_RATE = 0.75;
/** Reaching -$600 cash or lower triggers bankruptcy */
export const BUSINESS_BANKRUPT_LIMIT = -600;

export interface BusinessTileDefinition {
  index: number;
  name: string;
  type: BusinessTileType;
  colorGroup?: BusinessColorGroup;
  topBgHex?: string;
  bottomBgHex?: string;
  cost?: number;
  /** City rents: [base, level1, level2, skyscraper]; Transit rents: [1 owned, 2 owned, 3 owned] */
  rent?: readonly number[];
  /** Bonus base rent when player owns the full color group (level 0) */
  monopolyBaseRent?: number;
  upgradeCost?: number;
}

export const BUSINESS_BOARD: readonly BusinessTileDefinition[] = [
  { index: 0, name: "START", type: "start" },

  // Left Column (Bottom to Top: 1..6)
  {
    index: 1,
    name: "RIO",
    type: "city",
    colorGroup: "lime",
    topBgHex: "#b5d96c",
    bottomBgHex: "#8ec138",
    cost: 100,
    rent: [15, 55, 130, 260],
    monopolyBaseRent: 25,
    upgradeCost: 60,
  },
  {
    index: 2,
    name: "DELHI",
    type: "city",
    colorGroup: "lime",
    topBgHex: "#b5d96c",
    bottomBgHex: "#8ec138",
    cost: 110,
    rent: [18, 60, 145, 290],
    monopolyBaseRent: 28,
    upgradeCost: 60,
  },
  {
    index: 3,
    name: "BANGKOK",
    type: "city",
    colorGroup: "sky",
    topBgHex: "#89cff8",
    bottomBgHex: "#48a6eb",
    cost: 130,
    rent: [22, 75, 175, 340],
    monopolyBaseRent: 35,
    upgradeCost: 80,
  },
  {
    index: 4,
    name: "HARBOR",
    type: "transit",
    cost: 180,
    rent: [45, 110, 220],
  },
  {
    index: 5,
    name: "CAIRO",
    type: "city",
    colorGroup: "sky",
    topBgHex: "#89cff8",
    bottomBgHex: "#48a6eb",
    cost: 150,
    rent: [25, 85, 195, 380],
    monopolyBaseRent: 38,
    upgradeCost: 80,
  },
  {
    index: 6,
    name: "MADRID",
    type: "city",
    colorGroup: "sky",
    topBgHex: "#89cff8",
    bottomBgHex: "#48a6eb",
    cost: 160,
    rent: [28, 95, 215, 420],
    monopolyBaseRent: 42,
    upgradeCost: 80,
  },

  { index: 7, name: "MYSTERY", type: "chance" },

  // Top Row (Left to Right: 8..13)
  {
    index: 8,
    name: "JAKARTA",
    type: "city",
    colorGroup: "crimson",
    topBgHex: "#de618c",
    bottomBgHex: "#bd366d",
    cost: 180,
    rent: [32, 110, 250, 480],
    monopolyBaseRent: 48,
    upgradeCost: 110,
  },
  {
    index: 9,
    name: "BERLIN",
    type: "city",
    colorGroup: "crimson",
    topBgHex: "#de618c",
    bottomBgHex: "#bd366d",
    cost: 190,
    rent: [35, 120, 270, 520],
    monopolyBaseRent: 52,
    upgradeCost: 110,
  },
  {
    index: 10,
    name: "MOSCOW",
    type: "city",
    colorGroup: "orange",
    topBgHex: "#f9c65c",
    bottomBgHex: "#f29a11",
    cost: 210,
    rent: [38, 130, 290, 560],
    monopolyBaseRent: 58,
    upgradeCost: 130,
  },
  {
    index: 11,
    name: "RAILWAY",
    type: "transit",
    cost: 180,
    rent: [45, 110, 220],
  },
  {
    index: 12,
    name: "TORONTO",
    type: "city",
    colorGroup: "orange",
    topBgHex: "#f9c65c",
    bottomBgHex: "#f29a11",
    cost: 220,
    rent: [40, 140, 310, 600],
    monopolyBaseRent: 60,
    upgradeCost: 130,
  },
  {
    index: 13,
    name: "SEOUL",
    type: "city",
    colorGroup: "orange",
    topBgHex: "#f9c65c",
    bottomBgHex: "#f29a11",
    cost: 240,
    rent: [45, 155, 340, 650],
    monopolyBaseRent: 68,
    upgradeCost: 130,
  },

  { index: 14, name: "JAIL", type: "jail" },

  // Right Column (Top to Bottom: 15..20)
  {
    index: 15,
    name: "ZURICH",
    type: "city",
    colorGroup: "emerald",
    topBgHex: "#66c99b",
    bottomBgHex: "#1c8a5a",
    cost: 260,
    rent: [50, 170, 380, 720],
    monopolyBaseRent: 75,
    upgradeCost: 160,
  },
  {
    index: 16,
    name: "RIYADH",
    type: "city",
    colorGroup: "emerald",
    topBgHex: "#66c99b",
    bottomBgHex: "#1c8a5a",
    cost: 280,
    rent: [55, 185, 410, 780],
    monopolyBaseRent: 82,
    upgradeCost: 160,
  },
  {
    index: 17,
    name: "SYDNEY",
    type: "city",
    colorGroup: "brown",
    topBgHex: "#c99a67",
    bottomBgHex: "#8d5b28",
    cost: 300,
    rent: [58, 195, 430, 820],
    monopolyBaseRent: 88,
    upgradeCost: 180,
  },
  {
    index: 18,
    name: "ELECTRICITY",
    type: "utility",
    cost: 160,
    rent: [75],
  },
  {
    index: 19,
    name: "BEIJING",
    type: "city",
    colorGroup: "brown",
    topBgHex: "#c99a67",
    bottomBgHex: "#8d5b28",
    cost: 310,
    rent: [60, 205, 450, 860],
    monopolyBaseRent: 90,
    upgradeCost: 180,
  },
  {
    index: 20,
    name: "DUBAI",
    type: "city",
    colorGroup: "brown",
    topBgHex: "#c99a67",
    bottomBgHex: "#8d5b28",
    cost: 330,
    rent: [65, 220, 485, 920],
    monopolyBaseRent: 98,
    upgradeCost: 180,
  },

  { index: 21, name: "AUCTION", type: "auction_tax" },

  // Bottom Row (Right to Left: 22..27)
  {
    index: 22,
    name: "PARIS",
    type: "city",
    colorGroup: "purple",
    topBgHex: "#9b87f5",
    bottomBgHex: "#624da8",
    cost: 360,
    rent: [72, 240, 540, 1020],
    monopolyBaseRent: 108,
    upgradeCost: 220,
  },
  {
    index: 23,
    name: "HONG KONG",
    type: "city",
    colorGroup: "purple",
    topBgHex: "#9b87f5",
    bottomBgHex: "#624da8",
    cost: 380,
    rent: [78, 260, 580, 1100],
    monopolyBaseRent: 118,
    upgradeCost: 220,
  },
  {
    index: 24,
    name: "LONDON",
    type: "city",
    colorGroup: "coral",
    topBgHex: "#f78e69",
    bottomBgHex: "#e65132",
    cost: 420,
    rent: [85, 285, 630, 1200],
    monopolyBaseRent: 128,
    upgradeCost: 260,
  },
  {
    index: 25,
    name: "AIRPORT",
    type: "transit",
    cost: 180,
    rent: [45, 110, 220],
  },
  {
    index: 26,
    name: "TOKYO",
    type: "city",
    colorGroup: "coral",
    topBgHex: "#f78e69",
    bottomBgHex: "#e65132",
    cost: 440,
    rent: [90, 305, 670, 1280],
    monopolyBaseRent: 135,
    upgradeCost: 260,
  },
  {
    index: 27,
    name: "NEW YORK",
    type: "city",
    colorGroup: "coral",
    topBgHex: "#f78e69",
    bottomBgHex: "#e65132",
    cost: 480,
    rent: [100, 340, 750, 1450],
    monopolyBaseRent: 150,
    upgradeCost: 260,
  },
] as const;

export const BUSINESS_TRANSIT_INDICES: readonly number[] = [4, 11, 25] as const;

export interface BusinessSettings {
  targetNetWorth: 3000 | 5000 | 7000 | 10000;
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
  /** Rounds remaining in Jail (0 when free, 3 when newly jailed) */
  jailTurns: number;
  isBankrupt: boolean;
  /** Monotonic order of bankruptcy (higher = survived longer) */
  bankruptOrder: number | null;
  /** 1 = 1st place, 2 = 2nd place, 3 = 3rd place once target net worth is reached */
  finishRank: number | null;
  isConnected: boolean;
}

export interface BusinessPropertyState {
  tileIndex: number;
  ownerId: string | null;
  /** 0 = base deed, 1 = house, 2 = hotel, 3 = skyscraper */
  level: number;
}

export interface BusinessDieRoll {
  value: number; // 1..6
  rollId: string;
  rollerId: string;
  fromTile: number;
  toTile: number;
  passedStart: boolean;
  sentToJail: boolean;
  isBonusRoll: boolean;
}

export type BusinessEventTone = "info" | "cash" | "danger" | "jail" | "trade";

export interface BusinessEventNotice {
  id: string;
  /** Fallback third-person message text */
  text: string;
  /** Viewer-aware template supporting {actor}, {actorPoss}, {target}, and {v:youForm|thirdForm} */
  template?: string;
  actorId?: string;
  targetId?: string;
  tone: BusinessEventTone;
  playerColor?: BusinessPuckColor;
  timestamp: number;
}

export interface BusinessFinisherEvent {
  eventId: string;
  userId: string;
  username: string;
  rank: number;
  color: BusinessPuckColor;
  timestamp: number;
}

export interface BusinessTradeOffer {
  offerId: string;
  fromUserId: string;
  fromUsername: string;
  fromColor: BusinessPuckColor;
  offeredTileIndex: number;
}

export interface BusinessAuctionTrade {
  hostUserId: string;
  hostTileIndex: number;
  offers: BusinessTradeOffer[];
  declinedUserIds: string[];
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

export interface BusinessChatMessage {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  color: BusinessPuckColor;
  text: string;
  timestamp: number;
}

export interface BusinessState {
  phase: BusinessPhase;
  turnSubPhase: BusinessTurnSubPhase;
  hostUserId: string;
  settings: BusinessSettings;
  players: BusinessPlayer[];
  turnIndex: number;
  turnNumber: number;
  consecutiveSixes: number;
  bonusRollPending: boolean;
  /** Server-only shuffle bag stripped in serializeStateForPlayer */
  diceBag?: number[];
  properties: Record<number, BusinessPropertyState>;
  lastRoll: BusinessDieRoll | null;
  auctionTrade: BusinessAuctionTrade | null;
  pendingDebt: BusinessPendingDebt | null;
  lastTransaction: BusinessRentTransaction | null;
  /** Triggered whenever a player reaches target net worth (fires win sound & confetti even mid-match) */
  latestFinisher: BusinessFinisherEvent | null;
  turnNotices: BusinessEventNotice[];
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
  | { type: "upgrade-property"; tileIndex?: number }
  | { type: "skip-upgrade" }
  | { type: "sell-property"; tileIndex: number }
  | { type: "auction-select-tile"; tileIndex: number }
  | { type: "auction-propose-offer"; offeredTileIndex: number }
  | { type: "auction-decline" }
  | { type: "auction-accept-offer"; offerId: string }
  | { type: "auction-skip" }
  | { type: "pay-debt" }
  | { type: "declare-bankruptcy" }
  | { type: "send-chat"; text: string };

export interface BusinessUpdateSettingsPayload {
  targetNetWorth?: 3000 | 5000 | 7000 | 10000;
  startingCash?: 1000 | 1500 | 2000;
}

export function isPlayerActive(
  player: Pick<BusinessPlayer, "isBankrupt" | "finishRank">,
): boolean {
  return !player.isBankrupt && player.finishRank === null;
}

/** True if paying `amount` keeps cash strictly above the -$600 bankruptcy threshold. */
export function canSurviveCharge(cash: number, amount: number): boolean {
  return cash - amount > BUSINESS_BANKRUPT_LIMIT;
}

/** Formats positive and negative cash cleanly (e.g. `-$150`, `$1,200`). */
export function formatBusinessCash(amount: number): string {
  if (amount < 0) {
    return `-$${Math.abs(amount).toLocaleString()}`;
  }
  return `$${amount.toLocaleString()}`;
}

export function formatOrdinalRank(rank: number): string {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

/** Authoritative final podium sorting: Finished (1st..3rd) -> Solvent by Net Worth -> Bankrupt (latest first). */
export function sortBusinessStandings(
  players: readonly BusinessPlayer[],
): BusinessPlayer[] {
  return [...players].sort((a, b) => {
    const aFinished = a.finishRank !== null;
    const bFinished = b.finishRank !== null;
    if (aFinished !== bFinished) return aFinished ? -1 : 1;
    if (aFinished && bFinished) return a.finishRank! - b.finishRank!;

    if (a.isBankrupt !== b.isBankrupt) return a.isBankrupt ? 1 : -1;
    if (a.isBankrupt && b.isBankrupt) {
      return (b.bankruptOrder ?? 0) - (a.bankruptOrder ?? 0);
    }

    return b.netWorth - a.netWorth;
  });
}

export function getColorGroupTiles(
  group: BusinessColorGroup,
): readonly BusinessTileDefinition[] {
  return BUSINESS_BOARD.filter(
    (tile) => tile.type === "city" && tile.colorGroup === group,
  );
}

export function getColorGroupProgress(
  properties: Record<number, BusinessPropertyState>,
  group: BusinessColorGroup | undefined,
  ownerId: string | null,
): { owned: number; total: number; hasMonopoly: boolean } {
  if (!group || !ownerId) {
    return { owned: 0, total: 0, hasMonopoly: false };
  }
  const groupTiles = getColorGroupTiles(group);
  const owned = groupTiles.filter(
    (t) => properties[t.index]?.ownerId === ownerId,
  ).length;
  return {
    owned,
    total: groupTiles.length,
    hasMonopoly: groupTiles.length > 0 && owned === groupTiles.length,
  };
}

export function computeBusinessTileRent(
  properties: Record<number, BusinessPropertyState>,
  tileIndex: number,
): number {
  const tile = BUSINESS_BOARD[tileIndex];
  const prop = properties[tileIndex];
  if (!tile || !prop || !prop.ownerId) return 0;

  if (tile.type === "transit") {
    const ownedTransits = BUSINESS_TRANSIT_INDICES.filter(
      (idx) => properties[idx]?.ownerId === prop.ownerId,
    ).length;
    return tile.rent?.[Math.max(0, ownedTransits - 1)] ?? 45;
  }

  if (tile.type === "utility") {
    return tile.rent?.[0] ?? 75;
  }

  if (tile.type === "city" && tile.rent) {
    if (prop.level === 0) {
      const { hasMonopoly } = getColorGroupProgress(
        properties,
        tile.colorGroup,
        prop.ownerId,
      );
      if (hasMonopoly && tile.monopolyBaseRent) {
        return tile.monopolyBaseRent;
      }
      return tile.rent[0] ?? 20;
    }
    return tile.rent[prop.level] ?? tile.rent[tile.rent.length - 1] ?? 20;
  }

  return 0;
}

export function computePropertySellRefund(
  tile: BusinessTileDefinition,
  level: number,
): number {
  const base = tile.cost ?? 0;
  const upgrades = level > 0 && tile.upgradeCost ? level * tile.upgradeCost : 0;
  return Math.round((base + upgrades) * BUSINESS_SELL_REFUND_RATE);
}

export function formatBusinessNotice(
  notice: Pick<
    BusinessEventNotice,
    "text" | "template" | "actorId" | "targetId"
  >,
  players: readonly Pick<BusinessPlayer, "userId" | "username">[],
  viewerUserId: string,
): string {
  if (!notice.template) return notice.text;

  const actorIsMe = Boolean(notice.actorId && notice.actorId === viewerUserId);
  const targetIsMe = Boolean(
    notice.targetId && notice.targetId === viewerUserId,
  );

  const actorName = actorIsMe
    ? "You"
    : (players.find((p) => p.userId === notice.actorId)?.username ?? "Player");
  const targetName = targetIsMe
    ? "you"
    : (players.find((p) => p.userId === notice.targetId)?.username ?? "Player");
  const actorPoss = actorIsMe ? "Your" : `${actorName}'s`;

  return notice.template
    .replaceAll("{actorPoss}", actorPoss)
    .replaceAll("{actor}", actorName)
    .replaceAll("{target}", targetName)
    .replace(
      /\{v:([^|]+)\|([^}]+)\}/g,
      (_, youForm: string, thirdForm: string) =>
        actorIsMe ? youForm : thirdForm,
    );
}
