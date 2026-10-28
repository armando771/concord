import { useServerLevel } from '../hooks/useServerLevel'

/** Selo "Nv. N" ao lado do nome do servidor no cabeçalho. */
function ServerLevelChip({ serverId }: { serverId: string }): React.JSX.Element | null {
  const progress = useServerLevel(serverId)
  if (!progress) return null
  return (
    <span
      title={`Nível ${progress.level} do servidor`}
      className="shrink-0 rounded-md bg-violet-600/20 px-1.5 py-0.5 text-[10px] font-bold leading-none text-violet-300"
    >
      Nv. {progress.level}
    </span>
  )
}

export default ServerLevelChip
