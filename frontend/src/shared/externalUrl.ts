/**
 * Link que pode ir para o navegador de fora: só http e https, com host. O
 * shell.openExternal abre qualquer esquema (file:, smb:, ms-settings:…), então
 * tudo que sai do app passa por aqui — no main (setWindowOpenHandler) e no
 * chat (linkify).
 */
export function isSafeExternalUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== ''
}
