import type { SVGProps } from 'react'

/** Escala de tamanhos: 12 em selos, 16 em texto/chips, 20 em botões/menus, 24 na chamada. */
export type IconSize = 12 | 16 | 20 | 24

export interface IconProps {
  className?: string
  size?: IconSize
}

type SvgProps = Omit<SVGProps<SVGSVGElement>, 'width' | 'height' | 'className'>

/**
 * Base de todos os ícones: viewBox 24×24, cor do texto (`currentColor`) e
 * escondido do leitor de tela (o nome acessível fica no botão).
 */
export function Icon({
  className = '',
  size = 20,
  children,
  ...svg
}: IconProps & SvgProps): React.JSX.Element {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...svg}
    >
      {children}
    </svg>
  )
}

/** Ícone de traço (setas, chevrons, ×, ✓): mesma base, desenhado com linha. */
export function LineIcon({ children, ...props }: IconProps & SvgProps): React.JSX.Element {
  return (
    <Icon
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </Icon>
  )
}
