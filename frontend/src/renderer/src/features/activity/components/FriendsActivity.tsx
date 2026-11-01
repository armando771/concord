import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PublicUser } from '../../auth/store/authStore'
import { playingFriends } from '../lib/presenceActivity'
import { listeningFriends } from '../lib/listeningActivity'
import { usePresenceActivityStore } from '../store/presenceActivityStore'
import { useListeningStore } from '../store/listeningStore'
import { ActivityCard } from './ActivityCard'
import { ListeningCard } from './ListeningCard'

/** "Atividade — N" da tela de Amigos: quem está jogando e, depois, quem está ouvindo música. */
export function FriendsActivity({ friends }: { friends: PublicUser[] }): React.JSX.Element | null {
  const navigate = useNavigate()
  const games = usePresenceActivityStore((s) => s.byUser)
  const music = useListeningStore((s) => s.byUser)
  const playing = useMemo(() => playingFriends(friends, games), [friends, games])
  const listening = useMemo(
    () => listeningFriends(friends, music, new Set(playing.map((p) => p.friend.id))),
    [friends, music, playing]
  )
  const total = playing.length + listening.length
  if (total === 0) return null
  return (
    <>
      <h2 className="text-ds-lg font-bold text-strong">Atividade — {total}</h2>
      <div className="mt-3 mb-6 flex flex-col gap-2">
        {playing.map(({ friend, activity }) => (
          <ActivityCard
            key={friend.id}
            user={friend}
            activity={activity}
            onClick={() => navigate(`/dm/${friend.id}`)}
          />
        ))}
        {listening.map(({ friend, listening: track }) => (
          <ListeningCard
            key={friend.id}
            user={friend}
            listening={track}
            onClick={() => navigate(`/dm/${friend.id}`)}
          />
        ))}
      </div>
    </>
  )
}
