import { useActivity } from '../store/presenceActivityStore'
import { Elapsed } from './ActivityCard'
import GameIcon from './GameIcon'

/** "Jogando agora" no cartão de perfil; nada se a pessoa não está jogando. */
export function ProfileActivities({ userId }: { userId: string | undefined }): React.JSX.Element | null {
  const game = useActivity(userId)
  if (!game) return null
  return (
    <div className="mt-3 rounded-lg bg-fg/5 p-2.5">
      <p className="text-ds-xs font-bold uppercase text-gray-400">Jogando agora</p>
      <p className="mt-1 flex items-center gap-1.5 text-ds-md font-semibold text-strong">
        <GameIcon
          name={game.name}
          appId={game.app_id}
          iconHash={game.icon_hash}
          className="h-4 w-4 shrink-0"
        />
        <span className="truncate">{game.name}</span>
        <span className="shrink-0 text-ds-xs font-normal text-gray-400">
          <Elapsed startedAt={game.started_at} />
        </span>
      </p>
    </div>
  )
}
