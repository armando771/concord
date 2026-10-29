// Links do perfil (como as "Conexões" do Discord, mas por URL): descobre o
// serviço pelo endereço para mostrar o ícone certo.

export type LinkProviderId =
  | 'steam'
  | 'twitch'
  | 'youtube'
  | 'x'
  | 'instagram'
  | 'tiktok'
  | 'github'
  | 'spotify'
  | 'kick'
  | 'reddit'
  | 'discord'
  | 'soundcloud'
  | 'bluesky'
  | 'site'

export interface LinkProvider {
  id: LinkProviderId
  label: string
}

/** Domínios de cada serviço (subdomínios contam: m.youtube.com, www.twitch.tv). */
const PROVIDERS: { id: Exclude<LinkProviderId, 'site'>; label: string; hosts: string[] }[] = [
  { id: 'steam', label: 'Steam', hosts: ['steamcommunity.com', 'steampowered.com', 's.team'] },
  { id: 'twitch', label: 'Twitch', hosts: ['twitch.tv'] },
  { id: 'youtube', label: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
  { id: 'x', label: 'X', hosts: ['x.com', 'twitter.com'] },
  { id: 'instagram', label: 'Instagram', hosts: ['instagram.com'] },
  { id: 'tiktok', label: 'TikTok', hosts: ['tiktok.com'] },
  { id: 'github', label: 'GitHub', hosts: ['github.com'] },
  { id: 'spotify', label: 'Spotify', hosts: ['spotify.com'] },
  { id: 'kick', label: 'Kick', hosts: ['kick.com'] },
  { id: 'reddit', label: 'Reddit', hosts: ['reddit.com'] },
  { id: 'discord', label: 'Discord', hosts: ['discord.gg', 'discord.com'] },
  { id: 'soundcloud', label: 'SoundCloud', hosts: ['soundcloud.com'] },
  { id: 'bluesky', label: 'Bluesky', hosts: ['bsky.app'] }
]

/** Os mesmos limites do backend (internal/user/profile.go). */
export const MAX_LINKS = 5
export const MAX_LINK_LENGTH = 256

function parse(raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

/** Completa "twitch.tv/fulano" com https://; o resto fica como veio. */
export function normalizeLink(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

/** Mensagem de erro do link (já normalizado), ou null se está ok. */
export function linkError(url: string): string | null {
  if (!url) return 'Cole um link.'
  if (url.length > MAX_LINK_LENGTH) return `O link pode ter até ${MAX_LINK_LENGTH} caracteres.`
  const parsed = parse(url)
  if (!parsed || !['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    return 'Link inválido. Use um endereço que comece com https://'
  }
  return null
}

export function detectProvider(url: string): LinkProvider {
  const host = parse(url)?.hostname.toLowerCase() ?? ''
  const match = PROVIDERS.find((p) => p.hosts.some((h) => host === h || host.endsWith(`.${h}`)))
  return match ? { id: match.id, label: match.label } : { id: 'site', label: 'Site' }
}

/** Texto curto para mostrar no lugar da URL inteira ("twitch.tv/mugis_rx"). */
export function linkLabel(url: string): string {
  const parsed = parse(url)
  if (!parsed) return url
  const host = parsed.hostname.replace(/^www\./, '')
  const path = parsed.pathname.replace(/\/+$/, '')
  return `${host}${path}`
}

export interface TextPart {
  text: string
  /** Presente quando o pedaço é um link clicável. */
  url?: string
}

/** Separa os links http(s) do "Sobre mim" para virarem clicáveis. */
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = []
  let last = 0
  for (const match of text.matchAll(/https?:\/\/[^\s<>"]+/g)) {
    // Pontuação no fim ("veja https://x.com.") fica fora do link.
    const url = match[0].replace(/[.,;:!?)\]]+$/, '')
    const start = match.index ?? 0
    if (start > last) parts.push({ text: text.slice(last, start) })
    if (linkError(url)) parts.push({ text: url })
    else parts.push({ text: url, url })
    last = start + url.length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}
