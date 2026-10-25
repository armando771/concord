import { useCallStore } from '../../store/callStore'
import {
  CameraIcon,
  CameraOffIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  HeadsetIcon,
  HeadsetOffIcon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon
} from '../icons'
import CallControlsDock from './CallControlsDock'
import CallStage from './CallStage'
import { formatDuration, useElapsed } from './callUtils'
import useSpeaking from './useSpeaking'
import Avatar from '../Avatar'

function DmCallView({ children }: { children?: React.ReactNode }): React.JSX.Element | null {
  const status = useCallStore((s) => s.status)
  const type = useCallStore((s) => s.type)
  const participants = useCallStore((s) => s.participants)
  const muted = useCallStore((s) => s.muted)
  const deafened = useCallStore((s) => s.deafened)
  const startedAt = useCallStore((s) => s.startedAt)
  const cameraOn = useCallStore((s) => s.localCameraStream !== null)
  const toggleMute = useCallStore((s) => s.toggleMute)
  const toggleDeafen = useCallStore((s) => s.toggleDeafen)
  const toggleCamera = useCallStore((s) => s.toggleCamera)
  const endCall = useCallStore((s) => s.endCall)

  // No store: a miniatura da transmissão expande a DM ao ser clicada.
  const minimized = useCallStore((s) => s.dmMinimized)
  const setMinimized = useCallStore((s) => s.setDmMinimized)

  const dmActive = type === 'dm' && status === 'active'
  const elapsed = useElapsed(dmActive ? startedAt : null)
  const speaking = useSpeaking()

  const peer = participants[0]
  if (type !== 'dm' || !peer) return null

  const connected = status === 'active'
  const statusLabel = connected ? formatDuration(elapsed) : 'Chamando...'

  if (minimized) {
    // Barrinha estilo Discord: chamada minimizada com o chat visível abaixo.
    return (
      <>
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/6 bg-[#07080b] px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar
              userId={peer.id}
              name={peer.display_name}
              avatarUrl={peer.avatar_url}
              size={32}
              animate="always"
              className={`rounded-full transition-shadow ${
                speaking.has(peer.id) ? 'ring-2 ring-[#23a55a]' : ''
              }`}
            />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold text-white">{peer.display_name}</p>
              <p className="text-[11px] text-gray-400">{statusLabel}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={toggleMute}
              aria-label={muted ? 'Ativar Microfone' : 'Silenciar Microfone'}
              title={muted ? 'Ativar Microfone' : 'Silenciar Microfone'}
              className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors ${
                muted
                  ? 'bg-white text-[#07080b]'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {muted ? <MicOffIcon className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => void toggleCamera()}
              disabled={status !== 'active'}
              aria-label={cameraOn ? 'Desligar câmera' : 'Ligar câmera'}
              title={cameraOn ? 'Desligar câmera' : 'Ligar câmera'}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                status !== 'active'
                  ? 'cursor-not-allowed bg-white/5 text-gray-500 opacity-50'
                  : cameraOn
                    ? 'cursor-pointer bg-[#23a55a] text-white hover:bg-[#1e8c4a]'
                    : 'cursor-pointer bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {cameraOn ? (
                <CameraIcon className="h-4 w-4" />
              ) : (
                <CameraOffIcon className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={toggleDeafen}
              aria-label={deafened ? 'Ativar Audio' : 'Silenciar Audio'}
              title={deafened ? 'Ativar Audio' : 'Silenciar Audio'}
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
              aria-label="Encerrar chamada"
              title="Encerrar"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#f23f43] text-white transition-colors hover:bg-[#d83a3e]"
            >
              <PhoneOffIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setMinimized(false)}
              aria-label="Expandir chamada"
              title="Expandir"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ChevronUpIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        {children}
      </>
    )
  }

  // Tela cheia estilo Discord: tiles grandes + controles na parte inferior.
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[#07080b]">
      <div className="absolute right-4 top-3 z-10 flex items-center gap-2">
        <div
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
            connected
              ? 'border border-[#23a55a]/30 bg-[#23a55a]/15 text-[#23a55a]'
              : 'bg-white/5 text-gray-300'
          }`}
        >
          {connected && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#23a55a]" />}
          {statusLabel}
        </div>
        <button
          onClick={() => setMinimized(true)}
          aria-label="Minimizar chamada"
          title="Minimizar"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <CallStage speaking={speaking} />
      </div>

      <CallControlsDock />
    </div>
  )
}

export default DmCallView
