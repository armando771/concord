import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { InboxIcon, DiamondIcon, PlusIcon } from '../../../shared/ui/icons'
import { useServerStore } from '../store/serverStore'
import { useInviteStore } from '../store/inviteStore'
import { useServerRailSync } from '../hooks/useServerRailSync'
import { useRailBadges } from '../hooks/useRailBadges'
import { isHomePath } from '../lib/railHome'
import { RailHomeButton, RailNavButton } from './ServerRailButtons'
import ServerRailList from './ServerRailList'
import CreateServerModal from './CreateServerModal'

function ServerRail(): React.JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const clearCurrentServer = useServerStore((s) => s.clearCurrentServer)
  const invitesCount = useInviteStore((s) => s.invites.length)
  const [createModalOpen, setCreateModalOpen] = useState(false)

  useServerRailSync()
  const onInvites = location.pathname === '/invites'
  const onProposals = location.pathname === '/proposals'
  const { dmUnread, proposalsBadge } = useRailBadges(onProposals)

  const goTo = (path: string): void => {
    clearCurrentServer()
    navigate(path)
  }

  return (
    <>
      <aside className="group/rail flex h-full w-18 shrink-0 flex-col items-center gap-2 border-r border-subtle bg-tertiary py-3 backdrop-blur-2xl">
        <RailHomeButton
          isHome={isHomePath(location.pathname)}
          unread={dmUnread}
          onClick={clearCurrentServer}
        />

        <div className="my-1 h-0.5 w-8 rounded-full bg-fg/10" />

        <RailNavButton
          label="Convites de servidor"
          active={onInvites}
          badge={invitesCount}
          icon={(cls) => <InboxIcon className={cls} />}
          onClick={() => goTo('/invites')}
        />

        {/* Quadro de propostas (kanban com votação) */}
        <RailNavButton
          label="Propostas de melhoria"
          active={onProposals}
          badge={proposalsBadge}
          icon={(cls) => <DiamondIcon className={cls} />}
          onClick={() => goTo('/proposals')}
        />

        <ServerRailList />

        {/* Add Server Button */}
        <div className="group/btn relative flex items-center justify-center">
          <button
            onClick={() => setCreateModalOpen(true)}
            title="Adicionar um servidor"
            aria-label="Adicionar servidor"
            className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-3xl border border-subtle bg-surface text-discord-green transition-all duration-200 hover:rounded-2xl hover:bg-discord-green hover:text-white hover:shadow-lg hover:shadow-discord-green/25"
          >
            <PlusIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1" />
      </aside>

      <CreateServerModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
    </>
  )
}

export default ServerRail
