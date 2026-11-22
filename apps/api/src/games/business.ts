import {
  BUSINESS_AUCTION_BONUS,
  BUSINESS_BAIL_COST,
  BUSINESS_BANKRUPT_LIMIT,
  BUSINESS_BOARD,
  BUSINESS_CHAT_MAX_LENGTH,
  BUSINESS_PUCK_COLORS,
  BUSINESS_START_SALARY,
  businessActionSchema,
  businessUpdateSettingsSchema,
  canSurviveCharge,
  computeBusinessTileRent,
  computePropertySellRefund,
  emptySchema,
  formatBusinessNotice,
  formatOrdinalRank,
  getColorGroupProgress,
  isPlayerActive,
  sortBusinessStandings,
  type BusinessActionPayload,
  type BusinessChatMessage,
  type BusinessEventTone,
  type BusinessPlayer,
  type BusinessPropertyState,
  type BusinessPuckColor,
  type BusinessState,
  type RoomPlayer,
} from "@kridora/shared";
import type { GameActionContext, ServerGameModule } from "./types";

const PURCHASABLE_TYPES = new Set(["city", "transit", "utility"]);
const JAIL_TILE_INDEX = 14;
const JAIL_SENTENCE_ROUNDS = 3;
const MAX_UPGRADE_LEVEL = 3;
const CHAT_WINDOW_MS = 4000;
const CHAT_MAX_IN_WINDOW = 5;

const PLACEMENT_REWARDS = [
  { xp: 120, rings: 25 },
  { xp: 75, rings: 15 },
  { xp: 50, rings: 8 },
  { xp: 35, rings: 5 },
] as const;

const chatRateBuckets = new Map<string, number[]>();

const MYSTERY_EVENTS = [
  { label: "bank dividend", cashDelta: 200 },
  { label: "trade bonus", cashDelta: 150 },
  { label: "startup payout", cashDelta: 250 },
  { label: "tourism bonus", cashDelta: 120 },
  { label: "audit fee", cashDelta: -120 },
  { label: "port tariff", cashDelta: -100 },
  { label: "city tax", cashDelta: -150 },
] as const;

function cryptoRandInt(maxExclusive: number): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  let value = 0;
  do {
    crypto.getRandomValues(buf);
    value = buf[0]!;
  } while (value >= limit);
  return value % maxExclusive;
}

function createShuffledDiceBag(): number[] {
  const bag: number[] = [];
  for (let repeat = 0; repeat < 3; repeat++) {
    for (let face = 1; face <= 6; face++) {
      bag.push(face);
    }
  }
  for (let i = bag.length - 1; i > 0; i--) {
    const j = cryptoRandInt(i + 1);
    const tmp = bag[i]!;
    bag[i] = bag[j]!;
    bag[j] = tmp;
  }
  return bag;
}

function drawFairDie(state: BusinessState): number {
  if (!state.diceBag || state.diceBag.length < 4) {
    const fresh = createShuffledDiceBag();
    state.diceBag = state.diceBag ? [...state.diceBag, ...fresh] : fresh;
  }
  return state.diceBag.shift() ?? cryptoRandInt(6) + 1;
}

function makeId(prefix: string): string {
  const rand = cryptoRandInt(1_000_000_000).toString(36);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

interface NoticeOptions {
  template: string;
  tone: BusinessEventTone;
  actorId?: string;
  targetId?: string;
  playerColor?: BusinessPuckColor;
}

function pushNotice(state: BusinessState, opts: NoticeOptions): void {
  const fallbackText = formatBusinessNotice(
    {
      text: opts.template,
      template: opts.template,
      actorId: opts.actorId,
      targetId: opts.targetId,
    },
    state.players,
    "",
  );
  state.turnNotices.push({
    id: makeId("ntc"),
    text: fallbackText,
    template: opts.template,
    actorId: opts.actorId,
    targetId: opts.targetId,
    tone: opts.tone,
    playerColor: opts.playerColor,
    timestamp: Date.now(),
  });
  state.statusMessage = fallbackText;
}

function sanitizeChatText(raw: string): string {
  return raw
    .replace(
      /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, BUSINESS_CHAT_MAX_LENGTH);
}

function allowChatMessage(roomCode: string, userId: string): boolean {
  const key = `${roomCode}:${userId}`;
  const now = Date.now();
  const recent = (chatRateBuckets.get(key) ?? []).filter(
    (ts) => now - ts < CHAT_WINDOW_MS,
  );
  if (recent.length >= CHAT_MAX_IN_WINDOW) {
    chatRateBuckets.set(key, recent);
    return false;
  }
  recent.push(now);
  chatRateBuckets.set(key, recent);

  if (chatRateBuckets.size > 400) {
    for (const [k, timestamps] of chatRateBuckets) {
      if (timestamps.every((ts) => now - ts >= CHAT_WINDOW_MS)) {
        chatRateBuckets.delete(k);
      }
    }
  }
  return true;
}

function recalculateNetWorths(state: BusinessState): void {
  for (const player of state.players) {
    // Finished players keep their frozen winning net worth
    if (player.finishRank !== null) continue;
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

function getPlayerOwnedTiles(state: BusinessState, userId: string): number[] {
  return Object.values(state.properties)
    .filter((p) => p.ownerId === userId)
    .map((p) => p.tileIndex);
}

function computeTotalLiquidationValue(
  state: BusinessState,
  userId: string,
): number {
  let total = 0;
  for (const prop of Object.values(state.properties)) {
    if (prop.ownerId !== userId) continue;
    const tile = BUSINESS_BOARD[prop.tileIndex];
    if (!tile) continue;
    total += computePropertySellRefund(tile, prop.level);
  }
  return total;
}

function releasePlayerProperties(state: BusinessState, userId: string): void {
  for (const prop of Object.values(state.properties)) {
    if (prop.ownerId === userId) {
      prop.ownerId = null;
      prop.level = 0;
    }
  }
}

function bankruptPlayer(
  state: BusinessState,
  player: BusinessPlayer,
  reasonTemplate?: string,
): void {
  const bankruptCount = state.players.filter((p) => p.isBankrupt).length;
  player.isBankrupt = true;
  player.bankruptOrder = bankruptCount + 1;
  player.cash = BUSINESS_BANKRUPT_LIMIT;
  player.netWorth = 0;
  player.inJail = false;
  player.jailTurns = 0;
  releasePlayerProperties(state, player.userId);
  state.pendingDebt = null;
  state.bonusRollPending = false;
  state.consecutiveSixes = 0;

  if (reasonTemplate) {
    pushNotice(state, {
      template: reasonTemplate,
      tone: "danger",
      actorId: player.userId,
      playerColor: player.color,
    });
  }
}

function canUpgradeCity(
  state: BusinessState,
  player: BusinessPlayer,
  tileIndex: number,
): boolean {
  const tile = BUSINESS_BOARD[tileIndex];
  const prop = state.properties[tileIndex];
  if (
    !tile ||
    !prop ||
    tile.type !== "city" ||
    !tile.colorGroup ||
    !tile.upgradeCost ||
    prop.ownerId !== player.userId ||
    prop.level >= MAX_UPGRADE_LEVEL ||
    player.cash < tile.upgradeCost
  ) {
    return false;
  }
  const { hasMonopoly } = getColorGroupProgress(
    state.properties,
    tile.colorGroup,
    player.userId,
  );
  return hasMonopoly;
}

function advanceTurnOrBonus(state: BusinessState): void {
  const current = state.players[state.turnIndex];

  if (
    state.bonusRollPending &&
    current &&
    isPlayerActive(current) &&
    !current.inJail
  ) {
    state.bonusRollPending = false;
    state.turnSubPhase = "awaiting_roll";
    pushNotice(state, {
      template: "{actor} {v:get|gets} a bonus roll!",
      tone: "info",
      actorId: current.userId,
      playerColor: current.color,
    });
    return;
  }

  state.bonusRollPending = false;
  state.consecutiveSixes = 0;

  const totalPlayers = state.players.length;
  if (totalPlayers === 0) return;

  const maxSteps = totalPlayers * (JAIL_SENTENCE_ROUNDS + 2);
  let cursor = state.turnIndex;

  for (let step = 0; step < maxSteps; step++) {
    cursor = (cursor + 1) % totalPlayers;
    const candidate = state.players[cursor];
    if (!candidate || !isPlayerActive(candidate)) continue;

    if (candidate.inJail && candidate.jailTurns > 0) {
      candidate.jailTurns -= 1;
      if (candidate.jailTurns > 0) {
        const r = candidate.jailTurns;
        pushNotice(state, {
          template: `{actor} {v:need|needs} ${r} round${r > 1 ? "s" : ""} in Jail`,
          tone: "jail",
          actorId: candidate.userId,
          playerColor: candidate.color,
        });
      } else {
        candidate.inJail = false;
        pushNotice(state, {
          template: "{actor} finished Jail — free next turn!",
          tone: "info",
          actorId: candidate.userId,
          playerColor: candidate.color,
        });
      }
      continue;
    }

    state.turnIndex = cursor;
    state.turnNumber += 1;
    state.turnSubPhase = "awaiting_roll";
    return;
  }
}

/**
 * Evaluates podium finishes & match completion.
 * - Any active player reaching targetNetWorth gets the next podium rank (1st, 2nd, 3rd),
 *   freezes their net worth, releases their deeds, and triggers victory sound/confetti.
 * - Match continues until <= 1 active player remains!
 * Returns `{ matchEnded, activePlayerFinished }`.
 */
async function evaluateStandingsAndVictory(
  state: BusinessState,
  ctx: GameActionContext<BusinessState>,
): Promise<{ matchEnded: boolean; activePlayerFinished: boolean }> {
  if (state.phase !== "playing") {
    return { matchEnded: true, activePlayerFinished: true };
  }
  recalculateNetWorths(state);

  const activePlayerBefore = state.players[state.turnIndex] ?? null;
  let activePlayerFinished = false;

  // Award podium ranks to any active players who just hit targetNetWorth
  const newlyFinished = state.players
    .filter(
      (p) => isPlayerActive(p) && p.netWorth >= state.settings.targetNetWorth,
    )
    .sort((a, b) => b.netWorth - a.netWorth);

  for (const finisher of newlyFinished) {
    const existingFinishedCount = state.players.filter(
      (p) => p.finishRank !== null,
    ).length;
    const rank = existingFinishedCount + 1;
    finisher.finishRank = rank;
    finisher.inJail = false;
    finisher.jailTurns = 0;
    releasePlayerProperties(state, finisher.userId);

    if (activePlayerBefore?.userId === finisher.userId) {
      activePlayerFinished = true;
      state.bonusRollPending = false;
      state.consecutiveSixes = 0;
      state.pendingDebt = null;
      state.auctionTrade = null;
    }

    state.latestFinisher = {
      eventId: makeId("fin"),
      userId: finisher.userId,
      username: finisher.username,
      rank,
      color: finisher.color,
      timestamp: Date.now(),
    };

    pushNotice(state, {
      template: `{actor} finished ${formatOrdinalRank(rank)} Place! 🏆`,
      tone: "cash",
      actorId: finisher.userId,
      playerColor: finisher.color,
    });
  }

  // Match ends ONLY when <= 1 active player remains who hasn't finished or gone bankrupt
  const remainingActive = state.players.filter(isPlayerActive);
  if (remainingActive.length > 1) {
    return { matchEnded: false, activePlayerFinished };
  }

  const ranked = sortBusinessStandings(state.players);
  const champion = ranked[0] ?? null;

  state.phase = "game_over";
  state.bonusRollPending = false;
  state.consecutiveSixes = 0;
  state.auctionTrade = null;
  state.pendingDebt = null;
  state.winnerUserId = champion?.userId ?? null;
  state.winReason =
    champion?.finishRank === 1
      ? `Reached $${state.settings.targetNetWorth.toLocaleString()} Net Worth!`
      : "Last Solvent Tycoon Standing!";

  if (champion && newlyFinished.length === 0) {
    pushNotice(state, {
      template: "{actor} won the match! 🏆",
      tone: "cash",
      actorId: champion.userId,
      playerColor: champion.color,
    });
  }

  await ctx.completeMatch({
    winnerUserId: champion?.userId ?? null,
    placements: ranked.map((p, idx) => {
      const reward =
        PLACEMENT_REWARDS[idx] ??
        PLACEMENT_REWARDS[PLACEMENT_REWARDS.length - 1]!;
      return {
        userId: p.userId,
        placement: idx + 1,
        xpReward: reward.xp,
        ringsReward: reward.rings,
      };
    }),
  });

  return { matchEnded: true, activePlayerFinished: true };
}

/**
 * Charges `player` an involuntary fee (rent or Mystery bank fee).
 * - If `player.cash - amount > -$600`: pays immediately (allowing negative overdraft down to -$599).
 * - If `player.cash - amount <= -$600`:
 *   - If selling deeds can keep cash > -$600 -> enters `debt_resolution`.
 *   - Otherwise -> auto-bankrupts immediately (zero dead-end click!).
 */
function chargePlayerOrResolve(
  state: BusinessState,
  player: BusinessPlayer,
  amount: number,
  creditorId: string | "bank",
  reason: string,
): "paid" | "debt" | "bankrupt" {
  if (canSurviveCharge(player.cash, amount)) {
    player.cash -= amount;
    if (creditorId !== "bank") {
      const owner = state.players.find((p) => p.userId === creditorId);
      if (owner) owner.cash += amount;
    }
    recalculateNetWorths(state);
    return "paid";
  }

  // Check whether selling owned deeds can rescue the player above -$600
  const maxRecoverable =
    player.cash + computeTotalLiquidationValue(state, player.userId);
  if (canSurviveCharge(maxRecoverable, amount)) {
    state.pendingDebt = { amount, creditorId, reason };
    state.turnSubPhase = "debt_resolution";
    pushNotice(state, {
      template: `{actor} {v:owe|owes} $${amount} — sell deeds to stay above -$600`,
      tone: "danger",
      actorId: player.userId,
      playerColor: player.color,
    });
    recalculateNetWorths(state);
    return "debt";
  }

  // Cannot possibly stay above -$600 even after selling everything -> instant bankruptcy!
  if (creditorId !== "bank") {
    const owner = state.players.find((p) => p.userId === creditorId);
    const salvageable = Math.max(0, maxRecoverable - BUSINESS_BANKRUPT_LIMIT);
    const payout = Math.min(amount, salvageable);
    if (owner && payout > 0) {
      owner.cash += payout;
    }
  }
  bankruptPlayer(
    state,
    player,
    `{actor} hit -$600 (${reason}) and went bankrupt!`,
  );
  recalculateNetWorths(state);
  return "bankrupt";
}

function sendPlayerToJail(
  state: BusinessState,
  player: BusinessPlayer,
  template: string,
): void {
  player.inJail = true;
  player.jailTurns = JAIL_SENTENCE_ROUNDS;
  state.bonusRollPending = false;
  state.consecutiveSixes = 0;

  if (player.cash >= BUSINESS_BAIL_COST) {
    state.turnSubPhase = "jail_choice";
    pushNotice(state, {
      template,
      tone: "jail",
      actorId: player.userId,
      playerColor: player.color,
    });
  } else {
    pushNotice(state, {
      template: `{actor} {v:were|was} jailed for ${JAIL_SENTENCE_ROUNDS} rounds`,
      tone: "jail",
      actorId: player.userId,
      playerColor: player.color,
    });
    advanceTurnOrBonus(state);
  }
}

async function handleGameAction(
  state: BusinessState,
  action: BusinessActionPayload,
  userId: string,
  ctx: GameActionContext<BusinessState>,
): Promise<boolean> {
  const sender = state.players.find((p) => p.userId === userId);
  if (!sender) return false;

  if (action.type === "send-chat") {
    const cleanText = sanitizeChatText(action.text);
    if (!cleanText || !allowChatMessage(ctx.roomCode, userId)) {
      return false;
    }
    const chatMessage: BusinessChatMessage = {
      id: makeId("chat"),
      userId: sender.userId,
      username: sender.username,
      avatarUrl: sender.avatarUrl ?? null,
      color: sender.color,
      text: cleanText,
      timestamp: Date.now(),
    };
    ctx.broadcastEvent("business:chat", chatMessage);
    return false;
  }

  if (state.phase !== "playing") return false;

  // Rival actions during Auction Trade (only active non-finished rivals)
  if (
    state.turnSubPhase === "auction_trade" &&
    state.auctionTrade &&
    isPlayerActive(sender) &&
    sender.userId !== state.auctionTrade.hostUserId
  ) {
    if (action.type === "auction-propose-offer") {
      const prop = state.properties[action.offeredTileIndex];
      const tile = BUSINESS_BOARD[action.offeredTileIndex];
      if (!prop || !tile || prop.ownerId !== sender.userId) return false;

      state.turnNotices = [];
      state.auctionTrade.offers = [
        ...state.auctionTrade.offers.filter(
          (o) => o.fromUserId !== sender.userId,
        ),
        {
          offerId: makeId("ofr"),
          fromUserId: sender.userId,
          fromUsername: sender.username,
          fromColor: sender.color,
          offeredTileIndex: action.offeredTileIndex,
        },
      ];
      state.auctionTrade.declinedUserIds =
        state.auctionTrade.declinedUserIds.filter((id) => id !== sender.userId);

      pushNotice(state, {
        template: `{actor} offered ${tile.name}`,
        tone: "trade",
        actorId: sender.userId,
        playerColor: sender.color,
      });
      return true;
    }

    if (action.type === "auction-decline") {
      state.turnNotices = [];
      state.auctionTrade.offers = state.auctionTrade.offers.filter(
        (o) => o.fromUserId !== sender.userId,
      );
      if (!state.auctionTrade.declinedUserIds.includes(sender.userId)) {
        state.auctionTrade.declinedUserIds.push(sender.userId);
      }

      const eligibleRivals = state.players.filter(
        (p) =>
          isPlayerActive(p) &&
          p.userId !== state.auctionTrade?.hostUserId &&
          getPlayerOwnedTiles(state, p.userId).length > 0,
      );
      const allDeclined =
        state.auctionTrade.offers.length === 0 &&
        eligibleRivals.every((r) =>
          state.auctionTrade?.declinedUserIds.includes(r.userId),
        );

      if (allDeclined) {
        state.auctionTrade = null;
        pushNotice(state, {
          template: "Everyone passed — Auction closed",
          tone: "info",
        });
        advanceTurnOrBonus(state);
      } else {
        pushNotice(state, {
          template: "{actor} passed on Auction",
          tone: "info",
          actorId: sender.userId,
          playerColor: sender.color,
        });
      }
      return true;
    }
  }

  const activePlayer = state.players[state.turnIndex];
  if (
    !activePlayer ||
    activePlayer.userId !== userId ||
    !isPlayerActive(activePlayer)
  ) {
    return false;
  }

  state.turnNotices = [];

  switch (action.type) {
    case "pay-bail": {
      if (!activePlayer.inJail || state.turnSubPhase !== "jail_choice") {
        return false;
      }
      if (activePlayer.cash < BUSINESS_BAIL_COST) return false;
      activePlayer.cash -= BUSINESS_BAIL_COST;
      activePlayer.inJail = false;
      activePlayer.jailTurns = 0;
      recalculateNetWorths(state);
      pushNotice(state, {
        template: `{actor} paid $${BUSINESS_BAIL_COST} bail & left Jail`,
        tone: "cash",
        actorId: activePlayer.userId,
        playerColor: activePlayer.color,
      });
      advanceTurnOrBonus(state);
      return true;
    }

    case "pass-jail-turn": {
      if (!activePlayer.inJail || state.turnSubPhase !== "jail_choice") {
        return false;
      }
      pushNotice(state, {
        template: `{actor} {v:stay|stays} in Jail (${activePlayer.jailTurns} rounds)`,
        tone: "jail",
        actorId: activePlayer.userId,
        playerColor: activePlayer.color,
      });
      advanceTurnOrBonus(state);
      return true;
    }

    case "roll-die": {
      if (state.turnSubPhase !== "awaiting_roll" || activePlayer.inJail) {
        return false;
      }

      state.lastTransaction = null;
      const dieValue = drawFairDie(state);
      const fromTile = activePlayer.position;

      if (dieValue === 6) {
        state.consecutiveSixes += 1;
        if (state.consecutiveSixes >= 3) {
          activePlayer.position = JAIL_TILE_INDEX;
          state.lastRoll = {
            value: dieValue,
            rollId: makeId("roll"),
            rollerId: activePlayer.userId,
            fromTile,
            toTile: JAIL_TILE_INDEX,
            passedStart: false,
            sentToJail: true,
            isBonusRoll: false,
          };
          sendPlayerToJail(
            state,
            activePlayer,
            "{actor} rolled 3×6 — sent to Jail!",
          );
          return true;
        }
        state.bonusRollPending = true;
      } else {
        state.consecutiveSixes = 0;
        state.bonusRollPending = false;
      }

      const totalTiles = BUSINESS_BOARD.length;
      const toTile = (fromTile + dieValue) % totalTiles;
      const passedStart = toTile < fromTile;
      activePlayer.position = toTile;

      if (passedStart) {
        activePlayer.cash += BUSINESS_START_SALARY;
      }

      state.lastRoll = {
        value: dieValue,
        rollId: makeId("roll"),
        rollerId: activePlayer.userId,
        fromTile,
        toTile,
        passedStart,
        sentToJail: false,
        isBonusRoll: state.bonusRollPending,
      };

      const landedTile = BUSINESS_BOARD[toTile]!;
      recalculateNetWorths(state);

      // If passing START alone pushed the active player to targetNetWorth, award rank right away!
      if (activePlayer.netWorth >= state.settings.targetNetWorth) {
        const { matchEnded } = await evaluateStandingsAndVictory(state, ctx);
        if (!matchEnded) advanceTurnOrBonus(state);
        return true;
      }

      if (PURCHASABLE_TYPES.has(landedTile.type)) {
        const prop = state.properties[toTile]!;

        if (!prop.ownerId) {
          state.turnSubPhase = "buy_or_pass";
          return true;
        }

        if (prop.ownerId === activePlayer.userId) {
          if (canUpgradeCity(state, activePlayer, toTile)) {
            state.turnSubPhase = "upgrade_or_skip";
            return true;
          }
          const { matchEnded } = await evaluateStandingsAndVictory(state, ctx);
          if (!matchEnded) advanceTurnOrBonus(state);
          return true;
        }

        const owner = state.players.find((p) => p.userId === prop.ownerId);
        const rent = computeBusinessTileRent(state.properties, toTile);
        if (owner && rent > 0) {
          const outcome = chargePlayerOrResolve(
            state,
            activePlayer,
            rent,
            owner.userId,
            `Rent at ${landedTile.name}`,
          );
          if (outcome === "paid") {
            state.lastTransaction = {
              payerId: activePlayer.userId,
              payerName: activePlayer.username,
              payeeId: owner.userId,
              payeeName: owner.username,
              amount: rent,
              tileName: landedTile.name,
              timestamp: Date.now(),
            };
            pushNotice(state, {
              template: `{actor} paid {target} $${rent} rent`,
              tone: "danger",
              actorId: activePlayer.userId,
              targetId: owner.userId,
              playerColor: activePlayer.color,
            });
            const { matchEnded } = await evaluateStandingsAndVictory(
              state,
              ctx,
            );
            if (!matchEnded) advanceTurnOrBonus(state);
          } else if (outcome === "bankrupt") {
            const { matchEnded } = await evaluateStandingsAndVictory(
              state,
              ctx,
            );
            if (!matchEnded) advanceTurnOrBonus(state);
          }
          return true;
        }
      }

      if (landedTile.type === "chance") {
        const card = MYSTERY_EVENTS[cryptoRandInt(MYSTERY_EVENTS.length)]!;
        if (card.cashDelta >= 0) {
          activePlayer.cash += card.cashDelta;
          recalculateNetWorths(state);
          pushNotice(state, {
            template: `{actor} got $${card.cashDelta} (${card.label})`,
            tone: "cash",
            actorId: activePlayer.userId,
            playerColor: activePlayer.color,
          });
          const { matchEnded } = await evaluateStandingsAndVictory(state, ctx);
          if (!matchEnded) advanceTurnOrBonus(state);
        } else {
          const amt = Math.abs(card.cashDelta);
          const outcome = chargePlayerOrResolve(
            state,
            activePlayer,
            amt,
            "bank",
            card.label,
          );
          if (outcome === "paid") {
            pushNotice(state, {
              template: `{actor} paid $${amt} to bank (${card.label})`,
              tone: "danger",
              actorId: activePlayer.userId,
              playerColor: activePlayer.color,
            });
            const { matchEnded } = await evaluateStandingsAndVictory(
              state,
              ctx,
            );
            if (!matchEnded) advanceTurnOrBonus(state);
          } else if (outcome === "bankrupt") {
            const { matchEnded } = await evaluateStandingsAndVictory(
              state,
              ctx,
            );
            if (!matchEnded) advanceTurnOrBonus(state);
          }
        }
        return true;
      }

      if (landedTile.type === "jail") {
        sendPlayerToJail(state, activePlayer, "{actor} landed in Jail!");
        return true;
      }

      if (landedTile.type === "auction_tax") {
        const myOwned = getPlayerOwnedTiles(state, activePlayer.userId);
        const rivalHasDeeds = state.players.some(
          (p) =>
            isPlayerActive(p) &&
            p.userId !== activePlayer.userId &&
            getPlayerOwnedTiles(state, p.userId).length > 0,
        );

        if (myOwned.length > 0 && rivalHasDeeds) {
          state.turnSubPhase = "auction_trade";
          state.auctionTrade = {
            hostUserId: activePlayer.userId,
            hostTileIndex: myOwned[0]!,
            offers: [],
            declinedUserIds: [],
          };
          pushNotice(state, {
            template: "{actor} opened Auction!",
            tone: "trade",
            actorId: activePlayer.userId,
            playerColor: activePlayer.color,
          });
          return true;
        }

        activePlayer.cash += BUSINESS_AUCTION_BONUS;
        recalculateNetWorths(state);
        pushNotice(state, {
          template: `{actor} got $${BUSINESS_AUCTION_BONUS} Auction bonus`,
          tone: "cash",
          actorId: activePlayer.userId,
          playerColor: activePlayer.color,
        });
      }

      const { matchEnded } = await evaluateStandingsAndVictory(state, ctx);
      if (!matchEnded) advanceTurnOrBonus(state);
      return true;
    }

    case "buy-property": {
      if (state.turnSubPhase !== "buy_or_pass") return false;
      const tile = BUSINESS_BOARD[activePlayer.position];
      const prop = state.properties[activePlayer.position];
      if (!tile || !prop || prop.ownerId || !tile.cost) return false;
      if (activePlayer.cash < tile.cost) return false;

      activePlayer.cash -= tile.cost;
      prop.ownerId = activePlayer.userId;
      prop.level = 0;

      const monopolyCheck = getColorGroupProgress(
        state.properties,
        tile.colorGroup,
        activePlayer.userId,
      );
      pushNotice(state, {
        template: monopolyCheck.hasMonopoly
          ? `{actor} bought ${tile.name} — Set complete!`
          : `{actor} bought ${tile.name} ($${tile.cost})`,
        tone: "cash",
        actorId: activePlayer.userId,
        playerColor: activePlayer.color,
      });

      const { matchEnded } = await evaluateStandingsAndVictory(state, ctx);
      if (!matchEnded) advanceTurnOrBonus(state);
      return true;
    }

    case "pass-property": {
      if (state.turnSubPhase !== "buy_or_pass") return false;
      const tile = BUSINESS_BOARD[activePlayer.position];
      pushNotice(state, {
        template: `{actor} passed on ${tile?.name ?? "deed"}`,
        tone: "info",
        actorId: activePlayer.userId,
        playerColor: activePlayer.color,
      });
      const { matchEnded } = await evaluateStandingsAndVictory(state, ctx);
      if (!matchEnded) advanceTurnOrBonus(state);
      return true;
    }

    case "upgrade-property": {
      const targetIndex =
        action.tileIndex !== undefined
          ? action.tileIndex
          : activePlayer.position;

      const isLandingUpgrade =
        state.turnSubPhase === "upgrade_or_skip" &&
        targetIndex === activePlayer.position;
      const isPreRollMonopolyUpgrade = state.turnSubPhase === "awaiting_roll";

      if (!isLandingUpgrade && !isPreRollMonopolyUpgrade) return false;
      if (!canUpgradeCity(state, activePlayer, targetIndex)) return false;

      const tile = BUSINESS_BOARD[targetIndex]!;
      const prop = state.properties[targetIndex]!;
      const upgradeCost = tile.upgradeCost!;

      activePlayer.cash -= upgradeCost;
      prop.level += 1;
      pushNotice(state, {
        template: `{actor} upgraded ${tile.name} ★${prop.level} ($${upgradeCost})`,
        tone: "cash",
        actorId: activePlayer.userId,
        playerColor: activePlayer.color,
      });

      const { matchEnded, activePlayerFinished } =
        await evaluateStandingsAndVictory(state, ctx);
      if (!matchEnded && (isLandingUpgrade || activePlayerFinished)) {
        advanceTurnOrBonus(state);
      }
      return true;
    }

    case "skip-upgrade": {
      if (state.turnSubPhase !== "upgrade_or_skip") return false;
      const { matchEnded } = await evaluateStandingsAndVictory(state, ctx);
      if (!matchEnded) advanceTurnOrBonus(state);
      return true;
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
        return false;
      }

      const refund = computePropertySellRefund(tile, prop.level);
      prop.ownerId = null;
      prop.level = 0;
      activePlayer.cash += refund;
      recalculateNetWorths(state);
      pushNotice(state, {
        template: `{actor} sold ${tile.name} (+$${refund})`,
        tone: "cash",
        actorId: activePlayer.userId,
        playerColor: activePlayer.color,
      });
      return true;
    }

    case "auction-select-tile": {
      if (state.turnSubPhase !== "auction_trade" || !state.auctionTrade) {
        return false;
      }
      const prop = state.properties[action.tileIndex];
      const tile = BUSINESS_BOARD[action.tileIndex];
      if (!prop || !tile || prop.ownerId !== activePlayer.userId) return false;
      if (state.auctionTrade.hostTileIndex === action.tileIndex) return false;

      state.auctionTrade.hostTileIndex = action.tileIndex;
      state.auctionTrade.offers = [];
      state.auctionTrade.declinedUserIds = [];
      pushNotice(state, {
        template: `{actor} listed ${tile.name} for trade`,
        tone: "trade",
        actorId: activePlayer.userId,
        playerColor: activePlayer.color,
      });
      return true;
    }

    case "auction-accept-offer": {
      if (state.turnSubPhase !== "auction_trade" || !state.auctionTrade) {
        return false;
      }
      const offer = state.auctionTrade.offers.find(
        (o) => o.offerId === action.offerId,
      );
      if (!offer) return false;

      const hostProp = state.properties[state.auctionTrade.hostTileIndex];
      const rivalProp = state.properties[offer.offeredTileIndex];
      const hostTile = BUSINESS_BOARD[state.auctionTrade.hostTileIndex];
      const rivalTile = BUSINESS_BOARD[offer.offeredTileIndex];

      if (
        !hostProp ||
        !rivalProp ||
        !hostTile ||
        !rivalTile ||
        hostProp.ownerId !== activePlayer.userId ||
        rivalProp.ownerId !== offer.fromUserId
      ) {
        return false;
      }

      hostProp.ownerId = offer.fromUserId;
      rivalProp.ownerId = activePlayer.userId;
      state.auctionTrade = null;
      recalculateNetWorths(state);

      pushNotice(state, {
        template: `{actor} traded ${hostTile.name} ⇄ ${rivalTile.name} with {target}`,
        tone: "trade",
        actorId: activePlayer.userId,
        targetId: offer.fromUserId,
        playerColor: activePlayer.color,
      });

      const { matchEnded } = await evaluateStandingsAndVictory(state, ctx);
      if (!matchEnded) advanceTurnOrBonus(state);
      return true;
    }

    case "auction-skip": {
      if (state.turnSubPhase !== "auction_trade" || !state.auctionTrade) {
        return false;
      }
      state.auctionTrade = null;
      pushNotice(state, {
        template: "{actor} closed Auction",
        tone: "info",
        actorId: activePlayer.userId,
        playerColor: activePlayer.color,
      });
      advanceTurnOrBonus(state);
      return true;
    }

    case "pay-debt": {
      if (state.turnSubPhase !== "debt_resolution" || !state.pendingDebt) {
        return false;
      }
      if (!canSurviveCharge(activePlayer.cash, state.pendingDebt.amount)) {
        return false;
      }

      const debt = state.pendingDebt;
      activePlayer.cash -= debt.amount;
      if (debt.creditorId !== "bank") {
        const creditor = state.players.find(
          (p) => p.userId === debt.creditorId,
        );
        if (creditor) {
          creditor.cash += debt.amount;
          state.lastTransaction = {
            payerId: activePlayer.userId,
            payerName: activePlayer.username,
            payeeId: creditor.userId,
            payeeName: creditor.username,
            amount: debt.amount,
            tileName: debt.reason,
            timestamp: Date.now(),
          };
          pushNotice(state, {
            template: `{actor} paid {target} $${debt.amount}`,
            tone: "danger",
            actorId: activePlayer.userId,
            targetId: creditor.userId,
            playerColor: activePlayer.color,
          });
        }
      } else {
        pushNotice(state, {
          template: `{actor} paid $${debt.amount} to bank`,
          tone: "danger",
          actorId: activePlayer.userId,
          playerColor: activePlayer.color,
        });
      }
      state.pendingDebt = null;
      recalculateNetWorths(state);
      const { matchEnded } = await evaluateStandingsAndVictory(state, ctx);
      if (!matchEnded) advanceTurnOrBonus(state);
      return true;
    }

    case "declare-bankruptcy": {
      if (state.turnSubPhase !== "debt_resolution") return false;
      bankruptPlayer(state, activePlayer, "{actor} went bankrupt!");
      const { matchEnded } = await evaluateStandingsAndVictory(state, ctx);
      if (!matchEnded) advanceTurnOrBonus(state);
      return true;
    }

    default:
      return false;
  }
}

function stripServerSecrets(state: BusinessState): BusinessState {
  const { diceBag: _hiddenBag, ...publicState } = state;
  return publicState;
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

    const startingCash = 1500;
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
      bankruptOrder: null,
      finishRank: null,
      isConnected: true,
    }));

    return {
      phase: "setup",
      turnSubPhase: "awaiting_roll",
      hostUserId: players[0]?.userId ?? "",
      settings: {
        targetNetWorth: 5000,
        startingCash,
      },
      players: gamePlayers,
      turnIndex: 0,
      turnNumber: 1,
      consecutiveSixes: 0,
      bonusRollPending: false,
      diceBag: createShuffledDiceBag(),
      properties,
      lastRoll: null,
      auctionTrade: null,
      pendingDebt: null,
      lastTransaction: null,
      latestFinisher: null,
      turnNotices: [],
      statusMessage: "Waiting for host to start the match...",
      winnerUserId: null,
      winReason: null,
    };
  },

  serializeStateForPlayer(state: BusinessState): BusinessState {
    return stripServerSecrets(state);
  },

  onPlayerRenamed(
    state: BusinessState,
    userId: string,
    newName: string,
  ): boolean {
    const player = state.players.find((p) => p.userId === userId);
    if (!player) return false;
    player.username = newName;
    return true;
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
      return stripServerSecrets(state);
    }

    if (action === "update-settings") {
      const isOwner = ctx.ownerId
        ? userId === ctx.ownerId
        : userId === state.hostUserId;
      if (state.phase !== "setup" || !isOwner) {
        return stripServerSecrets(state);
      }

      const parsed = businessUpdateSettingsSchema.parse(rawPayload);
      state.settings = { ...state.settings, ...parsed };
      for (const p of state.players) {
        p.cash = state.settings.startingCash;
        p.netWorth = state.settings.startingCash;
      }
      ctx.setState(state);
      ctx.broadcastState();
      return stripServerSecrets(state);
    }

    if (action === "start-match") {
      emptySchema.parse(rawPayload);
      const isOwner = ctx.ownerId
        ? userId === ctx.ownerId
        : userId === state.hostUserId;
      if (state.phase !== "setup" || !isOwner) {
        return stripServerSecrets(state);
      }

      state.phase = "playing";
      state.turnIndex = 0;
      state.turnNumber = 1;
      state.turnSubPhase = "awaiting_roll";
      state.consecutiveSixes = 0;
      state.bonusRollPending = false;
      state.diceBag = createShuffledDiceBag();
      state.lastRoll = null;
      state.auctionTrade = null;
      state.pendingDebt = null;
      state.lastTransaction = null;
      state.latestFinisher = null;
      state.turnNotices = [];
      for (const p of state.players) {
        p.cash = state.settings.startingCash;
        p.netWorth = state.settings.startingCash;
        p.position = 0;
        p.inJail = false;
        p.jailTurns = 0;
        p.isBankrupt = false;
        p.bankruptOrder = null;
        p.finishRank = null;
      }
      if (state.players[0]) {
        pushNotice(state, {
          template: "{actorPoss} turn!",
          tone: "info",
          actorId: state.players[0].userId,
          playerColor: state.players[0].color,
        });
      }
      ctx.setState(state);
      ctx.broadcastState();
      return stripServerSecrets(state);
    }

    if (action === "action") {
      const parsedAction = businessActionSchema.parse(rawPayload);
      const mutated = await handleGameAction(state, parsedAction, userId, ctx);
      if (mutated) {
        ctx.setState(state);
        ctx.broadcastState();
      }
      return stripServerSecrets(state);
    }

    return stripServerSecrets(state);
  },

  onPlayerLeft(state: BusinessState, userId: string): boolean {
    const player = state.players.find((p) => p.userId === userId);
    if (!player) return false;
    player.isConnected = false;

    // Players who already finished on the podium keep their earned rank!
    if (state.phase === "playing" && isPlayerActive(player)) {
      const wasActive = state.players[state.turnIndex]?.userId === userId;
      state.turnNotices = [];
      bankruptPlayer(state, player, "{actor} left the match");

      if (state.auctionTrade) {
        if (state.auctionTrade.hostUserId === userId) {
          state.auctionTrade = null;
        } else {
          state.auctionTrade.offers = state.auctionTrade.offers.filter(
            (o) => o.fromUserId !== userId,
          );
        }
      }

      const remainingActive = state.players.filter(isPlayerActive);
      if (remainingActive.length <= 1) {
        const ranked = sortBusinessStandings(state.players);
        const champion = ranked[0] ?? null;
        state.phase = "game_over";
        state.auctionTrade = null;
        state.winnerUserId = champion?.userId ?? null;
        state.winReason =
          champion?.finishRank === 1
            ? `Reached $${state.settings.targetNetWorth.toLocaleString()} Net Worth!`
            : "Last Solvent Tycoon Standing!";
        if (champion) {
          pushNotice(state, {
            template: "{actor} won the match! 🏆",
            tone: "cash",
            actorId: champion.userId,
            playerColor: champion.color,
          });
        }
      } else if (wasActive) {
        advanceTurnOrBonus(state);
      }
    }

    return true;
  },
};
