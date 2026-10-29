import { useScreenCodecStore } from '../store/screenCodecStore'
import { useScreenCodecSupport } from '../hooks/useScreenCodecSupport'
import { codecChoices, type ScreenCodecPreference } from '../lib/screenCodec'
import type { ScreenCodecSupport, ScreenVideoCodec } from '../lib/screenCodecSupport'

const LABELS: Record<ScreenCodecPreference, string> = {
  auto: 'Automático',
  av1: 'AV1',
  h265: 'H.265',
  h264: 'H.264',
  vp8: 'VP8'
}
const CODECS: ScreenVideoCodec[] = ['av1', 'h265', 'h264', 'vp8']
const NO_CARD = 'Sua placa não codifica'

/** "AV1 e H.265: sua placa não codifica." (null enquanto detecta). */
function unavailableHint(usable: Record<ScreenVideoCodec, boolean> | null): string | null {
  const missing = CODECS.filter((codec) => usable && !usable[codec]).map((codec) => LABELS[codec])
  return missing.length ? `${missing.join(' e ')}: sua placa não codifica.` : null
}

/** "Avançado" do seletor de qualidade: o codec da live (Automático = o melhor da placa de vídeo). */
export function ScreenCodecOptions({
  value,
  support,
  onChange,
  compact
}: {
  value: ScreenCodecPreference
  /** null = ainda detectando (tudo habilitado). */
  support: ScreenCodecSupport | null
  onChange: (value: ScreenCodecPreference) => void
  compact: boolean
}): React.JSX.Element {
  const size = compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
  const usable = support && codecChoices(support)
  const hint = unavailableHint(usable)
  const option = (choice: ScreenCodecPreference, wide = false): React.JSX.Element => {
    const disabled = choice !== 'auto' && !!usable && !usable[choice]
    return (
      <button
        key={choice}
        type="button"
        aria-pressed={value === choice}
        disabled={disabled}
        title={disabled ? NO_CARD : undefined}
        onClick={() => onChange(choice)}
        className={`min-w-0 font-semibold transition-colors ${size} ${wide ? 'col-span-4' : ''} ${
          value === choice ? 'bg-brand text-white' : 'bg-fg/5 text-gray-300'
        } ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-fg/10'}`}
      >
        {LABELS[choice]}
      </button>
    )
  }
  return (
    <details className={compact ? 'mt-3' : 'mt-4'}>
      <summary className="cursor-pointer rounded text-xs font-semibold text-gray-400 hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-brand">
        Avançado
      </summary>
      <div role="group" aria-label="Codec" className="mt-2">
        <p className="mb-1.5 text-[11px] font-semibold text-gray-400">Codec</p>
        <div className="grid grid-cols-4 gap-px overflow-hidden rounded-md">
          {option('auto', true)}
          {CODECS.map((codec) => option(codec))}
        </div>
        {hint && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
        <p className="mt-1.5 text-xs text-gray-500">
          {compact
            ? 'Vale a partir da próxima transmissão.'
            : 'Automático usa o melhor que a sua placa de vídeo codifica: AV1, depois H.265, depois H.264. Use VP8 se a transmissão falhar para alguém.'}
        </p>
      </div>
    </details>
  )
}

export default function ScreenCodecControl({ compact }: { compact: boolean }): React.JSX.Element {
  const preference = useScreenCodecStore((s) => s.preference)
  const setPreference = useScreenCodecStore((s) => s.setPreference)
  const support = useScreenCodecSupport()
  return (
    <ScreenCodecOptions
      value={preference}
      support={support}
      onChange={setPreference}
      compact={compact}
    />
  )
}
