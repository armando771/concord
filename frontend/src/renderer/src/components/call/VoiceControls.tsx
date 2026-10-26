import { useCallback, useState } from 'react'
import { useCallStore } from '../../store/callStore'
import { useActivityStore } from '../../store/activityStore'
import {
  ActivityIcon,
  CameraIcon,
  CameraOffIcon,
  HeadsetIcon,
  HeadsetOffIcon,
  LockIcon,
  LockOpenIcon,
  MicIcon,
  MicOffIcon,
  MonitorIcon,
  PhoneOffIcon,
  SoundboardIcon
} from '../icons'
import SoundboardPopover from './SoundboardPopover'
import ActivityPickerPopover from './ActivityPickerPopover'
import ScreenQualityPopover from './ScreenQualityPopover'

function VoiceControls(): React.JSX.Element {
  const muted = useCallStore((s) => s.muted)
  const deafened = useCallStore((s) => s.deafened)
  const sharing = useCallStore((s) => s.isScreenSharing)
  const connected = useCallStore((s) => s.status === 'active')
  const canSpeak = useCallStore((s) => s.canSpeak)
  const canStream = useCallStore((s) => s.canStream)
  const callType = useCallStore((s) => s.type)
  const cameraOn = useCallStore((s) => s.localCameraStream !== null)
  const locked = useCallStore((s) => s.locked)
  const toggleLock = useCallStore((s) => s.toggleLock)
  const toggleMute = useCallStore((s) => s.toggleMute)
  const toggleDeafen = useCallStore((s) => s.toggleDeafen)
  const toggleCamera = useCallStore((s) => s.toggleCamera)
  const startScreenShare = useCallStore((s) => s.startScreenShare)
  const stopScreenShare = useCallStore((s) => s.stopScreenShare)
  const endCall = useCallStore((s) => s.endCall)

  const [soundboardAnchor, setSoundboardAnchor] = useState<HTMLElement | null>(null)
  const soundboardOpen = soundboardAnchor !== null
  const closeSoundboard = useCallback(() => setSoundboardAnchor(null), [])
  const [activityAnchor, setActivityAnchor] = useState<HTMLElement | null>(null)
  const activityOpen = activityAnchor !== null
  const closeActivities = useCallback(() => setActivityAnchor(null), [])
  const activityRunning = useActivityStore((s) => s.shared !== null || s.local !== null)

  const handleToggleScreen = (): void => {
    if (sharing) {
      stopScreenShare()
    } else {
      void startScreenShare()
    }
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-subtle bg-secondary p-1.5 shadow-2xl backdrop-blur-xl">
      <button
        onClick={toggleMute}
        aria-label={muted ? 'Ativar Microfone' : 'Silenciar Microfone'}
        title={
          !canSpeak
            ? 'Você não pode falar neste canal'
            : muted
              ? 'Ativar Microfone'
              : 'Silenciar Microfone'
        }
        className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors ${
          muted ? 'bg-white text-black' : 'bg-fg/5 text-gray-200 hover:bg-fg/10'
        } ${canSpeak ? '' : 'opacity-50'}`}
      >
        {muted ? <MicOffIcon className="h-5 w-5" /> : <MicIcon className="h-5 w-5" />}
      </button>
      <button
        onClick={toggleDeafen}
        aria-label={deafened ? 'Ativar Audio' : 'Silenciar Audio'}
        title={deafened ? 'Ativar Audio' : 'Silenciar Audio'}
        className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors ${
          deafened ? 'bg-white text-black' : 'bg-fg/5 text-gray-200 hover:bg-fg/10'
        }`}
      >
        {deafened ? <HeadsetOffIcon className="h-5 w-5" /> : <HeadsetIcon className="h-5 w-5" />}
      </button>
      <button
        onClick={() => void toggleCamera()}
        disabled={!connected || (!canStream && !cameraOn)}
        aria-label={cameraOn ? 'Desligar câmera' : 'Ligar câmera'}
        title={
          !canStream && !cameraOn
            ? 'Você não pode transmitir neste canal'
            : cameraOn
              ? 'Desligar câmera'
              : 'Ligar câmera'
        }
        className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
          !connected || (!canStream && !cameraOn)
            ? 'cursor-not-allowed bg-fg/5 text-gray-500 opacity-50'
            : cameraOn
              ? 'cursor-pointer bg-success-strong text-white hover:bg-success-strong-hover'
              : 'cursor-pointer bg-fg/5 text-gray-200 hover:bg-fg/10'
        }`}
      >
        {cameraOn ? <CameraIcon className="h-5 w-5" /> : <CameraOffIcon className="h-5 w-5" />}
      </button>
      <ScreenQualityPopover disabled={!connected}>
        <button
          onClick={handleToggleScreen}
          disabled={!connected || (!canStream && !sharing)}
          aria-label={sharing ? 'Parar de compartilhar tela' : 'Compartilhar tela'}
          title={
            !canStream && !sharing
              ? 'Você não pode transmitir neste canal'
              : sharing
                ? undefined
                : 'Compartilhar tela'
          }
          className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
            !connected || (!canStream && !sharing)
              ? 'cursor-not-allowed bg-fg/5 text-gray-500 opacity-50'
              : sharing
                ? 'cursor-pointer bg-success-strong text-white hover:bg-success-strong-hover'
                : 'cursor-pointer bg-fg/5 text-gray-200 hover:bg-fg/10'
          }`}
        >
          <MonitorIcon className="h-5 w-5" />
        </button>
      </ScreenQualityPopover>
      {callType === 'channel' && (
        <button
          onClick={toggleLock}
          disabled={!connected}
          aria-label={locked ? 'Destrancar sala' : 'Trancar sala'}
          title={locked ? 'Destrancar sala' : 'Trancar sala (pedir permissão para entrar)'}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
            !connected
              ? 'cursor-not-allowed bg-fg/5 text-gray-500 opacity-50'
              : locked
                ? 'cursor-pointer bg-amber-500 text-black shadow-sm hover:bg-amber-400'
                : 'cursor-pointer bg-fg/5 text-gray-200 hover:bg-fg/10'
          }`}
        >
          {locked ? <LockIcon className="h-5 w-5" /> : <LockOpenIcon className="h-5 w-5" />}
        </button>
      )}
      {callType === 'channel' && (
        <button
          onClick={(e) => {
            const button = e.currentTarget
            setSoundboardAnchor((open) => (open ? null : button))
          }}
          disabled={!connected}
          aria-label="Mesa de Áudio"
          aria-expanded={soundboardOpen}
          title="Mesa de Áudio"
          className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
            !connected
              ? 'cursor-not-allowed bg-fg/5 text-gray-500 opacity-50'
              : soundboardOpen
                ? 'cursor-pointer bg-brand text-white'
                : 'cursor-pointer bg-fg/5 text-gray-200 hover:bg-fg/10'
          }`}
        >
          <SoundboardIcon className="h-5 w-5" />
        </button>
      )}
      <button
        onClick={(e) => {
          const button = e.currentTarget
          setActivityAnchor((open) => (open ? null : button))
        }}
        disabled={!connected}
        aria-label="Atividades"
        aria-expanded={activityOpen}
        title="Atividades"
        className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
          !connected
            ? 'cursor-not-allowed bg-fg/5 text-gray-500 opacity-50'
            : activityOpen
              ? 'cursor-pointer bg-brand text-white'
              : activityRunning
                ? 'cursor-pointer bg-brand/25 text-strong hover:bg-brand/40'
                : 'cursor-pointer bg-fg/5 text-gray-200 hover:bg-fg/10'
        }`}
      >
        <ActivityIcon className="h-5 w-5" />
      </button>
      <button
        onClick={endCall}
        aria-label="Desconectar"
        title="Desconectar"
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-danger-strong text-white transition-colors hover:bg-danger-strong-hover"
      >
        <PhoneOffIcon className="h-5 w-5" />
      </button>
      {soundboardAnchor && (
        <SoundboardPopover anchor={soundboardAnchor} onClose={closeSoundboard} />
      )}
      {activityAnchor && (
        <ActivityPickerPopover anchor={activityAnchor} onClose={closeActivities} />
      )}
    </div>
  )
}

export default VoiceControls
