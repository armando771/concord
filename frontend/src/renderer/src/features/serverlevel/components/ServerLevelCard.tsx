import { useServerLevel } from '../hooks/useServerLevel'
import ServerLevelBar from './ServerLevelBar'

/** O nível no topo do menu do servidor; clicar abre o detalhamento. */
function ServerLevelCard({
  serverId,
  onOpen
}: {
  serverId: string
  onOpen: () => void
}): React.JSX.Element | null {
  const progress = useServerLevel(serverId)
  if (!progress) return null
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mb-1 block w-full cursor-pointer rounded-lg border border-subtle bg-fg/5 px-2.5 py-2 text-left hover:bg-fg/10"
    >
      <ServerLevelBar progress={progress} />
      <span className="mt-1.5 block text-ds-xs text-gray-400">Ver de onde vem o XP</span>
    </button>
  )
}

export default ServerLevelCard
