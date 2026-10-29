// Navegação e lugares: setas, canais, busca, configurações, mensagens e datas.
import { Icon, LineIcon, type IconProps } from './Icon'

export function ChevronDownIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path d="m6 9 6 6 6-6" />
    </LineIcon>
  )
}

export function ChevronUpIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path d="m18 15-6-6-6 6" />
    </LineIcon>
  )
}

export function ChevronRightIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path d="m9 6 6 6-6 6" />
    </LineIcon>
  )
}

export function ArrowLeftIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path d="M19 12H5m7 7-7-7 7-7" />
    </LineIcon>
  )
}

/** Seta para cima; gire com `style={{ rotate }}` para as outras direções. */
export function ArrowUpIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path d="M12 19V5m-7 7 7-7 7 7" />
    </LineIcon>
  )
}

export function HashIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
    </LineIcon>
  )
}

export function AtIcon(props: IconProps): React.JSX.Element {
  return (
    <LineIcon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
    </LineIcon>
  )
}

export function SearchIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    </Icon>
  )
}

export function GearIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.02-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.08-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.02.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
    </Icon>
  )
}

export function ChatBubbleIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
    </Icon>
  )
}

export function EnvelopeIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M2 6.5A2.5 2.5 0 0 1 4.5 4h15A2.5 2.5 0 0 1 22 6.5v.4l-10 6.3L2 6.9z" />
      <path d="M2 9.3l9.47 5.97a1 1 0 0 0 1.06 0L22 9.3v8.2a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 17.5z" />
    </Icon>
  )
}

export function CalendarIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M8 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h2a3 3 0 0 1 3 3v2H2V7a3 3 0 0 1 3-3h2V3a1 1 0 0 1 1-1z" />
      <path
        fillRule="evenodd"
        d="M2 11h20v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3zm4.5 3a.5.5 0 0 0-.5.5v2a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5z"
      />
    </Icon>
  )
}

export function ClockIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.3l4.5 2.7-.8 1.2z" />
    </Icon>
  )
}
