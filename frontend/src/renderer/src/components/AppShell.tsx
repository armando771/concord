import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import ServerRail from './ServerRail'
import FriendsSidebar from './FriendsSidebar'
import ServerSidebar from './ServerSidebar'
import IncomingCallModal from './call/IncomingCallModal'
import CallOverlay from './call/CallOverlay'
import ScreenMiniPlayer from './call/ScreenMiniPlayer'
import ScreenSharePickerModal from './call/ScreenSharePickerModal'
import LevelUpBanner from './level/LevelUpBanner'
import LevelUpScreen from './level/LevelUpScreen'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'

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
      <main className="min-w-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
      <IncomingCallModal />
      <CallOverlay />
      <ScreenMiniPlayer />
      <ScreenSharePickerModal />
      <LevelUpScreen />
      <LevelUpBanner />
    </div>
  )
}

export default AppShell
