import { useScreenCodecStore } from '../store/screenCodecStore'
import type { ScreenCodecPreference } from '../lib/screenCodec'

const OPTIONS: { value: ScreenCodecPreference; label: string }[] = [
  { value: 'auto', label: 'Automático' },
  { value: 'vp8', label: 'VP8' }
]

/** "Avançado" do seletor de qualidade: o codec da live (Automático = H.264). */
export function ScreenCodecOptions({
  value,
  onChange,
  compact
}: {
  value: ScreenCodecPreference
  onChange: (value: ScreenCodecPreference) => void
  compact: boolean
}): React.JSX.Element {
  const size = compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
  return (
    <details className={compact ? 'mt-3' : 'mt-4'}>
      <summary className="cursor-pointer rounded text-xs font-semibold text-gray-400 hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-brand">
        Avançado
      </summary>
      <div role="group" aria-label="Codec" className="mt-2">
        <p className="mb-1.5 text-[11px] font-semibold text-gray-400">Codec</p>
        <div className="flex overflow-hidden rounded-md">
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={value === option.value}
              onClick={() => onChange(option.value)}
              className={`flex-1 cursor-pointer font-semibold transition-colors ${size} ${
                value === option.value
                  ? 'bg-brand text-white'
                  : 'bg-fg/5 text-gray-300 hover:bg-fg/10'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-gray-500">
          {compact
            ? 'Vale a partir da próxima transmissão.'
            : 'Automático usa H.264. Use VP8 se a transmissão falhar para alguém.'}
        </p>
      </div>
    </details>
  )
}

export default function ScreenCodecControl({ compact }: { compact: boolean }): React.JSX.Element {
  const preference = useScreenCodecStore((s) => s.preference)
  const setPreference = useScreenCodecStore((s) => s.setPreference)
  return <ScreenCodecOptions value={preference} onChange={setPreference} compact={compact} />
}
