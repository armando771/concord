// Navegação e lugares: setas, canais, busca, configurações, mensagens e datas.
import { Icon, LineIcon, type IconProps } from './Icon'

export function ChevronDownIcon({ className, size }: IconProps): React.JSX.Element {
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
      <path d="m6 9 6 6 6-6" />
    </Icon>
  )
}

export function ChevronUpIcon({ className, size }: IconProps): React.JSX.Element {
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
      <path d="m18 15-6-6-6 6" />
    </Icon>
  )
}

export function ChevronRightIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <LineIcon className={className} size={size}>
      <path d="m9 6 6 6-6 6" />
    </LineIcon>
  )
}

export function ArrowLeftIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <LineIcon className={className} size={size}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </LineIcon>
  )
}

export function HashIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <LineIcon className={className} size={size}>
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </LineIcon>
  )
}

export function AtIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <LineIcon className={className} size={size}>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
    </LineIcon>
  )
}

export function SearchIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    </Icon>
  )
}

export function GearIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.02-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.08-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.02.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
    </Icon>
  )
}

export function ChatBubbleIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
    </Icon>
  )
}

export function EnvelopeIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <LineIcon className={className} size={size}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </LineIcon>
  )
}

export function ChangelogIcon({ className, size }: IconProps): React.JSX.Element {
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
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
    </Icon>
  )
}

export function CalendarIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <LineIcon className={className} size={size}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </LineIcon>
  )
}

export function ClockIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.3l4.5 2.7-.8 1.2z" />
    </Icon>
  )
}
