import { Route, Routes } from 'react-router'
import { AppShell } from '@/components/AppShell'
import GameLobbyPage from '@/pages/GameLobbyPage'
import GamesPage from '@/pages/GamesPage'
import HomePage from '@/pages/HomePage'
import NotFoundPage from '@/pages/NotFoundPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import RoomPage from '@/pages/RoomPage'
import { RealtimeProvider } from '@/providers/RealtimeProvider'

/**
 * Routes:
 *   /                      home
 *   /games                 browse games
 *   /reset-password        password reset (link from the email)
 *   /:game                 a game's front door (join public / create room)
 *   /:game/room/:code      the room lobby; also the game itself once started
 * Static routes win over /:game, which is why game slugs may not be "games" or "reset-password".
 */
function App() {
  return (
    <RealtimeProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="games" element={<GamesPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path=":slug" element={<GameLobbyPage />} />
          <Route path=":slug/room/:code" element={<RoomPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </RealtimeProvider>
  )
}

export default App
