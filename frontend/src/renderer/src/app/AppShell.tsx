import NotifySettingsModal from '../features/notifications/components/NotifySettingsModal'
import { Outlet, useLocation } from 'react-router-dom'
import ServerRail from '../features/servers/components/ServerRail'
import FriendsSidebar from '../features/friends/components/FriendsSidebar'
import ServerSidebar from '../features/servers/components/ServerSidebar'
import IncomingCallModal from '../features/call/components/IncomingCallModal'
import CallOverlay from '../features/call/components/CallOverlay'
import BirthdayModal from '../features/profile/components/BirthdayModal'
import EmailVerifyBanner from '../features/auth/components/EmailVerifyBanner'
import ConnectionBanner from '../shared/ui/ConnectionBanner'
import ScreenMiniPlayer from '../features/call/components/ScreenMiniPlayer'
import ActivityPanel from '../features/call/components/ActivityPanel'
import ScreenSharePrompt from '../features/call/components/ScreenSharePrompt'
import VideoBackgroundModal from '../features/call/components/VideoBackgroundModal'
import JoinRequestsStack from '../features/call/components/JoinRequestsStack'
import LevelUpBanner from '../features/levels/components/LevelUpBanner'
import BoostBanner from '../features/levels/components/BoostBanner'
import LevelUpScreen from '../features/levels/components/LevelUpScreen'
import InviteConfirmModal from '../features/servers/components/InviteConfirmModal'
import LevelUpMilestone from '../features/levels/components/LevelUpMilestone'
import { useFlushPendingLevelUp } from '../features/levels/hooks/useScreenCelebration'
import BadgesModal from '../features/levels/components/BadgesModal'
import BadgeUnlockToast from '../features/levels/components/BadgeUnlockToast'
import SegundoTurnoHost from '../features/segundoturno/components/SegundoTurnoHost'
import QuickSwitcherModal from '../features/friends/components/QuickSwitcherModal'
import ShortcutsModal from '../features/settings/components/ShortcutsModal'
import { useGlobalShortcuts } from '../features/settings/hooks/useGlobalShortcuts'
import { useInviteLinkClicks } from '../features/servers/hooks/useInviteLinkClicks'
import { useAuthStore } from '../features/auth/store/authStore'
import { useSessionConnection } from '../features/auth/hooks/useSessionConnection'
import { useUIStore } from '../shared/store/uiStore'

function AppShell(): React.JSX.Element {
  useFlushPendingLevelUp()
  useGlobalShortcuts()
  useInviteLinkClicks()
  const quickSwitcherOpen = useUIStore((s) => s.quickSwitcherOpen)
  const setQuickSwitcherOpen = useUIStore((s) => s.setQuickSwitcherOpen)
  const location = useLocation()
  const isServerPage = location.pathname.startsWith('/servers/')
  const hasToken = Boolean(useAuthStore((s) => s.accessToken))

  useSessionConnection(hasToken)

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
      <ScreenSharePrompt />
      <VideoBackgroundModal />
      <LevelUpScreen />
      <InviteConfirmModal />
      <LevelUpMilestone />

      <LevelUpBanner />
      <BoostBanner />
      <BadgeUnlockToast />
      <SegundoTurnoHost />
      <BadgesModal />
      <NotifySettingsModal />
      {quickSwitcherOpen && <QuickSwitcherModal open onClose={() => setQuickSwitcherOpen(false)} />}
      <ShortcutsModal />
    </div>
  )
}

export default AppShell
