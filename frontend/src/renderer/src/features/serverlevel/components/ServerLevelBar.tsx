import { formatXP, serverLevelPercent, type ServerLevelProgress } from '../lib/serverLevel'

/** "Nível N", a barra e o XP dentro do nível. */
function ServerLevelBar({ progress }: { progress: ServerLevelProgress }): React.JSX.Element {
  const percent = serverLevelPercent(progress)
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-ds-xs">
        <span className="font-bold text-violet-300">Nível {progress.level}</span>
        <span className="truncate text-gray-400">
          {formatXP(progress.xp_into_level)}/{formatXP(progress.xp_for_next)} XP
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`Progresso para o nível ${progress.level + 1}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 overflow-hidden rounded-full bg-fg/10"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-700"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export default ServerLevelBar
