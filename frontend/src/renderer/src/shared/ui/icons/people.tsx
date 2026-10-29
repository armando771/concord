// Pessoas e status: amigos, membros, usuário, dono, nível e atividades.
import { Icon, LineIcon, type IconProps } from './Icon'

export function FriendsIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M16 11C17.66 11 18.99 9.66 18.99 8C18.99 6.34 17.66 5 16 5C14.34 5 13 6.34 13 8C13 9.66 14.34 11 16 11ZM8 11C9.66 11 10.99 9.66 10.99 8C10.99 6.34 9.66 5 8 5C6.34 5 5 6.34 5 8C5 9.66 6.34 11 8 11ZM8 13C5.67 13 1 14.17 1 16.5V19H15V16.5C15 14.17 10.33 13 8 13ZM16 13C15.71 13 15.38 13.02 15.03 13.05C15.68 13.89 16 14.83 16 15.83V18H21V15.5C21 14.17 18.33 13 16 13Z" />
    </Icon>
  )
}

export function MembersIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <LineIcon className={className} size={size}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <path d="M18.5 14.5A6.5 6.5 0 0 1 21.5 20" />
    </LineIcon>
  )
}

export function OnlineIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </Icon>
  )
}

export function UserIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <LineIcon className={className} size={size}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </LineIcon>
  )
}

export function UserPlusIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M15 9c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3zm-9 8c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1H6v-1zm3-11c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm9 0h-1v2h-2v1h2v2h1v-2h2V8h-2V6z" />
    </Icon>
  )
}

/** Coroa cheia (marca do dono do servidor). */
export function CrownIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M3 7.5 7.5 11 12 4l4.5 7L21 7.5 19.5 18h-15L3 7.5Z" />
      <rect x="4.5" y="19" width="15" height="2" rx="1" />
    </Icon>
  )
}

export function DiamondIcon({ className, size }: IconProps): React.JSX.Element {
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
      <path d="M6 3h12l4 6-10 12L2 9z" />
      <path d="M11 3 8 9l4 12 4-12-3-6" />
      <path d="M2 9h20" />
    </Icon>
  )
}

/** Atividades da chamada (controle de jogo). */
export function ActivityIcon({ className, size }: IconProps): React.JSX.Element {
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
      <path d="M6 11h4M8 9v4M15 12h.01M18 10h.01" />
      <path d="M17.32 5H6.68a4 4 0 0 0-3.98 3.59l-.69 6.2A3 3 0 0 0 5 18c1 0 1.5-.5 2-1l1.41-1.41A2 2 0 0 1 9.83 15h4.34a2 2 0 0 1 1.42.59L17 17c.5.5 1 1 2 1a3 3 0 0 0 2.99-3.21l-.69-6.2A4 4 0 0 0 17.32 5Z" />
    </Icon>
  )
}

export function GamepadIcon({ className, size }: IconProps): React.JSX.Element {
  return (
    <Icon className={className} size={size}>
      <path d="M21.58 16.09l-1.09-7.66A3.996 3.996 0 0016.53 5H7.47C5.48 5 3.79 6.46 3.51 8.43l-1.09 7.66C2.2 17.63 3.39 19 4.94 19c.68 0 1.32-.27 1.8-.75L9 16h6l2.25 2.25c.48.48 1.13.75 1.8.75 1.56 0 2.75-1.37 2.53-2.91zM11 11H9v2H8v-2H6v-1h2V8h1v2h2v1zm4-1c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2 3c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
    </Icon>
  )
}

/** Mira (atividades de tiro, ex.: Krunker.io). */
export function CrosshairIcon({ className, size }: IconProps): React.JSX.Element {
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
      <circle cx="12" cy="12" r="8" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </Icon>
  )
}
