// Ações genéricas: criar, editar, apagar, confirmar, fechar, anexar, fixar, reagir, trancar.
import { Icon, LineIcon, type IconProps } from './Icon'

export function PlusIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z" />
    </Icon>
  )
}

export function PencilIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </Icon>
  )
}

export function TrashIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
    </Icon>
  )
}

export function CheckIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon
      className={className}
      size={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </Icon>
  )
}

export function XIcon({ className, size }: IconProps): React.JSX.Element {
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
      <path d="M18 6 6 18M6 6l12 12" />
    </Icon>
  )
}

export function DotsIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
    </Icon>
  )
}

/** Clipe de anexar arquivo. */
export function PaperclipIcon({ className, size }: IconProps): React.JSX.Element {
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
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </Icon>
  )
}

export function PinIcon({ className, size }: IconProps): React.JSX.Element {
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
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.77V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.77a2 2 0 0 1-1.11 1.79l-1.78.89A2 2 0 0 0 5 15.24Z" />
    </Icon>
  )
}

export function UndoIcon({ className, size }: IconProps): React.JSX.Element {
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
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </Icon>
  )
}

export function SmileyIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <LineIcon className={className} size={size}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2.5" />
      <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2.5" />
    </LineIcon>
  )
}

export function EyeIcon({ className, size }: IconProps): React.JSX.Element {
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
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

export function LockIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path
        fillRule="evenodd"
        d="M12 2a4 4 0 0 0-4 4v3H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a4 4 0 0 0-4-4zm2 7V6a2 2 0 1 0-4 0v3h4zm-2 5a1.5 1.5 0 0 0-.75 2.8v1.7a.75.75 0 0 0 1.5 0v-1.7A1.5 1.5 0 0 0 12 14z"
        clipRule="evenodd"
      />
    </Icon>
  )
}

export function LockOpenIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path
        fillRule="evenodd"
        d="M14 6a2 2 0 0 1 2 2h2a4 4 0 1 0-8 0v1H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2H12V8a2 2 0 0 1 2-2zm-2 8a1.5 1.5 0 0 0-.75 2.8v1.7a.75.75 0 0 0 1.5 0v-1.7A1.5 1.5 0 0 0 12 14z"
        clipRule="evenodd"
      />
    </Icon>
  )
}

export function SlidersIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <LineIcon className={className} size={size}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="6" r="2" fill="currentColor" />
      <circle cx="15" cy="12" r="2" fill="currentColor" />
      <circle cx="7" cy="18" r="2" fill="currentColor" />
    </LineIcon>
  )
}

/** Estrela (canal principal e favoritos). */
export function StarIcon({
  className,
  size,
  filled = false
}: IconProps & { filled?: boolean }): React.JSX.Element {
  return (
    <Icon
      className={className}
      size={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? '0' : '2'}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {filled ? (
        <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
      ) : (
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      )}
    </Icon>
  )
}

/** Estrela de favorito (mesa de áudio): vazada ou cheia. */
export function FavoriteStarIcon({
  className,
  size,
  filled = false
}: IconProps & { filled?: boolean }): React.JSX.Element {
  return (
    <Icon
      className={className}
      size={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </Icon>
  )
}

/** Enquete (barras de resultado). */
export function PollIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M5 4h9a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm0 6h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1zm0 6h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z" />
    </Icon>
  )
}

/** Carinha com "+": adicionar reação. */
export function AddReactionIcon({ className, size }: IconProps): React.JSX.Element {
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
      <path d="M20.8 10.2a9 9 0 1 1-7-7" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9.5" x2="9.01" y2="9.5" strokeWidth="2.5" />
      <line x1="15" y1="9.5" x2="15.01" y2="9.5" strokeWidth="2.5" />
      <path d="M19 2v6M16 5h6" />
    </Icon>
  )
}

/** Seta curva para a esquerda: responder. */
export function ReplyIcon({ className, size }: IconProps): React.JSX.Element {
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
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5V20" />
    </Icon>
  )
}

/** Três pontos na horizontal: mais ações. */
export function MoreIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </Icon>
  )
}

/** Olho riscado: desenhos escondidos. */
export function EyeOffIcon({ className, size }: IconProps): React.JSX.Element {
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
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3 3l18 18" strokeWidth="2.5" />
    </Icon>
  )
}
