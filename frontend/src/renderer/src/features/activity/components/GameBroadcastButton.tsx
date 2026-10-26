import { useEffect } from 'react'
import { useCallStore } from '../../call/store/callStore'
import { notePickedSource } from '../../call/lib/windowAudio'
import { showToast } from '../../../shared/store/toastStore'
import { MonitorIcon } from '../../../shared/ui/icons'
import { broadcastTone, broadcastView, toggleGameBroadcast } from '../lib/gameBroadcast'
import { useGameBroadcastStore } from '../store/gameBroadcastStore'

/**
 * Botão de transmitir a janela do jogo em atividade na call atual, sem passar
 * pelo modal de seleção. Usa o mesmo compartilhamento de tela da chamada.
 */
function GameBroadcastButton({ game }: { game: string }): React.JSX.Element {
  const sharing = useCallStore((s) => s.isScreenSharing)
  const canStream = useCallStore((s) => s.canStream)
  const connected = useCallStore((s) => s.status === 'active')
  const broadcasting = useGameBroadcastStore((s) => s.game)
  const setBroadcasting = useGameBroadcastStore((s) => s.set)
  const view = broadcastView({ game, sharing, canStream, connected, broadcasting })

  // O compartilhamento acabou (por qualquer caminho): o estado ativo some.
  useEffect(() => {
    if (!sharing) setBroadcasting(null)
  }, [sharing, setBroadcasting])

  const onClick = (): void => {
    const call = useCallStore.getState()
    void toggleGameBroadcast({
      game,
      sharing,
      active: view.active,
      prefer: (name) => window.api!.screenShare!.preferGameWindow(name),
      notePicked: notePickedSource,
      start: call.startScreenShare,
      stop: call.stopScreenShare,
      isSharing: () => useCallStore.getState().isScreenSharing,
      remember: setBroadcasting,
      notify: showToast.error
    })
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={view.disabled}
      aria-label={view.label}
      aria-pressed={view.active}
      title={view.label}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand ${broadcastTone(view)}`}
    >
      <MonitorIcon className="h-4 w-4" />
    </button>
  )
}

export default GameBroadcastButton
