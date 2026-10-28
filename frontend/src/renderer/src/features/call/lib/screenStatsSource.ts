import { Track } from 'livekit-client'
import type { ScreenStatsInput } from './screenStats'

// Lê, sob demanda, o getStats() do vídeo da live (o meu envio ou a recepção da
// de outra pessoa) e o estado da publicação. Só roda com o painel aberto.

interface StatsTrack {
  getRTCStatsReport(): Promise<RTCStatsReport | undefined>
}

export interface StatsRoomLike {
  localParticipant: {
    getTrackPublication(source: Track.Source):
      | {
          videoTrack?: StatsTrack & {
            publishOptions?: { screenShareEncoding?: { maxFramerate?: number } }
          }
        }
      | undefined
  }
  remoteParticipants: Map<
    string,
    {
      getTrackPublication(
        source: Track.Source
      ): { isEnabled: boolean; track?: StatsTrack & { streamState: string } } | undefined
    }
  >
}

const EMPTY = (): RTCStatsReport => new Map() as unknown as RTCStatsReport

async function readLocal(room: StatsRoomLike): Promise<ScreenStatsInput | null> {
  const track = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.videoTrack
  if (!track) return null
  return {
    local: true,
    report: (await track.getRTCStatsReport()) ?? EMPTY(),
    enabled: true,
    streamState: 'active',
    requestedFps: track.publishOptions?.screenShareEncoding?.maxFramerate ?? null
  }
}

async function readRemote(room: StatsRoomLike, userId: string): Promise<ScreenStatsInput | null> {
  const publication = room.remoteParticipants
    .get(userId)
    ?.getTrackPublication(Track.Source.ScreenShare)
  if (!publication) return null
  return {
    local: false,
    report: (await publication.track?.getRTCStatsReport()) ?? EMPTY(),
    enabled: publication.isEnabled,
    streamState: publication.track?.streamState ?? 'active',
    requestedFps: null
  }
}

/** null = essa live não está publicada (acabou ou ainda não chegou). */
export function readScreenStatsInput(
  room: StatsRoomLike,
  userId: string,
  local: boolean
): Promise<ScreenStatsInput | null> {
  return local ? readLocal(room) : readRemote(room, userId)
}

export interface ScreenStatsReader {
  readScreenStats(userId: string, local: boolean): Promise<ScreenStatsInput | null>
}

// A chamada atual (o CallMedia se registra ao nascer e sai ao desconectar):
// o painel lê sem passar pelo callStore.
let active: ScreenStatsReader | null = null

export function setActiveScreenStats(reader: ScreenStatsReader): void {
  active = reader
}

export function clearActiveScreenStats(reader: ScreenStatsReader): void {
  if (active === reader) active = null
}

export async function readActiveScreenStats(
  userId: string,
  local: boolean
): Promise<ScreenStatsInput | null> {
  return (await active?.readScreenStats(userId, local)) ?? null
}
