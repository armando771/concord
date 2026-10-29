import { useLocation, useNavigate } from 'react-router-dom'
import SidebarFooter from '../../../app/SidebarFooter'
import { useNow } from '../../../shared/hooks/useNow'
import { useResizableWidth } from '../../../shared/hooks/useResizableWidth'
import ResizeHandle from '../../../shared/ui/ResizeHandle'
import { VolumeIcon } from '../../../shared/ui/icons'
import { useCallStore } from '../../call/store/callStore'
import { isConnectedTo } from '../../servers/lib/voiceChannelRow'
import { GUEST_COPY } from '../lib/guestCopy'
import { timeLeftLabel } from '../lib/guestTime'
import { visitPath, visitServerOf } from '../lib/guestVisits'
import { useVisit } from '../hooks/useGuestVisits'
import type { GuestPass } from '../api/guestInvites'
import GuestBadge from './GuestBadge'

function VisitChannelRow({ visit }: { visit: GuestPass }): React.JSX.Element {
  const navigate = useNavigate()
  const connected = useCallStore((s) => isConnectedTo(s, visit.channel_id))
  return (
    <button
      type="button"
      onClick={() => navigate(visitPath(visit.server_id))}
      aria-current="page"
      className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-md bg-fg/10 px-2 py-1.5 text-left text-ds-md font-medium text-strong transition-colors hover:bg-fg/15 focus-visible:ring-2 focus-visible:ring-brand"
    >
      <VolumeIcon className={`h-5 w-5 shrink-0 ${connected ? 'text-success' : 'text-gray-400'}`} />
      <span className="min-w-0 flex-1 truncate">{visit.channel_name}</span>
    </button>
  )
}

/**
 * A coluna da esquerda numa visita: o servidor que convidou, só o canal de voz
 * do convite (sem chats nem membros) e o rodapé de sempre (Voz conectada,
 * usuário).
 */
function GuestVisitSidebar(): React.JSX.Element {
  const visit = useVisit(visitServerOf(useLocation().pathname))
  const sidebar = useResizableWidth('channels')
  const now = useNow(30_000)

  return (
    <aside
      style={sidebar.panelStyle}
      className="relative z-10 flex h-full shrink-0 flex-col border-r border-subtle bg-secondary backdrop-blur-2xl"
    >
      <ResizeHandle {...sidebar.handleProps} />
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-subtle px-4">
        <h2 className="min-w-0 flex-1 truncate text-ds-md font-bold text-strong">
          {visit?.server_name}
        </h2>
        <GuestBadge />
      </header>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {visit && (
          <>
            <VisitChannelRow visit={visit} />
            <p className="px-2 pt-3 text-ds-xs text-gray-400">{GUEST_COPY.sidebarHint}</p>
            <p className="px-2 pt-1 text-ds-xs text-gray-300">
              {GUEST_COPY.timeLeft(timeLeftLabel(visit.expires_at, now))}
            </p>
          </>
        )}
      </div>
      <SidebarFooter />
    </aside>
  )
}

export default GuestVisitSidebar
