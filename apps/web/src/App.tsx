import { Route, Routes } from "react-router";
import { AppShell } from "@/components/AppShell";
import GameLobbyPage from "@/pages/GameLobbyPage";
import GamesPage from "@/pages/GamesPage";
import HomePage from "@/pages/HomePage";
import InviteJoinPage from "@/pages/InviteJoinPage";
import NotFoundPage from "@/pages/NotFoundPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import RoomPage from "@/pages/RoomPage";
import { RealtimeProvider } from "@/providers/RealtimeProvider";

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
    </RealtimeProvider>
  );
}

export default App;
