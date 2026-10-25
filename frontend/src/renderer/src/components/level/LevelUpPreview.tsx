import { useState } from 'react'
import { useLevelStore } from '../../store/levelStore'

const PRESETS = [5, 25, 45, 65, 85, 100, 30]

/**
 * Só em dev (import.meta.env.DEV): toca a animação de subir para qualquer
 * nível em você, sem subir de verdade. No console: `__salinhaLevelUp(85)`.
 */
function LevelUpPreview(): React.JSX.Element {
  const preview = useLevelStore((s) => s.previewLevelUp)
  const [level, setLevel] = useState('42')

  return (
    <div className="rounded-xl border border-dashed border-amber-400/40 bg-amber-400/5 p-4">
      <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-300">
        Prévia da subida de nível (dev)
      </h3>
      <p className="mb-3 text-xs text-gray-400">
        Toca a animação em você sem mudar o seu nível de verdade.
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((value) => (
          <button
            key={value}
            onClick={() => preview(value)}
            className="cursor-pointer rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-gray-200 hover:bg-white/20"
          >
            {value % 10 === 0 && value < 100 ? `Marco ${value}` : `Nv ${value}`}
          </button>
        ))}
        <input
          type="number"
          min={1}
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          aria-label="Nível da prévia"
          className="w-16 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-white"
        />
        <button
          onClick={() => preview(Number(level))}
          className="cursor-pointer rounded-md bg-amber-500/80 px-2 py-1 text-xs font-bold text-black hover:bg-amber-400"
        >
          Tocar
        </button>
      </div>
    </div>
  )
}

export default LevelUpPreview
