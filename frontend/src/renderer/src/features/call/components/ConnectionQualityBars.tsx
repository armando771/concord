import { useAuthStore } from '../../auth/store/authStore'
import { useCallStore } from '../store/callStore'
import { qualityBars, qualityTooltip, type CallQuality } from '../lib/connectionQuality'

const LIT: Record<CallQuality, string> = {
  excellent: 'text-success',
  good: 'text-success',
  poor: 'text-warning',
  lost: 'text-danger',
  unknown: 'text-faint'
}

/** Ícone de barrinhas de sinal (3) do ConnectionQuality do LiveKit. */
export function QualityBarsIcon({
  quality,
  className = 'h-3.5 w-3.5'
}: {
  quality: CallQuality
  className?: string
}): React.JSX.Element {
  const lit = qualityBars(quality)
  return (
    <svg
      viewBox="0 0 12 12"
      className={`${className} ${LIT[quality]}`}
      aria-hidden="true"
      data-quality={quality}
    >
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={1 + i * 3.75}
          y={8 - i * 3}
          width="2.5"
          height={3 + i * 3}
          rx="0.6"
          fill="currentColor"
          opacity={i < lit ? 1 : 0.28}
        />
      ))}
    </svg>
  )
}

/**
 * Barrinhas de conexão de alguém na chamada, com tooltip que explica a
 * conexão ruim (perda de pacotes/latência quando medidas). Sem medida ainda:
 * nada aparece.
 */
function ConnectionQualityBars({
  userId,
  name,
  className
}: {
  userId: string
  name: string
  className?: string
}): React.JSX.Element | null {
  const quality = useCallStore((s) => s.connectionQuality[userId])
  const details = useCallStore((s) => s.qualityDetails[userId])
  const meId = useAuthStore((s) => s.user?.id)
  if (!quality || quality === 'unknown') return null
  const label = qualityTooltip(quality, userId === meId ? null : name, details)
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex shrink-0">
      <QualityBarsIcon quality={quality} className={className} />
    </span>
  )
}

export default ConnectionQualityBars
