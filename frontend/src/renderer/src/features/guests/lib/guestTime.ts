/**
 * Quanto falta para o acesso de visitante acabar, como as pessoas falam:
 * "1 dia", "5 h 20 min", "12 min", "menos de 1 min". Puro.
 */
export function timeLeftLabel(expiresAt: string, now: number): string {
  const minutes = Math.floor((new Date(expiresAt).getTime() - now) / 60_000)
  if (minutes < 1) return 'menos de 1 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours >= 24) return '1 dia'
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

/** O acesso já acabou? */
export function expired(expiresAt: string, now: number): boolean {
  return new Date(expiresAt).getTime() <= now
}
