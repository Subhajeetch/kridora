import { useState } from "react";
import {
  BUSINESS_BAIL_COST,
  BUSINESS_BANKRUPT_LIMIT,
  BUSINESS_BOARD,
  canSurviveCharge,
  computeBusinessTileRent,
  computePropertySellRefund,
  formatBusinessCash,
  formatBusinessNotice,
  getColorGroupProgress,
  isPlayerActive,
  type BusinessEventNotice,
  type BusinessPlayer,
  type BusinessState,
} from "@kridora/shared";
import {
  ArrowLeftRight,
  ArrowUp,
  Building2,
  Coins,
  Gavel,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  ShieldAlert,
  Store,
  X,
} from "lucide-react";
import { isSafeAvatarUrl } from "../utils";
import { CenterBankIllustration } from "./BoardArtwork";

export type AuctionPickMode = "host-tile" | "rival-offer" | null;

interface CenterBoardConsoleProps {
  state: BusinessState;
  userId: string;
  isAnimatingTurn: boolean;
  isDiceRolling: boolean;
  activeNotice: BusinessEventNotice | null;
  activePlayer: BusinessPlayer | null;
  isMyTurn: boolean;
  me: BusinessPlayer | null;
  selectedTileIndex: number | null;
  upgradeTileIndex: number | null;
  auctionPickMode: AuctionPickMode;
  onSelectTile: (tileIndex: number | null) => void;
  onCloseUpgradeModal: () => void;
  onSetAuctionPickMode: (mode: AuctionPickMode) => void;
  onBuy: () => void;
  onPass: () => void;
  onUpgrade: (tileIndex?: number) => void;
  onSkipUpgrade: () => void;
  onPayBail: () => void;
  onPassJailTurn: () => void;
  onPayDebt: () => void;
  onDeclareBankruptcy: () => void;
  onSellProperty: (tileIndex: number) => void;
  onAuctionDecline: () => void;
  onAuctionAcceptOffer: (offerId: string) => void;
  onAuctionSkip: () => void;
}

const NOTICE_STYLES: Record<BusinessEventNotice["tone"], string> = {
  info: "border-sky-200 bg-white/96 text-slate-800",
  cash: "border-emerald-300 bg-emerald-50/96 text-emerald-900",
  danger: "border-rose-300 bg-rose-50/96 text-rose-900",
  jail: "border-slate-300 bg-slate-100/96 text-slate-800",
  trade: "border-violet-300 bg-violet-50/96 text-violet-950",
};

function AuctionBranchArrows({ count }: { count: number }) {
  if (count <= 1) {
    return (
      <svg
        viewBox="0 0 200 22"
        className="h-3.5 w-full shrink-0 text-violet-500 sm:h-5"
        fill="none"
      >
        <path
          d="M100 1 V18"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M95 13 L100 19 L105 13"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (count === 2) {
    return (
      <svg
        viewBox="0 0 240 24"
        className="h-4 w-full shrink-0 text-violet-500 sm:h-5"
        fill="none"
      >
        <path
          d="M92 2 Q62 6 60 19"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M55 14 L60 20 L65 14"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M148 2 Q178 6 180 19"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M175 14 L180 20 L185 14"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 260 24"
      className="h-4 w-full shrink-0 text-violet-500 sm:h-5"
      fill="none"
    >
      <path
        d="M92 2 Q46 6 43 19"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M38 14 L43 20 L48 14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M130 2 V19"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M125 14 L130 20 L135 14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M168 2 Q214 6 217 19"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M212 14 L217 20 L222 14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CenterBoardConsole({
  state,
  userId,
  isAnimatingTurn,
  isDiceRolling,
  activeNotice,
  activePlayer,
  isMyTurn,
  me,
  selectedTileIndex,
  upgradeTileIndex,
  auctionPickMode,
  onSelectTile,
  onCloseUpgradeModal,
  onSetAuctionPickMode,
  onBuy,
  onPass,
  onUpgrade,
  onSkipUpgrade,
  onPayBail,
  onPassJailTurn,
  onPayDebt,
  onDeclareBankruptcy,
  onSellProperty,
  onAuctionDecline,
  onAuctionAcceptOffer,
  onAuctionSkip,
}: CenterBoardConsoleProps) {
  const [showPortfolio, setShowPortfolio] = useState(false);

  const landedTile = activePlayer
    ? BUSINESS_BOARD[activePlayer.position]
    : null;
  const propState = landedTile ? state.properties[landedTile.index] : null;

  const myProperties = Object.values(state.properties)
    .filter((p) => p.ownerId === userId)
    .map((p) => {
      const tile = BUSINESS_BOARD[p.tileIndex]!;
      return {
        prop: p,
        tile,
        currentRent: computeBusinessTileRent(state.properties, p.tileIndex),
        refund: computePropertySellRefund(tile, p.level),
        monopoly: getColorGroupProgress(
          state.properties,
          tile.colorGroup,
          userId,
        ),
      };
    });

  // Explicit user-opened Portfolio / Sell Sheet (z-40)
  const renderPortfolioOverlay = () => {
    if (!showPortfolio) return null;
    const isBuyingMode =
      state.turnSubPhase === "buy_or_pass" && isMyTurn && landedTile?.cost;
    const isDebtMode =
      state.turnSubPhase === "debt_resolution" && isMyTurn && state.pendingDebt;

    const debtProjectedCash =
      isDebtMode && me && state.pendingDebt
        ? me.cash - state.pendingDebt.amount
        : null;
    const debtSafe =
      isDebtMode && me && state.pendingDebt
        ? canSurviveCharge(me.cash, state.pendingDebt.amount)
        : false;
    const buyTarget = isBuyingMode ? (landedTile?.cost ?? 0) : null;

    return (
      <div className="animate-in zoom-in-95 duration-150 absolute inset-1.5 z-40 flex flex-col justify-between overflow-hidden rounded-2xl border border-white/85 bg-white/98 p-2.5 text-slate-800 shadow-2xl backdrop-blur-md sm:inset-2.5 sm:p-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
          <div className="flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wider text-emerald-700 sm:text-xs">
            <Building2 className="h-3.5 w-3.5" />
            My Deeds ({myProperties.length})
          </div>
          <button
            type="button"
            onClick={() => setShowPortfolio(false)}
            className="cursor-pointer rounded-lg p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close deeds"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {buyTarget !== null && me && (
          <div className="mt-1.5 flex items-center justify-between rounded-xl bg-slate-100 px-2.5 py-1 text-[10.5px] font-extrabold sm:text-xs">
            <span className="text-slate-600">
              Cash:{" "}
              <strong
                className={
                  me.cash >= buyTarget ? "text-emerald-600" : "text-rose-500"
                }
              >
                {formatBusinessCash(me.cash)}
              </strong>
            </span>
            <span className="text-slate-500">
              {me.cash >= buyTarget
                ? "Ready to Buy!"
                : `Need $${buyTarget - me.cash} more`}
            </span>
          </div>
        )}

        {debtProjectedCash !== null && (
          <div className="mt-1.5 flex items-center justify-between rounded-xl bg-rose-50 px-2.5 py-1 text-[10px] font-extrabold sm:text-xs">
            <span className="text-slate-600">
              After paying:{" "}
              <strong
                className={debtSafe ? "text-emerald-600" : "text-rose-600"}
              >
                {formatBusinessCash(debtProjectedCash)}
              </strong>
            </span>
            <span className="text-slate-500">
              {debtSafe
                ? "Safe ✓"
                : `Limit ${formatBusinessCash(BUSINESS_BANKRUPT_LIMIT)}`}
            </span>
          </div>
        )}

        <div className="my-1.5 flex flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
          {myProperties.length === 0 ? (
            <p className="my-auto text-center text-xs font-semibold text-slate-400">
              You don&apos;t own any properties yet.
            </p>
          ) : (
            myProperties.map(
              ({ prop, tile, currentRent, refund, monopoly }) => (
                <div
                  key={prop.tileIndex}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5"
                >
                  <div className="flex min-w-0 items-center gap-2 text-left">
                    <span
                      style={{ backgroundColor: tile.bottomBgHex ?? "#10b981" }}
                      className="h-3 w-3 shrink-0 rounded-full"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-black text-slate-800">
                        {tile.name}{" "}
                        {prop.level > 0 && (
                          <span className="text-amber-500">
                            {"★".repeat(prop.level)}
                          </span>
                        )}
                      </div>
                      <div className="text-[9.5px] font-semibold text-slate-500">
                        Rent ${currentRent}
                        {tile.type === "city" &&
                          (monopoly.hasMonopoly
                            ? " • Full Set ✓"
                            : ` • Set ${monopoly.owned}/${monopoly.total}`)}
                      </div>
                    </div>
                  </div>

                  {isMyTurn && !isAnimatingTurn && (
                    <button
                      type="button"
                      onClick={() => onSellProperty(prop.tileIndex)}
                      className="shrink-0 cursor-pointer rounded-lg bg-amber-400 px-2.5 py-1 text-[10px] font-black text-slate-900 shadow-xs transition hover:brightness-105 active:scale-95"
                    >
                      Sell +${refund}
                    </button>
                  )}
                </div>
              ),
            )
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowPortfolio(false)}
          className="w-full cursor-pointer rounded-xl bg-[#1885f2] py-1.5 text-xs font-black text-white shadow-xs transition hover:brightness-105"
        >
          {buyTarget !== null || debtProjectedCash !== null
            ? "Back to Decision"
            : "Done"}
        </button>
      </div>
    );
  };

  // Dedicated Upgrade Confirmation Modal triggered when clicking an UP-arrow tile (z-40)
  const renderBoardUpgradeModal = () => {
    if (showPortfolio || upgradeTileIndex === null) return null;
    const tile = BUSINESS_BOARD[upgradeTileIndex];
    const prop = state.properties[upgradeTileIndex];
    if (!tile || !prop || !tile.upgradeCost) return null;

    const currentLevel = prop.level;
    const currentRent = computeBusinessTileRent(state.properties, tile.index);
    const nextRent = tile.rent?.[currentLevel + 1] ?? currentRent;
    const canAfford = (me?.cash ?? 0) >= tile.upgradeCost;

    return (
      <div className="animate-in zoom-in-95 duration-150 absolute inset-2 z-40 flex flex-col items-center justify-between overflow-y-auto rounded-2xl border border-emerald-200 bg-white/98 p-3 text-center text-slate-800 shadow-2xl backdrop-blur-md sm:inset-4 sm:p-5">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 sm:text-xs">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs sm:h-5 sm:w-5">
              <ArrowUp className="h-2.5 w-2.5 stroke-[3] sm:h-3 sm:w-3" />
            </span>
            <span>Upgrade City</span>
          </div>
          <button
            type="button"
            onClick={onCloseUpgradeModal}
            className="cursor-pointer rounded-lg p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close upgrade"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="my-auto flex flex-col items-center gap-1.5">
          <span
            style={{ backgroundColor: tile.bottomBgHex ?? "#10b981" }}
            className="rounded-full px-3.5 py-0.5 text-xs font-black uppercase tracking-wide text-white shadow-xs sm:px-4 sm:py-1 sm:text-sm"
          >
            {tile.name}
          </span>

          <div className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10.5px] font-black text-amber-800 sm:text-xs">
            Level {currentLevel} → Level {currentLevel + 1}{" "}
            {"★".repeat(currentLevel + 1)}
          </div>

          <div className="text-[11px] font-bold text-slate-600 sm:text-xs">
            Rent{" "}
            <span className="text-slate-400 line-through">${currentRent}</span>{" "}
            → <strong className="text-emerald-600">${nextRent}</strong>
          </div>
        </div>

        <div className="flex w-full max-w-[235px] flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canAfford}
              onClick={() => {
                onUpgrade(tile.index);
                onCloseUpgradeModal();
              }}
              className="flex-1 cursor-pointer rounded-xl bg-emerald-500 py-2 text-xs font-black uppercase text-white shadow-[0_3px_0_#047857] transition hover:brightness-105 active:translate-y-0.5 disabled:pointer-events-none disabled:opacity-40 sm:py-2.5 sm:text-sm"
            >
              Upgrade ${tile.upgradeCost}
            </button>
            <button
              type="button"
              onClick={onCloseUpgradeModal}
              className="cursor-pointer rounded-xl bg-slate-200 px-3.5 py-2 text-xs font-black uppercase text-slate-700 hover:bg-slate-300 sm:px-4 sm:py-2.5 sm:text-sm"
            >
              Cancel
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              onCloseUpgradeModal();
              onSelectTile(tile.index);
            }}
            className="cursor-pointer text-[10px] font-bold text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
          >
            Inspect Deed / Sell instead
          </button>
        </div>
      </div>
    );
  };

  // Property Deed Inspector (z-40)
  const renderSelectedTileOverlay = () => {
    if (
      showPortfolio ||
      upgradeTileIndex !== null ||
      selectedTileIndex === null
    )
      return null;
    const selectedTile = BUSINESS_BOARD[selectedTileIndex];
    const selectedProp = state.properties[selectedTileIndex];
    if (!selectedTile || !selectedProp) return null;

    const isOwnedByMe = selectedProp.ownerId === userId;
    const owner = selectedProp.ownerId
      ? state.players.find((p) => p.userId === selectedProp.ownerId)
      : null;
    const currentLevel = selectedProp.level;
    const refund = computePropertySellRefund(selectedTile, currentLevel);
    const currentRent = owner
      ? computeBusinessTileRent(state.properties, selectedTile.index)
      : (selectedTile.rent?.[0] ?? 0);
    const monopoly = getColorGroupProgress(
      state.properties,
      selectedTile.colorGroup,
      selectedProp.ownerId,
    );
    const upgradeCost = selectedTile.upgradeCost ?? 0;
    const canUpgradeHere =
      isOwnedByMe &&
      isMyTurn &&
      !isAnimatingTurn &&
      state.turnSubPhase === "awaiting_roll" &&
      selectedTile.type === "city" &&
      monopoly.hasMonopoly &&
      currentLevel < 3 &&
      upgradeCost > 0 &&
      (me?.cash ?? 0) >= upgradeCost;

    return (
      <div className="animate-in zoom-in-95 duration-150 absolute inset-1.5 z-40 flex flex-col justify-between overflow-y-auto rounded-2xl border border-white/85 bg-white/98 p-2.5 text-center text-slate-800 shadow-2xl backdrop-blur-md sm:inset-2.5 sm:p-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-1">
          <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 sm:text-[10px]">
            Property Deed
          </span>
          <button
            type="button"
            onClick={() => onSelectTile(null)}
            className="cursor-pointer rounded-lg p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close deed"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="my-auto flex flex-col items-center gap-1 py-1">
          <span
            style={{ backgroundColor: selectedTile.bottomBgHex ?? "#3b82f6" }}
            className="rounded-full px-3 py-0.5 text-[11px] font-black uppercase tracking-wide text-white shadow-xs sm:text-xs"
          >
            {selectedTile.name}
          </span>

          <div className="text-sm font-black text-slate-900 sm:text-lg">
            {owner
              ? `Rent: $${currentRent}`
              : `Price: $${selectedTile.cost ?? 0}`}
          </div>

          {owner && (
            <div className="text-[10px] font-bold text-slate-500 sm:text-xs">
              Owner:{" "}
              <span style={{ color: owner.color }} className="font-black">
                {isOwnedByMe ? "You" : owner.username}
              </span>
            </div>
          )}

          {selectedTile.type === "city" && selectedTile.colorGroup && (
            <div className="flex flex-wrap items-center justify-center gap-1 text-[9.5px] font-bold sm:text-[11px]">
              <span
                className={`rounded-full px-2 py-0.5 ${
                  monopoly.hasMonopoly
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {monopoly.hasMonopoly
                  ? "Full Color Set ✓"
                  : owner
                    ? `Color Set ${monopoly.owned}/${monopoly.total}`
                    : "Own full color set to upgrade"}
              </span>
              {currentLevel > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                  Lv.{currentLevel} {"★".repeat(currentLevel)}
                </span>
              )}
            </div>
          )}

          {selectedTile.type === "city" && selectedTile.rent && (
            <div className="mt-0.5 grid grid-cols-4 gap-1 text-[8.5px] font-bold text-slate-600 sm:text-[10px]">
              <div className="rounded-lg bg-slate-100 px-1.5 py-0.5">
                Base ${selectedTile.rent[0]}
              </div>
              <div className="rounded-lg bg-slate-100 px-1.5 py-0.5">
                ★ ${selectedTile.rent[1]}
              </div>
              <div className="rounded-lg bg-slate-100 px-1.5 py-0.5">
                ★★ ${selectedTile.rent[2]}
              </div>
              <div className="rounded-lg bg-slate-100 px-1.5 py-0.5">
                ★★★ ${selectedTile.rent[3]}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          {isOwnedByMe && isMyTurn && !isAnimatingTurn && (
            <>
              {selectedTile.type === "city" && currentLevel < 3 && (
                <button
                  type="button"
                  disabled={!canUpgradeHere}
                  onClick={() => {
                    onUpgrade(selectedTile.index);
                    onSelectTile(null);
                  }}
                  className="flex w-full cursor-pointer items-center justify-center gap-1 rounded-xl bg-emerald-500 py-1.5 text-[10.5px] font-black text-white shadow-xs transition hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 sm:py-2 sm:text-xs"
                >
                  {monopoly.hasMonopoly ? (
                    <>
                      <ArrowUp className="h-3.5 w-3.5 stroke-[3]" />
                      Upgrade (${upgradeCost})
                    </>
                  ) : (
                    <>
                      <Lock className="h-3 w-3" />
                      Own All {monopoly.total} Same-Color Cities
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onSellProperty(selectedTile.index);
                  onSelectTile(null);
                }}
                className="flex w-full cursor-pointer items-center justify-center gap-1 rounded-xl bg-amber-400 py-1.5 text-[10.5px] font-black text-slate-900 shadow-xs transition hover:brightness-105 active:scale-95 sm:py-2 sm:text-xs"
              >
                <Coins className="h-3.5 w-3.5" />
                Sell Deed (+${refund})
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => onSelectTile(null)}
            className="w-full cursor-pointer rounded-xl bg-slate-100 py-1.5 text-[10.5px] font-bold text-slate-600 transition hover:bg-slate-200 sm:text-xs"
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  // Active Turn Modals (z-30)
  const renderActiveDecision = () => {
    if (isAnimatingTurn) return null;

    // A. BUY OR PASS
    if (state.turnSubPhase === "buy_or_pass" && landedTile) {
      const cost = landedTile.cost ?? 0;
      const canAfford = (me?.cash ?? 0) >= cost;
      const myGroupInfo = getColorGroupProgress(
        state.properties,
        landedTile.colorGroup,
        userId,
      );

      return (
        <div className="animate-in zoom-in-95 duration-200 absolute inset-2 z-30 flex flex-col items-center justify-between overflow-y-auto rounded-2xl border border-white/85 bg-white/96 p-3 text-center text-slate-800 shadow-xl backdrop-blur-md sm:inset-4 sm:p-5">
          <span className="text-[9.5px] font-black uppercase tracking-widest text-emerald-600 sm:text-[11px]">
            For Sale
          </span>

          <div className="my-auto flex flex-col items-center gap-1">
            <span
              style={{ backgroundColor: landedTile.bottomBgHex ?? "#10b981" }}
              className="rounded-full px-3.5 py-0.5 text-xs font-black uppercase tracking-wide text-white shadow-xs sm:px-4 sm:py-1 sm:text-sm"
            >
              {landedTile.name}
            </span>

            <div className="text-2xl font-black text-slate-900 sm:text-3xl">
              ${cost}
            </div>

            <p className="text-[10px] font-bold text-slate-500 sm:text-xs">
              Rent{" "}
              <strong className="text-emerald-600">
                ${landedTile.rent?.[0] ?? 45}
              </strong>
              {landedTile.rent && landedTile.rent.length > 1 && (
                <>
                  {" "}
                  • Max{" "}
                  <strong className="text-emerald-600">
                    ${landedTile.rent[landedTile.rent.length - 1]}
                  </strong>
                </>
              )}
            </p>

            {isMyTurn && landedTile.colorGroup && myGroupInfo.total > 0 && (
              <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[9.5px] font-extrabold text-sky-700 sm:text-[10.5px]">
                {myGroupInfo.owned + 1 === myGroupInfo.total
                  ? "Completes Color Set!"
                  : `Color Set: ${myGroupInfo.owned}/${myGroupInfo.total}`}
              </span>
            )}
          </div>

          {isMyTurn ? (
            <div className="flex w-full max-w-[230px] flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!canAfford}
                  onClick={onBuy}
                  className="flex-1 cursor-pointer rounded-xl bg-emerald-500 py-2 text-xs font-black uppercase tracking-wide text-white shadow-[0_3px_0_#047857] transition hover:brightness-105 active:translate-y-0.5 disabled:pointer-events-none disabled:opacity-40 sm:py-2.5 sm:text-sm"
                >
                  {canAfford ? `Buy $${cost}` : `Need $${cost}`}
                </button>
                <button
                  type="button"
                  onClick={onPass}
                  className="cursor-pointer rounded-xl bg-slate-200 px-3.5 py-2 text-xs font-black uppercase text-slate-700 transition hover:bg-slate-300 active:scale-95 sm:px-4 sm:py-2.5 sm:text-sm"
                >
                  Pass
                </button>
              </div>
              {!canAfford && myProperties.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPortfolio(true)}
                  className="cursor-pointer rounded-xl bg-amber-100 py-1.5 text-[10.5px] font-black text-amber-900 transition hover:bg-amber-200 active:scale-95"
                >
                  Sell a Deed to Raise Cash
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-full bg-slate-100 px-3 py-1 text-[10.5px] font-bold text-slate-600 sm:text-xs">
              <strong style={{ color: activePlayer?.color }}>
                {activePlayer?.username}
              </strong>{" "}
              is deciding...
            </div>
          )}
        </div>
      );
    }

    // B. LANDING UPGRADE OR SKIP
    if (state.turnSubPhase === "upgrade_or_skip" && landedTile) {
      const upgradeCost = landedTile.upgradeCost ?? 0;
      const canAfford = (me?.cash ?? 0) >= upgradeCost;
      const currentLevel = propState?.level ?? 0;
      const nextRent = landedTile.rent?.[currentLevel + 1] ?? 100;

      return (
        <div className="animate-in zoom-in-95 duration-200 absolute inset-2 z-30 flex flex-col items-center justify-between overflow-y-auto rounded-2xl border border-white/85 bg-white/96 p-3 text-center text-slate-800 shadow-xl backdrop-blur-md sm:inset-4 sm:p-5">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 sm:text-xs">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs sm:h-5 sm:w-5">
              <ArrowUp className="h-2.5 w-2.5 stroke-[3] sm:h-3 sm:w-3" />
            </span>
            <span>Upgrade City</span>
          </div>

          <div className="my-auto flex flex-col items-center gap-1">
            <span
              style={{ backgroundColor: landedTile.bottomBgHex ?? "#10b981" }}
              className="rounded-full px-3.5 py-0.5 text-xs font-black uppercase text-white sm:px-4 sm:py-1 sm:text-sm"
            >
              {landedTile.name}
            </span>
            <div className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black text-amber-700 sm:text-xs">
              Lv.{currentLevel} → Lv.{currentLevel + 1}{" "}
              {"★".repeat(currentLevel + 1)}
            </div>
            <p className="text-[10.5px] font-bold text-slate-600 sm:text-xs">
              Cost <strong className="text-amber-600">${upgradeCost}</strong> •
              Rent <strong className="text-emerald-600">${nextRent}</strong>
            </p>
          </div>

          {isMyTurn ? (
            <div className="flex w-full max-w-[230px] items-center gap-2">
              <button
                type="button"
                disabled={!canAfford}
                onClick={() => onUpgrade()}
                className="flex-1 cursor-pointer rounded-xl bg-emerald-500 py-2 text-xs font-black uppercase text-white shadow-[0_3px_0_#047857] transition hover:brightness-105 active:translate-y-0.5 disabled:pointer-events-none disabled:opacity-40 sm:py-2.5 sm:text-sm"
              >
                Upgrade ${upgradeCost}
              </button>
              <button
                type="button"
                onClick={onSkipUpgrade}
                className="cursor-pointer rounded-xl bg-slate-200 px-3.5 py-2 text-xs font-black uppercase text-slate-700 hover:bg-slate-300 sm:px-4 sm:py-2.5 sm:text-sm"
              >
                Skip
              </button>
            </div>
          ) : (
            <div className="rounded-full bg-slate-100 px-3 py-1 text-[10.5px] font-bold text-slate-600 sm:text-xs">
              <strong style={{ color: activePlayer?.color }}>
                {activePlayer?.username}
              </strong>{" "}
              is deciding...
            </div>
          )}
        </div>
      );
    }

    // C. ONE-TIME JAIL ENTRY CHOICE
    if (state.turnSubPhase === "jail_choice" && activePlayer) {
      return (
        <div className="animate-in zoom-in-95 duration-200 absolute inset-2 z-30 flex flex-col items-center justify-between overflow-y-auto rounded-2xl border border-white/85 bg-white/96 p-3 text-center text-slate-800 shadow-xl backdrop-blur-md sm:inset-4 sm:p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-500 sm:h-11 sm:w-11">
            <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>

          <div className="my-auto space-y-1">
            <div className="text-sm font-black text-slate-900 sm:text-base">
              {isMyTurn
                ? "You Landed in Jail!"
                : `${activePlayer.username} Landed in Jail`}
            </div>
            <p className="text-[10.5px] font-semibold text-slate-500 sm:text-xs">
              Pay ${BUSINESS_BAIL_COST} now to walk free, or sit out 3 rounds
              automatically.
            </p>
          </div>

          {isMyTurn ? (
            <div className="flex w-full max-w-[235px] items-center gap-2">
              <button
                type="button"
                disabled={(me?.cash ?? 0) < BUSINESS_BAIL_COST}
                onClick={onPayBail}
                className="flex-1 cursor-pointer rounded-xl bg-amber-400 py-2 text-[11px] font-black uppercase text-slate-900 shadow-[0_3px_0_#b45309] transition hover:brightness-105 active:translate-y-0.5 disabled:opacity-40 sm:py-2.5 sm:text-xs"
              >
                Pay ${BUSINESS_BAIL_COST}
              </button>
              <button
                type="button"
                onClick={onPassJailTurn}
                className="flex-1 cursor-pointer rounded-xl bg-slate-200 py-2 text-[11px] font-black uppercase text-slate-700 hover:bg-slate-300 active:scale-95 sm:py-2.5 sm:text-xs"
              >
                Stay (3r)
              </button>
            </div>
          ) : (
            <div className="rounded-full bg-slate-100 px-3 py-1 text-[10.5px] font-bold text-slate-600">
              {activePlayer.username} is choosing bail...
            </div>
          )}
        </div>
      );
    }

    // D. AUCTION TREE UI (Host at Top -> Curved Arrows -> Rival Cards -> Dedicated Big PASS Button Below)
    if (state.turnSubPhase === "auction_trade" && state.auctionTrade) {
      const trade = state.auctionTrade;
      const host = state.players.find((p) => p.userId === trade.hostUserId);
      const hostTile = BUSINESS_BOARD[trade.hostTileIndex];
      const hostProp = state.properties[trade.hostTileIndex];
      const isAuctionHost = trade.hostUserId === userId;
      const hostOwnedCount = Object.values(state.properties).filter(
        (p) => p.ownerId === trade.hostUserId,
      ).length;

      const rivals = state.players.filter(
        (p) => isPlayerActive(p) && p.userId !== trade.hostUserId,
      );
      const amIRival = !isAuctionHost && Boolean(me && isPlayerActive(me));
      const didIPass = trade.declinedUserIds.includes(userId);
      const showBigPassButton =
        amIRival && myProperties.length > 0 && !didIPass;

      const subtitle =
        auctionPickMode === "rival-offer"
          ? "Tap a shaking place on the board!"
          : auctionPickMode === "host-tile"
            ? "Tap your place on the board to list!"
            : isAuctionHost
              ? trade.offers.length > 0
                ? "Tap any offer below to swap"
                : "Waiting for players to propose"
              : didIPass
                ? "You passed on this auction"
                : "Tap + to pick a place, or Pass below";

      return (
        <div className="animate-in zoom-in-95 duration-200 absolute inset-1.5 z-30 flex flex-col justify-between overflow-hidden rounded-2xl border border-violet-200/90 bg-gradient-to-b from-[#f7f4ff] to-[#ede9fe] p-2 text-slate-800 shadow-xl sm:inset-2.5 sm:p-3">
          {/* Header Banner */}
          <div className="flex shrink-0 items-center justify-between gap-1.5 rounded-xl bg-[#5b3cc4] px-2.5 py-1.5 text-white shadow-sm sm:px-3 sm:py-2">
            <div className="flex min-w-0 items-center gap-2">
              <Gavel className="h-4 w-4 shrink-0 text-violet-200 sm:h-5 sm:w-5" />
              <div className="min-w-0 border-l border-white/25 pl-2 text-left leading-tight">
                <div className="text-[11px] font-black tracking-tight sm:text-xs">
                  Auction
                </div>
                <div className="truncate text-[8.5px] font-semibold text-violet-100 sm:text-[10px]">
                  {subtitle}
                </div>
              </div>
            </div>

            {isAuctionHost && (
              <button
                type="button"
                onClick={() => {
                  onSetAuctionPickMode(null);
                  onAuctionSkip();
                }}
                className="flex shrink-0 cursor-pointer items-center gap-0.5 rounded-lg bg-white/15 px-2 py-1 text-[9.5px] font-black text-white transition hover:bg-white/25 active:scale-95 sm:text-[10.5px]"
                title="Cancel Auction"
              >
                <X className="h-3 w-3" />
                <span>Close</span>
              </button>
            )}
          </div>

          {/* Tree Structure: Host Card (Top) -> Arrows -> Rival Cards (Middle) */}
          <div className="my-auto flex min-h-0 flex-col items-center justify-center py-0.5">
            {/* TOP NODE: Auction Host */}
            <div className="relative flex w-[78%] max-w-[215px] flex-col items-center rounded-2xl border-2 border-[#6d4aff]/70 bg-gradient-to-b from-violet-100/90 to-white px-2.5 py-1 shadow-xs sm:px-3.5 sm:py-1.5">
              <div className="flex items-center gap-1.5">
                <div
                  style={{ borderColor: host?.color ?? "#6d4aff" }}
                  className="h-5 w-5 shrink-0 overflow-hidden rounded-full border-2 bg-slate-800 sm:h-7 sm:w-7"
                >
                  {isSafeAvatarUrl(host?.avatarUrl) ? (
                    <img
                      src={host.avatarUrl}
                      alt={host.username}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      style={{ backgroundColor: host?.color ?? "#6d4aff" }}
                      className="flex h-full w-full items-center justify-center text-[8.5px] font-black text-white"
                    >
                      {host?.username.slice(0, 2).toUpperCase() ?? "AU"}
                    </div>
                  )}
                </div>
                <span className="max-w-[100px] truncate text-[10.5px] font-black text-slate-900 sm:text-xs">
                  {isAuctionHost ? "You" : (host?.username ?? "Host")}
                </span>
              </div>

              {hostTile && (
                <div className="mt-0.5 flex items-center gap-1">
                  <span
                    style={{
                      backgroundColor: hostTile.bottomBgHex ?? "#5b3cc4",
                    }}
                    className="rounded-full px-2 py-[1px] text-[9px] font-black text-white shadow-xs sm:px-2.5 sm:text-[10px]"
                  >
                    {hostTile.name} (${hostTile.cost ?? 0})
                    {hostProp && hostProp.level > 0
                      ? ` ${"★".repeat(hostProp.level)}`
                      : ""}
                  </span>

                  {isAuctionHost && hostOwnedCount > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        onSetAuctionPickMode(
                          auctionPickMode === "host-tile" ? null : "host-tile",
                        )
                      }
                      className={`flex cursor-pointer items-center gap-0.5 rounded-full px-1.5 py-[1px] text-[8.5px] font-black transition active:scale-95 sm:text-[9.5px] ${
                        auctionPickMode === "host-tile"
                          ? "bg-rose-500 text-white"
                          : "bg-violet-200 text-violet-800 hover:bg-violet-300"
                      }`}
                      title="Pick a different place on the board"
                    >
                      <RefreshCw className="h-2.5 w-2.5" />
                      <span>
                        {auctionPickMode === "host-tile" ? "Cancel" : "Change"}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Curved Branching Connector Arrows */}
            <AuctionBranchArrows count={rivals.length} />

            {/* RIVAL CARDS ROW */}
            <div
              className={`grid w-full gap-1.5 sm:gap-2 ${
                rivals.length === 1
                  ? "max-w-[185px] grid-cols-1"
                  : rivals.length === 2
                    ? "grid-cols-2"
                    : "grid-cols-3"
              }`}
            >
              {rivals.map((rival) => {
                const isThisMe = rival.userId === userId;
                const offer = trade.offers.find(
                  (o) => o.fromUserId === rival.userId,
                );
                const passed = trade.declinedUserIds.includes(rival.userId);
                const rivalDeedCount = Object.values(state.properties).filter(
                  (p) => p.ownerId === rival.userId,
                ).length;

                const offeredTile = offer
                  ? BUSINESS_BOARD[offer.offeredTileIndex]
                  : null;
                const offeredProp = offer
                  ? state.properties[offer.offeredTileIndex]
                  : null;
                const isPickingNow =
                  isThisMe && auctionPickMode === "rival-offer";

                // CASE 1: Rival has proposed a place
                if (offer && offeredTile) {
                  const canHostAccept = isAuctionHost;
                  return (
                    <div
                      key={rival.userId}
                      onClick={
                        canHostAccept
                          ? () => {
                              onSetAuctionPickMode(null);
                              onAuctionAcceptOffer(offer.offerId);
                            }
                          : undefined
                      }
                      className={`relative flex min-h-[68px] flex-col items-center justify-between rounded-2xl border-2 bg-white p-1.5 text-center shadow-xs transition sm:min-h-[84px] sm:p-2 ${
                        canHostAccept
                          ? "cursor-pointer border-emerald-400 hover:-translate-y-0.5 hover:bg-emerald-50/70 hover:shadow-md active:scale-95"
                          : "border-violet-200"
                      }`}
                    >
                      <div className="my-auto flex flex-col items-center gap-0.5">
                        <div className="text-[10px] font-black leading-tight text-slate-900 sm:text-xs">
                          {offeredTile.name}{" "}
                          <span className="text-emerald-600">
                            (${offeredTile.cost ?? 0})
                          </span>
                        </div>
                        {offeredProp && offeredProp.level > 0 && (
                          <span className="text-[8.5px] font-black text-amber-500">
                            {"★".repeat(offeredProp.level)}
                          </span>
                        )}
                        <MapPin
                          style={{
                            color: offeredTile.bottomBgHex ?? "#5b3cc4",
                          }}
                          className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                        />
                        {canHostAccept && (
                          <span className="flex items-center gap-0.5 rounded-full bg-emerald-500 px-2 py-[1px] text-[8px] font-black uppercase text-white sm:text-[9px]">
                            <ArrowLeftRight className="h-2.5 w-2.5" />
                            Swap
                          </span>
                        )}
                        {isThisMe && (
                          <button
                            type="button"
                            onClick={() =>
                              onSetAuctionPickMode(
                                isPickingNow ? null : "rival-offer",
                              )
                            }
                            className="mt-0.5 cursor-pointer rounded-full bg-violet-100 px-2 py-[1px] text-[8.5px] font-black text-violet-700 hover:bg-violet-200"
                          >
                            {isPickingNow ? "Cancel" : "Change"}
                          </button>
                        )}
                      </div>

                      <div className="w-full truncate text-[9px] font-extrabold text-slate-500 sm:text-[10px]">
                        {isThisMe ? "You" : rival.username}
                      </div>
                    </div>
                  );
                }

                // CASE 2: Rival passed
                if (passed) {
                  return (
                    <div
                      key={rival.userId}
                      className="flex min-h-[68px] flex-col items-center justify-between rounded-2xl border border-violet-200/80 bg-white/85 p-1.5 text-center shadow-xs sm:min-h-[84px] sm:p-2"
                    >
                      <div className="my-auto flex flex-col items-center gap-1">
                        <span className="text-xs font-black tracking-wide text-[#5b3cc4] sm:text-sm">
                          PASS
                        </span>
                        {isThisMe && rivalDeedCount > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              onSetAuctionPickMode(
                                isPickingNow ? null : "rival-offer",
                              )
                            }
                            className="cursor-pointer rounded-full bg-violet-100 px-2 py-[1px] text-[8.5px] font-black text-violet-700 hover:bg-violet-200"
                          >
                            {isPickingNow ? "Cancel" : "+ Offer"}
                          </button>
                        )}
                      </div>
                      <div className="w-full truncate text-[9px] font-extrabold text-slate-500 sm:text-[10px]">
                        {isThisMe ? "You" : rival.username}
                      </div>
                    </div>
                  );
                }

                // CASE 3: Rival owns no properties
                if (rivalDeedCount === 0) {
                  return (
                    <div
                      key={rival.userId}
                      className="flex min-h-[68px] flex-col items-center justify-between rounded-2xl border border-slate-200/80 bg-white/70 p-1.5 text-center opacity-70 sm:min-h-[84px] sm:p-2"
                    >
                      <span className="my-auto text-[9.5px] font-bold text-slate-400">
                        No Deeds
                      </span>
                      <div className="w-full truncate text-[9px] font-extrabold text-slate-500 sm:text-[10px]">
                        {isThisMe ? "You" : rival.username}
                      </div>
                    </div>
                  );
                }

                // CASE 4: Pending Rival — Clean centered `+` button (big PASS button lives below!)
                return (
                  <div
                    key={rival.userId}
                    className={`flex min-h-[68px] flex-col items-center justify-between rounded-2xl border-2 bg-white p-1.5 text-center shadow-xs transition sm:min-h-[84px] sm:p-2 ${
                      isPickingNow
                        ? "border-[#6d4aff] ring-2 ring-violet-400/35"
                        : "border-violet-200/80"
                    }`}
                  >
                    <div className="my-auto flex flex-col items-center justify-center">
                      {isThisMe ? (
                        <button
                          type="button"
                          onClick={() =>
                            onSetAuctionPickMode(
                              isPickingNow ? null : "rival-offer",
                            )
                          }
                          className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-white shadow-sm transition active:scale-90 sm:h-11 sm:w-11 ${
                            isPickingNow
                              ? "bg-rose-500 hover:bg-rose-600"
                              : "bg-[#6d4aff] hover:brightness-110"
                          }`}
                          title={
                            isPickingNow
                              ? "Cancel picking"
                              : "Pick a place on the board to propose"
                          }
                          aria-label="Propose a property"
                        >
                          {isPickingNow ? (
                            <X className="h-4 w-4 sm:h-5 sm:w-5" />
                          ) : (
                            <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                          )}
                        </button>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-400">
                          <span className="h-2 w-2 rounded-full bg-violet-400 animate-ping" />
                          <span className="text-[9px] font-bold">
                            Thinking…
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="w-full truncate text-[9px] font-extrabold text-slate-600 sm:text-[10px]">
                      {isThisMe ? "You" : rival.username}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dedicated Bottom Area: Big Easy-to-Tap PASS Button for Rivals */}
          <div className="shrink-0 pt-1">
            {showBigPassButton ? (
              <button
                type="button"
                onClick={() => {
                  onSetAuctionPickMode(null);
                  onAuctionDecline();
                }}
                className="w-full cursor-pointer rounded-xl bg-white py-2 text-xs font-black uppercase tracking-wider text-[#5b3cc4] shadow-[0_2px_0_#c4b5fd] ring-1 ring-violet-300 transition hover:bg-violet-50 active:translate-y-0.5 sm:py-2.5 sm:text-sm"
              >
                Pass
              </button>
            ) : (
              <div className="text-center text-[8.5px] font-bold text-violet-700/80 sm:text-[9.5px]">
                {auctionPickMode
                  ? "Tap any glowing place on the board perimeter"
                  : isAuctionHost
                    ? "Tap a proposed card to confirm swap, or Close anytime"
                    : didIPass
                      ? "You passed • Tap + Offer above if you change your mind"
                      : "Waiting for auction offers..."}
              </div>
            )}
          </div>
        </div>
      );
    }

    // E. DEBT RESOLUTION
    if (state.turnSubPhase === "debt_resolution" && state.pendingDebt) {
      const canPayNow = Boolean(
        me && canSurviveCharge(me.cash, state.pendingDebt.amount),
      );
      const projected = (me?.cash ?? 0) - state.pendingDebt.amount;

      return (
        <div className="animate-in zoom-in-95 duration-200 absolute inset-2 z-30 flex flex-col items-center justify-between overflow-y-auto rounded-2xl border border-rose-200 bg-white/97 p-3 text-center text-slate-800 shadow-xl backdrop-blur-md sm:inset-4 sm:p-5">
          <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">
            Bankruptcy Risk
          </span>

          <div className="my-auto w-full space-y-1.5">
            <div className="text-base font-black text-slate-900 sm:text-lg">
              Owe ${state.pendingDebt.amount}
            </div>
            <p className="text-[10px] font-semibold text-slate-500 sm:text-xs">
              {state.pendingDebt.reason} • After paying:{" "}
              <strong
                className={canPayNow ? "text-emerald-600" : "text-rose-600"}
              >
                {formatBusinessCash(projected)}
              </strong>{" "}
              (Bankrupt at {formatBusinessCash(BUSINESS_BANKRUPT_LIMIT)})
            </p>

            {isMyTurn && myProperties.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPortfolio(true)}
                className="mt-1 cursor-pointer rounded-xl bg-amber-100 px-3 py-1.5 text-[10.5px] font-black text-amber-900 hover:bg-amber-200 active:scale-95"
              >
                Sell Deeds ({myProperties.length})
              </button>
            )}
          </div>

          {isMyTurn && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!canPayNow}
                onClick={onPayDebt}
                className="cursor-pointer rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black uppercase text-white shadow-xs disabled:opacity-40"
              >
                Pay ${state.pendingDebt.amount}
              </button>
              <button
                type="button"
                onClick={onDeclareBankruptcy}
                className="cursor-pointer rounded-xl bg-rose-500 px-3.5 py-2 text-xs font-black uppercase text-white hover:bg-rose-600"
              >
                Bankrupt
              </button>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  const hasCenterOverlay =
    showPortfolio ||
    upgradeTileIndex !== null ||
    selectedTileIndex !== null ||
    (!isAnimatingTurn && state.turnSubPhase !== "awaiting_roll");

  const formattedNoticeText = activeNotice
    ? formatBusinessNotice(activeNotice, state.players, userId)
    : null;

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center p-2 text-center select-none sm:p-4">
      {/* Base Layer (z-10): Smoothly fades out when rolling the die, fades back in after */}
      <div
        className={`relative z-10 transition-all will-change-transform ${
          isDiceRolling
            ? "scale-90 opacity-0 duration-150 ease-out"
            : hasCenterOverlay
              ? "scale-95 opacity-15 duration-200 ease-out"
              : "scale-100 opacity-100 duration-500 ease-out"
        }`}
      >
        <CenterBankIllustration />
      </div>

      {/* Deeds Shortcut (z-20) */}
      {myProperties.length > 0 && !isDiceRolling && (
        <button
          type="button"
          onClick={() => setShowPortfolio(true)}
          className="absolute top-2 right-2 z-20 flex cursor-pointer items-center gap-1 rounded-full border border-white/80 bg-white/88 px-2.5 py-1 text-[9.5px] font-black text-slate-700 shadow-xs backdrop-blur transition hover:bg-white active:scale-95 sm:top-3 sm:right-3 sm:text-[11px]"
        >
          <Store className="h-3 w-3 text-emerald-600 sm:h-3.5 sm:w-3.5" />
          <span>Deeds ({myProperties.length})</span>
        </button>
      )}

      {/* Viewer-Personalized Short Event Notice Pill (z-20) */}
      {!isDiceRolling && activeNotice && formattedNoticeText && (
        <div
          key={activeNotice.id}
          className={`animate-in fade-in slide-in-from-bottom-2 duration-200 absolute bottom-2 z-20 mx-2 flex max-w-[94%] items-center gap-1.5 rounded-full border px-3 py-1 text-[10.5px] font-extrabold shadow-md sm:bottom-3 sm:px-4 sm:py-1.5 sm:text-xs ${NOTICE_STYLES[activeNotice.tone]}`}
        >
          {activeNotice.playerColor && (
            <span
              style={{ backgroundColor: activeNotice.playerColor }}
              className="h-2 w-2 shrink-0 rounded-full"
            />
          )}
          <span className="truncate">{formattedNoticeText}</span>
        </div>
      )}

      {/* Active Turn Modals (z-30) */}
      {renderActiveDecision()}

      {/* Explicit User-Opened Sheets (z-40) */}
      {renderBoardUpgradeModal()}
      {renderSelectedTileOverlay()}
      {renderPortfolioOverlay()}
    </div>
  );
}
