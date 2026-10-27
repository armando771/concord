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
