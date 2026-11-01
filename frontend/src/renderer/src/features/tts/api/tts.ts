import { ApiError, request } from '../../../shared/api/client'
import type { ExtraMessageData, Message } from '../../chat/api/messages'
import { parseTTSCommand, ttsErrorMessage } from '../lib/ttsCommand'

/** O texto a mandar como TTS, ou null se a mensagem não é um /tts (com anexo, GIF ou figurinha, não é). */
export function ttsTextOf(
  content: string,
  attachmentIds: string[],
  extra: ExtraMessageData | undefined
): string | null {
  if (attachmentIds.length > 0 || extra?.stickerId || extra?.gifUrl) return null
  return parseTTSCommand(content)
}

/**
 * Manda a mensagem TTS pela rota da sala (`/channels/:id` ou
 * `/conversations/:id`). As recusas do /tts (intervalo, tamanho) voltam com o
 * aviso em português, mantendo status e código.
 */
export async function sendTTSMessage(roomBase: string, text: string): Promise<Message> {
  try {
    return await request<Message>(`${roomBase}/tts`, {
      method: 'POST',
      body: JSON.stringify({ content: text })
    })
  } catch (err) {
    const message = err instanceof ApiError ? ttsErrorMessage(err.code, err.body) : null
    if (!message) throw err
    const apiErr = err as ApiError
    throw new ApiError(apiErr.status, message, apiErr.code, apiErr.body)
  }
}
