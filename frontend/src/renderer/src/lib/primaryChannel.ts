/**
 * Canal principal do servidor (onde vão os avisos do servidor, como os de
 * aniversário): o escolhido, se ainda é um canal de texto do servidor; senão
 * o primeiro canal de texto — a mesma regra do backend.
 */
export function primaryChannelId(
  server: { primary_channel_id?: string | null } | null | undefined,
  channels: { id: string; type: string }[]
): string | null {
  const text = channels.filter((c) => c.type === 'text')
  const chosen = server?.primary_channel_id
  if (chosen && text.some((c) => c.id === chosen)) return chosen
  return text[0]?.id ?? null
}
