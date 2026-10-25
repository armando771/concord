import { createBrowserRouter, createHashRouter, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Friends from './pages/Friends'
import ServerView from './pages/ServerView'
import DmChat from './pages/DmChat'
import GroupChat from './pages/GroupChat'
import Invites from './pages/Invites'
import Login from './pages/Login'
import Register from './pages/Register'
import RequireAuth from './components/RequireAuth'
import RedirectIfAuthed from './components/RedirectIfAuthed'
import AppShell from './components/AppShell'
import { IS_WEB } from './lib/config'

// Desktop carrega de file:// e precisa do hash (#/rota). No navegador as rotas
// são caminhos de verdade: o Caddy devolve o index.html para qualquer rota
// (try_files), então recarregar em /servers/… continua no mesmo lugar.
const createRouter = IS_WEB ? createBrowserRouter : createHashRouter

export const router = createRouter([
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: 'friends', element: <Friends /> },
      { path: 'invites', element: <Invites /> },
      { path: 'dm/:userId', element: <DmChat /> },
      { path: 'dm/c/:conversationId', element: <GroupChat /> },
      { path: 'servers/:id', element: <ServerView /> },
      { path: 'servers/:id/channels/:channelId', element: <ServerView /> }
    ]
  },
  {
    path: '/login',
    element: (
      <RedirectIfAuthed>
        <Login />
      </RedirectIfAuthed>
    )
  },
  {
    path: '/register',
    element: (
      <RedirectIfAuthed>
        <Register />
      </RedirectIfAuthed>
    )
  },
  {
    path: '*',
    element: <Navigate to="/" replace />
  }
])

export default router
