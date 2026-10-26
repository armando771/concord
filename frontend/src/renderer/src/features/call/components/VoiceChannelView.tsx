import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useCallStore } from '../store/callStore'
import { useMusicStore } from '../../music/store/musicStore'
import { MAESTRO_NAME } from '../../music/lib/music'
import MusicPanel from '../../music/components/MusicPanel'
import { useMusicWatching } from '../../music/hooks/useMusicWatching'
import { useServerStore } from '../../servers/store/serverStore'
import { useServerNicknames } from '../../servers/hooks/useServerNames'
import { serverDisplayName } from '../../servers/lib/serverNames'
import { showToast } from '../../../shared/store/toastStore'
import Button from '../../../shared/ui/Button'
import { VolumeIcon } from '../../../shared/ui/icons'
import { boostRank } from '../../levels/lib/boost'
import StyleRank from '../../levels/components/StyleRank'
import { useMyBoostPercent } from '../../levels/hooks/useMyBoost'
import ParticipantTile from './ParticipantTile'
import CallControlsDock from './CallControlsDock'
import CallStage from './CallStage'
import { formatDuration, useElapsed } from '../lib/callUtils'
import useSpeaking from '../hooks/useSpeaking'

function VoiceChannelView({ channelId }: { channelId: string }): React.JSX.Element {
  const status = useCallStore((s) => s.status)
  const type = useCallStore((s) => s.type)
  const activeChannelId = useCallStore((s) => s.channelId)
  const startedAt = useCallStore((s) => s.startedAt)
  const serverCalls = useCallStore((s) => s.serverCalls)
  const joinVoiceChannel = useCallStore((s) => s.joinVoiceChannel)
  // O canal é do servidor aberto: nomes com o apelido de lá.
  const nicknames = useServerNicknames(useServerStore((s) => s.currentServer?.id))
  const { id: serverId } = useParams<{ id: string }>()
  const callId = useCallStore((s) => s.callId)
  const loadState = useMusicStore((s) => s.loadState)
  const clearState = useMusicStore((s) => s.clearState)
  const maestroHere = useMusicStore((s) =>
    (serverId ? s.presence[serverId] : undefined)?.includes(channelId)
  )

  const connectedHere = status !== 'idle' && type === 'channel' && activeChannelId === channelId

  const boostPercent = useMyBoostPercent()
  const rank = connectedHere ? boostRank(boostPercent) : null
  const muted = useCallStore((s) => s.muted)
  const deafened = useCallStore((s) => s.deafened)

  const elapsed = useElapsed(connectedHere ? startedAt : null)
  const speaking = useSpeaking()
  useMusicWatching(connectedHere ? serverId : null)

  useEffect(() => {
    if (!connectedHere || !serverId) return
    void loadState(serverId).catch(() => {})
    return () => clearState()
  }, [connectedHere, serverId, callId, loadState, clearState])

  const handleJoin = (): void => {
    joinVoiceChannel(channelId).catch((err) => {
      showToast.error(err instanceof Error ? err.message : 'Falha ao entrar no canal de voz.')
    })
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {rank?.aura && !(muted || deafened) && (
        <span
          aria-hidden="true"
          className="boost-aura boost-motion pointer-events-none absolute inset-0 z-0"
          style={{ '--boost-color': `${rank.color}66` } as React.CSSProperties}
        />
      )}
      {connectedHere && (
        <div className="absolute right-4 top-3 z-10 flex items-center gap-2 rounded-full border border-success/30 bg-success/15 px-3 py-1 text-xs font-semibold text-success">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          Voz conectada · {formatDuration(elapsed)}
        </div>
      )}
      {connectedHere && rank && (
        <div className="absolute left-4 top-3 z-10 rounded-xl border border-subtle bg-floating px-3 py-1.5 backdrop-blur">
          <StyleRank percent={boostPercent} paused={muted || deafened} size="md" />
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
          {connectedHere ? (
            <CallStage speaking={speaking} serverId={serverId} />
          ) : (serverCalls[channelId]?.participants ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-success/40 bg-success/10 text-success shadow-lg">
                <VolumeIcon className="h-9 w-9" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-strong">Ninguém aqui ainda</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Entre na voz para conversar com os membros do servidor.
                </p>
              </div>
              <Button variant="success" onClick={handleJoin} className="px-6 py-2.5 font-semibold">
                Entrar na voz
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-4">
              {(serverCalls[channelId]?.participants ?? []).map((p) => (
                <ParticipantTile
                  key={p.user_id}
                  user={{
                    id: p.user_id,
                    username: p.username ?? '',
                    display_name: serverDisplayName({ nickname: nicknames?.[p.user_id] }, p),
                    avatar_url: p.avatar_url ?? null,
                    name_style: nicknames?.[p.user_id] ? null : p.name_style
                  }}
                  isScreen={(serverCalls[channelId]?.screen_sharing ?? []).includes(p.user_id)}
                />
              ))}
              {maestroHere && (
                <ParticipantTile
                  user={{
                    id: 'bot-music:' + channelId,
                    username: '',
                    display_name: MAESTRO_NAME,
                    avatar_url: null
                  }}
                />
              )}
              <Button variant="success" onClick={handleJoin} className="px-6 py-2.5 font-semibold">
                Entrar na voz
              </Button>
            </div>
          )}
        </div>
      </div>
      {connectedHere && serverId && <MusicPanel serverId={serverId} />}

      {connectedHere && <CallControlsDock />}
    </div>
  )
}

export default VoiceChannelView
