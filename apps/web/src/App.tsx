import { Suspense } from "react";
import { Route, Routes } from "react-router";
import { AppShell } from "@/components/AppShell";
import { RealtimeProvider } from "@/providers/RealtimeProvider";
import { lazyWithRetry } from "@/lib/chunk-reload";

const HomePage = lazyWithRetry(() => import("@/pages/HomePage"));
const GamesPage = lazyWithRetry(() => import("@/pages/GamesPage"));
const GameLobbyPage = lazyWithRetry(() => import("@/pages/GameLobbyPage"));
const RoomPage = lazyWithRetry(() => import("@/pages/RoomPage"));
const InviteJoinPage = lazyWithRetry(() => import("@/pages/InviteJoinPage"));
const ResetPasswordPage = lazyWithRetry(
  () => import("@/pages/ResetPasswordPage"),
);
const NotFoundPage = lazyWithRetry(() => import("@/pages/NotFoundPage"));

/**
 * Routes:
 *   /                      home
 *   /games                 browse games
 *   /reset-password        password reset (link from the email)
 *   /join/:token           secure encrypted invite link landing
 *   /:game                 a game's front door (join public / create room / join with code)
 *   /:game/join/:token     alternative game-scoped invite link
 *   /:game/room            the room lobby & live match (state-based, room codes hidden from URL)
 */
function App() {
  return (
    <RealtimeProvider>
      <Suspense fallback={null}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="games" element={<GamesPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="join/:token" element={<InviteJoinPage />} />
            <Route path=":slug/join/:token" element={<InviteJoinPage />} />
            <Route path=":slug" element={<GameLobbyPage />} />
            <Route path=":slug/room" element={<RoomPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </RealtimeProvider>
  );
}

export default App;
