import { useScreenSimulcastStore } from '../store/screenSimulcastStore'
import type { SimulcastMode } from '../lib/screenSimulcast'

const MODES: { mode: SimulcastMode; label: string }[] = [
  { mode: 'auto', label: 'Automático' },
  { mode: 'on', label: 'Ligada' },
  { mode: 'off', label: 'Desligada' }
]

/** Camada extra de 720p (simulcast) para quem assiste com internet fraca. */
export function ScreenSimulcastOption({
  value,
  onChange,
  compact
}: {
  value: SimulcastMode
  onChange: (mode: SimulcastMode) => void
  compact: boolean
}): React.JSX.Element {
  const size = compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
  return (
    <div role="group" aria-label="Enviar também em 720p" className={compact ? 'mt-3' : 'mt-4'}>
      <p className="mb-1.5 text-[11px] font-semibold text-gray-400">
        Enviar também em 720p para quem tem internet fraca
      </p>
      <div className="flex overflow-hidden rounded-md">
        {MODES.map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            aria-pressed={value === mode}
            onClick={() => onChange(mode)}
            className={`min-w-0 flex-1 cursor-pointer font-semibold transition-colors ${size} ${
              value === mode ? 'bg-brand text-white' : 'bg-fg/5 text-gray-300 hover:bg-fg/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-gray-500">
        {compact
          ? 'Automático liga quando a sua placa de vídeo aguenta. Vale a partir da próxima transmissão.'
          : 'Automático liga quando a sua placa de vídeo aguenta; no processador fica desligada, porque deixa a transmissão mais pesada para o seu PC. Só vale em 1080p ou Fonte.'}
      </p>
    </div>
  )
}

export default function ScreenSimulcastToggle({
  compact
}: {
  compact: boolean
}): React.JSX.Element {
  const mode = useScreenSimulcastStore((s) => s.mode)
  const setMode = useScreenSimulcastStore((s) => s.setMode)
  return <ScreenSimulcastOption value={mode} onChange={setMode} compact={compact} />
}
