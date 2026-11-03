import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import { AppShell } from "@/components/AppShell";
import { RealtimeProvider } from "@/providers/RealtimeProvider";

const HomePage = lazy(() => import("@/pages/HomePage"));
const GamesPage = lazy(() => import("@/pages/GamesPage"));
const GameLobbyPage = lazy(() => import("@/pages/GameLobbyPage"));
const RoomPage = lazy(() => import("@/pages/RoomPage"));
const InviteJoinPage = lazy(() => import("@/pages/InviteJoinPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

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
