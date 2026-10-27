import { useMemo, type CSSProperties, type ReactNode, type Ref } from 'react'
import type { ProfileThemeLook } from '../lib/profileTheme'
import { effectParticles } from '../lib/profileParticles'
import '../../../assets/profileTheme.css'

/** Estrelinha dos brilhos (o mesmo ✦ do efeito de nome). */
const SPARKLE = '✦'

function CardEffect({ effect }: { effect: string }): React.JSX.Element | null {
  const particles = useMemo(() => effectParticles(effect), [effect])
  if (particles.length === 0) return null
  return (
    <div aria-hidden="true" className={`pt-fx pt-fx-${effect}`}>
      {particles.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.left}%`,
            top: effect === 'snow' ? '-8px' : `${p.top}%`,
            ...(effect === 'sparkles' ? { fontSize: p.size } : { width: p.size, height: p.size }),
            // Atraso negativo: abre já com o efeito no meio, não vazio.
            animationDelay: `-${p.delay}s`,
            animationDuration: `${p.duration}s`
          }}
        >
          {effect === 'sparkles' ? SPARKLE : null}
        </span>
      ))}
    </div>
  )
}

/**
 * Moldura do cartão de perfil com o tema da pessoa: borda (sólida, neon,
 * arco-íris, degradê), fundo do corpo e o efeito por cima. Igual em todo lugar
 * onde o cartão aparece (o que abre ao clicar e a prévia do editor). `look`
 * vem de profileThemeLook(resolveProfileTheme(...)).
 */
export default function ProfileCardFrame({
  look,
  effect,
  className = '',
  style,
  children,
  ref,
  ...rest
}: {
  look: ProfileThemeLook
  effect?: string
  className?: string
  style?: CSSProperties
  children: ReactNode
  ref?: Ref<HTMLDivElement>
} & Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'style' | 'className' | 'children'
>): React.JSX.Element {
  return (
    <div
      ref={ref}
      {...rest}
      className={`${look.className} ${className}`.trim()}
      style={{ ...look.style, ...style }}
    >
      {children}
      {effect && effect !== 'none' && <CardEffect effect={effect} />}
    </div>
  )
}
