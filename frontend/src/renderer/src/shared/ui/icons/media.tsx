// Chamada e mídia: microfone, fone, câmera, tela, telefone, volume, player e mesa de áudio.
import { Icon, type IconProps } from './Icon'

export function MicIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
    </Icon>
  )
}

export function MicOffIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
    </Icon>
  )
}

export function HeadsetIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z" />
    </Icon>
  )
}

export function HeadsetOffIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z" />
      <path d="M3.5 2.5l18 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </Icon>
  )
}

/** Ondas de voz (supressão de ruído, como o botão do Krisp no Discord). */
export function NoiseSuppressionIcon({
  className,
  size,
  off = false
}: IconProps & { off?: boolean }): React.JSX.Element {
  return (
    <Icon
      className={className}
      size={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M3 10v4M7 7v10M11 4v16M15 8v8M19 10.5v3" />
      {off && <path d="M3 3l18 18" />}
    </Icon>
  )
}

export function MonitorIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon
      className={className}
      size={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </Icon>
  )
}

export function CameraIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
    </Icon>
  )
}

export function CameraOffIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z" />
    </Icon>
  )
}

export function PhoneIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
    </Icon>
  )
}

export function PhoneOffIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M21 15.46l-5.27-2.23c-.26-.11-.56-.04-.75.18l-2.18 2.65c-2.83-1.44-5.15-3.76-6.59-6.59l2.66-2.17c.22-.19.29-.5.18-.75L6.82 1.28C6.7.99 6.38.84 6.08.93L1.62 2.28C1.34 2.36 1.15 2.62 1.16 2.92 1.42 13.28 9.94 21.8 20.3 22.06c.3.01.56-.18.64-.46l1.35-4.46c.09-.3-.06-.63-.35-.75l-.94-.93zM2.1 3.87l3.14-.95 1.42 3.54-2.32 1.9C3.98 6.53 3.31 4.85 2.1 3.87zm17.03 17.03c-.98-1.21-2.66-1.88-4.49-2.24l1.9-2.32 3.54 1.42-.95 3.14z" />
    </Icon>
  )
}

/** Telefone "no gancho": sair da chamada (painel Voz conectada). */
export function HangUpIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 0 1 0-1.41C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.39.39.39 1.02 0 1.41l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
    </Icon>
  )
}

/** Sinal da conexão de voz (o "Voz conectada" do painel). */
export function SignalIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon
      className={className}
      size={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M5 19.5h.01" strokeWidth="3.5" />
      <path d="M4.5 13a6.5 6.5 0 0 1 6.5 6.5" />
      <path d="M4.5 7.5a12 12 0 0 1 12 12" />
      <path d="M4.5 2.5a17 17 0 0 1 17 17" />
    </Icon>
  )
}

export function VolumeIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </Icon>
  )
}

export function VolumeOffIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
    </Icon>
  )
}

export function PlayIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.6-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z" />
    </Icon>
  )
}

export function PauseIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M7 5h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm7 0h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
    </Icon>
  )
}

export function FullscreenIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon
      className={className}
      size={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </Icon>
  )
}

export function FullscreenExitIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon
      className={className}
      size={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
    </Icon>
  )
}

/** Ícone de Mesa de Áudio (mixer com faders deslizantes). */
export function SoundboardIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon
      className={className}
      size={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3v4M6 11v10M12 3v10M12 17v4M18 3v2M18 9v12" />
      <rect x="4" y="7" width="4" height="4" rx="1" />
      <rect x="10" y="13" width="4" height="4" rx="1" />
      <rect x="16" y="5" width="4" height="4" rx="1" />
    </Icon>
  )
}

/** Ícone da seção "Sons" da Mesa de Áudio (grade de pads). */
export function SoundPadsIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon
      className={className}
      size={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <path d="M15 17.5h5M17.5 15v5" />
    </Icon>
  )
}

/** Nota musical (player sem logo conhecido). */
export function MusicNoteIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6Z" />
    </Icon>
  )
}
