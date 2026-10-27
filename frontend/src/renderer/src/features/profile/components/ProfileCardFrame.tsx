import { useMemo, type CSSProperties, type ReactNode, type Ref } from 'react'
import type { ProfileThemeLook } from '../lib/profileTheme'
import { effectParticles, type Particle } from '../lib/profileParticles'
import EffectCanvas from './EffectCanvas'
import '../../../assets/profileTheme.css'

/** Estrelinha dos brilhos (o mesmo ✦ do efeito de nome). */
const SPARKLE = '✦'

/** Estilo de uma partícula: neve cai do topo; brilho é texto; o resto, bolinha. */
function particleStyle(effect: string, p: Particle): CSSProperties {
  const size = effect === 'sparkles' ? { fontSize: p.size } : { width: p.size, height: p.size }
  return {
    left: `${p.left}%`,
    top: effect === 'snow' ? '-8px' : `${p.top}%`,
    ...size,
    // Atraso negativo: abre já com o efeito no meio, não vazio.
    animationDelay: `-${p.delay}s`,
    animationDuration: `${p.duration}s`
  }
}

function CssEffect({ fx }: { fx: ProfileThemeLook['fx'] }): React.JSX.Element {
  const { density, speed } = fx.params
  const particles = useMemo(() => effectParticles(fx.id, density, speed), [fx.id, density, speed])
  const glyph = fx.id === 'sparkles' ? SPARKLE : null
  return (
    <div aria-hidden="true" className={`pt-fx pt-fx-${fx.id}`}>
      {particles.map((p, i) => (
        <span key={i} style={particleStyle(fx.id, p)}>
          {glyph}
        </span>
      ))}
    </div>
  )
}

/** O efeito por cima do cartão: partículas em CSS ou a cena em canvas. */
function CardEffect({ fx }: { fx: ProfileThemeLook['fx'] }): React.JSX.Element | null {
  if (fx.kind === 'css') return <CssEffect fx={fx} />
  if (fx.kind === 'canvas') return <EffectCanvas effect={fx.id} params={fx.params} />
  return null
}

/**
 * Moldura do cartão de perfil com o tema da pessoa: borda (sólida, neon,
 * arco-íris, degradê), fundo do corpo e o efeito por cima. Igual em todo lugar
 * onde o cartão aparece (o que abre ao clicar e a prévia do editor). `look`
 * vem de profileThemeLook(resolveProfileTheme(...)); o efeito (look.fx) só é
 * desenhado se `effect` vier (as miniaturas das predefinições não animam).
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
      {effect && effect !== 'none' && <CardEffect fx={look.fx} />}
    </div>
  )
}
