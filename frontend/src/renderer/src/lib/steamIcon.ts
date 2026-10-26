// Ícone dos jogos da Steam (CDN pública da comunidade), pelo appid e pelo sha1
// do ícone, que o dono do jogo informa. Puro.

const CDN = 'https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps'

export function steamIconUrl(appId: number | undefined, hash: string | undefined): string | null {
  if (!appId || !Number.isInteger(appId) || appId <= 0) return null
  if (!hash || !/^[0-9a-f]{40}$/.test(hash)) return null
  return `${CDN}/${appId}/${hash}.jpg`
}
