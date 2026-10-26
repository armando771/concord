import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../auth/store/authStore'
import { useFriendStore } from '../store/friendStore'
import { useUIStore, type FriendsTab } from '../../../shared/store/uiStore'
import { useChatStore } from '../../chat/store/chatStore'
import ActiveNow from '../components/ActiveNow'
import { FriendsHeader, SearchBox, useTabCounts } from '../components/FriendsTabs'
import { TAB_BODIES } from '../components/FriendsTabBodies'
import { MAIN_BG } from '../components/PersonRow'
import { parseFriendsTab, tabHasSearch } from '../lib/friendsTabs'

function Friends(): React.JSX.Element {
  const me = useAuthStore((s) => s.user)
  const friends = useFriendStore((s) => s.friends)
  const loadAll = useFriendStore((s) => s.loadAll)
  const fetchPresenceFor = useChatStore((s) => s.fetchPresenceFor)
  const tab = useUIStore((s) => s.friendsTab)
  const setFriendsTab = useUIStore((s) => s.setFriendsTab)
  const [searchParams, setSearchParams] = useSearchParams()
  const [filterText, setFilterText] = useState('')
  const counts = useTabCounts()
  const Body = TAB_BODIES[tab]

  const setTab = (next: FriendsTab): void => {
    setFriendsTab(next)
    setFilterText('')
  }

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Notificação de pedido abre direto em Pendente (/friends?tab=pending).
  useEffect(() => {
    const wanted = parseFriendsTab(searchParams.get('tab'))
    if (wanted) {
      setFriendsTab(wanted)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams, setFriendsTab])

  useEffect(() => {
    if (friends.length > 0) fetchPresenceFor(friends.map((f) => f.id))
  }, [friends, fetchPresenceFor])

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col" style={{ background: MAIN_BG }}>
      <FriendsHeader tab={tab} onTab={setTab} counts={counts} />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto px-4 pt-4 pb-6 sm:px-6">
          {tabHasSearch(tab) && <SearchBox value={filterText} onChange={setFilterText} />}
          <Body filterText={filterText} />
        </div>
        {me && <ActiveNow friends={friends} />}
      </div>
    </div>
  )
}

export default Friends
