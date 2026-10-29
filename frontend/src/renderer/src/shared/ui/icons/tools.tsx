// Ferramentas da tela compartilhada (desenho) e do fundo da câmera.
import { Icon, type IconProps } from './Icon'

export function HighlighterIcon({ className, size }: IconProps): React.JSX.Element {
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
      <path d="m9 11-6 6v3h3l6-6" />
      <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
    </Icon>
  )
}

export function LaserIcon({ className, size }: IconProps): React.JSX.Element {
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
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </Icon>
  )
}

export function EraserIcon({ className, size }: IconProps): React.JSX.Element {
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
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </Icon>
  )
}

/** Círculo cortado: nenhum (fundo da câmera). */
export function CircleSlashIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </Icon>
  )
}

/** Pessoa com o fundo desfocado. */
export function BlurIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5z" />
      <path
        d="M3 4h2M3 8h1M19 4h2M20 8h1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity=".6"
      />
    </Icon>
  )
}

/** Imagem com "+": enviar uma imagem. */
export function ImageAddIcon({ className, size }: IconProps): React.JSX.Element {
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
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M21 16l-5-5-8 8" />
      <path d="M17 3v4M15 5h4" />
    </Icon>
  )
}
