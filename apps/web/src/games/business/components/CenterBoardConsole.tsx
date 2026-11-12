import {
  BUSINESS_BOARD,
  type BusinessPlayer,
  type BusinessState,
} from "@kridora/shared";
import { Coins, Sparkles, HelpCircle, ShieldAlert } from "lucide-react";
import { CenterBankIllustration } from "./BoardArtwork";

interface CenterBoardConsoleProps {
  state: BusinessState;
  userId: string;
  isHopping: boolean;
  activePlayer: BusinessPlayer | null;
  isMyTurn: boolean;
  me: BusinessPlayer | null;
  onBuy: () => void;
  onPass: () => void;
  onUpgrade: () => void;
  onSkipUpgrade: () => void;
  onAcknowledgeMystery: () => void;
  onPayBail: () => void;
  onPassJailTurn: () => void;
  onPayDebt: () => void;
  onDeclareBankruptcy: () => void;
  onSellProperty: (tileIndex: number) => void;
}

export function CenterBoardConsole({
  state,
  userId,
  isHopping,
  activePlayer,
  isMyTurn,
  me,
  onBuy,
  onPass,
  onUpgrade,
  onSkipUpgrade,
  onAcknowledgeMystery,
  onPayBail,
  onPassJailTurn,
  onPayDebt,
  onDeclareBankruptcy,
  onSellProperty,
}: CenterBoardConsoleProps) {
  const landedTile = activePlayer
    ? BUSINESS_BOARD[activePlayer.position]
    : null;
  const propState = landedTile ? state.properties[landedTile.index] : null;

  // 1. BUY OR PASS MODAL IN THE MIDDLE
  if (!isHopping && state.turnSubPhase === "buy_or_pass" && landedTile) {
    const cost = landedTile.cost ?? 0;
    const canAfford = (me?.cash ?? 0) >= cost;

    return (
      <div className="absolute inset-2 flex flex-col items-center justify-center rounded-2xl border border-emerald-500/30 bg-slate-950/95 p-4 text-center shadow-2xl backdrop-blur-md sm:inset-4 sm:p-6 animate-in zoom-in-95 duration-200">
        <div
          style={{ backgroundColor: landedTile.topBgHex ?? "#10b981" }}
          className="mb-1 rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow sm:text-xs sm:px-4 sm:py-1"
        >
          {landedTile.name}
        </div>

        <div className="text-2xl font-black text-white sm:text-3xl">
          ${cost}
        </div>
        <p className="mt-0.5 text-[11px] text-slate-300 sm:text-xs">
          Base Rent:{" "}
          <strong className="text-emerald-400">
            ${landedTile.rent?.[0] ?? 35}
          </strong>
        </p>

        {isMyTurn ? (
          <div className="mt-4 flex w-full max-w-xs items-center justify-center gap-3">
            <button
              disabled={!canAfford}
              onClick={onBuy}
              className="flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-lime-500 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:pointer-events-none sm:py-3 sm:text-sm"
            >
              {canAfford ? `Buy ($${cost})` : "Need Cash"}
            </button>
            <button
              onClick={onPass}
              className="cursor-pointer rounded-xl border border-white/20 bg-slate-800/80 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-slate-700 active:scale-95 sm:px-5 sm:py-3 sm:text-sm"
            >
              Pass
            </button>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-900/80 px-4 py-2 text-xs font-bold text-amber-300 border border-amber-400/20">
            <span
              style={{ backgroundColor: activePlayer?.color ?? "#f59e0b" }}
              className="inline-block h-2.5 w-2.5 rounded-full animate-ping"
            />
            <span>
              <strong style={{ color: activePlayer?.color }}>
                {activePlayer?.username ?? "Opponent"}
              </strong>{" "}
              is deciding to buy {landedTile.name}...
            </span>
          </div>
        )}
      </div>
    );
  }

  // 2. UPGRADE PROPERTY CONSOLE IN THE MIDDLE
  if (!isHopping && state.turnSubPhase === "upgrade_or_skip" && landedTile) {
    const upgradeCost = landedTile.upgradeCost ?? 0;
    const canAfford = (me?.cash ?? 0) >= upgradeCost;
    const currentLevel = propState?.level ?? 0;
    const nextRent = landedTile.rent?.[currentLevel + 1] ?? 50;

    return (
      <div className="absolute inset-2 flex flex-col items-center justify-center rounded-2xl border border-sky-500/30 bg-slate-950/95 p-4 text-center shadow-2xl backdrop-blur-md sm:inset-4 sm:p-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-sky-400 sm:text-xs">
          <Sparkles className="h-4 w-4 text-sky-300" />
          UPGRADE PROPERTY
        </div>
        <h3 className="mt-1 text-xl font-black text-white sm:text-2xl">
          {landedTile.name}
        </h3>
        <p className="mt-0.5 text-[11px] text-slate-300 sm:text-xs">
          Upgrade Cost:{" "}
          <strong className="text-amber-300">${upgradeCost}</strong> • Next
          Rent: <strong className="text-emerald-400">${nextRent}</strong>
        </p>

        {isMyTurn ? (
          <div className="mt-4 flex w-full max-w-xs items-center justify-center gap-3">
            <button
              disabled={!canAfford}
              onClick={onUpgrade}
              className="flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-sky-400 to-emerald-400 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-sky-500/30 transition hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:pointer-events-none sm:py-3 sm:text-sm"
            >
              {canAfford ? `Upgrade ($${upgradeCost})` : "Need Cash"}
            </button>
            <button
              onClick={onSkipUpgrade}
              className="cursor-pointer rounded-xl border border-white/20 bg-slate-800/80 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-slate-700 active:scale-95 sm:px-5 sm:py-3 sm:text-sm"
            >
              Skip
            </button>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-900/80 px-4 py-2 text-xs font-bold text-sky-300 border border-sky-400/20">
            <span
              style={{ backgroundColor: activePlayer?.color ?? "#38bdf8" }}
              className="inline-block h-2.5 w-2.5 rounded-full animate-ping"
            />
            <span>
              <strong style={{ color: activePlayer?.color }}>
                {activePlayer?.username ?? "Opponent"}
              </strong>{" "}
              is deciding on an upgrade...
            </span>
          </div>
        )}
      </div>
    );
  }

  // 3. JAIL CHOICE & ROUNDS COUNTDOWN NOTIFICATION IN THE MIDDLE
  if (
    !isHopping &&
    activePlayer?.inJail &&
    (state.turnSubPhase === "jail_choice" ||
      state.turnSubPhase === "awaiting_roll")
  ) {
    const roundsLeft = Math.max(1, 3 - activePlayer.jailTurns);

    return (
      <div className="absolute inset-2 flex flex-col items-center justify-center rounded-2xl border border-rose-500/40 bg-slate-950/95 p-4 text-center shadow-2xl backdrop-blur-md sm:inset-4 sm:p-6 animate-in zoom-in-95 duration-200">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 sm:h-12 sm:w-12">
          <ShieldAlert className="h-6 w-6" />
        </div>

        {/* User-requested exact wording: "[3] rounds remaining for your [turn]" */}
        <div className="text-base font-extrabold text-white sm:text-lg">
          <span className="text-emerald-400 font-black text-xl sm:text-2xl">
            {roundsLeft}
          </span>{" "}
          rounds remaining for your{" "}
          <span className="text-emerald-400 font-black">turn</span>
        </div>

        <p className="mt-1 text-[11px] text-slate-300 sm:text-xs">
          Roll a 6 to break out free, pay $100 bail, or pass turn.
        </p>

        {isMyTurn && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {(me?.cash ?? 0) >= 100 && (
              <button
                onClick={onPayBail}
                className="cursor-pointer rounded-xl bg-amber-500 px-4 py-2 text-xs font-black uppercase text-slate-950 shadow-md hover:bg-amber-400 active:scale-95"
              >
                Pay $100 Bail
              </button>
            )}
            <button
              onClick={onPassJailTurn}
              className="cursor-pointer rounded-xl border border-white/20 bg-slate-800/80 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-slate-700 active:scale-95"
            >
              Pass Round
            </button>
          </div>
        )}
      </div>
    );
  }

  // 4. MYSTERY CARD MODAL IN THE MIDDLE
  if (
    !isHopping &&
    state.turnSubPhase === "mystery_card" &&
    state.mysteryNotice
  ) {
    const isGain = state.mysteryNotice.cashDelta >= 0;

    return (
      <div className="absolute inset-2 flex flex-col items-center justify-center rounded-2xl border border-amber-500/40 bg-slate-950/95 p-4 text-center shadow-2xl backdrop-blur-md sm:inset-4 sm:p-6 animate-in zoom-in-95 duration-200">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 sm:h-12 sm:w-12">
          <HelpCircle className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-black text-white sm:text-xl">
          {state.mysteryNotice.title}
        </h3>
        <p className="mt-1 text-xs text-slate-300 sm:text-sm">
          {state.mysteryNotice.description}
        </p>
        <div
          className={`mt-2 text-xl font-black ${
            isGain ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {isGain
            ? `+$${state.mysteryNotice.cashDelta}`
            : `-$${Math.abs(state.mysteryNotice.cashDelta)}`}
        </div>

        {isMyTurn ? (
          <button
            onClick={onAcknowledgeMystery}
            className="mt-4 cursor-pointer rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg hover:brightness-110 active:scale-95"
          >
            Continue
          </button>
        ) : (
          <span className="mt-4 text-xs font-semibold text-slate-400">
            Waiting for {activePlayer?.username}...
          </span>
        )}
      </div>
    );
  }

  // 5. DEBT RESOLUTION CONSOLE IN THE MIDDLE
  if (
    !isHopping &&
    state.turnSubPhase === "debt_resolution" &&
    state.pendingDebt
  ) {
    const ownedProperties = Object.values(state.properties).filter(
      (p) => p.ownerId === userId,
    );

    return (
      <div className="absolute inset-2 flex flex-col items-center justify-center rounded-2xl border border-rose-500/60 bg-slate-950/98 p-4 text-center shadow-2xl sm:inset-4 sm:p-6 animate-in zoom-in-95 duration-200">
        <div className="text-xs font-black uppercase tracking-wider text-rose-400">
          DEBT RESOLUTION
        </div>
        <div className="mt-1 text-lg font-black text-white sm:text-xl">
          Owe ${state.pendingDebt.amount} ({state.pendingDebt.reason})
        </div>
        <p className="mt-0.5 text-[11px] text-slate-400 sm:text-xs">
          Sell owned properties for 75% refund, or declare bankruptcy.
        </p>

        {isMyTurn && (
          <div className="mt-3 flex flex-col items-center gap-2 w-full max-w-sm">
            {ownedProperties.length > 0 && (
              <div className="flex max-h-24 w-full flex-wrap justify-center gap-1.5 overflow-y-auto p-1">
                {ownedProperties.map((p) => {
                  const tile = BUSINESS_BOARD[p.tileIndex];
                  if (!tile || !tile.cost) return null;
                  const refund = Math.round(
                    (tile.cost +
                      (p.level > 0 && tile.upgradeCost
                        ? p.level * tile.upgradeCost
                        : 0)) *
                      0.75,
                  );
                  return (
                    <button
                      key={p.tileIndex}
                      onClick={() => onSellProperty(p.tileIndex)}
                      className="cursor-pointer rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[10px] font-black text-amber-300 hover:bg-amber-500/20 active:scale-95"
                    >
                      Sell {tile.name} (+${refund})
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <button
                disabled={(me?.cash ?? 0) < state.pendingDebt.amount}
                onClick={onPayDebt}
                className="cursor-pointer rounded-xl bg-emerald-500 px-5 py-2 text-xs font-black uppercase text-slate-950 shadow disabled:opacity-40"
              >
                Pay ${state.pendingDebt.amount}
              </button>
              <button
                onClick={onDeclareBankruptcy}
                className="cursor-pointer rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold uppercase text-white hover:bg-rose-500 active:scale-95"
              >
                Bankrupt
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 6. DEFAULT / IDLE CENTERPIECE: Dome Bank + Status + Rent Notification Banner
  const tx = state.lastTransaction;
  const isRecentTx = Boolean(tx);
  const payer = tx ? state.players.find((p) => p.userId === tx.payerId) : null;
  const payee = tx ? state.players.find((p) => p.userId === tx.payeeId) : null;

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center p-3 select-none">
      <CenterBankIllustration />

      {/* User-requested Rent Notification in the Middle:
          "[user (in color)] paid you [$amount (in Golden color)]" */}
      {isRecentTx && tx && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 absolute bottom-3 z-30 mx-auto flex max-w-sm items-center gap-2 rounded-2xl border border-amber-400/40 bg-slate-950/95 px-4 py-2.5 shadow-2xl backdrop-blur-md">
          <Coins className="h-5 w-5 shrink-0 text-amber-400 animate-spin" />
          <div className="text-xs font-extrabold sm:text-sm">
            {tx.payeeId === userId ? (
              <span>
                <strong style={{ color: payer?.color ?? "#f59e0b" }}>
                  {tx.payerName}
                </strong>{" "}
                paid you{" "}
                <strong className="text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]">
                  ${tx.amount}
                </strong>{" "}
                rent at {tx.tileName}!
              </span>
            ) : tx.payerId === userId ? (
              <span>
                You paid{" "}
                <strong style={{ color: payee?.color ?? "#38bdf8" }}>
                  {tx.payeeName}
                </strong>{" "}
                <strong className="text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]">
                  ${tx.amount}
                </strong>{" "}
                rent at {tx.tileName}.
              </span>
            ) : (
              <span>
                <strong style={{ color: payer?.color ?? "#f59e0b" }}>
                  {tx.payerName}
                </strong>{" "}
                paid{" "}
                <strong style={{ color: payee?.color ?? "#38bdf8" }}>
                  {tx.payeeName}
                </strong>{" "}
                <strong className="text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]">
                  ${tx.amount}
                </strong>{" "}
                rent!
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
