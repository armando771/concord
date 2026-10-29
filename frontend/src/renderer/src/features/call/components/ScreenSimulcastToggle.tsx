import { useScreenSimulcastStore } from '../store/screenSimulcastStore'

/** Camada extra de 720p (simulcast) para quem assiste com internet fraca. */
export function ScreenSimulcastOption({
  checked,
  onChange,
  compact
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  compact: boolean
}): React.JSX.Element {
  return (
    <div className={compact ? 'mt-3' : 'mt-4'}>
      <label className="flex min-h-6 cursor-pointer items-start gap-2 text-xs font-semibold text-gray-300">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand"
        />
        <span>Enviar também em 720p para quem tem internet fraca</span>
      </label>
      <p className="mt-1 pl-6 text-xs text-gray-500">
        {compact
          ? 'Mais pesado para o seu PC. Vale a partir da próxima transmissão.'
          : 'Deixa a transmissão mais pesada para o seu PC. Só vale em 1080p ou Fonte.'}
      </p>
    </div>
  )
}

export default function ScreenSimulcastToggle({
  compact
}: {
  compact: boolean
}): React.JSX.Element {
  const enabled = useScreenSimulcastStore((s) => s.enabled)
  const setEnabled = useScreenSimulcastStore((s) => s.setEnabled)
  return <ScreenSimulcastOption checked={enabled} onChange={setEnabled} compact={compact} />
}
