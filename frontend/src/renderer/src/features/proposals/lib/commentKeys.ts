/**
 * O que uma tecla faz no campo de editar um comentário: Enter salva (Shift+Enter
 * quebra a linha) e Esc cancela. Quem chama deve marcar o evento como tratado,
 * senão o Esc também fecharia o modal da proposta que está em volta.
 */
export function commentEditKeyAction(key: string, shiftKey: boolean): 'save' | 'cancel' | null {
  if (key === 'Enter' && !shiftKey) return 'save'
  if (key === 'Escape') return 'cancel'
  return null
}

/** Salvar fica desabilitado enquanto salva, ou se o texto ficou vazio (só anexo pode ficar sem texto). */
export function commentSaveDisabled(draft: string, hasAttachments: boolean, busy: boolean): boolean {
  return busy || (draft.trim().length === 0 && !hasAttachments)
}
