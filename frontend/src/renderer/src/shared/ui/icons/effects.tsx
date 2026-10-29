// Efeitos do perfil (neve, fogo, raio...) e os brilhos de "novidades".
import { Icon, type IconProps } from './Icon'

/** Traço dos efeitos que são linha por natureza (floco, onda, espiral, grade). */
const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
} as const

/** Brilho de 4 pontas, grande e pequeno. */
export function SparkleIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M10 3q1 7 8 8-7 1-8 8-1-7-8-8 7-1 8-8z" />
      <path d="M18.5 1q.5 3 3.5 3.5-3 .5-3.5 3.5-.5-3-3.5-3.5 3-.5 3.5-3.5z" />
    </Icon>
  )
}

/** Novidades (changelog): os mesmos brilhos. */
export const ChangelogIcon = SparkleIcon

export function SnowIcon(props: IconProps): React.JSX.Element {
  const arm = 'M12 2v20M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5'
  return (
    <Icon {...props}>
      <g {...STROKE}>
        <path d={arm} />
        <path d={arm} transform="rotate(60 12 12)" />
        <path d={arm} transform="rotate(120 12 12)" />
      </g>
    </Icon>
  )
}

/** Chama com o miolo vazado. */
export function FlameIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path
        fillRule="evenodd"
        d="M12 1.5c.4 3 2.3 4.7 4 6.5 1.6 1.7 3 3.6 3 6.5a7 7 0 0 1-14 0c0-2.7 1.2-4.6 2.6-6 .3 1.8 1.1 3 2.4 3.6C10 9.1 10.6 4.9 12 1.5zm0 19.5a3 3 0 0 0 3-3c0-1.7-1.3-2.9-3-4.5-1.7 1.6-3 2.8-3 4.5a3 3 0 0 0 3 3z"
      />
    </Icon>
  )
}

/** Raio (tempestade; também o laser da tela). */
export function BoltIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M13.2 1.6a.6.6 0 0 1 1 .5L13.1 10h6.3a.6.6 0 0 1 .5 1L10.8 22.4a.6.6 0 0 1-1-.5l1.1-7.9H4.6a.6.6 0 0 1-.5-1z" />
    </Icon>
  )
}

export function HeartIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M12 21s-9-5.4-9-11.6A5 5 0 0 1 12 6.6a5 5 0 0 1 9 2.8C21 15.6 12 21 12 21z" />
    </Icon>
  )
}

/** Nuvem com gotas. */
export function RainIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M7 16a5 5 0 0 1-.9-9.92A6.5 6.5 0 0 1 18.2 7.1 4.5 4.5 0 0 1 17.5 16z" />
      <rect x="7" y="17.5" width="2" height="5" rx="1" transform="rotate(20 8 20)" />
      <rect x="11" y="17.5" width="2" height="5" rx="1" transform="rotate(20 12 20)" />
      <rect x="15" y="17.5" width="2" height="5" rx="1" transform="rotate(20 16 20)" />
    </Icon>
  )
}

/** Espiral (galáxia). */
export function GalaxyIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path {...STROKE} d="M10.5 12a1.75 1.75 0 0 1 3.5 0 4.75 4.75 0 0 1-9.5 0 7.75 7.75 0 0 1 15.5 0" />
    </Icon>
  )
}

/** Ondas (aurora). */
export function WaveIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path
        {...STROKE}
        d="M2 7q2.5-3 5 0t5 0 5 0 5 0M2 12q2.5-3 5 0t5 0 5 0 5 0M2 17q2.5-3 5 0t5 0 5 0 5 0"
      />
    </Icon>
  )
}

/** Sol listrado sobre a grade em perspectiva (synthwave). */
export function GridIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path fillRule="evenodd" d="M5 11.5a7 7 0 0 1 14 0zm.4-3.25h13.2v1H5.4zm-.3 2h13.8v.6H5.1z" />
      <path {...STROKE} d="M2 14h20M12 14v8M8.5 14 5 22M15.5 14l3.5 8M3.5 18h17" />
    </Icon>
  )
}

/** Faixas deslocadas (glitch). */
export function GlitchIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <rect x="3" y="3.5" width="13" height="4.5" rx="1" />
      <rect x="18" y="3.5" width="3" height="4.5" rx="1" />
      <rect x="2" y="9.75" width="4" height="4.5" rx="1" />
      <rect x="8" y="9.75" width="13" height="4.5" rx="1" />
      <rect x="5" y="16" width="11" height="4.5" rx="1" />
      <rect x="18" y="16" width="4" height="4.5" rx="1" />
    </Icon>
  )
}

/** Colunas de código caindo (matrix). */
export function MatrixIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <rect x="3.5" y="2" width="3" height="5" rx="1" opacity=".5" />
      <rect x="3.5" y="9" width="3" height="4" rx="1" />
      <rect x="3.5" y="15" width="3" height="7" rx="1" />
      <rect x="10.5" y="4" width="3" height="3" rx="1" opacity=".5" />
      <rect x="10.5" y="9" width="3" height="9" rx="1" />
      <rect x="17.5" y="2" width="3" height="3" rx="1" opacity=".5" />
      <rect x="17.5" y="7" width="3" height="6" rx="1" />
      <rect x="17.5" y="15" width="3" height="4" rx="1" />
    </Icon>
  )
}

/** Partículas soltas de tamanhos diferentes. */
export function ParticlesIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <circle cx="6" cy="6.5" r="2.5" />
      <circle cx="16" cy="5" r="1.5" />
      <circle cx="18" cy="13.5" r="3" />
      <circle cx="8" cy="17" r="2" />
      <circle cx="12.5" cy="11" r="1.25" />
      <circle cx="14" cy="20" r="1.5" />
      <circle cx="3.5" cy="12" r="1" />
    </Icon>
  )
}

/** Lança-confete. */
export function ConfettiIcon(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M2.6 20.2 7 8.3a1 1 0 0 1 1.65-.36l7.4 7.4a1 1 0 0 1-.36 1.65L3.8 21.4a.9.9 0 0 1-1.2-1.2z" />
      <circle cx="17" cy="4" r="1.5" />
      <circle cx="20.5" cy="11" r="1.25" />
      <circle cx="12" cy="3.5" r="1" />
      <rect x="14" y="7" width="2" height="4.5" rx="1" transform="rotate(40 15 9.25)" />
      <rect x="18.5" y="15" width="2" height="4" rx="1" transform="rotate(-30 19.5 17)" />
      <rect x="8.5" y="1" width="2" height="4" rx="1" transform="rotate(-20 9.5 3)" />
    </Icon>
  )
}
