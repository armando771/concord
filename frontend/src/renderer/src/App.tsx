import { RouterProvider } from 'react-router-dom'
import router from './router'
import Background from './components/Background'
import ToastContainer from './components/ToastContainer'
import BackgroundBridge from './components/BackgroundBridge'
import UpdateNotice from './components/UpdateNotice'
import UserContextMenu from './components/UserContextMenu'

function App(): React.JSX.Element {
  return (
    <>
      <Background />
      <ToastContainer />
      <BackgroundBridge />
      <UpdateNotice />
      <UserContextMenu />
      <RouterProvider router={router} />
    </>
  )
}

export default App
