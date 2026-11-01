// Players de música que a Salinha reconhece ("Ouvindo"). Só o que está aqui
// vira atividade: mídia de outro app (vídeo, app desconhecido) nunca sai do PC.
// Puro: usado pelo main (detecção) e pelo renderer (cor do card).

export interface MusicAppDefinition {
  /** Nome exibido ("Ouvindo Spotify"). */
  name: string
  /**
   * Pedaços (minúsculos) do id da sessão de mídia: o AUMID no Windows; no
   * Linux, o nome no barramento MPRIS junto com o Identity do player.
   */
  ids: string[]
  /** Domínios do player web, quando o navegador informa o endereço. */
  sites: string[]
  /** Cor de destaque. */
  accent: string
}

export const MUSIC_APPS: readonly MusicAppDefinition[] = [
  { name: 'Spotify', ids: ['spotify'], sites: ['open.spotify.com'], accent: '#1ed760' },
  {
    name: 'YouTube Music',
    ids: ['youtube-music', 'youtubemusic', 'youtube music'],
    sites: ['music.youtube.com'],
    accent: '#ff0000'
  },
  { name: 'Deezer', ids: ['deezer'], sites: ['deezer.com'], accent: '#a238ff' },
  {
    name: 'Apple Music',
    ids: ['applemusic', 'apple music', 'itunes', 'cider'],
    sites: ['music.apple.com'],
    accent: '#fa243c'
  },
  {
    name: 'Amazon Music',
    ids: ['amazonmusic', 'amazon music'],
    sites: ['music.amazon.'],
    accent: '#46c3d0'
  },
  { name: 'TIDAL', ids: ['tidal'], sites: ['tidal.com'], accent: '#33ffee' },
  { name: 'SoundCloud', ids: ['soundcloud'], sites: ['soundcloud.com'], accent: '#ff5500' },
  { name: 'Reprodutor Multimídia', ids: ['zunemusic'], sites: [], accent: '#0078d4' },
  { name: 'VLC', ids: ['vlc'], sites: [], accent: '#ff8800' },
  { name: 'foobar2000', ids: ['foobar2000'], sites: [], accent: '#9aa0a6' },
  { name: 'MusicBee', ids: ['musicbee'], sites: [], accent: '#f5c518' },
  { name: 'AIMP', ids: ['aimp'], sites: [], accent: '#ff9f1c' },
  { name: 'Winamp', ids: ['winamp'], sites: [], accent: '#f0a30a' },
  { name: 'Rhythmbox', ids: ['rhythmbox'], sites: [], accent: '#e66100' },
  { name: 'Elisa', ids: ['elisa'], sites: [], accent: '#1d99f3' },
  { name: 'Strawberry', ids: ['strawberry'], sites: [], accent: '#e01b24' },
  { name: 'Clementine', ids: ['clementine'], sites: [], accent: '#f57900' },
  { name: 'Audacious', ids: ['audacious'], sites: [], accent: '#3584e4' },
  { name: 'Lollypop', ids: ['lollypop'], sites: [], accent: '#c061cb' },
  { name: 'Amberol', ids: ['amberol'], sites: [], accent: '#f6d32d' },
  { name: 'Tauon', ids: ['tauon'], sites: [], accent: '#e5a50a' }
]

/**
 * Navegadores: só contam com o site do player identificado ou com metadados de
 * música (álbum); vídeo comum no navegador não vira "Ouvindo". A ordem importa:
 * o Chrome no Linux aparece como "chromium.instanceN Google Chrome".
 */
const BROWSERS: readonly { name: string; ids: string[] }[] = [
  { name: 'Chrome', ids: ['chrome'] },
  { name: 'Edge', ids: ['msedge', 'microsoft edge'] },
  { name: 'Firefox', ids: ['firefox'] },
  { name: 'Opera', ids: ['opera'] },
  { name: 'Brave', ids: ['brave'] },
  { name: 'Vivaldi', ids: ['vivaldi'] },
  { name: 'Chromium', ids: ['chromium'] }
]

export interface MusicSource {
  /** Nome exibido. */
  app: string
  /** É um navegador sem site conhecido (precisa de metadados de música). */
  browser: boolean
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

function bySite(url: string | undefined): MusicAppDefinition | undefined {
  const host = hostOf(url)
  if (!host) return undefined
  return MUSIC_APPS.find((app) => app.sites.some((site) => host.includes(site)))
}

function byId<T extends { ids: string[] }>(list: readonly T[], id: string): T | undefined {
  return list.find((item) => item.ids.some((part) => id.includes(part)))
}

/** Quem está tocando, pelo id da sessão (e pelo endereço, se houver); null = não é música. */
export function musicSourceFor(sourceId: string, url?: string): MusicSource | null {
  const id = sourceId.trim().toLowerCase()
  if (!id) return null
  const app = bySite(url) ?? byId(MUSIC_APPS, id)
  if (app) return { app: app.name, browser: false }
  const browser = byId(BROWSERS, id)
  return browser ? { app: browser.name, browser: true } : null
}

/** Cor de destaque do player pelo nome (undefined se não for do catálogo). */
export function musicAccent(name: string): string | undefined {
  return MUSIC_APPS.find((app) => app.name === name)?.accent
}
