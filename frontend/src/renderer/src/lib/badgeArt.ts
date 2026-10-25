/**
 * Arte dos badges (assets/badges): "<categoria>-<tier>.webp" com 256 px e
 * "<categoria>-<tier>-64.webp" com 64 px. Categoria sem arte (nova no
 * backend, app antigo) cai no ícone genérico do BadgeIcon.
 */
const files = import.meta.glob('../assets/badges/*.webp', {
  eager: true,
  import: 'default'
}) as Record<string, string>

const art: Record<string, string> = {}
for (const [path, url] of Object.entries(files)) {
  const name = path
    .split('/')
    .pop()
    ?.replace(/\.webp$/, '')
  if (name) art[name] = url
}

export type BadgeArtSize = 'sm' | 'lg'

/** Tier 0 (ainda não conquistado) mostra a arte do primeiro tier. */
export function badgeArt(category: string, tier: number, size: BadgeArtSize): string | undefined {
  const name = `${category}-${Math.max(1, tier)}`
  return size === 'sm' ? (art[`${name}-64`] ?? art[name]) : (art[name] ?? art[`${name}-64`])
}
