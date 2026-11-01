import type { ScreenShareQuality } from '../lib/screenShareQuality'
import ScreenCodecControl from './ScreenCodecControl'
import ScreenSimulcastToggle from './ScreenSimulcastToggle'

export default function ScreenQualityControls({
  value,
  onChange,
  compact = false
}: {
  value: ScreenShareQuality
  onChange: (value: ScreenShareQuality) => void
  /** Painel da chamada: uma coluna, legenda só para leitor de tela e sem nota. */
  compact?: boolean
}): React.JSX.Element {
  const buttonClass = (selected: boolean): string =>
    `flex-1 cursor-pointer font-semibold transition-colors ${
      compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
    } ${selected ? 'bg-brand text-white' : 'bg-fg/5 text-gray-300 hover:bg-fg/10'}`
  const labelClass = compact
    ? 'mb-1.5 text-[11px] font-semibold text-gray-400'
    : 'mb-2 text-xs font-semibold text-gray-400'
  return (
    <fieldset className={compact ? 'mt-3' : 'mt-5 rounded-lg border border-subtle p-4'}>
      <legend className={compact ? 'sr-only' : 'px-1 text-xs font-bold uppercase text-gray-400'}>
        Qualidade da transmissão
      </legend>
      <div className={compact ? 'flex flex-col gap-3' : 'grid gap-4 sm:grid-cols-2'}>
        <div role="group" aria-label="Resolução">
          <p className={labelClass}>Resolução</p>
          <div className="flex overflow-hidden rounded-md">
            {(['720p', '1080p', 'source'] as const).map((resolution) => (
              <button
                key={resolution}
                type="button"
                aria-pressed={value.resolution === resolution}
                className={buttonClass(value.resolution === resolution)}
                onClick={() => onChange({ ...value, resolution })}
              >
                {resolution === 'source' ? 'Fonte' : resolution}
              </button>
            ))}
          </div>
        </div>
        <div role="group" aria-label="Taxa de quadros">
          <p className={labelClass}>Taxa de quadros</p>
          <div className="flex overflow-hidden rounded-md">
            {([30, 60] as const).map((frameRate) => (
              <button
                key={frameRate}
                type="button"
                aria-pressed={value.frameRate === frameRate}
                className={buttonClass(value.frameRate === frameRate)}
                onClick={() => onChange({ ...value, frameRate })}
              >
                {frameRate} FPS
              </button>
            ))}
          </div>
        </div>
      </div>
      <ScreenSimulcastToggle compact={compact} />
      <ScreenCodecControl compact={compact} />
      {!compact && (
        <p className="mt-3 text-xs text-gray-500">
          Fonte mantém a resolução original, até 1440p. Se a conexão ou o PC não derem conta, a
          qualidade baixa sozinha, sem passar de 720p 30, e volta quando puder.
        </p>
      )}
    </fieldset>
  )
}
