/** Abaixo disso a lista de membros não cabe ao lado do chat (mesmo corte da lista de membros do servidor). */
export const MEMBERS_MIN_VIEWPORT = 1024

/**
 * A lista de membros do grupo já aparece aberta? Só em janela larga: numa de
 * 360 px ela tomaria 240 px do chat. Sem janela (servidor), mostra.
 */
export function initialShowMembers(): boolean {
  const width = globalThis.window?.innerWidth
  return width === undefined || width >= MEMBERS_MIN_VIEWPORT
}
