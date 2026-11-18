import { useState } from "react";
import {
  BUSINESS_BOARD,
  type BusinessPlayer,
  type BusinessState,
} from "@kridora/shared";
import {
  Coins,
  Sparkles,
  HelpCircle,
  ShieldAlert,
  Building2,
  X,
  Store,
} from "lucide-react";
import { CenterBankIllustration } from "./BoardArtwork";

interface CenterBoardConsoleProps {
  state: BusinessState;
  userId: string;
  isHopping: boolean;
  visualPosition: number | undefined;
  activePlayer: BusinessPlayer | null;
  isMyTurn: boolean;
  me: BusinessPlayer | null;
  selectedTileIndex: number | null;
  onSelectTile: (tileIndex: number | null) => void;
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
  visualPosition,
  activePlayer,
  isMyTurn,
  me,
  selectedTileIndex,
  onSelectTile,
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
  const [showPortfolio, setShowPortfolio] = useState(false);

  const landedTile = activePlayer
    ? BUSINESS_BOARD[activePlayer.position]
    : null;
  const propState = landedTile ? state.properties[landedTile.index] : null;

  // Player has finished hopping if isHopping is false OR their visual token has arrived at their target position
  const isStillHopping =
    isHopping &&
    activePlayer !== null &&
    visualPosition !== undefined &&
    visualPosition !== activePlayer.position;

  // Owned properties by the local player
  const myProperties = Object.values(state.properties)
    .filter((p) => p.ownerId === userId)
    .map((p) => ({
      prop: p,
      tile: BUSINESS_BOARD[p.tileIndex]!,
      refund: Math.round(
        ((BUSINESS_BOARD[p.tileIndex]?.cost ?? 0) +
          (p.level > 0 && BUSINESS_BOARD[p.tileIndex]?.upgradeCost
            ? p.level * (BUSINESS_BOARD[p.tileIndex]?.upgradeCost ?? 0)
            : 0)) *
          0.75,
      ),
    }));

  // Selected tile for inspection or selling
  const selectedTile =
    selectedTileIndex !== null ? BUSINESS_BOARD[selectedTileIndex] : null;
  const selectedProp =
    selectedTileIndex !== null ? state.properties[selectedTileIndex] : null;
  const isSelectedOwnedByMe = selectedProp?.ownerId === userId;
  const selectedOwner = selectedProp?.ownerId
    ? state.players.find((p) => p.userId === selectedProp.ownerId)
    : null;

  // 1. PROPERTY INSPECT & SELL MODAL (Triggered by clicking an owned tile on the board or choosing from portfolio)
  if (selectedTile && selectedProp) {
    const cost = selectedTile.cost ?? 0;
    const upgradeCost = selectedTile.upgradeCost ?? 0;
    const currentLevel = selectedProp.level ?? 0;
    const upgradeValue =
      currentLevel > 0 && upgradeCost ? currentLevel * upgradeCost : 0;
    const refund = Math.round((cost + upgradeValue) * 0.75);
    const canAffordUpgrade = (me?.cash ?? 0) >= upgradeCost;
    const isCity = selectedTile.type === "city";

    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-between rounded-xl bg-slate-950/98 p-3.5 text-center shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-150 sm:p-5 overflow-y-auto">
        <div className="flex w-full items-center justify-between border-b border-white/10 pb-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            PROPERTY DEED
          </span>
          <button
            onClick={() => onSelectTile(null)}
            className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* City header */}
        <div className="my-auto flex flex-col items-center gap-1">
          <div
            style={{ backgroundColor: selectedTile.topBgHex ?? "#3b82f6" }}
            className="rounded-full px-3.5 py-0.5 text-xs font-black uppercase tracking-wider text-white shadow"
          >
            {selectedTile.name}
          </div>

          <div className="text-xl font-black text-white sm:text-2xl">
            Value: ${cost + upgradeValue}
          </div>

          {selectedOwner && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <span>Owner:</span>
              <span
                style={{ color: selectedOwner.color }}
                className="font-black"
              >
                {selectedOwner.username} {isSelectedOwnedByMe && "(YOU)"}
              </span>
            </div>
          )}

          {/* Level / Stars info */}
          {isCity && (
            <div className="text-xs font-bold text-amber-300">
              Tier:{" "}
              {currentLevel === 0
                ? "Base Deed"
                : `Level ${currentLevel} ${"★".repeat(currentLevel)}`}
            </div>
          )}

          {/* Rent breakdown */}
          {selectedTile.rent && (
            <div className="mt-1 flex flex-wrap justify-center gap-2 text-[10px] font-bold text-slate-300">
              <span className="rounded bg-slate-900 px-2 py-0.5 border border-white/10">
                Base Rent: ${selectedTile.rent[0]}
              </span>
              <span className="rounded bg-slate-900 px-2 py-0.5 border border-white/10">
                Max Rent: ${selectedTile.rent[3] ?? selectedTile.rent[0]}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-3 flex w-full max-w-xs flex-col gap-2">
          {isSelectedOwnedByMe ? (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  onSellProperty(selectedTile.index);
                  onSelectTile(null);
                }}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-amber-500/25 transition hover:brightness-110 active:scale-95 sm:py-3 sm:text-sm"
              >
                <Coins className="h-4 w-4" /> SELL PROPERTY FOR +${refund}
              </button>

              {isMyTurn &&
                isCity &&
                currentLevel < 3 &&
                upgradeCost > 0 &&
                activePlayer?.position === selectedTile.index && (
                  <button
                    disabled={!canAffordUpgrade}
                    onClick={() => {
                      onUpgrade();
                      onSelectTile(null);
                    }}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 to-emerald-400 py-2 text-xs font-black uppercase text-slate-950 shadow disabled:opacity-40"
                  >
                    Upgrade City (${upgradeCost})
                  </button>
                )}
            </div>
          ) : (
            <div className="text-xs font-semibold text-slate-400">
              {selectedOwner
                ? `Owned by ${selectedOwner.username}. Rent is $${selectedTile.rent?.[selectedProp.level] ?? 40}.`
                : `Unowned. Cost is $${cost}.`}
            </div>
          )}

          <button
            onClick={() => onSelectTile(null)}
            className="cursor-pointer rounded-xl border border-white/15 bg-slate-800/80 py-2 text-xs font-bold text-white hover:bg-slate-700 active:scale-95"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // 2. MY PROPERTIES PORTFOLIO & SELL CONSOLE
  if (showPortfolio) {
    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-between rounded-xl bg-slate-950/98 p-3.5 text-center shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-150 sm:p-5 overflow-y-auto">
        <div className="flex w-full items-center justify-between border-b border-white/10 pb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-emerald-400">
            <Building2 className="h-4 w-4" />
            MY PROPERTIES ({myProperties.length})
          </div>
          <button
            onClick={() => setShowPortfolio(false)}
            className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {myProperties.length === 0 ? (
          <div className="my-auto text-xs font-semibold text-slate-400">
            You do not own any properties yet.
            <br />
            Land on unowned cities to buy them!
          </div>
        ) : (
          <div className="my-auto flex max-h-[190px] w-full flex-col gap-1.5 overflow-y-auto p-1 sm:max-h-[220px]">
            {myProperties.map(({ prop, tile, refund }) => (
              <div
                key={prop.tileIndex}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2"
              >
                <div className="flex items-center gap-2 text-left">
                  <span
                    style={{ backgroundColor: tile.bottomBgHex ?? "#10b981" }}
                    className="h-3 w-3 shrink-0 rounded-full"
                  />
                  <div>
                    <div className="text-xs font-black text-white">
                      {tile.name}{" "}
                      {prop.level > 0 && (
                        <span className="text-[10px] text-amber-300">
                          {"★".repeat(prop.level)}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Rent: ${tile.rent?.[prop.level] ?? 35}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onSellProperty(prop.tileIndex)}
                  className="cursor-pointer rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-[11px] font-black uppercase text-slate-950 shadow hover:brightness-110 active:scale-95"
                >
                  Sell (+${refund})
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowPortfolio(false)}
          className="mt-2 w-full max-w-xs cursor-pointer rounded-xl border border-white/15 bg-slate-800/80 py-2 text-xs font-bold text-white hover:bg-slate-700 active:scale-95"
        >
          Done
        </button>
      </div>
    );
  }

  // 3. BUY OR PASS MODAL IN THE MIDDLE
  if (!isStillHopping && state.turnSubPhase === "buy_or_pass" && landedTile) {
    const cost = landedTile.cost ?? 0;
    const canAfford = (me?.cash ?? 0) >= cost;

    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-between rounded-xl bg-slate-950/98 p-3.5 text-center shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-150 sm:p-5 overflow-y-auto">
        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 sm:text-xs">
          ACQUIRE PROPERTY
        </div>

        <div className="my-auto flex flex-col items-center gap-1">
          <div
            style={{ backgroundColor: landedTile.topBgHex ?? "#10b981" }}
            className="rounded-full px-3.5 py-0.5 text-xs font-black uppercase tracking-wider text-white shadow sm:text-sm sm:px-5 sm:py-1"
          >
            {landedTile.name}
          </div>

          <div className="text-2xl font-black text-white sm:text-3xl">
            ${cost}
          </div>

          <p className="text-[11px] text-slate-300 sm:text-xs">
            Base Rent:{" "}
            <strong className="text-emerald-400">
              ${landedTile.rent?.[0] ?? 35}
            </strong>{" "}
            • Max:{" "}
            <strong className="text-emerald-400">
              ${landedTile.rent?.[3] ?? 200}
            </strong>
          </p>
        </div>

        {isMyTurn ? (
          <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <button
                disabled={!canAfford}
                onClick={onBuy}
                className="flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-lime-500 py-3 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:pointer-events-none sm:text-sm"
              >
                {canAfford ? `BUY ($${cost})` : `Need $${cost}`}
              </button>
              <button
                onClick={onPass}
                className="cursor-pointer rounded-xl border border-white/20 bg-slate-800/90 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-slate-700 active:scale-95 sm:text-sm"
              >
                PASS
              </button>
            </div>

            {/* Quick helper to sell property if player needs cash */}
            {!canAfford && myProperties.length > 0 && (
              <button
                onClick={() => setShowPortfolio(true)}
                className="cursor-pointer rounded-lg border border-amber-400/30 bg-amber-500/10 py-1.5 text-[11px] font-black text-amber-300 hover:bg-amber-500/20 active:scale-95"
              >
                Sell Properties to Afford
              </button>
            )}
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-slate-900/90 px-4 py-2.5 text-xs font-bold text-amber-300 border border-amber-400/20">
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

  // 4. UPGRADE PROPERTY CONSOLE IN THE MIDDLE
  if (!isStillHopping && state.turnSubPhase === "upgrade_or_skip" && landedTile) {
    const upgradeCost = landedTile.upgradeCost ?? 0;
    const canAfford = (me?.cash ?? 0) >= upgradeCost;
    const currentLevel = propState?.level ?? 0;
    const nextRent = landedTile.rent?.[currentLevel + 1] ?? 50;

    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-between rounded-xl bg-slate-950/98 p-3.5 text-center shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-150 sm:p-5 overflow-y-auto">
        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-sky-400 sm:text-xs">
          <Sparkles className="h-4 w-4 text-sky-300" />
          UPGRADE PROPERTY
        </div>

        <div className="my-auto flex flex-col items-center gap-1">
          <h3 className="text-xl font-black text-white sm:text-2xl">
            {landedTile.name}
          </h3>
          <div className="text-xs font-bold text-amber-300">
            Current Tier: Level {currentLevel} {"★".repeat(currentLevel)}
          </div>
          <p className="mt-1 text-xs text-slate-300">
            Cost: <strong className="text-amber-300">${upgradeCost}</strong> • Next
            Rent: <strong className="text-emerald-400">${nextRent}</strong>
          </p>
        </div>

        {isMyTurn ? (
          <div className="mt-2 flex w-full max-w-xs items-center justify-center gap-2.5">
            <button
              disabled={!canAfford}
              onClick={onUpgrade}
              className="flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-sky-400 to-emerald-400 py-3 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-sky-500/30 transition hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:pointer-events-none sm:text-sm"
            >
              {canAfford ? `UPGRADE ($${upgradeCost})` : `Need $${upgradeCost}`}
            </button>
            <button
              onClick={onSkipUpgrade}
              className="cursor-pointer rounded-xl border border-white/20 bg-slate-800/90 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-slate-700 active:scale-95 sm:text-sm"
            >
              SKIP
            </button>
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-slate-900/90 px-4 py-2.5 text-xs font-bold text-sky-300 border border-sky-400/20">
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

  // 5. JAIL CHOICE & ROUNDS COUNTDOWN NOTIFICATION IN THE MIDDLE
  if (
    !isStillHopping &&
    activePlayer?.inJail &&
    (state.turnSubPhase === "jail_choice" ||
      state.turnSubPhase === "awaiting_roll")
  ) {
    const roundsLeft = Math.max(1, 3 - activePlayer.jailTurns);

    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-between rounded-xl bg-slate-950/98 p-3.5 text-center shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-150 sm:p-5 overflow-y-auto">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 sm:h-12 sm:w-12">
          <ShieldAlert className="h-6 w-6" />
        </div>

        {/* User-requested exact wording: "[3] rounds remaining for your [turn]" */}
        <div className="my-auto space-y-1">
          <div className="text-base font-extrabold text-white sm:text-lg">
            <span className="text-emerald-400 font-black text-2xl sm:text-3xl">
              {roundsLeft}
            </span>{" "}
            rounds remaining for your{" "}
            <span className="text-emerald-400 font-black">turn</span>
          </div>
          <p className="text-[11px] text-slate-300 sm:text-xs">
            Roll a 6 to escape, pay $100 bail, or pass turn.
          </p>
        </div>

        {isMyTurn && (
          <div className="mt-2 flex w-full max-w-xs flex-wrap items-center justify-center gap-2">
            {(me?.cash ?? 0) >= 100 && (
              <button
                onClick={onPayBail}
                className="cursor-pointer rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black uppercase text-slate-950 shadow-md hover:bg-amber-400 active:scale-95"
              >
                Pay $100 Bail
              </button>
            )}
            <button
              onClick={onPassJailTurn}
              className="cursor-pointer rounded-xl border border-white/20 bg-slate-800/90 px-4 py-2.5 text-xs font-bold uppercase text-white hover:bg-slate-700 active:scale-95"
            >
              Pass Round
            </button>
          </div>
        )}
      </div>
    );
  }

  // 6. MYSTERY CARD MODAL IN THE MIDDLE
  if (
    !isStillHopping &&
    state.turnSubPhase === "mystery_card" &&
    state.mysteryNotice
  ) {
    const isGain = state.mysteryNotice.cashDelta >= 0;

    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-between rounded-xl bg-slate-950/98 p-3.5 text-center shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-150 sm:p-5 overflow-y-auto">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 sm:h-12 sm:w-12">
          <HelpCircle className="h-6 w-6" />
        </div>

        <div className="my-auto space-y-1">
          <h3 className="text-lg font-black text-white sm:text-xl">
            {state.mysteryNotice.title}
          </h3>
          <p className="text-xs text-slate-300 sm:text-sm">
            {state.mysteryNotice.description}
          </p>
          <div
            className={`text-xl font-black ${
              isGain ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {isGain
              ? `+$${state.mysteryNotice.cashDelta}`
              : `-$${Math.abs(state.mysteryNotice.cashDelta)}`}
          </div>
        </div>

        {isMyTurn ? (
          <button
            onClick={onAcknowledgeMystery}
            className="mt-2 w-full max-w-xs cursor-pointer rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg hover:brightness-110 active:scale-95 sm:text-sm"
          >
            CONTINUE
          </button>
        ) : (
          <span className="mt-2 text-xs font-semibold text-slate-400">
            Waiting for {activePlayer?.username}...
          </span>
        )}
      </div>
    );
  }

  // 7. DEBT RESOLUTION CONSOLE IN THE MIDDLE
  if (
    !isStillHopping &&
    state.turnSubPhase === "debt_resolution" &&
    state.pendingDebt
  ) {
    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-between rounded-xl bg-slate-950/98 p-3.5 text-center shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-150 sm:p-5 overflow-y-auto">
        <div className="text-xs font-black uppercase tracking-wider text-rose-400">
          DEBT RESOLUTION
        </div>

        <div className="my-auto space-y-1 w-full max-w-sm">
          <div className="text-lg font-black text-white sm:text-xl">
            Owe ${state.pendingDebt.amount} ({state.pendingDebt.reason})
          </div>
          <p className="text-[11px] text-slate-400">
            Sell owned properties for 75% refund, or declare bankruptcy.
          </p>

          {isMyTurn && myProperties.length > 0 && (
            <div className="mt-2 flex max-h-24 w-full flex-wrap justify-center gap-1.5 overflow-y-auto p-1">
              {myProperties.map(({ prop, tile, refund }) => (
                <button
                  key={prop.tileIndex}
                  onClick={() => onSellProperty(prop.tileIndex)}
                  className="cursor-pointer rounded-lg border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-[11px] font-black text-amber-300 hover:bg-amber-500/25 active:scale-95"
                >
                  Sell {tile.name} (+${refund})
                </button>
              ))}
            </div>
          )}
        </div>

        {isMyTurn && (
          <div className="mt-2 flex items-center gap-2.5">
            <button
              disabled={(me?.cash ?? 0) < state.pendingDebt.amount}
              onClick={onPayDebt}
              className="cursor-pointer rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-black uppercase text-slate-950 shadow disabled:opacity-40"
            >
              Pay ${state.pendingDebt.amount}
            </button>
            <button
              onClick={onDeclareBankruptcy}
              className="cursor-pointer rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold uppercase text-white hover:bg-rose-500 active:scale-95"
            >
              Bankrupt
            </button>
          </div>
        )}
      </div>
    );
  }

  // 8. DEFAULT / IDLE CENTERPIECE: Dome Bank + Status + Rent Notification + Sell Properties Trigger
  const tx = state.lastTransaction;
  const isRecentTx = Boolean(tx);
  const payer = tx ? state.players.find((p) => p.userId === tx.payerId) : null;
  const payee = tx ? state.players.find((p) => p.userId === tx.payeeId) : null;

  return (
    <div className="relative z-20 flex h-full w-full flex-col items-center justify-between p-2 text-center select-none overflow-hidden sm:p-4">
      {/* 3D Bank Architectural Vector */}
      <div className="my-auto flex flex-col items-center">
        <CenterBankIllustration />
      </div>

      {/* Quick Sell / Properties button when player owns deeds */}
      {myProperties.length > 0 && (
        <button
          onClick={() => setShowPortfolio(true)}
          className="absolute top-2.5 right-2.5 z-30 flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-slate-950/90 px-2.5 py-1 text-[11px] font-black text-amber-300 shadow hover:bg-amber-500/20 active:scale-95"
          title="Inspect and Sell Properties"
        >
          <Store className="h-3.5 w-3.5 text-amber-400" />
          <span>My Deeds ({myProperties.length})</span>
        </button>
      )}

      {/* User-requested Rent Notification in the Middle:
          "[user (in color)] paid you [$amount (in Golden color)]" */}
      {isRecentTx && tx && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 absolute bottom-2 z-30 mx-auto flex max-w-[90%] items-center gap-2 rounded-2xl border border-amber-400/50 bg-slate-950/95 px-3.5 py-2 shadow-2xl backdrop-blur-md sm:bottom-3 sm:px-4 sm:py-2.5">
          <Coins className="h-4 w-4 shrink-0 text-amber-400 animate-spin sm:h-5 sm:w-5" />
          <div className="text-[11px] font-extrabold sm:text-xs">
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
