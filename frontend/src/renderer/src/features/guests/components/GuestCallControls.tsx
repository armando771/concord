import { useCallStore } from '../../call/store/callStore'
import {
  CameraIcon,
  CameraOffIcon,
  HeadsetIcon,
  HeadsetOffIcon,
  MicIcon,
  MicOffIcon,
  MonitorIcon,
  PhoneOffIcon,
  SlidersIcon
} from '../../../shared/ui/icons'
import { GUEST_COPY } from '../lib/guestCopy'

function ControlButton({
  label,
  active = false,
  danger = false,
  disabled = false,
  onClick,
  children
}: {
  label: string
  active?: boolean
  danger?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  const tone = danger
    ? 'bg-danger text-white hover:bg-danger/80'
    : active
      ? 'bg-fg/20 text-strong'
      : 'bg-secondary text-gray-200 hover:bg-fg/10'
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={danger ? undefined : active}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-subtle shadow-lg transition-colors focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-40 ${tone}`}
    >
      {children}
    </button>
  )
}

/**
 * Os controles do visitante: microfone, fone, câmera e tela (travados pelo
 * que o convite deu — o servidor é quem impede de verdade), volumes e sair.
 */
function GuestCallControls({ onVolumes }: { onVolumes: () => void }): React.JSX.Element {
  const muted = useCallStore((s) => s.muted)
  const deafened = useCallStore((s) => s.deafened)
  const canSpeak = useCallStore((s) => s.canSpeak)
  const canStream = useCallStore((s) => s.canStream)
  const cameraOn = useCallStore((s) => s.localCameraStream !== null)
  const sharing = useCallStore((s) => s.isScreenSharing)
  const call = useCallStore.getState

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 px-3 pb-4 pt-2">
      <ControlButton
        label={muted ? 'Ativar microfone' : 'Silenciar microfone'}
        active={muted}
        disabled={!canSpeak}
        onClick={() => call().toggleMute()}
      >
        {muted ? <MicOffIcon className="h-5 w-5" /> : <MicIcon className="h-5 w-5" />}
      </ControlButton>
      <ControlButton
        label={deafened ? 'Ativar áudio' : 'Desativar áudio'}
        active={deafened}
        onClick={() => call().toggleDeafen()}
      >
        {deafened ? <HeadsetOffIcon className="h-5 w-5" /> : <HeadsetIcon className="h-5 w-5" />}
      </ControlButton>
      <ControlButton
        label={cameraOn ? 'Desligar câmera' : 'Ligar câmera'}
        active={cameraOn}
        disabled={!canStream}
        onClick={() => void call().toggleCamera({ skipPreview: true })}
      >
        {cameraOn ? <CameraIcon className="h-5 w-5" /> : <CameraOffIcon className="h-5 w-5" />}
      </ControlButton>
      <ControlButton
        label={sharing ? 'Parar transmissão' : 'Transmitir tela'}
        active={sharing}
        disabled={!canStream}
        onClick={() => (sharing ? call().stopScreenShare() : void call().startScreenShare())}
      >
        <MonitorIcon className="h-5 w-5" />
      </ControlButton>
      <ControlButton label={GUEST_COPY.volumes} onClick={onVolumes}>
        <SlidersIcon className="h-5 w-5" />
      </ControlButton>
      <ControlButton label={GUEST_COPY.leave} danger onClick={() => call().endCall()}>
        <PhoneOffIcon className="h-5 w-5" />
      </ControlButton>
    </div>
  )
}

export default GuestCallControls
