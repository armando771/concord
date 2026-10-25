import type { ScreenShareQuality } from '../../lib/screenShareQuality'

export default function ScreenQualityControls({
  value,
  onChange,
  disabled = false
}: {
  value: ScreenShareQuality
  onChange: (value: ScreenShareQuality) => void
  disabled?: boolean
}): React.JSX.Element {
  const buttonClass = (selected: boolean): string =>
    `flex-1 cursor-pointer px-3 py-2 text-sm font-semibold transition-colors ${selected ? 'bg-[#5865f2] text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`
  return (
    <fieldset
      disabled={disabled}
      className="mt-5 rounded-lg border border-white/10 p-4 disabled:opacity-60"
    >
      <legend className="px-1 text-xs font-bold uppercase text-gray-400">
        Qualidade da transmissão
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <div role="group" aria-label="Resolução">
          <p className="mb-2 text-xs font-semibold text-gray-400">Resolução</p>
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
          <p className="mb-2 text-xs font-semibold text-gray-400">Taxa de quadros</p>
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
      <p className="mt-3 text-xs text-gray-500">
        Fonte mantém a resolução original. A taxa de quadros depende da fonte, da conexão e do
        desempenho do dispositivo.
      </p>
    </fieldset>
  )
}
