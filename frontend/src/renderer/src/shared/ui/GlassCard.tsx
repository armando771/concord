import type { ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
}

function GlassCard({ children, className = '' }: GlassCardProps): React.JSX.Element {
  return <div className={`glass-card ${className}`}>{children}</div>
}

export default GlassCard
