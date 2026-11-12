import {
  BUSINESS_BOARD,
  BUSINESS_PUCK_COLORS,
  businessActionSchema,
  businessUpdateSettingsSchema,
  emptySchema,
  type BusinessActionPayload,
  type BusinessPlayer,
  type BusinessPropertyState,
  type BusinessState,
  type RoomPlayer,
} from "@kridora/shared";
import type { GameActionContext, ServerGameModule } from "./types";

const PURCHASABLE_TYPES = new Set(["city", "transit", "utility"]);
const TRANSIT_INDICES = [4, 11, 25];

const MYSTERY_EVENTS = [
  {
    title: "Central Bank Dividend",
    description: "Global markets rally! You collect $200 bonus.",
    cashDelta: 200,
  },
  {
    title: "Export Surplus",
    description: "International trade boom! Collect $150.",
    cashDelta: 150,
  },
  {
    title: "Luxury Audit Tax",
    description: "Pay $120 commercial inspection fee.",
    cashDelta: -120,
  },
  {
    title: "Tech Venture Payout",
    description: "Your startup IPO succeeds! Collect $250.",
    cashDelta: 250,
  },
  {
    title: "Customs Tariff",
    description: "Pay $100 port tariff to the central bank.",
    cashDelta: -100,
  },
] as const;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeRollId(): string {
  return `roll_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function recalculateNetWorths(state: BusinessState): void {
  for (const player of state.players) {
    if (player.isBankrupt) {
      player.netWorth = 0;
      continue;
    }
    let worth = player.cash;
    for (const prop of Object.values(state.properties)) {
      if (prop.ownerId === player.userId) {
        const tile = BUSINESS_BOARD[prop.tileIndex];
        if (!tile || !tile.cost) continue;
        worth += tile.cost;
        if (prop.level > 0 && tile.upgradeCost) {
          worth += prop.level * tile.upgradeCost;
        }
      }
    }
    player.netWorth = worth;
  }
}

function computeRent(state: BusinessState, tileIndex: number): number {
  const tile = BUSINESS_BOARD[tileIndex];
  const prop = state.properties[tileIndex];
  if (!tile || !prop || !prop.ownerId) return 0;

  if (tile.type === "transit") {
    const ownedTransits = TRANSIT_INDICES.filter(
      (idx) => state.properties[idx]?.ownerId === prop.ownerId,
    ).length;
    return tile.rent?.[Math.max(0, ownedTransits - 1)] ?? 40;
  }

  if (tile.rent) {
    return tile.rent[prop.level] ?? tile.rent[0];
  }
  return 35;
}

function advanceTurnOrBonus(state: BusinessState): void {
  const current = state.players[state.turnIndex];

  // Rolling a 6 grants an extra roll if the player is not in jail or bankrupt
  if (
    current &&
    !current.isBankrupt &&
    !current.inJail &&
    state.lastRoll?.rollerId === current.userId &&
    state.lastRoll.value === 6
  ) {
    state.turnSubPhase = "awaiting_roll";
    state.statusMessage = `${current.username} rolled a 6 and gets a bonus roll!`;
    return;
  }

  const totalPlayers = state.players.length;
  for (let offset = 1; offset <= totalPlayers; offset++) {
    const idx = (state.turnIndex + offset) % totalPlayers;
    const candidate = state.players[idx];
    if (candidate && !candidate.isBankrupt) {
      state.turnIndex = idx;
      state.turnSubPhase = candidate.inJail ? "jail_choice" : "awaiting_roll";
      const remainingJail = Math.max(1, 3 - candidate.jailTurns);
      state.statusMessage = candidate.inJail
        ? `${candidate.username} is in Jail (${remainingJail} round${remainingJail > 1 ? "s" : ""} remaining).`
        : `${candidate.username}'s turn to roll.`;
      return;
    }
  }
}

async function checkVictory(
  state: BusinessState,
  ctx: GameActionContext<BusinessState>,
): Promise<boolean> {
  if (state.phase !== "playing") return false;
  recalculateNetWorths(state);

  const active = state.players.filter((p) => !p.isBankrupt);
  let winner: BusinessPlayer | null = null;
  let reason: string | null = null;

  if (active.length === 1) {
    winner = active[0]!;
    reason = "Last Solvent Tycoon Standing!";
  } else {
    const reachedGoal = active
      .filter((p) => p.netWorth >= state.settings.targetNetWorth)
      .sort((a, b) => b.netWorth - a.netWorth);
    if (reachedGoal[0]) {
      winner = reachedGoal[0];
      reason = `Reached $${state.settings.targetNetWorth.toLocaleString()} Net Worth!`;
    }
  }

  if (!winner) return false;

  state.phase = "game_over";
  state.winnerUserId = winner.userId;
  state.winReason = reason;
  state.statusMessage = `${winner.username} won the match!`;

  const ranked = [...state.players].sort((a, b) => {
    if (a.isBankrupt !== b.isBankrupt) return a.isBankrupt ? 1 : -1;
    return b.netWorth - a.netWorth;
  });

  await ctx.completeMatch({
    winnerUserId: winner.userId,
    placements: ranked.map((p, i) => ({
      userId: p.userId,
      placement: i + 1,
      xpReward: i === 0 ? 120 : 40,
      ringsReward: i === 0 ? 25 : 5,
    })),
  });

  return true;
}

function chargePlayerOrEnterDebt(
  state: BusinessState,
  player: BusinessPlayer,
  amount: number,
  creditorId: string | "bank",
  reason: string,
): boolean {
  if (player.cash >= amount) {
    player.cash -= amount;
    if (creditorId !== "bank") {
      const owner = state.players.find((p) => p.userId === creditorId);
      if (owner) owner.cash += amount;
    }
    recalculateNetWorths(state);
    return true;
  }

  state.pendingDebt = { amount, creditorId, reason };
  state.turnSubPhase = "debt_resolution";
  state.statusMessage = `${player.username} owes $${amount} (${reason}). Sell a property or declare bankruptcy.`;
  recalculateNetWorths(state);
  return false;
}

async function handleGameAction(
  state: BusinessState,
  action: BusinessActionPayload,
  userId: string,
  ctx: GameActionContext<BusinessState>,
): Promise<void> {
  const sender = state.players.find((p) => p.userId === userId);
  if (!sender) return;

  if (action.type === "send-emote") {
    sender.lastEmote = { emoji: action.emoji, timestamp: Date.now() };
    return;
  }

  const activePlayer = state.players[state.turnIndex];
  if (
    !activePlayer ||
    activePlayer.userId !== userId ||
    activePlayer.isBankrupt
  ) {
    return;
  }

  switch (action.type) {
    case "pay-bail": {
      if (!activePlayer.inJail || state.turnSubPhase !== "jail_choice") return;
      if (activePlayer.cash < 100) return;
      activePlayer.cash -= 100;
      activePlayer.inJail = false;
      activePlayer.jailTurns = 0;
      state.turnSubPhase = "awaiting_roll";
      state.statusMessage = `${activePlayer.username} paid $100 bail and can now roll!`;
      recalculateNetWorths(state);
      return;
    }

    case "pass-jail-turn": {
      if (!activePlayer.inJail || state.turnSubPhase !== "jail_choice") return;
      activePlayer.jailTurns += 1;
      if (activePlayer.jailTurns >= 3) {
        activePlayer.inJail = false;
        activePlayer.jailTurns = 0;
        state.statusMessage = `${activePlayer.username} served 3 rounds in Jail and is now free!`;
      } else {
        const remaining = 3 - activePlayer.jailTurns;
        state.statusMessage = `${activePlayer.username} passed turn in Jail (${remaining} round${remaining > 1 ? "s" : ""} remaining).`;
      }
      advanceTurnOrBonus(state);
      return;
    }

    case "roll-die": {
      if (
        state.turnSubPhase !== "awaiting_roll" &&
        state.turnSubPhase !== "jail_choice"
      ) {
        return;
      }

      state.lastTransaction = null;
      const dieValue = randomInt(1, 6);
      const fromTile = activePlayer.position;

      if (activePlayer.inJail) {
        if (dieValue === 6) {
          activePlayer.inJail = false;
          activePlayer.jailTurns = 0;
          state.statusMessage = `${activePlayer.username} rolled a 6 and broke out of Jail!`;
        } else {
          activePlayer.jailTurns += 1;
          state.lastRoll = {
            value: dieValue,
            rollId: makeRollId(),
            rollerId: activePlayer.userId,
            fromTile,
            toTile: fromTile,
          };
          if (activePlayer.jailTurns >= 3) {
            activePlayer.inJail = false;
            activePlayer.jailTurns = 0;
            state.statusMessage = `${activePlayer.username} rolled ${dieValue} and completed 3 rounds in Jail — now free!`;
          } else {
            const rem = 3 - activePlayer.jailTurns;
            state.statusMessage = `${activePlayer.username} rolled ${dieValue} in Jail (${rem} round${rem > 1 ? "s" : ""} remaining).`;
          }
          advanceTurnOrBonus(state);
          return;
        }
      }

      const totalTiles = BUSINESS_BOARD.length; // 28
      const toTile = (fromTile + dieValue) % totalTiles;
      activePlayer.position = toTile;

      state.lastRoll = {
        value: dieValue,
        rollId: makeRollId(),
        rollerId: activePlayer.userId,
        fromTile,
        toTile,
      };

      // Passed or landed on START (Tile 0)
      if (toTile < fromTile) {
        activePlayer.cash += 200;
      }

      const landedTile = BUSINESS_BOARD[toTile]!;
      recalculateNetWorths(state);

      if (PURCHASABLE_TYPES.has(landedTile.type)) {
        const prop = state.properties[toTile]!;
        if (!prop.ownerId) {
          state.turnSubPhase = "buy_or_pass";
          state.statusMessage = `${activePlayer.username} landed on ${landedTile.name} ($${landedTile.cost}).`;
          return;
        }

        if (prop.ownerId === activePlayer.userId) {
          if (
            landedTile.type === "city" &&
            prop.level < 3 &&
            landedTile.upgradeCost &&
            activePlayer.cash >= landedTile.upgradeCost
          ) {
            state.turnSubPhase = "upgrade_or_skip";
            state.statusMessage = `${activePlayer.username} can upgrade ${landedTile.name}!`;
            return;
          }
          const won = await checkVictory(state, ctx);
          if (!won) advanceTurnOrBonus(state);
          return;
        }

        // Owned by a rival — charge rent automatically
        const owner = state.players.find((p) => p.userId === prop.ownerId);
        const rent = computeRent(state, toTile);
        if (owner && rent > 0) {
          const paid = chargePlayerOrEnterDebt(
            state,
            activePlayer,
            rent,
            owner.userId,
            `Rent at ${landedTile.name}`,
          );
          if (paid) {
            state.lastTransaction = {
              payerId: activePlayer.userId,
              payerName: activePlayer.username,
              payeeId: owner.userId,
              payeeName: owner.username,
              amount: rent,
              tileName: landedTile.name,
              timestamp: Date.now(),
            };
            state.statusMessage = `${activePlayer.username} paid $${rent} rent to ${owner.username} at ${landedTile.name}.`;
            const won = await checkVictory(state, ctx);
            if (!won) advanceTurnOrBonus(state);
          }
          return;
        }
      }

      if (landedTile.type === "chance") {
        const card = MYSTERY_EVENTS[randomInt(0, MYSTERY_EVENTS.length - 1)]!;
        state.mysteryNotice = card;
        state.turnSubPhase = "mystery_card";
        return;
      }

      if (landedTile.type === "jail") {
        activePlayer.inJail = true;
        activePlayer.jailTurns = 0;
        state.statusMessage = `${activePlayer.username} entered Jail!`;
        const won = await checkVictory(state, ctx);
        if (!won) advanceTurnOrBonus(state);
        return;
      }

      if (landedTile.type === "auction_tax") {
        // Auction/Market Dividend corner gives +$100 market bonus
        activePlayer.cash += 100;
        recalculateNetWorths(state);
        state.statusMessage = `${activePlayer.username} collected $100 Auction House dividend!`;
      }

      const won = await checkVictory(state, ctx);
      if (!won) advanceTurnOrBonus(state);
      return;
    }

    case "buy-property": {
      if (state.turnSubPhase !== "buy_or_pass") return;
      const tile = BUSINESS_BOARD[activePlayer.position];
      const prop = state.properties[activePlayer.position];
      if (!tile || !prop || prop.ownerId || !tile.cost) return;

      if (activePlayer.cash < tile.cost) return;
      activePlayer.cash -= tile.cost;
      prop.ownerId = activePlayer.userId;
      prop.level = 0;

      state.statusMessage = `${activePlayer.username} bought ${tile.name} for $${tile.cost}!`;
      const won = await checkVictory(state, ctx);
      if (!won) advanceTurnOrBonus(state);
      return;
    }

    case "pass-property": {
      if (state.turnSubPhase !== "buy_or_pass") return;
      const tile = BUSINESS_BOARD[activePlayer.position];
      state.statusMessage = `${activePlayer.username} passed on ${tile?.name ?? "property"}.`;
      const won = await checkVictory(state, ctx);
      if (!won) advanceTurnOrBonus(state);
      return;
    }

    case "upgrade-property": {
      if (state.turnSubPhase !== "upgrade_or_skip") return;
      const tile = BUSINESS_BOARD[activePlayer.position];
      const prop = state.properties[activePlayer.position];
      if (
        !tile ||
        !prop ||
        prop.ownerId !== activePlayer.userId ||
        !tile.upgradeCost ||
        prop.level >= 3
      ) {
        return;
      }
      if (activePlayer.cash < tile.upgradeCost) return;
      activePlayer.cash -= tile.upgradeCost;
      prop.level += 1;
      state.statusMessage = `${activePlayer.username} upgraded ${tile.name} to Level ${prop.level}!`;
      const won = await checkVictory(state, ctx);
      if (!won) advanceTurnOrBonus(state);
      return;
    }

    case "skip-upgrade": {
      if (state.turnSubPhase !== "upgrade_or_skip") return;
      const won = await checkVictory(state, ctx);
      if (!won) advanceTurnOrBonus(state);
      return;
    }

    case "acknowledge-mystery": {
      if (state.turnSubPhase !== "mystery_card" || !state.mysteryNotice) return;
      const delta = state.mysteryNotice.cashDelta;
      const title = state.mysteryNotice.title;
      state.mysteryNotice = null;

      if (delta >= 0) {
        activePlayer.cash += delta;
        recalculateNetWorths(state);
        const won = await checkVictory(state, ctx);
        if (!won) advanceTurnOrBonus(state);
      } else {
        const paid = chargePlayerOrEnterDebt(
          state,
          activePlayer,
          Math.abs(delta),
          "bank",
          title,
        );
        if (paid) {
          const won = await checkVictory(state, ctx);
          if (!won) advanceTurnOrBonus(state);
        }
      }
      return;
    }

    case "sell-property": {
      const prop = state.properties[action.tileIndex];
      const tile = BUSINESS_BOARD[action.tileIndex];
      if (
        !prop ||
        !tile ||
        prop.ownerId !== activePlayer.userId ||
        !tile.cost
      ) {
        return;
      }
      const upgradeValue =
        prop.level > 0 && tile.upgradeCost ? prop.level * tile.upgradeCost : 0;
      const refund = Math.round((tile.cost + upgradeValue) * 0.75);

      prop.ownerId = null;
      prop.level = 0;
      activePlayer.cash += refund;
      state.statusMessage = `${activePlayer.username} sold ${tile.name} for $${refund}.`;
      recalculateNetWorths(state);
      return;
    }

    case "pay-debt": {
      if (state.turnSubPhase !== "debt_resolution" || !state.pendingDebt)
        return;
      if (activePlayer.cash < state.pendingDebt.amount) return;

      activePlayer.cash -= state.pendingDebt.amount;
      if (state.pendingDebt.creditorId !== "bank") {
        const creditor = state.players.find(
          (p) => p.userId === state.pendingDebt?.creditorId,
        );
        if (creditor) {
          creditor.cash += state.pendingDebt.amount;
          state.lastTransaction = {
            payerId: activePlayer.userId,
            payerName: activePlayer.username,
            payeeId: creditor.userId,
            payeeName: creditor.username,
            amount: state.pendingDebt.amount,
            tileName: state.pendingDebt.reason,
            timestamp: Date.now(),
          };
        }
      }
      state.pendingDebt = null;
      recalculateNetWorths(state);
      const won = await checkVictory(state, ctx);
      if (!won) advanceTurnOrBonus(state);
      return;
    }

    case "declare-bankruptcy": {
      if (state.turnSubPhase !== "debt_resolution") return;
      activePlayer.isBankrupt = true;
      activePlayer.cash = 0;
      activePlayer.netWorth = 0;
      for (const prop of Object.values(state.properties)) {
        if (prop.ownerId === activePlayer.userId) {
          prop.ownerId = null;
          prop.level = 0;
        }
      }
      state.pendingDebt = null;
      state.statusMessage = `${activePlayer.username} went bankrupt!`;
      const won = await checkVictory(state, ctx);
      if (!won) advanceTurnOrBonus(state);
      return;
    }
  }
}

export const businessGameModule: ServerGameModule<BusinessState> = {
  slug: "business",
  eventPrefix: "business",
  stateEvent: "business:state",

  createInitialState(players: readonly RoomPlayer[]): BusinessState {
    const properties: Record<number, BusinessPropertyState> = {};
    for (const tile of BUSINESS_BOARD) {
      if (PURCHASABLE_TYPES.has(tile.type)) {
        properties[tile.index] = {
          tileIndex: tile.index,
          ownerId: null,
          level: 0,
        };
      }
    }

    const startingCash = 1000;
    const gamePlayers: BusinessPlayer[] = players.map((p, idx) => ({
      userId: p.userId,
      username: p.name,
      avatarUrl: p.image ?? null,
      color: BUSINESS_PUCK_COLORS[idx % BUSINESS_PUCK_COLORS.length]!,
      cash: startingCash,
      netWorth: startingCash,
      position: 0,
      inJail: false,
      jailTurns: 0,
      isBankrupt: false,
      isConnected: true,
      lastEmote: null,
    }));

    return {
      phase: "setup",
      turnSubPhase: "awaiting_roll",
      hostUserId: players[0]?.userId ?? "",
      settings: {
        targetNetWorth: 7000,
        startingCash: 1000,
      },
      players: gamePlayers,
      turnIndex: 0,
      properties,
      lastRoll: null,
      mysteryNotice: null,
      pendingDebt: null,
      lastTransaction: null,
      statusMessage: "Waiting for host to start the match...",
      winnerUserId: null,
      winReason: null,
    };
  },

  async handleAction(
    ctx: GameActionContext<BusinessState>,
    action: string,
    rawPayload: unknown,
  ): Promise<BusinessState> {
    const { state, user } = ctx;
    const userId = user.id;

    if (action === "get-state") {
      emptySchema.parse(rawPayload);
      return state;
    }

    if (action === "update-settings") {
      const isOwner = ctx.ownerId
        ? userId === ctx.ownerId
        : userId === state.hostUserId;
      if (state.phase !== "setup" || !isOwner) return state;

      const parsed = businessUpdateSettingsSchema.parse(rawPayload);
      state.settings = { ...state.settings, ...parsed };
      for (const p of state.players) {
        p.cash = state.settings.startingCash;
        p.netWorth = state.settings.startingCash;
      }
      ctx.setState(state);
      ctx.broadcastState();
      return state;
    }

    if (action === "start-match") {
      emptySchema.parse(rawPayload);
      const isOwner = ctx.ownerId
        ? userId === ctx.ownerId
        : userId === state.hostUserId;
      if (state.phase !== "setup" || !isOwner) return state;

      state.phase = "playing";
      state.turnIndex = 0;
      state.turnSubPhase = "awaiting_roll";
      for (const p of state.players) {
        p.cash = state.settings.startingCash;
        p.netWorth = state.settings.startingCash;
        p.position = 0;
      }
      state.statusMessage = `${state.players[0]?.username ?? "Player 1"}'s turn to roll!`;
      ctx.setState(state);
      ctx.broadcastState();
      return state;
    }

    if (action === "action" && state.phase === "playing") {
      const parsedAction = businessActionSchema.parse(rawPayload);
      await handleGameAction(state, parsedAction, userId, ctx);
      ctx.setState(state);
      ctx.broadcastState();
      return state;
    }

    return state;
  },

  onPlayerLeft(state: BusinessState, userId: string): boolean {
    const player = state.players.find((p) => p.userId === userId);
    if (!player) return false;
    player.isConnected = false;

    if (state.phase === "playing" && !player.isBankrupt) {
      player.isBankrupt = true;
      player.cash = 0;
      player.netWorth = 0;
      for (const prop of Object.values(state.properties)) {
        if (prop.ownerId === userId) {
          prop.ownerId = null;
          prop.level = 0;
        }
      }
      const active = state.players.filter((p) => !p.isBankrupt);
      if (active.length === 1) {
        state.phase = "game_over";
        state.winnerUserId = active[0]!.userId;
        state.winReason = "Last Solvent Tycoon Standing!";
        state.statusMessage = `${active[0]!.username} won the match!`;
      } else if (state.players[state.turnIndex]?.userId === userId) {
        advanceTurnOrBonus(state);
      }
    }

    return true;
  },
};
