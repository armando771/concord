import { useCallStore } from '../../store/callStore'
import { showToast } from '../../store/toastStore'
import Button from '../Button'
import { VolumeIcon } from '../icons'
import ParticipantTile from './ParticipantTile'
import CallControlsDock from './CallControlsDock'
import CallStage from './CallStage'
import { formatDuration, useElapsed } from './callUtils'
import useSpeaking from './useSpeaking'

function VoiceChannelView({ channelId }: { channelId: string }): React.JSX.Element {
  const status = useCallStore((s) => s.status)
  const type = useCallStore((s) => s.type)
  const activeChannelId = useCallStore((s) => s.channelId)
  const startedAt = useCallStore((s) => s.startedAt)
  const serverCalls = useCallStore((s) => s.serverCalls)
  const joinVoiceChannel = useCallStore((s) => s.joinVoiceChannel)

  const connectedHere = status !== 'idle' && type === 'channel' && activeChannelId === channelId

  const elapsed = useElapsed(connectedHere ? startedAt : null)
  const speaking = useSpeaking()

  const handleJoin = (): void => {
    joinVoiceChannel(channelId).catch((err) => {
      showToast.error(err instanceof Error ? err.message : 'Falha ao entrar no canal de voz.')
    })
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {connectedHere && (
        <div className="absolute right-4 top-3 z-10 flex items-center gap-2 rounded-full border border-[#23a55a]/30 bg-[#23a55a]/15 px-3 py-1 text-xs font-semibold text-[#23a55a]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#23a55a]" />
          Voz conectada · {formatDuration(elapsed)}
        </div>
      )}

      <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
        {connectedHere ? (
          <CallStage speaking={speaking} />
        ) : (serverCalls[channelId]?.participants ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#23a55a]/40 bg-[#23a55a]/10 text-[#23a55a] shadow-lg">
              <VolumeIcon className="h-9 w-9" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Ninguém aqui ainda</h2>
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
                  display_name: p.display_name ?? p.username ?? 'Usuário',
                  avatar_url: p.avatar_url ?? null
                }}
                isScreen={(serverCalls[channelId]?.screen_sharing ?? []).includes(p.user_id)}
              />
            ))}
            <Button variant="success" onClick={handleJoin} className="px-6 py-2.5 font-semibold">
              Entrar na voz
            </Button>
          </div>
        )}
      </div>

      {connectedHere && <CallControlsDock />}
    </div>
  )
}

export default VoiceChannelView
