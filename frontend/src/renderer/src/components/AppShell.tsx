import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import ServerRail from './ServerRail'
import FriendsSidebar from './FriendsSidebar'
import ServerSidebar from './ServerSidebar'
import IncomingCallModal from './call/IncomingCallModal'
import CallOverlay from './call/CallOverlay'
import BirthdayModal from './BirthdayModal'
import EmailVerifyBanner from './EmailVerifyBanner'
import ScreenMiniPlayer from './call/ScreenMiniPlayer'
import ScreenSharePickerModal from './call/ScreenSharePickerModal'
import LevelUpBanner from './level/LevelUpBanner'
import BoostBanner from './level/BoostBanner'
import LevelUpScreen from './level/LevelUpScreen'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { IS_WEB } from '../lib/config'

function AppShell(): React.JSX.Element {
  const location = useLocation()
  const isServerPage = location.pathname.startsWith('/servers/')
  const hasToken = Boolean(useAuthStore((s) => s.accessToken))

  useEffect(() => {
    if (hasToken) {
      useChatStore.getState().connect()
    }
    return () => {
      useChatStore.getState().disconnect()
    }
  }, [hasToken])

  return (
    <div className="flex h-full">
      <ServerRail />
      {isServerPage ? <ServerSidebar /> : <FriendsSidebar />}
      <div className="flex min-w-0 flex-1 flex-col">
        <EmailVerifyBanner />
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      <IncomingCallModal />
      <CallOverlay />
      <BirthdayModal />
      <ScreenMiniPlayer />
      {/* No navegador o seletor de tela é o do próprio navegador. */}
      {!IS_WEB && <ScreenSharePickerModal />}
      <LevelUpScreen />

      <LevelUpBanner />
      <BoostBanner />
    </div>
  )
}

export default AppShell
