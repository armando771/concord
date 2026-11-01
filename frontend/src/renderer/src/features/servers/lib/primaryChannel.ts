/**
 * Canal principal do servidor (onde vão os avisos do servidor, como os de
 * aniversário): o escolhido, se ainda é um canal de texto do servidor; senão
 * o canal de texto mais antigo — a mesma regra do backend. Não segue a ordem
 * da barra lateral: arrastar canais não muda para onde vão os avisos.
 */
export function primaryChannelId(
  server: { primary_channel_id?: string | null } | null | undefined,
  channels: { id: string; type: string; created_at?: string }[]
): string | null {
  const text = channels.filter((c) => c.type === 'text')
  const chosen = server?.primary_channel_id
  if (chosen && text.some((c) => c.id === chosen)) return chosen
  let oldest: (typeof text)[number] | undefined
  for (const c of text) {
    if (!oldest || isOlder(c, oldest)) oldest = c
  }
  return oldest?.id ?? null
}

/**
 * Mais antigo por created_at (o backend usa ORDER BY c.created_at, c.id). Sem
 * data ou empate na precisão de ms, fica o que já vinha antes na lista.
 */
function isOlder(a: { created_at?: string }, b: { created_at?: string }): boolean {
  const ta = Date.parse(a.created_at ?? '')
  const tb = Date.parse(b.created_at ?? '')
  return Number.isFinite(ta) && Number.isFinite(tb) && ta < tb
}
