// Organiza as tracks remotas do LiveKit no formato que a UI de chamada já usa
// (um MediaStream por usuário e por tipo). Sem dependência do livekit-client
// para poder ser testado isolado.

/** Valores de Track.Source do livekit-client. */
export type TrackSourceName =
  'microphone' | 'camera' | 'screen_share' | 'screen_share_audio' | string

export interface TrackEntry {
  userId: string
  source: TrackSourceName
  track: MediaStreamTrack
}

export type MediaKind = 'voice' | 'screen' | 'screenAudio' | 'camera'

export type GroupedTracks = Record<MediaKind, Record<string, MediaStreamTrack[]>>

const KIND_BY_SOURCE: Record<string, MediaKind> = {
  microphone: 'voice',
  camera: 'camera',
  screen_share: 'screen',
  screen_share_audio: 'screenAudio'
}

export function groupTracks(entries: TrackEntry[]): GroupedTracks {
  const grouped: GroupedTracks = { voice: {}, screen: {}, screenAudio: {}, camera: {} }
  for (const { userId, source, track } of entries) {
    const kind = KIND_BY_SOURCE[source]
    if (!kind) continue
    ;(grouped[kind][userId] ??= []).push(track)
  }
  return grouped
}

export interface PublicationEntry {
  userId: string
  source: TrackSourceName
}

const SCREEN_SOURCES = new Set<TrackSourceName>(['screen_share', 'screen_share_audio'])

/**
 * Se devo baixar essa publicação: microfone/câmera sempre; tela e som da tela
 * só de quem estou assistindo (transmissão começa pausada).
 */
export function wantsSubscription(
  source: TrackSourceName,
  userId: string,
  watched: ReadonlySet<string>
): boolean {
  return !SCREEN_SOURCES.has(source) || watched.has(userId)
}

/** Quem publica tela (assinada ou não), sem repetir, na ordem de chegada. */
export function listScreenPublishers(pubs: PublicationEntry[]): string[] {
  const ids = new Set<string>()
  for (const { userId, source } of pubs) {
    if (source === 'screen_share') ids.add(userId)
  }
  return [...ids]
}

/**
 * Mantém o mesmo objeto de stream enquanto o conjunto de tracks não muda —
 * evita que <video>/<audio> e o analisador de fala reiniciem a cada evento.
 */
export class StreamCache<T> {
  private entries = new Map<string, { signature: string; stream: T }>()

  constructor(private readonly create: (tracks: MediaStreamTrack[]) => T) {}

  get(key: string, tracks: MediaStreamTrack[]): T {
    const signature = tracks.map((t) => t.id).join(',')
    const cached = this.entries.get(key)
    if (cached && cached.signature === signature) return cached.stream
    const stream = this.create(tracks)
    this.entries.set(key, { signature, stream })
    return stream
  }

  /** Remove as chaves fora de `inUse`. */
  prune(inUse: Set<string>): void {
    for (const key of this.entries.keys()) {
      if (!inUse.has(key)) this.entries.delete(key)
    }
  }

  clear(): void {
    this.entries.clear()
  }
}
