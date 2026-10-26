import { useEffect } from 'react'
import { useCallStore } from '../store/callStore'
import { useVoiceModStore } from '../store/voiceModStore'
import { PITCH_MAX, PITCH_MIN, PRESET_ORDER, VOICE_MOD_PRESETS } from '../lib/voiceModPresets'

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  display,
  hint,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  hint?: [string, string]
  onChange: (value: number) => void
}): React.JSX.Element {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-gray-200">{label}</span>
        <span className="font-semibold text-gray-400">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="h-1.5 w-full cursor-pointer accent-brand"
      />
      {hint && (
        <div className="mt-0.5 flex justify-between text-[10px] text-gray-500">
          <span>{hint[0]}</span>
          <span>{hint[1]}</span>
        </div>
      )}
    </div>
  )
}

function VoiceModPanel(): React.JSX.Element {
  const connected = useCallStore((s) => s.status === 'active')
  const preset = useVoiceModStore((s) => s.preset)
  const customized = useVoiceModStore((s) => s.customized)
  const pitch = useVoiceModStore((s) => s.pitch)
  const timbre = useVoiceModStore((s) => s.timbre)
  const intensity = useVoiceModStore((s) => s.intensity)
  const available = useVoiceModStore((s) => s.available)
  const monitoring = useVoiceModStore((s) => s.monitoring)
  const selectPreset = useVoiceModStore((s) => s.selectPreset)
  const setPitch = useVoiceModStore((s) => s.setPitch)
  const setTimbre = useVoiceModStore((s) => s.setTimbre)
  const setIntensity = useVoiceModStore((s) => s.setIntensity)
  const setMonitoring = useVoiceModStore((s) => s.setMonitoring)

  // Fechar a aba não pode deixar a própria voz tocando.
  useEffect(() => () => useVoiceModStore.getState().setMonitoring(false), [])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      {!available && (
        <p className="mb-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-warning">
          O voice mod não carregou neste PC. Sua voz segue normal.
        </p>
      )}

      <div className="mb-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Preset de voz">
        {PRESET_ORDER.map((id) => {
          const selected = id === preset
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!available}
              onClick={() => selectPreset(id)}
              className={`cursor-pointer rounded-xl border px-2 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                selected
                  ? 'border-brand bg-brand/20 text-strong'
                  : 'border-subtle bg-fg/[0.04] text-gray-300 hover:border-normal hover:bg-fg/[0.08]'
              }`}
            >
              {VOICE_MOD_PRESETS[id].label}
            </button>
          )
        })}
      </div>

      {customized && (
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Personalizado
        </p>
      )}

      <SliderRow
        label="Tom"
        value={pitch}
        min={PITCH_MIN}
        max={PITCH_MAX}
        step={1}
        display={`${pitch > 0 ? '+' : ''}${pitch} st`}
        onChange={setPitch}
      />
      <SliderRow
        label="Timbre"
        value={timbre}
        min={-1}
        max={1}
        step={0.05}
        display={`${Math.round(timbre * 100)}%`}
        hint={['Grosso', 'Fino']}
        onChange={setTimbre}
      />
      <SliderRow
        label="Intensidade"
        value={intensity}
        min={0}
        max={1}
        step={0.05}
        display={`${Math.round(intensity * 100)}%`}
        onChange={setIntensity}
      />

      <button
        type="button"
        disabled={!connected || !available}
        onClick={() => setMonitoring(!monitoring)}
        aria-pressed={monitoring}
        className={`w-full cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          monitoring
            ? 'bg-brand text-white hover:bg-brand-hover'
            : 'bg-fg/10 text-gray-200 hover:bg-fg/15'
        }`}
      >
        {monitoring ? 'Parar de ouvir' : 'Ouvir minha voz'}
      </button>
      <p className="mt-1 text-[10px] text-gray-500">
        {connected ? 'Use fone para evitar eco.' : 'Entre numa chamada para ouvir.'}
      </p>
    </div>
  )
}

export default VoiceModPanel
