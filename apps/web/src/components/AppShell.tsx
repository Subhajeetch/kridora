import { Gamepad2, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Link, useNavigate } from "react-router";
import { AuthDialog } from "@/components/AuthDialog";
import { Background } from "@/components/Background";
import { Logo } from "@/components/Logo";
import { MusicController } from "@/components/MusicController";
import { PageTransition } from "@/components/PageTransition";
import { PlayerHud } from "@/components/PlayerHud";
import { ProfileDialog } from "@/components/ProfileDialog";
import { RingsBadge } from "@/components/RingsBadge";
import { SplashScreen } from "@/components/SplashScreen";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { authClient } from "@/lib/auth-client";
import { socket } from "@/lib/socket";
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

  useEffect(() => {
    if (!isPending) {
      authStore.setInitialized();
    }
  }, [isPending]);

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
    }

    socket.on("room:invitation-received", onInvite);
    return () => {
      socket.off("room:invitation-received", onInvite);
    };
  }, []);

  if (isPending && !isAuthInitialized) return <SplashScreen />;

  return (
    <div className="min-h-dvh">
      <Background />
      <MusicController />

      {!inGameMode && (
        <header className="relative z-20 mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <Link
            to="/"
            aria-label="Kridora home"
            className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <Logo />
          </Link>

          {session?.user ? (
            <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-white/10 bg-panel/70 hover:border-primary/60 hover:text-primary"
                onClick={() => {
                  setAuthMode("login");
                  setAuthOpen(true);
                }}
              >
                Sign In
              </Button>
            </div>
          )}
        </header>
      )}

      {session && connection === "disconnected" && (
        <p
          role="status"
          className="mx-auto mb-2 w-fit rounded-full bg-coin/10 px-4 py-1.5 text-sm text-coin"
        >
          Connection lost. Reconnecting...
        </p>
      )}

      <main className="w-full">
        <PageTransition />
      </main>

      {/* Floating Realtime Invitation Toast from Friend */}
      {incomingInvite && (
        <div
          role="dialog"
          aria-label="Game invitation"
          className="fixed bottom-6 right-6 z-50 flex max-w-sm flex-col gap-3 rounded-3xl border border-neon-cyan/40 bg-panel/95 p-4 backdrop-blur-xl shadow-2xl shadow-neon-cyan/15 animate-in slide-in-from-bottom-5"
        >
          <div className="flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-neon-cyan/15 text-neon-cyan">
              <Gamepad2 className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase font-semibold tracking-wider text-neon-cyan">
                Game Invitation
              </p>
              <p className="text-sm font-bold text-foreground truncate">
                {incomingInvite.senderName}
              </p>
              <p className="text-xs text-muted-foreground">
                invited you to play {incomingInvite.gameName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 font-semibold text-xs h-9 bg-primary text-primary-foreground"
              onClick={() => {
                const token = incomingInvite.inviteToken;
                setIncomingInvite(null);
                void navigate(`/join/${token}`);
              }}
            >
              Accept & Join
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-9 border-white/15"
              onClick={() => setIncomingInvite(null)}
            >
              Decline
            </Button>
          </div>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-between gap-3 overflow-hidden rounded-2xl border border-primary/30 bg-panel py-3 pr-3 pl-5 text-sm shadow-xl"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1.5 bg-primary"
          />
          <span>{notice}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss"
            onClick={dismissNotice}
          >
            <X />
          </Button>
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
