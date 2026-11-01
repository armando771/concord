/** "mugis@gmail.com" → "*****@gmail.com", como o Discord mostra em Minha conta. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at <= 0) return '*'.repeat(Math.max(email.length, 1))
  return `${'*'.repeat(at)}${email.slice(at)}`
}
