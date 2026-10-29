import type { CSSProperties, ReactNode } from 'react'

interface SkeletonProps {
  /** Tamanho e posição (h-3 w-24…). O formato padrão é uma barra de cantos suaves. */
  className?: string
  style?: CSSProperties
  /** Círculo (avatar, ícone de servidor). */
  circle?: boolean
}

/**
 * Bloco cinza com brilho suave que ocupa o lugar do conteúdo que ainda não
 * chegou. As cores vêm das variáveis --skeleton-base / --skeleton-shine
 * (main.css), então acompanham o tema; o brilho para com prefers-reduced-motion.
 * Decorativo: quem avisa o leitor de tela é o SkeletonRegion em volta.
 */
export function Skeleton({
  className = '',
  style,
  circle = false
}: SkeletonProps): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={`skeleton block shrink-0 ${circle ? 'rounded-full' : 'rounded'} ${className}`}
      style={style}
    />
  )
}

/**
 * Agrupa um skeleton e o anuncia como "carregando" para leitor de tela (os
 * blocos de dentro são decorativos).
 */
export function SkeletonRegion({
  label = 'Carregando…',
  className,
  style,
  children
}: {
  label?: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}): React.JSX.Element {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className} style={style}>
      {children}
    </div>
  )
}
