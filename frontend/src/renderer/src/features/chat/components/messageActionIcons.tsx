// Ícones da barra de ações e das reações da mensagem (como os do Discord).

interface IconProps {
  className?: string
}

/** Carinha com "+": adicionar reação. */
export function AddReactionIcon({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.8 10.2a9 9 0 1 1-7-7" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9.5" x2="9.01" y2="9.5" strokeWidth="2.5" />
      <line x1="15" y1="9.5" x2="15.01" y2="9.5" strokeWidth="2.5" />
      <path d="M19 2v6M16 5h6" />
    </svg>
  )
}

/** Seta curva para a esquerda: responder. */
export function ReplyIcon({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5V20" />
    </svg>
  )
}

/** Três pontos na horizontal: mais ações. */
export function MoreIcon({ className = '' }: IconProps): React.JSX.Element {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  )
}
