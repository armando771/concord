import { useCallStore } from '../../store/callStore'
import {
  CameraIcon,
  CameraOffIcon,
  HeadsetIcon,
  HeadsetOffIcon,
  MicIcon,
  MicOffIcon,
  MonitorIcon,
  PhoneOffIcon
} from '../icons'

function VoiceControls(): React.JSX.Element {
  const muted = useCallStore((s) => s.muted)
  const deafened = useCallStore((s) => s.deafened)
  const sharing = useCallStore((s) => s.isScreenSharing)
  const connected = useCallStore((s) => s.status === 'active')
  const cameraOn = useCallStore((s) => s.localCameraStream !== null)
  const toggleMute = useCallStore((s) => s.toggleMute)
  const toggleDeafen = useCallStore((s) => s.toggleDeafen)
  const toggleCamera = useCallStore((s) => s.toggleCamera)
  const startScreenShare = useCallStore((s) => s.startScreenShare)
  const stopScreenShare = useCallStore((s) => s.stopScreenShare)
  const endCall = useCallStore((s) => s.endCall)

  const handleToggleScreen = (): void => {
    if (sharing) {
      stopScreenShare()
    } else {
      void startScreenShare()
    }
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0b0c10]/95 p-1.5 shadow-2xl backdrop-blur-xl">
      <button
        onClick={toggleMute}
        aria-label={muted ? 'Ativar microfone' : 'Silenciar microfone'}
        title={muted ? 'Ativar microfone' : 'Silenciar microfone'}
        className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors ${
          muted ? 'bg-white text-[#07080b]' : 'bg-white/5 text-gray-200 hover:bg-white/10'
        }`}
      >
        {muted ? <MicOffIcon className="h-5 w-5" /> : <MicIcon className="h-5 w-5" />}
      </button>
      <button
        onClick={toggleDeafen}
        aria-label={deafened ? 'Desativar surdez' : 'Ficar surdo'}
        title={deafened ? 'Desativar surdez' : 'Ficar surdo'}
        className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors ${
          deafened ? 'bg-white text-[#07080b]' : 'bg-white/5 text-gray-200 hover:bg-white/10'
        }`}
      >
        {deafened ? <HeadsetOffIcon className="h-5 w-5" /> : <HeadsetIcon className="h-5 w-5" />}
      </button>
      <button
        onClick={() => void toggleCamera()}
        disabled={!connected}
        aria-label={cameraOn ? 'Desligar câmera' : 'Ligar câmera'}
        title={cameraOn ? 'Desligar câmera' : 'Ligar câmera'}
        className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
          !connected
            ? 'cursor-not-allowed bg-white/5 text-gray-500 opacity-50'
            : cameraOn
              ? 'cursor-pointer bg-[#23a55a] text-white hover:bg-[#1e8c4a]'
              : 'cursor-pointer bg-white/5 text-gray-200 hover:bg-white/10'
        }`}
      >
        {cameraOn ? <CameraIcon className="h-5 w-5" /> : <CameraOffIcon className="h-5 w-5" />}
      </button>
      <button
        onClick={handleToggleScreen}
        disabled={!connected}
        aria-label={sharing ? 'Parar de compartilhar tela' : 'Compartilhar tela'}
        title={sharing ? 'Parar de compartilhar' : 'Compartilhar tela'}
        className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
          !connected
            ? 'cursor-not-allowed bg-white/5 text-gray-500 opacity-50'
            : sharing
              ? 'cursor-pointer bg-[#23a55a] text-white hover:bg-[#1e8c4a]'
              : 'cursor-pointer bg-white/5 text-gray-200 hover:bg-white/10'
        }`}
      >
        <MonitorIcon className="h-5 w-5" />
      </button>
      <button
        onClick={endCall}
        aria-label="Desconectar"
        title="Desconectar"
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#f23f43] text-white transition-colors hover:bg-[#d83a3e]"
      >
        <PhoneOffIcon className="h-5 w-5" />
      </button>
    </div>
  )
}

export default VoiceControls
