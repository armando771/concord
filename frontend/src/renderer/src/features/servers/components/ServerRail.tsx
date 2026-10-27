import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { DiamondIcon, PlusIcon } from '../../../shared/ui/icons'
import { useServerStore } from '../store/serverStore'
import { useServerRailSync } from '../hooks/useServerRailSync'
import { useRailBadges } from '../hooks/useRailBadges'
import { isHomePath } from '../lib/railHome'
import { useBotaoSegundoTurno } from '../../segundoturno/hooks/useBotaoSegundoTurno'
import SegundoTurnoIcone from '../../segundoturno/components/SegundoTurnoIcone'
import { RailHomeButton, RailNavButton } from './ServerRailButtons'
import ServerRailList from './ServerRailList'
import CreateServerModal from './CreateServerModal'

function ServerRail(): React.JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const clearCurrentServer = useServerStore((s) => s.clearCurrentServer)
  const [createModalOpen, setCreateModalOpen] = useState(false)

  useServerRailSync()
  const onProposals = location.pathname === '/proposals'
  const { dmUnread, proposalsBadge } = useRailBadges(onProposals)
  const segundoTurno = useBotaoSegundoTurno()

  const goTo = (path: string): void => {
    clearCurrentServer()
    navigate(path)
  }

  return (
    <>
      <aside className="group/rail flex h-full w-18 shrink-0 flex-col items-center gap-2 border-r border-subtle bg-tertiary py-3 backdrop-blur-2xl">
        {/* Início: Mensagens Diretas, Amigos e convites de servidor */}
        <RailHomeButton
          isHome={isHomePath(location.pathname)}
          unread={dmUnread}
          onClick={clearCurrentServer}
        />

        <div className="my-1 h-0.5 w-8 rounded-full bg-fg/10" />

        {/* Quadro de propostas (kanban com votação) */}
        <RailNavButton
          label="Propostas de melhoria"
          active={onProposals}
          badge={proposalsBadge}
          icon={(cls) => <DiamondIcon className={cls} />}
          onClick={() => goTo('/proposals')}
        />

        {/* Banner do segundo turno dispensado: o botão reabre */}
        {segundoTurno.visivel && (
          <RailNavButton
            label="Você fez o L no segundo turno?"
            active={false}
            badge={1}
            icon={(cls) => <SegundoTurnoIcone className={cls} />}
            onClick={segundoTurno.reabrir}
          />
        )}

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
