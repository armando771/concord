// Ícones novos vão aqui: o icons.tsx é grande demais para crescer.

interface IconProps {
  className?: string
}

function Stroke({ className = '', children }: IconProps & { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function ChevronRightIcon({ className }: IconProps): React.JSX.Element {
  return (
    <Stroke className={className}>
      <path d="m9 6 6 6-6 6" />
    </Stroke>
  )
}

export function EnvelopeIcon({ className }: IconProps): React.JSX.Element {
  return (
    <Stroke className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </Stroke>
  )
}

export function ArrowLeftIcon({ className }: IconProps): React.JSX.Element {
  return (
    <Stroke className={className}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </Stroke>
  )
}

export function MembersIcon({ className }: IconProps): React.JSX.Element {
  return (
    <Stroke className={className}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
      <path d="M18.5 14.5A6.5 6.5 0 0 1 21.5 20" />
    </Stroke>
  )
}

/** Coroa cheia (marca do dono do servidor). */
export function CrownIcon({ className }: IconProps): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 7.5 7.5 11 12 4l4.5 7L21 7.5 19.5 18h-15L3 7.5Z" />
      <rect x="4.5" y="19" width="15" height="2" rx="1" />
    </svg>
  )
}
