// Chamada e mídia: microfone, fone, câmera, tela, telefone, volume, player e mesa de áudio.
import { Icon, LineIcon, SlashedIcon, type IconProps } from './Icon'

const MIC = (
  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
)
const HEADSET = (
  <path d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z" />
)
const CAMERA = (
  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
)
const VOLUME = (
  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
)
/** Barras de voz (altura de cada onda). */
const VOICE_BARS = (
  <>
    <rect x="2.75" y="9" width="2.5" height="6" rx="1.25" />
    <rect x="6.75" y="6" width="2.5" height="12" rx="1.25" />
    <rect x="10.75" y="3" width="2.5" height="18" rx="1.25" />
    <rect x="14.75" y="7" width="2.5" height="10" rx="1.25" />
    <rect x="18.75" y="9.5" width="2.5" height="5" rx="1.25" />
  </>
)

export function MicIcon(props: IconProps): React.JSX.Element {
  return <Icon {...props}>{MIC}</Icon>
}

export function MicOffIcon(props: IconProps): React.JSX.Element {
  return <SlashedIcon {...props}>{MIC}</SlashedIcon>
}

export function HeadsetIcon(props: IconProps): React.JSX.Element {
  return <Icon {...props}>{HEADSET}</Icon>
}

export function HeadsetOffIcon(props: IconProps): React.JSX.Element {
  return <SlashedIcon {...props}>{HEADSET}</SlashedIcon>
}

/** Ondas de voz (supressão de ruído, como o botão do Krisp no Discord). */
export function NoiseSuppressionIcon({
  off = false,
  ...props
}: IconProps & { off?: boolean }): React.JSX.Element {
  return off ? (
    <SlashedIcon {...props}>{VOICE_BARS}</SlashedIcon>
  ) : (
    <Icon {...props}>{VOICE_BARS}</Icon>
  )
}

export function MonitorIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6v2h3a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2h3v-2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    </Icon>
  )
}

export function CameraIcon(props: IconProps): React.JSX.Element {
  return <Icon {...props}>{CAMERA}</Icon>
}

export function CameraOffIcon(props: IconProps): React.JSX.Element {
  return <SlashedIcon {...props}>{CAMERA}</SlashedIcon>
}

export function PhoneIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
    </Icon>
  )
}

/** Telefone "no gancho": sair da chamada. */
export function HangUpIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 0 1 0-1.41C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.39.39.39 1.02 0 1.41l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
    </Icon>
  )
}

/** Desligar a chamada: o mesmo telefone no gancho. */
export const PhoneOffIcon = HangUpIcon

/** Sinal da conexão de voz (o "Voz conectada" do painel). */
export function SignalIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <rect x="3" y="14" width="4.5" height="7" rx="1.5" />
      <rect x="9.75" y="9" width="4.5" height="12" rx="1.5" />
      <rect x="16.5" y="3" width="4.5" height="18" rx="1.5" />
    </Icon>
  )
}

export function VolumeIcon(props: IconProps): React.JSX.Element {
  return <Icon {...props}>{VOLUME}</Icon>
}

export function VolumeOffIcon(props: IconProps): React.JSX.Element {
  return <SlashedIcon {...props}>{VOLUME}</SlashedIcon>
}

export function PlayIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.6-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z" />
    </Icon>
  )
}

export function PauseIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M7 5h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm7 0h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
    </Icon>
  )
}

export function FullscreenIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </LineIcon>
  )
}

export function FullscreenExitIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
    </LineIcon>
  )
}

/** Mesa de Áudio (mixer com faders). */
export function SoundboardIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <rect x="5" y="2" width="2" height="20" rx="1" />
      <rect x="11" y="2" width="2" height="20" rx="1" />
      <rect x="17" y="2" width="2" height="20" rx="1" />
      <rect x="3" y="6" width="6" height="5" rx="1.5" />
      <rect x="9" y="13" width="6" height="5" rx="1.5" />
      <rect x="15" y="4" width="6" height="5" rx="1.5" />
    </Icon>
  )
}

/** Seção "Sons" da Mesa de Áudio (grade de pads com um "+"). */
export function SoundPadsIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <path d="M17 13.5a1 1 0 0 1 1 1V16h1.5a1 1 0 1 1 0 2H18v1.5a1 1 0 1 1-2 0V18h-1.5a1 1 0 1 1 0-2H16v-1.5a1 1 0 0 1 1-1z" />
    </Icon>
  )
}

/** Nota musical (player sem logo conhecido). */
export function MusicNoteIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6Z" />
    </Icon>
  )
}
