import { RouterProvider } from 'react-router-dom'
import router from './router'
import Background from './components/Background'
import ToastContainer from './components/ToastContainer'
import BackgroundBridge from './components/BackgroundBridge'
import OverlayBridge from './components/OverlayBridge'
import UpdateNotice from './components/UpdateNotice'
import UpdateCallBridge from './components/UpdateCallBridge'
import UserContextMenu from './components/UserContextMenu'
import UserProfileCard from './components/UserProfileCard'
import FriendActionsHost from './components/friends/FriendActionsHost'
import SettingsScreen from './components/settings/SettingsScreen'
import ServerSettingsScreen from './components/serverSettings/ServerSettingsScreen'
import ModerationHost from './components/ModerationHost'
import TitleBar from './components/TitleBar'
import WebNotificationBridge from './components/WebNotificationBridge'
import WebLeaveGuard from './components/WebLeaveGuard'
import { IS_WEB } from './lib/config'
import { currentPlatform, hasCustomTitleBar } from './lib/titleBar'

const customTitleBar = hasCustomTitleBar(currentPlatform())

function App(): React.JSX.Element {
  return (
    <>
      <Background />
      <ToastContainer />
      {IS_WEB ? (
        <>
          <WebNotificationBridge />
          <WebLeaveGuard />
        </>
      ) : (
        <>
          {/* Só no Electron: bandeja, overlay de jogo e atualizações. */}
          <BackgroundBridge />
          <OverlayBridge />
          <UpdateNotice />
          <UpdateCallBridge />
        </>
      )}
      <UserContextMenu />
      <UserProfileCard />
      <FriendActionsHost />
      <SettingsScreen />
      <ServerSettingsScreen />
      <ModerationHost />
      {customTitleBar ? (
        <div className="flex h-full flex-col">
          <TitleBar />
          <div className="relative min-h-0 flex-1">
            <RouterProvider router={router} />
          </div>
        </div>
      ) : (
        <RouterProvider router={router} />
      )}
    </>
  )
}

export default App
