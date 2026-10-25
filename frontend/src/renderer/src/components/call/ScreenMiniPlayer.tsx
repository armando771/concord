import { useNavigate } from 'react-router-dom'
import { useCallStore } from '../../store/callStore'
import { miniPlayerTarget } from '../../lib/screenWatch'
import { XIcon } from '../icons'
import { VideoFill } from './ParticipantTile'
import { callRoute } from './callUtils'

/**
 * Transmissão assistida fora da tela da call (outro canal, servidor, DM ou
 * DM minimizada): miniatura no canto que continua passando. O som segue no
 * CallOverlay. Clicar volta à call com a transmissão em destaque.
 */
function ScreenMiniPlayer(): React.JSX.Element | null {
  const navigate = useNavigate()
  const status = useCallStore((s) => s.status)
  const type = useCallStore((s) => s.type)
  const serverId = useCallStore((s) => s.serverId)
  const channelId = useCallStore((s) => s.channelId)
  const participants = useCallStore((s) => s.participants)
  const mediaPeers = useCallStore((s) => s.mediaPeers)
  const stageVisible = useCallStore((s) => s.stageVisible)
  const watchedScreenIds = useCallStore((s) => s.watchedScreenIds)
  const focusedScreenUserId = useCallStore((s) => s.focusedScreenUserId)
  const screenStreams = useCallStore((s) => s.screenStreams)
  const focusWatchedScreen = useCallStore((s) => s.focusWatchedScreen)
  const stopWatchingScreen = useCallStore((s) => s.stopWatchingScreen)

  const id = miniPlayerTarget(watchedScreenIds, focusedScreenUserId, screenStreams)
  if (status !== 'active' || stageVisible || !id) return null

  const name = participants.find((p) => p.id === id)?.display_name || mediaPeers[id] || 'Usuário'

  const handleOpen = (): void => {
    focusWatchedScreen(id)
    const route = callRoute({ type, serverId, channelId, peerId: participants[0]?.id ?? null })
    if (route) navigate(route)
  }

  return (
    <div
      onClick={handleOpen}
      role="button"
      title="Voltar para a chamada"
      className="fixed bottom-24 right-4 z-40 aspect-video w-72 cursor-pointer overflow-hidden rounded-2xl bg-black shadow-xl ring-2 ring-[#23a55a]"
    >
      <VideoFill stream={screenStreams[id]} fit="contain" />
      <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-[#f23f43] px-1.5 py-0.5">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-white">Ao vivo</span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          stopWatchingScreen(id)
        }}
        aria-label="Fechar transmissão"
        title="Fechar transmissão"
        className="absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-black/60 text-gray-200 backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
      <div className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] rounded-md bg-black/60 px-2 py-1 backdrop-blur-sm">
        <span className="block truncate text-xs font-semibold text-white">{name}</span>
      </div>
    </div>
  )
}

export default ScreenMiniPlayer
