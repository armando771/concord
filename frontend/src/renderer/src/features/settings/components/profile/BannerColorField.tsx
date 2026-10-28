import { ColorSwatch } from './controls'

/** Cores prontas para um toque (a amostra abre o seletor para qualquer outra). */
const QUICK_COLORS = [
  { hex: '#5865f2', name: 'Anil' },
  { hex: '#7c3aed', name: 'Roxo' },
  { hex: '#db2777', name: 'Rosa' },
  { hex: '#dc2626', name: 'Vermelho' },
  { hex: '#ea580c', name: 'Laranja' },
  { hex: '#ca8a04', name: 'Mostarda' },
  { hex: '#16a34a', name: 'Verde' },
  { hex: '#0891b2', name: 'Ciano' },
  { hex: '#334155', name: 'Ardósia' },
  { hex: '#111827', name: 'Preto' }
]

/** Cor do banner: as prontas, o seletor livre e voltar ao degradê padrão. */
export default function BannerColorField({
  value,
  error,
  onChange
}: {
  value: string | null
  error?: string
  onChange: (color: string | null) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-gray-400">A cor aparece quando não há imagem de banner.</p>
      <div role="group" aria-label="Cores prontas" className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {QUICK_COLORS.map(({ hex: c, name }) => (
          <button
            key={c}
            type="button"
            aria-label={name}
            aria-pressed={value === c}
            title={name}
            onClick={() => onChange(c)}
            className={`aspect-square min-h-10 cursor-pointer rounded-lg border transition-transform hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              value === c ? 'border-white ring-2 ring-brand' : 'border-subtle'
            }`}
            style={{ background: c }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ColorSwatch label="Outra cor" value={value ?? '#5865f2'} onChange={onChange} />
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="min-h-10 cursor-pointer rounded-md px-2 text-xs text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Usar a cor padrão
          </button>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
