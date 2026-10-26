import { useEffect } from 'react'
import { useCallStore } from '../../call/store/callStore'
import { notePickedSource } from '../../call/lib/windowAudio'
import { showToast } from '../../../shared/store/toastStore'
import { MonitorIcon } from '../../../shared/ui/icons'
import { toggleGameBroadcast } from '../lib/gameBroadcast'
import { useGameBroadcastStore } from '../store/gameBroadcastStore'

/** O desktop sabe achar a janela do jogo (Electron no Windows). */
export function canBroadcastGame(): boolean {
  return typeof window !== 'undefined' && !!window.api?.screenShare?.preferGameWindow
}

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
  const active = sharing && broadcasting === game

  // O compartilhamento acabou (por qualquer caminho): o estado ativo some.
  useEffect(() => {
    if (!sharing && broadcasting) setBroadcasting(null)
  }, [sharing, broadcasting, setBroadcasting])

  const disabled = !connected || (!canStream && !sharing)
  const label = active ? `Parar de transmitir ${game}` : `Transmitir ${game}`

  const onClick = (): void => {
    const call = useCallStore.getState()
    void toggleGameBroadcast({
      game,
      sharing,
      active,
      prefer: (name) => window.api!.screenShare!.preferGameWindow(name),
      notePicked: notePickedSource,
      start: call.startScreenShare,
      stop: call.stopScreenShare,
      isSharing: () => useCallStore.getState().isScreenSharing,
      remember: setBroadcasting,
      notify: (message) => showToast.error(message)
    })
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand ${
        disabled
          ? 'cursor-not-allowed bg-fg/5 text-gray-600'
          : active
            ? 'cursor-pointer bg-success-strong text-white hover:bg-success-strong-hover'
            : 'cursor-pointer bg-fg/6 text-gray-200 hover:bg-fg/12 hover:text-strong'
      }`}
    >
      <MonitorIcon className="h-4 w-4" />
    </button>
  )
}

export default GameBroadcastButton
