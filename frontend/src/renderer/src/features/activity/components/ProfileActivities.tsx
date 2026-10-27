import { musicAccent } from '../../../../../shared/musicApps'
import type { ListeningActivity } from '../lib/listeningActivity'
import type { PresenceActivity } from '../lib/presenceActivity'
import { useActivity } from '../store/presenceActivityStore'
import { useListening } from '../store/listeningStore'
import { Elapsed } from './ActivityCard'
import GameIcon from './GameIcon'
import MusicIcon from './MusicIcon'
import TrackProgress from './TrackProgress'

function PlayingNow({ game }: { game: PresenceActivity }): React.JSX.Element {
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

/** "Ouvindo Spotify": música, artista, álbum e o tempo andando. */
export function ListeningNow({ listening }: { listening: ListeningActivity }): React.JSX.Element {
  const accent = musicAccent(listening.app) ?? '#5865f2'
  return (
    <div className="mt-3 rounded-lg bg-fg/5 p-2.5">
      <p className="truncate text-ds-xs font-bold uppercase text-gray-400">
        Ouvindo {listening.app}
      </p>
      <div className="mt-1.5 flex min-w-0 items-center gap-2.5">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
          style={{ background: `${accent}33` }}
        >
          <MusicIcon app={listening.app} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-ds-md font-semibold text-strong" title={listening.title}>
            {listening.title}
          </p>
          {listening.artist && (
            <p className="truncate text-ds-sm text-gray-300" title={listening.artist}>
              {listening.artist}
            </p>
          )}
          {listening.album && (
            <p className="truncate text-ds-xs text-gray-400" title={listening.album}>
              {listening.album}
            </p>
          )}
        </div>
      </div>
      <TrackProgress startedAt={listening.started_at} durationMs={listening.duration_ms} />
    </div>
  )
}

/** "Jogando agora" e "Ouvindo" no cartão de perfil; nada se não houver nenhum. */
export function ProfileActivities({ userId }: { userId: string | undefined }): React.JSX.Element {
  const game = useActivity(userId)
  const listening = useListening(userId)
  return (
    <>
      {game && <PlayingNow game={game} />}
      {listening && <ListeningNow listening={listening} />}
    </>
  )
}
