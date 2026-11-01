import { useState } from 'react'
import { useLevelStore } from '../store/levelStore'
import { levelTier, milestoneFor } from '../lib/levels'
import { SPECIAL_BADGE_LEVELS } from '../lib/levelBadgeStyle'

const LEVELS = [1, 5, 15, 25, 35, 45, 55, 65, 75, 85, 95, 105, 120, 250]
const MILESTONES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

const chip =
  'cursor-pointer rounded-md bg-fg/10 px-2 py-1 text-xs font-semibold text-gray-200 hover:bg-fg/20'

/**
 * Só em dev (import.meta.env.DEV): toca a animação de subir para qualquer
 * nível em você, sem subir de verdade. No console: `__salinhaLevelUp(85)`,
 * `__salinhaLevelUp('marco')` (próximo marco).
 */
function LevelUpPreview(): React.JSX.Element {
  const preview = useLevelStore((s) => s.previewLevelUp)
  const previewNext = useLevelStore((s) => s.previewNextMilestone)
  const [level, setLevel] = useState('42')

  return (
    <div className="rounded-xl border border-dashed border-amber-400/40 bg-amber-400/5 p-4">
      <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-300">
        Prévia da subida de nível (dev)
      </h3>
      <p className="mb-3 text-xs text-gray-400">
        Toca a animação em você sem mudar o seu nível de verdade.
      </p>

      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Níveis</p>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {LEVELS.map((value) => (
          <button key={value} onClick={() => preview(value)} className={chip}>
            Nv {value}
          </button>
        ))}
      </div>

      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        Selos especiais
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {SPECIAL_BADGE_LEVELS.map((value) => (
          <button key={value} onClick={() => preview(value)} className={chip}>
            Nv {value}
          </button>
        ))}
      </div>

      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Marcos</p>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {MILESTONES.map((value) => (
          <button
            key={value}
            onClick={() => preview(value)}
            title={milestoneFor(value)?.title}
            className={chip}
            style={{ boxShadow: `inset 0 -2px 0 ${levelTier(value).color}` }}
          >
            {value} · {levelTier(value).name}
          </button>
        ))}
        <button
          onClick={previewNext}
          className="cursor-pointer rounded-md bg-amber-500/20 px-2 py-1 text-xs font-bold text-amber-200 hover:bg-amber-500/30"
        >
          Próximo marco
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="number"
          min={1}
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && preview(Number(level))}
          aria-label="Nível da prévia"
          className="w-20 rounded-md border border-subtle bg-input px-2 py-1 text-xs text-strong"
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
