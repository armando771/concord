/** Subtítulo do bloco: diz que há mais, nunca o quê. */
export const HIDDEN_BADGES_HINT = 'Os detalhes de cada badge serão revelados quando alcançados'

/**
 * Título do bloco "N badges ocultos restantes" (como as conquistas secretas
 * da Steam); null quando não falta nenhum (ou o servidor não mandou o número).
 */
export function hiddenBadgesTitle(count: number | undefined): string | null {
  if (!count || count < 1) return null
  return count === 1 ? '1 badge oculto restante' : `${count} badges ocultos restantes`
}
