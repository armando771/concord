import type { ComponentType } from 'react'
import {
  ArrowUpIcon,
  BoltIcon,
  CircleSlashIcon,
  ConfettiIcon,
  FlameIcon,
  GalaxyIcon,
  GlitchIcon,
  GridIcon,
  HeartIcon,
  MatrixIcon,
  ParticlesIcon,
  RainIcon,
  SnowIcon,
  SparkleIcon,
  WaveIcon,
  type IconProps
} from '../../../../../shared/ui/icons'

/** Ícone de cada efeito do perfil (chips do editor e selo das predefinições). */
export const EFFECT_ICONS: Record<string, ComponentType<IconProps>> = {
  none: CircleSlashIcon,
  particles: ParticlesIcon,
  sparkles: SparkleIcon,
  snow: SnowIcon,
  fire: FlameIcon,
  matrix: MatrixIcon,
  glitch: GlitchIcon,
  storm: BoltIcon,
  galaxy: GalaxyIcon,
  aurora: WaveIcon,
  hearts: HeartIcon,
  confetti: ConfettiIcon,
  synthwave: GridIcon,
  rain: RainIcon
}

/** Seta da direção do degradê: a mesma seta para cima, girada pelo ângulo (0° = cima). */
export function gradientArrow(angle: number): ComponentType<IconProps> {
  function GradientArrow(props: IconProps): React.JSX.Element {
    return <ArrowUpIcon {...props} style={{ rotate: `${angle}deg` }} />
  }
  return GradientArrow
}
