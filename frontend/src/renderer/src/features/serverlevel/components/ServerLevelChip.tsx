import { useServerLevel } from '../hooks/useServerLevel'
import { serverLevelBadge } from '../lib/serverLevelScene'
import './serverLevelUp.css'

/** Selo "Nv. N" ao lado do nome do servidor, no material da faixa (bronze, prata, ouro…). */
function ServerLevelChip({ serverId }: { serverId: string }): React.JSX.Element | null {
  const progress = useServerLevel(serverId)
  if (!progress) return null
  const look = serverLevelBadge(progress.level)
  return (
    <span
      title={`Nível ${progress.level} do servidor · ${look.name}`}
      data-tier={look.name}
      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none ${look.className}`}
      style={look.style}
    >
      Nv. {progress.level}
    </span>
  )
}

export default ServerLevelChip
