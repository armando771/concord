import { useCallStore } from '../../store/callStore'
import { useServerStore } from '../../store/serverStore'
import { HeadsetIcon, HeadsetOffIcon, MicIcon, MicOffIcon, PhoneOffIcon } from '../icons'

/**
 * Painel "Voz conectada" (estilo Discord) exibido acima do card do usuário
 * nas sidebars enquanto houver chamada ativa — canal de voz ou DM.
 */
function VoiceConnectedPanel(): React.JSX.Element | null {
  const status = useCallStore((s) => s.status)
  const type = useCallStore((s) => s.type)
  const channelId = useCallStore((s) => s.channelId)
  const peer = useCallStore((s) => s.participants[0] ?? null)
  const muted = useCallStore((s) => s.muted)
  const deafened = useCallStore((s) => s.deafened)
  const toggleMute = useCallStore((s) => s.toggleMute)
  const toggleDeafen = useCallStore((s) => s.toggleDeafen)
  const endCall = useCallStore((s) => s.endCall)

  const channels = useServerStore((s) => s.channels)

  if (status === 'idle') return null

  const title =
    type === 'channel'
      ? `#${channels.find((c) => c.id === channelId)?.name ?? 'canal'}`
      : (peer?.display_name ?? 'Chamada')

  return (
    <div className="shrink-0 border-t border-white/6 bg-[#07080b]/90 px-2 py-2">
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#23a55a]" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-xs font-bold text-[#23a55a]">{title}</p>
            <p className="text-[10px] text-gray-400">Voz conectada</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={toggleMute}
            aria-label={muted ? 'Ativar microfone' : 'Silenciar microfone'}
            title={muted ? 'Ativar microfone' : 'Silenciar microfone'}
            className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors ${
              muted
                ? 'bg-white text-[#07080b]'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            {muted ? <MicOffIcon className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
          </button>
          <button
            onClick={toggleDeafen}
            aria-label={deafened ? 'Desativar surdez' : 'Ficar surdo'}
            title={deafened ? 'Desativar surdez' : 'Ficar surdo'}
            className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors ${
              deafened
                ? 'bg-white text-[#07080b]'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            {deafened ? (
              <HeadsetOffIcon className="h-4 w-4" />
            ) : (
              <HeadsetIcon className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={endCall}
            aria-label="Desconectar da voz"
            title="Desconectar"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#f23f43] text-white transition-colors hover:bg-[#d83a3e]"
          >
            <PhoneOffIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default VoiceConnectedPanel
