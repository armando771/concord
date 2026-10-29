// Comando /tts no campo de mensagem: "/tts <texto>" manda o texto como
// mensagem TTS (docs/adr/0012-tts-no-cliente.md). Mesmos limites do backend
// (internal/message/tts.go).

/** Limite do texto falado, em caracteres. */
export const TTS_MAX_LENGTH = 200

/** Sugestão do comando no menu do "/" do campo de mensagem. */
export const TTS_SUGGESTION = {
  command: '/tts',
  aliases: [] as string[],
  usage: '/tts <mensagem>',
  description: 'Lê a mensagem em voz para quem está em call'
}

const COMMAND = /^\/tts(?:\s+([\s\S]*))?$/i

/** O texto do /tts ('' se veio sem texto), ou null se não é o comando. */
export function parseTTSCommand(content: string): string | null {
  const match = COMMAND.exec(content.trim())
  if (!match) return null
  return (match[1] ?? '').trim()
}

/** Aviso das recusas próprias do /tts; null = erro comum (quem chama trata). */
export function ttsErrorMessage(
  code: string | undefined,
  body: Record<string, unknown>
): string | null {
  switch (code) {
    case 'tts_cooldown': {
      const wait = Number(body.retry_after) || 10
      return `Espere ${wait} s para mandar outra mensagem TTS.`
    }
    case 'tts_too_long':
      return `A mensagem TTS pode ter no máximo ${TTS_MAX_LENGTH} caracteres.`
    case 'content_required':
      return 'Escreva o que falar depois de /tts.'
    default:
      return null
  }
}
