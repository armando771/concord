import NotifySettingsModal from './NotifySettingsModal'
import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import ServerRail from './ServerRail'
import FriendsSidebar from './FriendsSidebar'
import ServerSidebar from './ServerSidebar'
import IncomingCallModal from './call/IncomingCallModal'
import CallOverlay from './call/CallOverlay'
import BirthdayModal from './BirthdayModal'
import EmailVerifyBanner from './EmailVerifyBanner'
import ConnectionBanner from './ConnectionBanner'
import ScreenMiniPlayer from './call/ScreenMiniPlayer'
import ActivityPanel from './call/ActivityPanel'
import ScreenSharePickerModal from './call/ScreenSharePickerModal'
import ScreenQualityModal from './call/ScreenQualityModal'
import { usesNativePicker } from '../lib/displayMedia'
import JoinRequestsStack from './call/JoinRequestsStack'
import LevelUpBanner from './level/LevelUpBanner'
import BoostBanner from './level/BoostBanner'
import LevelUpScreen from './level/LevelUpScreen'
import InviteConfirmModal from './invite/InviteConfirmModal'
import LevelUpMilestone from './level/LevelUpMilestone'
import { useFlushPendingLevelUp } from './level/useScreenCelebration'
import BadgesModal from './badges/BadgesModal'
import BadgeUnlockToast from './badges/BadgeUnlockToast'
import QuickSwitcherModal from './friends/QuickSwitcherModal'
import ShortcutsModal from './ShortcutsModal'
import { useGlobalShortcuts } from './useGlobalShortcuts'
import { useInviteLinkClicks } from './invite/useInviteLinkClicks'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { useUIStore } from '../store/uiStore'
import { IS_WEB } from '../lib/config'

// Fixo durante a vida do app (a sessão Wayland/X11 não muda com ele aberto).
const nativePicker = usesNativePicker(
  IS_WEB,
  typeof window !== 'undefined' ? window.api?.screenShare?.flow : undefined
)

function AppShell(): React.JSX.Element {
  useFlushPendingLevelUp()
  useGlobalShortcuts()
  useInviteLinkClicks()
  const quickSwitcherOpen = useUIStore((s) => s.quickSwitcherOpen)
  const setQuickSwitcherOpen = useUIStore((s) => s.setQuickSwitcherOpen)
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
        <ConnectionBanner />
        <EmailVerifyBanner />
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      <IncomingCallModal />
      <JoinRequestsStack />
      <CallOverlay />
      <BirthdayModal />
      <ScreenMiniPlayer />
      <ActivityPanel />
      {/* Navegador e Linux/Wayland: o seletor de tela é o do sistema; o app só
          pergunta a qualidade antes. */}
      {!nativePicker && <ScreenSharePickerModal />}
      {nativePicker && <ScreenQualityModal />}
      <LevelUpScreen />
      <InviteConfirmModal />
      <LevelUpMilestone />

      <LevelUpBanner />
      <BoostBanner />
      <BadgeUnlockToast />
      <BadgesModal />
      <NotifySettingsModal />
      {quickSwitcherOpen && <QuickSwitcherModal open onClose={() => setQuickSwitcherOpen(false)} />}
      <ShortcutsModal />
    </div>
  )
}

export default AppShell
