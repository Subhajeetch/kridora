import { ArrowRight, Gamepad2, Search, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { AuthDialog } from "@/components/AuthDialog";
import { Background } from "@/components/Background";
import { Logo } from "@/components/Logo";
import { MusicController } from "@/components/MusicController";
import { PageTransition } from "@/components/PageTransition";
import { PlayerHud } from "@/components/PlayerHud";
import { ProfileDialog } from "@/components/ProfileDialog";
import { RingsBadge } from "@/components/RingsBadge";
import { SplashScreen } from "@/components/SplashScreen";
import { useProfile } from "@/hooks/useProfile";
import { authClient } from "@/lib/auth-client";
import { playNotificationSound } from "@/lib/audio-settings";
import { socket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { useGameLayout } from "@/providers/game-layout-context";
import { useRealtime } from "@/providers/realtime-context";

const authStore = {
  initialized: false,
  listeners: new Set<() => void>(),
  setInitialized() {
    if (authStore.initialized) return;
    authStore.initialized = true;
    for (const listener of authStore.listeners) {
      listener();
    }
  },
  subscribe(listener: () => void) {
    authStore.listeners.add(listener);
    return () => {
      authStore.listeners.delete(listener);
    };
  },
  getSnapshot() {
    return authStore.initialized;
  },
};

/** Layout shared by every page: background, top bar (HUD, Rings, music, settings), toast area. */
export function AppShell() {
  const navigate = useNavigate();
  const { data: rawSession, isPending } = authClient.useSession();
  const isAuthInitialized = useSyncExternalStore(
    authStore.subscribe,
    authStore.getSnapshot,
    () => false,
  );
  const [splashFinished, setSplashFinished] = useState(() => isAuthInitialized);

  const handleSplashComplete = () => {
    authStore.setInitialized();
    setSplashFinished(true);
  };

  const session =
    rawSession &&
    typeof rawSession === "object" &&
    "user" in rawSession &&
    rawSession.user
      ? rawSession
      : null;
  const { me } = useProfile();
  const { notice, dismissNotice, connection } = useRealtime();
  const { inGameMode } = useGameLayout();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"guest" | "login" | "signup">(
    "guest",
  );
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();
  const currentLocationKey = location.pathname + location.search;
  const [mobileSearchOpenKey, setMobileSearchOpenKey] = useState<string | null>(
    null,
  );
  const isMobileSearchOpen = mobileSearchOpenKey === currentLocationKey;
  const setIsMobileSearchOpen = (
    action: boolean | ((prev: boolean) => boolean),
  ) => {
    setMobileSearchOpenKey((prevKey) => {
      const currentlyOpen = prevKey === currentLocationKey;
      const next =
        typeof action === "function" ? action(currentlyOpen) : action;
      return next ? currentLocationKey : null;
    });
  };
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isMobileSearchOpen) return;

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsMobileSearchOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMobileSearchOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    const timer = setTimeout(() => {
      mobileInputRef.current?.focus();
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileSearchOpen]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setIsMobileSearchOpen(false);
    if (searchQuery.trim()) {
      void navigate(`/games?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      void navigate("/games");
    }
  }

  // Real-time direct room invitation received via numeric User ID
  const [incomingInvite, setIncomingInvite] = useState<{
    senderName: string;
    gameSlug: string;
    gameName: string;
    inviteToken: string;
  } | null>(null);

  useEffect(() => {
    function onInvite(data: {
      senderName: string;
      gameSlug: string;
      gameName: string;
      inviteToken: string;
    }) {
      setIncomingInvite(data);
      playNotificationSound();
    }

    socket.on("room:invitation-received", onInvite);
    return () => {
      socket.off("room:invitation-received", onInvite);
    };
  }, []);

  if (!splashFinished && !isAuthInitialized) {
    return (
      <SplashScreen
        isReady={!isPending}
        onComplete={handleSplashComplete}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative flex flex-col w-full min-w-full",
        inGameMode ? "h-dvh max-h-dvh overflow-hidden w-screen max-w-full" : "min-h-dvh",
      )}
    >
      {!inGameMode && <Background />}
      <MusicController />

      {!inGameMode && (
        <header className="relative z-20 mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:py-6">
          {/* Logo on Left */}
          <Link
            to="/"
            aria-label="Kridora home"
            className="outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] shrink-0"
          >
            <Logo />
          </Link>

          {/* Search + Sign In grouped together on Right */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <div ref={searchContainerRef} className="sm:relative">
              {/* Mobile Search Button (phone only) */}
              <button
                type="button"
                onClick={() => setIsMobileSearchOpen((prev) => !prev)}
                aria-label={
                  isMobileSearchOpen ? "Close search" : "Search games"
                }
                aria-expanded={isMobileSearchOpen}
                className="sm:hidden filter drop-shadow-[0_3px_0_#78350f] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#78350f] transition-all cursor-pointer shrink-0"
              >
                <div className="pixel-corners-sm bg-[#facc15] p-[2px] transition-colors hover:bg-[#fde047]">
                  <div
                    className={cn(
                      "pixel-corners-sm h-8 w-8 flex items-center justify-center transition-colors",
                      isMobileSearchOpen
                        ? "bg-[#facc15] text-black"
                        : "bg-[#12131a] hover:bg-[#1a1b26] text-[#facc15]",
                    )}
                  >
                    <Search className="size-3.5" />
                  </div>
                </div>
              </button>

              {/* Desktop inline search bar */}
              <form
                onSubmit={handleSearchSubmit}
                className="hidden sm:block relative filter drop-shadow-[0_3px_0_#78350f] transition-all"
              >
                <div className="pixel-corners-sm bg-[#facc15] p-[2px] transition-colors hover:bg-[#fde047]">
                  <div className="pixel-corners-sm bg-[#12131a] flex items-center h-8 sm:h-9 w-56 md:w-64 px-2.5 sm:px-3">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search Games..."
                      className="w-full bg-transparent font-retro text-[10px] sm:text-xs text-white placeholder:text-gray-400 outline-none"
                    />
                    <button
                      type="submit"
                      aria-label="Search games"
                      className="text-gray-400 hover:text-[#facc15] transition-colors cursor-pointer shrink-0 ml-1"
                    >
                      <Search className="size-3.5" />
                    </button>
                  </div>
                </div>
              </form>

              {/* Mobile Search Popup */}
              {isMobileSearchOpen && (
                <div className="sm:hidden absolute top-full left-4 right-4 mt-2.5 z-50 filter drop-shadow-[0_6px_0_#78350f] animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150">
                  <div className="pixel-corners-sm bg-black p-[2px]">
                    <div className="pixel-corners-sm bg-[#12131a] p-2">
                      <form
                        onSubmit={handleSearchSubmit}
                        className="flex items-center gap-2"
                      >
                        <div className="pixel-corners-sm bg-[#facc15] p-[2px] flex-1">
                          <div className="pixel-corners-sm bg-[#0e0f16] flex items-center h-9 px-2.5">
                            <Search className="size-3.5 text-gray-400 shrink-0 mr-1.5" />
                            <input
                              ref={mobileInputRef}
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search Games..."
                              className="w-full bg-transparent font-retro text-xs text-white placeholder:text-gray-400 outline-none"
                            />
                            {searchQuery && (
                              <button
                                type="button"
                                aria-label="Clear search"
                                onClick={() => setSearchQuery("")}
                                className="text-gray-400 hover:text-white p-0.5 shrink-0 ml-1 cursor-pointer"
                              >
                                <X className="size-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="filter drop-shadow-[0_3px_0_#78350f] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#78350f] transition-all cursor-pointer shrink-0"
                        >
                          <div className="pixel-corners-sm bg-black p-[1.5px]">
                            <div className="pixel-corners-sm bg-[#facc15] hover:bg-[#fbbf24] text-black font-retro text-[10px] font-bold uppercase tracking-wider h-9 px-3 flex items-center gap-1.5">
                              <Search className="size-3.5" />
                              <span>Search</span>
                            </div>
                          </div>
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {session?.user ? (
              <div className="flex items-center gap-2 shrink-0">
                <PlayerHud
                  name={session.user.name}
                  image={session.user.image}
                  level={me?.profile.level}
                  xp={me?.profile.xp}
                  isGuest={Boolean(
                    session.user.isAnonymous ?? me?.user.isAnonymous,
                  )}
                  isVerified={Boolean(
                    !(session.user.isAnonymous ?? me?.user.isAnonymous) &&
                    (me?.user.emailVerified ?? session.user.emailVerified),
                  )}
                  onClick={() => setProfileOpen(true)}
                />
                <RingsBadge rings={me?.profile.rings} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setAuthOpen(true);
                }}
                className="filter drop-shadow-[0_4px_0_#78350f] hover:drop-shadow-[0_5px_0_#78350f] active:translate-y-1 active:drop-shadow-[0_1px_0_#78350f] transition-all cursor-pointer shrink-0 inline-flex"
              >
                <div className="pixel-corners-sm bg-black p-[2px]">
                  <div className="pixel-corners-sm bg-[#facc15] hover:bg-[#fbbf24] text-black font-retro text-[11px] sm:text-xs font-bold uppercase tracking-wider px-3.5 sm:px-4 py-1.5 sm:py-2">
                    SIGN IN
                  </div>
                </div>
              </button>
            )}
          </div>
        </header>
      )}

      {session && connection === "disconnected" && (
        <p
          role="status"
          className="mx-auto mb-2 w-fit rounded-full bg-amber-400/10 border border-amber-400/30 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#facc15]"
        >
          Connection lost. Reconnecting...
        </p>
      )}

      <main
        className={cn(
          "w-full min-w-full flex-1 flex flex-col",
          inGameMode && "min-h-0 overflow-hidden",
        )}
      >
        <PageTransition />
      </main>

      {/* Floating Realtime Invitation Toast from Friend */}
      {incomingInvite && (
        <div
          role="dialog"
          aria-label="Game invitation"
          className="fixed bottom-4 right-4 left-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 sm:w-96 filter drop-shadow-[0_8px_0_#78350f] animate-in slide-in-from-bottom-5 duration-200"
        >
          <div className="pixel-corners-md bg-black p-[2px]">
            <div className="pixel-corners-md bg-[#12131a] p-3.5 sm:p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="pixel-corners-sm bg-[#facc15] p-[1.5px] shrink-0">
                    <div className="pixel-corners-sm bg-[#0e0f16] size-10 flex items-center justify-center text-[#facc15]">
                      <Gamepad2 className="size-5" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-retro text-[10px] sm:text-[11px] uppercase font-bold tracking-wider text-[#facc15] flex items-center gap-1.5">
                      <span className="relative flex size-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#facc15] opacity-75" />
                        <span className="relative inline-flex size-1.5 rounded-full bg-[#facc15]" />
                      </span>
                      Game Invitation
                    </p>
                    <p className="font-retro text-sm font-bold text-white truncate">
                      {incomingInvite.senderName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      invited you to play{" "}
                      <span className="text-[#facc15] font-semibold">
                        {incomingInvite.gameName}
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Dismiss invitation"
                  onClick={() => setIncomingInvite(null)}
                  className="text-gray-400 hover:text-white transition-colors p-1 -mr-1 -mt-1 cursor-pointer shrink-0"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  className="flex-1 filter drop-shadow-[0_4px_0_#78350f] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#78350f] transition-all cursor-pointer"
                  onClick={() => {
                    const token = incomingInvite.inviteToken;
                    setIncomingInvite(null);
                    void navigate(`/join/${token}`);
                  }}
                >
                  <div className="pixel-corners-sm bg-black p-[1.5px]">
                    <div className="pixel-corners-sm bg-[#facc15] hover:bg-[#fbbf24] text-black font-retro text-[11px] sm:text-xs font-bold uppercase tracking-wider h-9 flex items-center justify-center gap-1.5 px-3">
                      <span>Accept & Join</span>
                      <ArrowRight className="size-3.5" />
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIncomingInvite(null)}
                  className="filter drop-shadow-[0_3px_0_#000000] active:translate-y-0.5 active:drop-shadow-[0_1px_0_#000000] transition-all cursor-pointer shrink-0"
                >
                  <div className="pixel-corners-sm bg-black p-[1.5px]">
                    <div className="pixel-corners-sm bg-[#1e202e] hover:bg-[#282a3c] text-gray-300 hover:text-white font-retro text-[11px] sm:text-xs font-bold uppercase tracking-wider h-9 px-3.5 flex items-center justify-center">
                      Decline
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="fixed bottom-4 right-4 left-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 sm:max-w-md filter drop-shadow-[0_6px_0_#78350f] animate-in slide-in-from-bottom-5 duration-200"
        >
          <div className="pixel-corners-sm bg-black p-[2px]">
            <div className="pixel-corners-sm bg-[#12131a] flex items-center justify-between gap-3 px-3.5 py-2.5 border-l-4 border-l-[#facc15]">
              <span className="font-retro text-xs sm:text-sm text-white">
                {notice}
              </span>
              <button
                type="button"
                aria-label="Dismiss notice"
                onClick={dismissNotice}
                className="text-gray-400 hover:text-white p-1 -mr-1 transition-colors cursor-pointer shrink-0"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        initialMode={authMode}
      />
      <ProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        onOpenAuth={(mode) => {
          setAuthMode(mode ?? "signup");
          setAuthOpen(true);
        }}
      />
    </div>
  );
}
