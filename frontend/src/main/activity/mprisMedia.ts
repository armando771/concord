import { execFile } from 'child_process'
import type { MediaSession } from './mediaSessions'

// Linux: os players de mídia pelo MPRIS (D-Bus da sessão), lidos com o
// `busctl --json` do systemd. Sem dependência nova; sem busctl (distro sem
// systemd), simplesmente não detecta nada (docs/adr/0006-musica-em-atividade.md).

const MPRIS_PREFIX = 'org.mpris.MediaPlayer2.'
const MPRIS_PATH = '/org/mpris/MediaPlayer2'
/** Mais players que isso abertos ao mesmo tempo é exagero: lê só os primeiros. */
const MAX_PLAYERS = 8
const POLL_INTERVAL_MS = 3000

/** Roda o busctl com estes argumentos; null se falhou. */
export type BusctlRun = (args: string[]) => Promise<string | null>

type Raw = Record<string, unknown>

const isRecord = (value: unknown): value is Raw => typeof value === 'object' && value !== null

function parseJson(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

/** O `data` de um valor do busctl ({ type, data }). */
function dataOf(value: unknown): unknown {
  return isRecord(value) ? value.data : undefined
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const micros = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value / 1000) : 0

/** Artistas: no MPRIS é uma lista de textos. */
function artists(value: unknown): string {
  if (!Array.isArray(value)) return text(value)
  return value.filter((a): a is string => typeof a === 'string').join(', ')
}

/** Saída do ListNames → nomes dos players (sem o do próprio app: chromium.instance<pid>). */
export function parseBusNames(json: string, ownPid: number): string[] {
  const data = dataOf(parseJson(json))
  const names = Array.isArray(data) && Array.isArray(data[0]) ? (data[0] as unknown[]) : []
  return names
    .filter((n): n is string => typeof n === 'string' && n.startsWith(MPRIS_PREFIX))
    .filter((n) => !n.endsWith(`.instance${ownPid}`))
    .slice(0, MAX_PLAYERS)
}

/** Saída do get-property Identity → nome do player ("Spotify"). */
export function parseIdentity(json: string): string {
  return text(dataOf(parseJson(json)))
}

/** Saída do GetAll de org.mpris.MediaPlayer2.Player → sessão (sem a origem). */
export function parsePlayer(json: string): Omit<MediaSession, 'source'> | null {
  const data = dataOf(parseJson(json))
  const props = Array.isArray(data) ? data[0] : undefined
  if (!isRecord(props)) return null
  const meta = dataOf(props.Metadata)
  const get = (key: string): unknown => (isRecord(meta) ? dataOf(meta[key]) : undefined)
  const url = text(get('xesam:url'))
  return {
    title: text(get('xesam:title')),
    artist: artists(get('xesam:artist')),
    album: text(get('xesam:album')),
    ...(url ? { url } : {}),
    playing: dataOf(props.PlaybackStatus) === 'Playing',
    positionMs: micros(dataOf(props.Position)),
    durationMs: micros(get('mpris:length'))
  }
}

async function identityOf(
  run: BusctlRun,
  name: string,
  cache: Map<string, string>
): Promise<string> {
  const cached = cache.get(name)
  if (cached !== undefined) return cached
  const out = await run(['get-property', name, MPRIS_PATH, 'org.mpris.MediaPlayer2', 'Identity'])
  const identity = out ? parseIdentity(out) : ''
  cache.set(name, identity)
  return identity
}

async function readPlayer(
  run: BusctlRun,
  name: string,
  identities: Map<string, string>
): Promise<MediaSession | null> {
  const out = await run([
    'call',
    name,
    MPRIS_PATH,
    'org.freedesktop.DBus.Properties',
    'GetAll',
    's',
    'org.mpris.MediaPlayer2.Player'
  ])
  const player = out ? parsePlayer(out) : null
  if (!player) return null
  const identity = await identityOf(run, name, identities)
  return { source: `${name.slice(MPRIS_PREFIX.length)} ${identity}`.trim(), ...player }
}

/** Todas as sessões MPRIS agora. `identities` guarda o Identity de cada player entre leituras. */
export async function readMprisSessions(
  run: BusctlRun,
  ownPid: number,
  identities = new Map<string, string>()
): Promise<MediaSession[]> {
  const list = await run([
    'call',
    'org.freedesktop.DBus',
    '/org/freedesktop/DBus',
    'org.freedesktop.DBus',
    'ListNames'
  ])
  const names = list ? parseBusNames(list, ownPid) : []
  // Player que fechou sai do cache (o Firefox troca de nome a cada abertura).
  for (const known of identities.keys()) if (!names.includes(known)) identities.delete(known)
  const sessions = await Promise.all(names.map((name) => readPlayer(run, name, identities)))
  return sessions.filter((s): s is MediaSession => s !== null)
}

const runBusctl: BusctlRun = (args) =>
  new Promise((resolve) => {
    execFile('busctl', ['--user', '--json=short', ...args], { timeout: 2000 }, (error, stdout) =>
      resolve(error ? null : stdout)
    )
  })

/** Lê os players a cada 3 s e repassa as sessões. Devolve o "parar". */
export function watchMpris(onSessions: (sessions: MediaSession[]) => void): () => void {
  const identities = new Map<string, string>()
  let busy = false
  let stopped = false
  const tick = async (): Promise<void> => {
    if (busy) return
    busy = true
    const sessions = await readMprisSessions(runBusctl, process.pid, identities)
    busy = false
    if (!stopped) onSessions(sessions)
  }
  void tick()
  const timer = setInterval(() => void tick(), POLL_INTERVAL_MS)
  return () => {
    stopped = true
    clearInterval(timer)
  }
}
