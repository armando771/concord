// Pessoas e status: amigos, membros, usuário, dono, nível e atividades.
import { Icon, type IconProps } from './Icon'

/** Duas pessoas: amigos e lista de membros. */
export function FriendsIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M16 11C17.66 11 18.99 9.66 18.99 8C18.99 6.34 17.66 5 16 5C14.34 5 13 6.34 13 8C13 9.66 14.34 11 16 11ZM8 11C9.66 11 10.99 9.66 10.99 8C10.99 6.34 9.66 5 8 5C6.34 5 5 6.34 5 8C5 9.66 6.34 11 8 11ZM8 13C5.67 13 1 14.17 1 16.5V19H15V16.5C15 14.17 10.33 13 8 13ZM16 13C15.71 13 15.38 13.02 15.03 13.05C15.68 13.89 16 14.83 16 15.83V18H21V15.5C21 14.17 18.33 13 16 13Z" />
    </Icon>
  )
}

/** Lista de membros: as mesmas duas pessoas. */
export const MembersIcon = FriendsIcon

/** Uma pessoa (usuário, "Online"). */
export function UserIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <circle cx="12" cy="7.5" r="4.5" />
      <path d="M4 20a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20.5z" />
    </Icon>
  )
}

/** Aba "Online" dos amigos: a mesma pessoa. */
export const OnlineIcon = UserIcon

export function UserPlusIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="4" />
      <path d="M1.5 19.5A6.5 6.5 0 0 1 8 13h2a6.5 6.5 0 0 1 6.5 6.5v.5a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1z" />
      <path d="M19 5a1 1 0 0 1 1 1v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-2h-2a1 1 0 1 1 0-2h2V6a1 1 0 0 1 1-1z" />
    </Icon>
  )
}

/** Coroa cheia (marca do dono do servidor). */
export function CrownIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M3 7.5 7.5 11 12 4l4.5 7L21 7.5 19.5 18h-15L3 7.5Z" />
      <rect x="4.5" y="19" width="15" height="2" rx="1" />
    </Icon>
  )
}

/** Diamante (lapidado: coroa e pavilhão separados por uma fresta). */
export function DiamondIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M6.6 3h10.8l3.7 5H2.9z" />
      <path d="M2.4 9.5h19.2L12 21.5z" />
    </Icon>
  )
}

/** Controle de jogo (jogos e atividades da chamada). */
export function GamepadIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M21.58 16.09l-1.09-7.66A3.996 3.996 0 0016.53 5H7.47C5.48 5 3.79 6.46 3.51 8.43l-1.09 7.66C2.2 17.63 3.39 19 4.94 19c.68 0 1.32-.27 1.8-.75L9 16h6l2.25 2.25c.48.48 1.13.75 1.8.75 1.56 0 2.75-1.37 2.53-2.91zM11 11H9v2H8v-2H6v-1h2V8h1v2h2v1zm4-1c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm2 3c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
    </Icon>
  )
}

/** Atividades da chamada: o mesmo controle de jogo. */
export const ActivityIcon = GamepadIcon

/** Mira (atividades de tiro, ex.: Krunker.io). */
export function CrosshairIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path
        fillRule="evenodd"
        d="M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zm0 2.25a6.25 6.25 0 1 0 0 12.5 6.25 6.25 0 0 0 0-12.5z"
      />
      <rect x="10.9" y="1" width="2.2" height="6" rx="1.1" />
      <rect x="10.9" y="17" width="2.2" height="6" rx="1.1" />
      <rect x="1" y="10.9" width="6" height="2.2" rx="1.1" />
      <rect x="17" y="10.9" width="6" height="2.2" rx="1.1" />
      <circle cx="12" cy="12" r="1.75" />
    </Icon>
  )
}
