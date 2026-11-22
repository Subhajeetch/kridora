import {
  BUSINESS_BOARD,
  BUSINESS_CHAT_MAX_HISTORY,
  BUSINESS_START_SALARY,
  computeBusinessTileRent,
  formatBusinessCash,
  formatOrdinalRank,
  getColorGroupProgress,
  isPlayerActive,
  sortBusinessStandings,
  type BusinessActionPayload,
  type BusinessChatMessage,
  type BusinessEventNotice,
  type BusinessPlayer,
  type BusinessState,
  type BusinessUpdateSettingsPayload,
} from "@kridora/shared";
import confetti from "canvas-confetti";
import {
  ArrowLeft,
  ArrowUp,
  Crown,
  LogOut,
  MoreVertical,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInGameRoom } from "@/games/hooks";
import { request, socket } from "@/lib/socket";
import { useGameAudio } from "../in-game-context";
import type { GameComponentProps } from "../types";
import { businessAudio } from "./audio";
import styles from "./business.module.css";
import { SpecialTileArtwork } from "./components/BoardArtwork";
import { BusinessChatBar } from "./components/BusinessChatBar";
import {
  CenterBoardConsole,
  type AuctionPickMode,
} from "./components/CenterBoardConsole";
import {
  CenterWebGLDice,
  type CenterDiceRollTrigger,
} from "./components/CenterWebGLDice";
import { PlayerSeatCard } from "./components/PlayerSeatCard";
import { isSafeAvatarUrl } from "./utils";

function getGridCoords(index: number): { gridRow: number; gridColumn: number } {
  if (index === 0) return { gridRow: 8, gridColumn: 1 };
  if (index >= 1 && index <= 6) return { gridRow: 8 - index, gridColumn: 1 };
  if (index === 7) return { gridRow: 1, gridColumn: 1 };
  if (index >= 8 && index <= 13) return { gridRow: 1, gridColumn: index - 6 };
  if (index === 14) return { gridRow: 1, gridColumn: 8 };
  if (index >= 15 && index <= 20) return { gridRow: index - 13, gridColumn: 8 };
  if (index === 21) return { gridRow: 8, gridColumn: 8 };
  return { gridRow: 8, gridColumn: 29 - index };
}

function arrangeSeats(players: readonly BusinessPlayer[], userId: string) {
  const mePlayer =
    players.find((p) => p.userId === userId) ?? players[0] ?? null;
  const opponents = players.filter((p) => p.userId !== mePlayer?.userId);

  if (opponents.length <= 1) {
    return {
      topLeft: null as BusinessPlayer | null,
      topRight: null as BusinessPlayer | null,
      bottomLeft: opponents[0] ?? null,
      bottomRight: mePlayer,
    };
  }
  if (opponents.length === 2) {
    return {
      topLeft: opponents[1] ?? null,
      topRight: null as BusinessPlayer | null,
      bottomLeft: opponents[0] ?? null,
      bottomRight: mePlayer,
    };
  }
  return {
    topLeft: opponents[1] ?? null,
    topRight: opponents[2] ?? null,
    bottomLeft: opponents[0] ?? null,
    bottomRight: mePlayer,
  };
}

export default function BusinessGame({ userId }: GameComponentProps) {
  const { onBackToRoom, onLeaveRoom, isLeaving } = useInGameRoom();
  const { isMuted, toggleMute } = useGameAudio();

  const [state, setState] = useState<BusinessState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(
    null,
  );
  const [upgradeModalTileIndex, setUpgradeModalTileIndex] = useState<
    number | null
  >(null);
  const [auctionPickMode, setAuctionPickMode] = useState<AuctionPickMode>(null);

  // Smooth animation states
  const [visualPositions, setVisualPositions] = useState<
    Record<string, number>
  >({});
  const [hoppingState, setHoppingState] = useState<{
    playerId: string;
    stepSeq: number;
  } | null>(null);
  const [diceTrigger, setDiceTrigger] = useState<CenterDiceRollTrigger | null>(
    null,
  );
  const [isAnimatingTurn, setIsAnimatingTurn] = useState(false);
  const [activeNotice, setActiveNotice] = useState<BusinessEventNotice | null>(
    null,
  );

  // Ephemeral in-memory chat (React state only, max 250 messages)
  const [chatMessages, setChatMessages] = useState<BusinessChatMessage[]>([]);
  const [activeChatPopup, setActiveChatPopup] =
    useState<BusinessChatMessage | null>(null);

  const lastRollIdRef = useRef<string | null>(null);
  const lastNoticeIdRef = useRef<string | null>(null);
  const lastFinisherEventIdRef = useRef<string | null>(null);
  const isMutedRef = useRef(isMuted);
  const animTimeoutsRef = useRef<number[]>([]);
  const noticeTimeoutsRef = useRef<number[]>([]);
  const chatPopupTimerRef = useRef<number | null>(null);
  const celebratedGameOverRef = useRef(false);

  useEffect(() => {
    businessAudio.preload();
  }, []);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const clearNoticeTimers = useCallback(() => {
    for (const id of noticeTimeoutsRef.current) {
      window.clearTimeout(id);
    }
    noticeTimeoutsRef.current = [];
  }, []);

  const clearTurnAnimationTimers = useCallback(() => {
    for (const id of animTimeoutsRef.current) {
      window.clearTimeout(id);
    }
    animTimeoutsRef.current = [];
  }, []);

  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      animTimeoutsRef.current = animTimeoutsRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    animTimeoutsRef.current.push(id);
  }, []);

  const triggerCelebration = useCallback((big: boolean) => {
    businessAudio.playWin(isMutedRef.current);
    void confetti({
      particleCount: big ? 105 : 70,
      spread: big ? 80 : 62,
      origin: { y: 0.58 },
    });
  }, []);

  const playNoticeSequence = useCallback(
    (notices: readonly BusinessEventNotice[]) => {
      if (notices.length === 0) return;
      const newestId = notices[notices.length - 1]?.id ?? null;
      if (!newestId || newestId === lastNoticeIdRef.current) return;
      lastNoticeIdRef.current = newestId;

      clearNoticeTimers();
      notices.forEach((notice, idx) => {
        const id = window.setTimeout(() => {
          setActiveNotice(notice);
        }, idx * 1450);
        noticeTimeoutsRef.current.push(id);
      });
    },
    [clearNoticeTimers],
  );

  const checkCelebrations = useCallback(
    (next: BusinessState) => {
      const fin = next.latestFinisher;
      const hasNewFinisher = Boolean(
        fin && fin.eventId !== lastFinisherEventIdRef.current,
      );

      if (hasNewFinisher && fin) {
        lastFinisherEventIdRef.current = fin.eventId;
        if (next.phase === "game_over") {
          celebratedGameOverRef.current = true;
        }
        triggerCelebration(next.phase === "game_over" || fin.rank === 1);
        return;
      }

      if (next.phase === "game_over" && !celebratedGameOverRef.current) {
        celebratedGameOverRef.current = true;
        triggerCelebration(true);
      }
    },
    [triggerCelebration],
  );

  const applyIncomingState = useCallback(
    (next: BusinessState, isInitialFetch: boolean) => {
      setState(next);

      if (next.phase === "setup") {
        clearTurnAnimationTimers();
        clearNoticeTimers();
        lastRollIdRef.current = null;
        lastNoticeIdRef.current = null;
        lastFinisherEventIdRef.current = null;
        celebratedGameOverRef.current = false;
        setVisualPositions({});
        setHoppingState(null);
        setDiceTrigger(null);
        setIsAnimatingTurn(false);
        setActiveNotice(null);
        setAuctionPickMode(null);
        setUpgradeModalTileIndex(null);
        return;
      }

      const roll = next.lastRoll;

      if (isInitialFetch) {
        if (roll) lastRollIdRef.current = roll.rollId;
        if (next.latestFinisher) {
          lastFinisherEventIdRef.current = next.latestFinisher.eventId;
        }
        if (next.phase === "game_over") {
          celebratedGameOverRef.current = true;
        }
        const lastN = next.turnNotices[next.turnNotices.length - 1] ?? null;
        if (lastN) {
          lastNoticeIdRef.current = lastN.id;
          setActiveNotice(lastN);
        }
        const snapped: Record<string, number> = {};
        for (const p of next.players) {
          snapped[p.userId] = p.position;
        }
        setVisualPositions(snapped);
        return;
      }

      // Non-roll update (buy, upgrade, sell, bail, auction, etc.)
      if (!roll || roll.rollId === lastRollIdRef.current) {
        setVisualPositions((prev) => {
          let changed = false;
          const updated = { ...prev };
          for (const p of next.players) {
            if (updated[p.userId] === undefined) {
              updated[p.userId] = p.position;
              changed = true;
            }
          }
          return changed ? updated : prev;
        });
        checkCelebrations(next);
        playNoticeSequence(next.turnNotices);
        return;
      }

      // NEW ROLL DETECTED -> Side Dice -> Step-by-Step Hop (with START stop + $200 cash sound!)
      lastRollIdRef.current = roll.rollId;
      clearTurnAnimationTimers();
      clearNoticeTimers();
      setSelectedTileIndex(null);
      setUpgradeModalTileIndex(null);
      setAuctionPickMode(null);
      setActiveNotice(null);

      setVisualPositions(() => {
        const synced: Record<string, number> = {};
        for (const p of next.players) {
          synced[p.userId] =
            p.userId === roll.rollerId ? roll.fromTile : p.position;
        }
        return synced;
      });

      const roller = next.players.find((p) => p.userId === roll.rollerId);
      const seats = arrangeSeats(next.players, userId);
      const fromSide: "left" | "right" =
        seats.bottomRight?.userId === roll.rollerId ||
        seats.topRight?.userId === roll.rollerId
          ? "right"
          : "left";

      setIsAnimatingTurn(true);
      setHoppingState(null);
      setDiceTrigger({
        rollId: roll.rollId,
        value: roll.value,
        fromSide,
        rollerName:
          roll.rollerId === userId ? "You" : (roller?.username ?? "Player"),
        rollerColor: roller?.color ?? "#1885f2",
        isBonus: roll.isBonusRoll,
        sentToJail: roll.sentToJail,
      });
      businessAudio.playDieRoll(isMutedRef.current);

      const finishTurnAnimation = () => {
        setHoppingState(null);
        setIsAnimatingTurn(false);
        checkCelebrations(next);
        playNoticeSequence(next.turnNotices);

        if (next.lastTransaction) {
          businessAudio.playRentCoin(isMutedRef.current);
        } else if (
          roll.sentToJail ||
          BUSINESS_BOARD[roll.toTile]?.type === "jail"
        ) {
          businessAudio.playJail(isMutedRef.current);
        } else if (BUSINESS_BOARD[roll.toTile]?.type === "chance") {
          businessAudio.playMystery(isMutedRef.current);
        } else if (BUSINESS_BOARD[roll.toTile]?.type === "auction_tax") {
          businessAudio.playTrade(isMutedRef.current);
        }
      };

      // Begin hopping right as die finishes its readable hold; clear roll pill so START notice has space
      scheduleTimeout(() => {
        setDiceTrigger((curr) => (curr?.rollId === roll.rollId ? null : curr));

        if (roll.fromTile === roll.toTile) {
          scheduleTimeout(finishTurnAnimation, 280);
          return;
        }

        if (roll.sentToJail) {
          setVisualPositions((prev) => ({
            ...prev,
            [roll.rollerId]: roll.toTile,
          }));
          setHoppingState({ playerId: roll.rollerId, stepSeq: 1 });
          scheduleTimeout(finishTurnAnimation, 320);
          return;
        }

        const path: number[] = [];
        let curr = roll.fromTile;
        while (curr !== roll.toTile) {
          curr = (curr + 1) % BUSINESS_BOARD.length;
          path.push(curr);
        }

        const runStep = (idx: number) => {
          const tileIdx = path[idx];
          if (tileIdx === undefined) {
            scheduleTimeout(finishTurnAnimation, 210);
            return;
          }

          setVisualPositions((prev) => ({
            ...prev,
            [roll.rollerId]: tileIdx,
          }));
          setHoppingState({ playerId: roll.rollerId, stepSeq: idx + 1 });

          const isLastStep = idx === path.length - 1;

          // Passing or landing on START: stop there, announce "You got $200" + cash sound, then continue!
          if (tileIdx === 0) {
            businessAudio.playStartSalary(isMutedRef.current);
            setActiveNotice({
              id: `start_${roll.rollId}`,
              text: `${roller?.username ?? "Player"} got $${BUSINESS_START_SALARY}`,
              template: `{actor} got $${BUSINESS_START_SALARY}`,
              actorId: roll.rollerId,
              tone: "cash",
              playerColor: roller?.color,
              timestamp: Date.now(),
            });

            if (isLastStep) {
              scheduleTimeout(finishTurnAnimation, 550);
            } else {
              // Pause smoothly on START so players read the $200 message before remaining hops
              scheduleTimeout(() => runStep(idx + 1), 950);
            }
            return;
          }

          businessAudio.playHop(isMutedRef.current, idx);

          if (isLastStep) {
            scheduleTimeout(finishTurnAnimation, 210);
          } else {
            scheduleTimeout(() => runStep(idx + 1), 200);
          }
        };

        runStep(0);
      }, 1150);
    },
    [
      checkCelebrations,
      clearNoticeTimers,
      clearTurnAnimationTimers,
      playNoticeSequence,
      scheduleTimeout,
      userId,
    ],
  );

  useEffect(() => {
    const onState = (next: BusinessState) => applyIncomingState(next, false);
    const onChat = (msg: BusinessChatMessage) => {
      setChatMessages((prev) =>
        [...prev, msg].slice(-BUSINESS_CHAT_MAX_HISTORY),
      );
      setActiveChatPopup(msg);
      if (msg.userId !== userId) {
        businessAudio.playChatPop(isMutedRef.current);
      }
      if (chatPopupTimerRef.current !== null) {
        window.clearTimeout(chatPopupTimerRef.current);
      }
      chatPopupTimerRef.current = window.setTimeout(() => {
        setActiveChatPopup((curr) => (curr?.id === msg.id ? null : curr));
      }, 1000);
    };

    void request("business:get-state", {})
      .then((initial) => applyIncomingState(initial, true))
      .catch(() => undefined);

    socket.on("business:state", onState);
    socket.on("business:chat", onChat);

    return () => {
      socket.off("business:state", onState);
      socket.off("business:chat", onChat);
      clearTurnAnimationTimers();
      clearNoticeTimers();
      if (chatPopupTimerRef.current !== null) {
        window.clearTimeout(chatPopupTimerRef.current);
      }
    };
  }, [applyIncomingState, clearNoticeTimers, clearTurnAnimationTimers, userId]);

  const sendAction = useCallback(
    (payload: BusinessActionPayload) => {
      if (payload.type === "buy-property") {
        businessAudio.playCashRegister(isMutedRef.current);
      } else if (payload.type === "upgrade-property") {
        businessAudio.playUpgrade(isMutedRef.current);
      } else if (payload.type === "sell-property") {
        businessAudio.playSell(isMutedRef.current);
      } else if (payload.type === "auction-accept-offer") {
        businessAudio.playTrade(isMutedRef.current);
      }

      void request("business:action", payload)
        .then((next) => {
          if (payload.type !== "send-chat") {
            applyIncomingState(next, false);
          }
        })
        .catch(() => undefined);
    },
    [applyIncomingState],
  );

  const updateSettings = useCallback(
    (patch: BusinessUpdateSettingsPayload) => {
      void request("business:update-settings", patch)
        .then((next) => applyIncomingState(next, false))
        .catch(() => undefined);
    },
    [applyIncomingState],
  );

  const startMatch = useCallback(() => {
    void request("business:start-match", {})
      .then((next) => applyIncomingState(next, false))
      .catch(() => undefined);
  }, [applyIncomingState]);

  const activePlayer = state ? (state.players[state.turnIndex] ?? null) : null;
  const isMyTurn = activePlayer?.userId === userId;
  const me = useMemo(
    () => state?.players.find((p) => p.userId === userId) ?? null,
    [state, userId],
  );

  const effectiveAuctionPickMode: AuctionPickMode =
    state?.phase === "playing" &&
    state.turnSubPhase === "auction_trade" &&
    !isAnimatingTurn
      ? auctionPickMode
      : null;

  const upgradeableTileSet = useMemo(() => {
    const eligible = new Set<number>();
    if (
      !state ||
      state.phase !== "playing" ||
      !isMyTurn ||
      isAnimatingTurn ||
      !me ||
      !isPlayerActive(me) ||
      effectiveAuctionPickMode !== null
    ) {
      return eligible;
    }

    const canPreRoll = state.turnSubPhase === "awaiting_roll";
    const isLandingUpgrade = state.turnSubPhase === "upgrade_or_skip";
    if (!canPreRoll && !isLandingUpgrade) return eligible;

    for (const tile of BUSINESS_BOARD) {
      if (tile.type !== "city" || !tile.colorGroup || !tile.upgradeCost)
        continue;
      if (isLandingUpgrade && tile.index !== me.position) continue;
      const prop = state.properties[tile.index];
      if (!prop || prop.ownerId !== userId || prop.level >= 3) continue;
      if (me.cash < tile.upgradeCost) continue;
      const { hasMonopoly } = getColorGroupProgress(
        state.properties,
        tile.colorGroup,
        userId,
      );
      if (hasMonopoly) {
        eligible.add(tile.index);
      }
    }
    return eligible;
  }, [state, isMyTurn, isAnimatingTurn, me, userId, effectiveAuctionPickMode]);

  const effectiveUpgradeTileIndex =
    state?.turnSubPhase === "awaiting_roll" &&
    upgradeModalTileIndex !== null &&
    upgradeableTileSet.has(upgradeModalTileIndex)
      ? upgradeModalTileIndex
      : null;

  const canRollNow =
    state?.phase === "playing" &&
    isMyTurn &&
    !isAnimatingTurn &&
    Boolean(activePlayer && isPlayerActive(activePlayer)) &&
    !activePlayer?.inJail &&
    state.turnSubPhase === "awaiting_roll";

  const handleRollDie = useCallback(() => {
    if (!canRollNow) return;
    sendAction({ type: "roll-die" });
  }, [canRollNow, sendAction]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !canRollNow) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      handleRollDie();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canRollNow, handleRollDie]);

  const seats = useMemo(() => {
    if (!state) {
      return {
        topLeft: null,
        topRight: null,
        bottomLeft: null,
        bottomRight: null,
      };
    }
    return arrangeSeats(state.players, userId);
  }, [state, userId]);

  if (!state) {
    return (
      <div
        className={`${styles.arenaBg} flex h-dvh w-screen items-center justify-center font-extrabold text-white`}
      >
        Loading Business Board...
      </div>
    );
  }

  // SETUP SCREEN (Host configures; Guests see clean Host PFP waiting card)
  if (state.phase === "setup") {
    const isHost = state.hostUserId === userId;
    const hostPlayer =
      state.players.find((p) => p.userId === state.hostUserId) ??
      state.players[0] ??
      null;
    const hostAvatar = isSafeAvatarUrl(hostPlayer?.avatarUrl)
      ? hostPlayer.avatarUrl
      : null;

    return (
      <div
        className={`${styles.arenaBg} flex min-h-dvh w-full flex-col justify-between text-white`}
      >
        <div className="flex flex-1 items-center justify-center p-4">
          {isHost ? (
            <div className="w-full max-w-md space-y-5 rounded-3xl border border-white/15 bg-[#2a2832]/95 p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <button
                  type="button"
                  onClick={onBackToRoom}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200 transition hover:bg-white/15"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Room</span>
                </button>
                <button
                  type="button"
                  onClick={onLeaveRoom}
                  disabled={isLeaving}
                  className="cursor-pointer text-xs font-bold text-rose-300 transition hover:text-rose-200"
                >
                  {isLeaving ? "Leaving…" : "Leave"}
                </button>
              </div>

              <div className="space-y-1 text-center">
                <h1 className="text-2xl font-black tracking-tight text-white">
                  Business Setup
                </h1>
                <p className="text-xs text-slate-300">
                  Choose match goal & starting cash (2–4 players)
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                  Target Net Worth to Win
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {([3000, 5000, 7000, 10000] as const).map((goal) => (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => updateSettings({ targetNetWorth: goal })}
                      className={`cursor-pointer rounded-2xl border py-2.5 text-xs font-black transition active:scale-95 ${
                        state.settings.targetNetWorth === goal
                          ? "border-[#8ee04e] bg-[#8ee04e]/20 text-[#8ee04e]"
                          : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"
                      }`}
                    >
                      ${(goal / 1000).toFixed(0)}k
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                  Starting Cash
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([1000, 1500, 2000] as const).map((cash) => (
                    <button
                      key={cash}
                      type="button"
                      onClick={() => updateSettings({ startingCash: cash })}
                      className={`cursor-pointer rounded-2xl border py-2.5 text-xs font-black transition active:scale-95 ${
                        state.settings.startingCash === cash
                          ? "border-[#38bdf8] bg-[#1885f2]/25 text-sky-300"
                          : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"
                      }`}
                    >
                      ${cash.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                  Players ({state.players.length}/4)
                </div>
                <div className="space-y-1.5">
                  {state.players.map((p) => (
                    <div
                      key={p.userId}
                      className="flex items-center justify-between rounded-2xl bg-white/8 px-3.5 py-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          style={{ backgroundColor: p.color }}
                          className="h-3.5 w-3.5 rounded-full border-2 border-white shadow"
                        />
                        <span className="text-xs font-bold text-white">
                          {p.username}
                        </span>
                        {p.userId === userId && (
                          <span className="rounded-full bg-[#1885f2]/30 px-2 py-0.5 text-[9px] font-black text-sky-200">
                            YOU
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-extrabold text-[#8ee04e]">
                        ${state.settings.startingCash.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={startMatch}
                className="w-full cursor-pointer rounded-2xl bg-[#1885f2] py-3.5 text-sm font-black uppercase tracking-wider text-white shadow-[0_4px_0_#1463bd] transition hover:brightness-105 active:translate-y-0.5"
              >
                Start Match
              </button>
            </div>
          ) : (
            <div className="w-full max-w-sm space-y-6 rounded-3xl border border-white/15 bg-[#2a2832]/95 p-6 text-center shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <button
                  type="button"
                  onClick={onBackToRoom}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-200 transition hover:bg-white/15"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Room</span>
                </button>
                <button
                  type="button"
                  onClick={onLeaveRoom}
                  disabled={isLeaving}
                  className="cursor-pointer text-xs font-bold text-rose-300 transition hover:text-rose-200"
                >
                  {isLeaving ? "Leaving…" : "Leave"}
                </button>
              </div>

              <div className="flex flex-col items-center gap-4 py-4">
                <div className="relative">
                  <div
                    style={{
                      borderColor: hostPlayer?.color ?? "#38bdf8",
                    }}
                    className="h-20 w-20 overflow-hidden rounded-full border-[3px] bg-slate-800 shadow-xl ring-4 ring-white/10 sm:h-24 sm:w-24"
                  >
                    {hostAvatar ? (
                      <img
                        src={hostAvatar}
                        alt={hostPlayer?.username ?? "Host"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        style={{
                          backgroundColor: hostPlayer?.color ?? "#1885f2",
                        }}
                        className="flex h-full w-full items-center justify-center text-2xl font-black text-white"
                      >
                        {hostPlayer?.username.slice(0, 2).toUpperCase() ?? "H"}
                      </div>
                    )}
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow-md">
                    <Crown className="h-4 w-4" />
                  </span>
                </div>

                <div className="space-y-1.5">
                  <p className="text-base font-extrabold text-white sm:text-lg">
                    Waiting for{" "}
                    <span style={{ color: hostPlayer?.color ?? "#8ee04e" }}>
                      {hostPlayer?.username ?? "host"}
                    </span>{" "}
                    to start…
                  </p>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 text-[11px] font-bold text-slate-300">
                    <span className="h-2 w-2 rounded-full bg-[#8ee04e] animate-pulse" />
                    <span>{state.players.length} players ready</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <BusinessChatBar
          messages={chatMessages}
          activePopup={activeChatPopup}
          currentUserId={userId}
          onSendMessage={(text) => sendAction({ type: "send-chat", text })}
        />
      </div>
    );
  }

  // ACTIVE GAMEPLAY ARENA
  const hasTopPlayers = Boolean(seats.topLeft || seats.topRight);
  const rankedStandings =
    state.phase === "game_over" ? sortBusinessStandings(state.players) : [];

  return (
    <div
      className={`${styles.arenaBg} flex h-dvh w-screen select-none flex-col justify-between overflow-hidden text-white`}
    >
      {/* Top Bar */}
      <header className="relative z-30 mx-auto flex w-full max-w-2xl shrink-0 items-center justify-between px-3 pt-2.5 pb-1 sm:px-4 sm:pt-3">
        <button
          type="button"
          onClick={onBackToRoom}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-black/30 text-white transition hover:bg-black/45 active:scale-95"
          title="Back to Room"
          aria-label="Back to Room"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="px-2 text-center text-xs font-bold leading-snug text-white sm:text-sm">
          <span className="font-black text-[#8ee04e]">
            ${state.settings.targetNetWorth.toLocaleString()}
          </span>{" "}
          net worth to win.{" "}
          <span className="text-slate-300">Turn {state.turnNumber}</span>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-black/30 text-white transition hover:bg-black/45 active:scale-95"
            title="Menu"
            aria-label="Game menu"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div className="animate-in fade-in zoom-in-95 duration-150 absolute right-0 z-50 mt-2 w-40 overflow-hidden rounded-2xl border border-white/15 bg-[#23212b] p-1.5 shadow-2xl">
              <button
                type="button"
                onClick={() => {
                  toggleMute();
                  setMenuOpen(false);
                }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4 text-slate-400" />
                ) : (
                  <Volume2 className="h-4 w-4 text-[#8ee04e]" />
                )}
                <span>{isMuted ? "Unmute SFX" : "Mute SFX"}</span>
              </button>
              <button
                type="button"
                disabled={isLeaving}
                onClick={() => {
                  setMenuOpen(false);
                  onLeaveRoom();
                }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-500/15"
              >
                <LogOut className="h-4 w-4" />
                <span>{isLeaving ? "Leaving…" : "Leave Room"}</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Center Stage */}
      <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col items-center justify-center gap-2 px-1 py-1 sm:gap-3 sm:px-2">
        {hasTopPlayers && (
          <div className="flex w-full items-center justify-around px-2">
            {seats.topLeft && (
              <PlayerSeatCard
                player={seats.topLeft}
                isMe={seats.topLeft.userId === userId}
                isTurn={activePlayer?.userId === seats.topLeft.userId}
                isHost={seats.topLeft.userId === state.hostUserId}
                puckSide="left"
                compact
              />
            )}
            {seats.topRight && (
              <PlayerSeatCard
                player={seats.topRight}
                isMe={seats.topRight.userId === userId}
                isTurn={activePlayer?.userId === seats.topRight.userId}
                isHost={seats.topRight.userId === state.hostUserId}
                puckSide="right"
                compact
              />
            )}
          </div>
        )}

        {/* 8x8 Perimeter Game Board */}
        <div
          className={`${styles.boardFrame} ${
            hasTopPlayers ? styles.boardFrameWithTopPlayers : ""
          }`}
        >
          {BUSINESS_BOARD.map((tile) => {
            const coords = getGridCoords(tile.index);
            const prop = state.properties[tile.index];
            const owner = prop?.ownerId
              ? state.players.find((p) => p.userId === prop.ownerId)
              : null;

            // Keep animating roller visible during their final hop even if they just finished/bankrupted
            const occupants = state.players.filter((p) => {
              const visibleOnBoard =
                isPlayerActive(p) ||
                (isAnimatingTurn && state.lastRoll?.rollerId === p.userId);
              return (
                visibleOnBoard &&
                (visualPositions[p.userId] ?? p.position) === tile.index
              );
            });

            const isBought = Boolean(owner);
            const displayPrice = isBought
              ? computeBusinessTileRent(state.properties, tile.index)
              : (tile.cost ?? 0);

            const isOwnedByMe = prop?.ownerId === userId;
            const isAuctionPickTarget =
              effectiveAuctionPickMode !== null && isOwnedByMe;
            const isDimmedForAuctionPick =
              effectiveAuctionPickMode !== null && !isOwnedByMe;
            const isUpgradeable = upgradeableTileSet.has(tile.index);

            const handleTileClick = () => {
              if (effectiveAuctionPickMode !== null) {
                if (!isOwnedByMe) return;
                if (effectiveAuctionPickMode === "rival-offer") {
                  sendAction({
                    type: "auction-propose-offer",
                    offeredTileIndex: tile.index,
                  });
                } else {
                  sendAction({
                    type: "auction-select-tile",
                    tileIndex: tile.index,
                  });
                }
                setAuctionPickMode(null);
                return;
              }

              if (isUpgradeable && state.turnSubPhase === "awaiting_roll") {
                setSelectedTileIndex(null);
                setUpgradeModalTileIndex(tile.index);
                return;
              }

              if (prop) {
                setUpgradeModalTileIndex(null);
                setSelectedTileIndex(tile.index);
              }
            };

            return (
              <div
                key={tile.index}
                style={{
                  gridRow: coords.gridRow,
                  gridColumn: coords.gridColumn,
                }}
                onClick={handleTileClick}
                className={`relative flex flex-col overflow-visible rounded-[7px] transition duration-200 ${
                  isAuctionPickTarget
                    ? `${styles.selectableTilePump} cursor-pointer`
                    : isDimmedForAuctionPick
                      ? "opacity-45"
                      : prop
                        ? "cursor-pointer hover:brightness-105 active:scale-95"
                        : ""
                }`}
              >
                <div className="flex h-full w-full flex-col overflow-hidden rounded-[7px]">
                  {tile.type === "city" ? (
                    <>
                      <div
                        style={{ backgroundColor: tile.topBgHex }}
                        className="flex h-[37%] w-full items-center justify-center px-0.5"
                      >
                        {isBought && owner ? (
                          <span
                            style={{ backgroundColor: owner.color }}
                            className="rounded-full border border-white/90 px-1.5 py-[0.5px] text-[8px] font-black leading-none text-white shadow-xs sm:text-[9.5px] md:text-[11px]"
                          >
                            ${displayPrice}
                          </span>
                        ) : (
                          <span className="text-[8.5px] font-black leading-none text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)] sm:text-[10.5px] md:text-[12px]">
                            ${displayPrice}
                          </span>
                        )}
                      </div>
                      <div
                        style={{ backgroundColor: tile.bottomBgHex }}
                        className="flex h-[63%] w-full flex-col items-center justify-center px-0.5 text-center"
                      >
                        <span className="max-w-full truncate text-[8px] font-black uppercase leading-none tracking-tight text-white sm:text-[9.5px] md:text-[11px]">
                          {tile.name}
                        </span>
                        {prop && prop.level > 0 && (
                          <span className="mt-0.5 text-[7.5px] font-black leading-none text-amber-200 sm:text-[9px]">
                            {"★".repeat(prop.level)}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <SpecialTileArtwork
                        tileIndex={tile.index}
                        name={tile.name}
                      />
                      {isBought && owner && (
                        <span
                          style={{ backgroundColor: owner.color }}
                          className="absolute top-0.5 left-0.5 z-10 rounded-full border border-white/90 px-1 py-[0.5px] text-[7.5px] font-black leading-none text-white shadow-xs sm:text-[9px]"
                        >
                          ${displayPrice}
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* Pumping/Shaking Circular UP-Arrow Badge (Top-Right, ONLY on Owner's Turn!) */}
                {isUpgradeable && (
                  <span
                    className={`${styles.upgradeBadgePump} pointer-events-none absolute -top-1.5 -right-1.5 z-30 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white sm:h-5 sm:w-5`}
                    title={`Upgrade ${tile.name} ($${tile.upgradeCost})`}
                  >
                    <ArrowUp className="h-2.5 w-2.5 stroke-[3] sm:h-3 sm:w-3" />
                  </span>
                )}

                {/* Player Tokens */}
                {occupants.length > 0 && (
                  <div className="pointer-events-none absolute inset-0 z-10 flex flex-wrap items-center justify-center gap-0.5 p-0.5">
                    {occupants.map((occ) => {
                      const isHoppingNow =
                        hoppingState?.playerId === occ.userId;
                      return (
                        <div
                          key={
                            isHoppingNow
                              ? `${occ.userId}_${hoppingState.stepSeq}`
                              : occ.userId
                          }
                          className={`${styles.tokenPuck} h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 ${
                            isHoppingNow ? styles.hoppingToken : ""
                          }`}
                        >
                          <div
                            style={{ backgroundColor: occ.color }}
                            className="h-full w-full rounded-full"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* CENTER WELL */}
          <div className={styles.centerWell}>
            <CenterBoardConsole
              state={state}
              userId={userId}
              isAnimatingTurn={isAnimatingTurn}
              isDiceRolling={diceTrigger !== null}
              activeNotice={activeNotice}
              activePlayer={activePlayer}
              isMyTurn={isMyTurn}
              me={me}
              selectedTileIndex={selectedTileIndex}
              upgradeTileIndex={effectiveUpgradeTileIndex}
              auctionPickMode={effectiveAuctionPickMode}
              onSelectTile={setSelectedTileIndex}
              onCloseUpgradeModal={() => setUpgradeModalTileIndex(null)}
              onSetAuctionPickMode={setAuctionPickMode}
              onBuy={() => sendAction({ type: "buy-property" })}
              onPass={() => sendAction({ type: "pass-property" })}
              onUpgrade={(tileIndex) =>
                sendAction(
                  tileIndex !== undefined
                    ? { type: "upgrade-property", tileIndex }
                    : { type: "upgrade-property" },
                )
              }
              onSkipUpgrade={() => sendAction({ type: "skip-upgrade" })}
              onPayBail={() => sendAction({ type: "pay-bail" })}
              onPassJailTurn={() => sendAction({ type: "pass-jail-turn" })}
              onPayDebt={() => sendAction({ type: "pay-debt" })}
              onDeclareBankruptcy={() =>
                sendAction({ type: "declare-bankruptcy" })
              }
              onSellProperty={(tileIndex) =>
                sendAction({ type: "sell-property", tileIndex })
              }
              onAuctionDecline={() => sendAction({ type: "auction-decline" })}
              onAuctionAcceptOffer={(offerId) =>
                sendAction({ type: "auction-accept-offer", offerId })
              }
              onAuctionSkip={() => sendAction({ type: "auction-skip" })}
            />

            <CenterWebGLDice trigger={diceTrigger} />
          </div>
        </div>

        {/* Bottom Control Row */}
        <div className="flex w-full items-center justify-between gap-2 px-1.5 sm:px-3">
          <div className="flex flex-1 justify-start">
            {seats.bottomLeft && (
              <PlayerSeatCard
                player={seats.bottomLeft}
                isMe={seats.bottomLeft.userId === userId}
                isTurn={activePlayer?.userId === seats.bottomLeft.userId}
                isHost={seats.bottomLeft.userId === state.hostUserId}
                puckSide="left"
              />
            )}
          </div>

          <button
            type="button"
            disabled={!canRollNow}
            onClick={handleRollDie}
            className={`shrink-0 cursor-pointer rounded-2xl bg-[#1885f2] px-7 py-3 text-sm font-black uppercase tracking-wider text-white transition active:translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-600/70 disabled:text-slate-300 disabled:shadow-none sm:px-10 sm:py-3.5 sm:text-base ${
              canRollNow ? styles.rollBtnPulse : ""
            }`}
          >
            {isAnimatingTurn
              ? "Rolling…"
              : me?.finishRank !== null && me?.finishRank !== undefined
                ? `${formatOrdinalRank(me.finishRank)} 🏆`
                : canRollNow
                  ? "ROLL"
                  : state.turnSubPhase === "auction_trade"
                    ? "Auction"
                    : isMyTurn
                      ? "Decide"
                      : "Wait"}
          </button>

          <div className="flex flex-1 justify-end">
            {seats.bottomRight && (
              <PlayerSeatCard
                player={seats.bottomRight}
                isMe={seats.bottomRight.userId === userId}
                isTurn={activePlayer?.userId === seats.bottomRight.userId}
                isHost={seats.bottomRight.userId === state.hostUserId}
                puckSide="right"
              />
            )}
          </div>
        </div>
      </main>

      {/* Ephemeral Chat Bar */}
      <BusinessChatBar
        messages={chatMessages}
        activePopup={activeChatPopup}
        currentUserId={userId}
        onSendMessage={(text) => sendAction({ type: "send-chat", text })}
      />

      {/* GAME OVER PODIUM MODAL (z-[60]) */}
      {state.phase === "game_over" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="animate-in zoom-in-95 duration-200 w-full max-w-md space-y-4 rounded-3xl border border-white/15 bg-[#2a2832] p-6 text-center shadow-2xl">
            <Trophy className="mx-auto h-12 w-12 text-amber-400" />
            <h2 className="text-2xl font-black text-white">Match Complete!</h2>
            <p className="text-xs font-extrabold text-[#8ee04e]">
              {state.winReason}
            </p>
            <div className="space-y-2 text-left">
              {rankedStandings.map((p, i) => (
                <div
                  key={p.userId}
                  className="flex items-center justify-between rounded-2xl bg-white/8 px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`text-xs font-black ${
                        i === 0
                          ? "text-amber-400"
                          : i === 1
                            ? "text-slate-200"
                            : i === 2
                              ? "text-orange-400"
                              : "text-slate-400"
                      }`}
                    >
                      {formatOrdinalRank(i + 1)}
                    </span>
                    <span
                      style={{ backgroundColor: p.color }}
                      className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white"
                    />
                    <span className="text-xs font-bold text-white">
                      {p.userId === userId ? "You" : p.username}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-black ${
                      p.isBankrupt ? "text-rose-400" : "text-[#8ee04e]"
                    }`}
                  >
                    {p.isBankrupt ? "Bankrupt" : formatBusinessCash(p.netWorth)}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={onBackToRoom}
              className="w-full cursor-pointer rounded-2xl bg-[#1885f2] py-3 text-xs font-black uppercase tracking-wider text-white shadow-[0_4px_0_#1463bd] transition hover:brightness-105 active:translate-y-0.5"
            >
              Return to Room
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
