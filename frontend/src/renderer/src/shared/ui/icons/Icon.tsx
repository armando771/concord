import { useId, type CSSProperties, type SVGProps } from 'react'

/** Escala de tamanhos: 12 em selos, 16 em texto/chips, 20 em botões/menus, 24 na chamada. */
export type IconSize = 12 | 16 | 20 | 24

export interface IconProps {
  className?: string
  size?: IconSize
  /** Para girar (ex.: a seta da direção do degradê). */
  style?: CSSProperties
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

/**
 * Ícone de traço: só para símbolos que são linha (setas, chevrons, ×, ✓, +, #,
 * @, clipe), como o Discord. Todo o resto é preenchido.
 */
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

/**
 * Versão "desligada" (microfone, fone, câmera...): a mesma figura com um risco
 * diagonal e uma folga em volta dele, como no Discord.
 */
export function SlashedIcon({ children, ...props }: IconProps & SvgProps): React.JSX.Element {
  const mask = useId()
  return (
    <Icon {...props}>
      <mask id={mask}>
        <rect width="24" height="24" fill="#fff" />
        <path d="M3 3l18 18" stroke="#000" strokeWidth="5" strokeLinecap="round" />
      </mask>
      <g mask={`url(#${mask})`}>{children}</g>
      <path d="M3.7 2.3l18 18a1 1 0 0 1-1.4 1.4l-18-18a1 1 0 0 1 1.4-1.4z" />
    </Icon>
  )
}
