import { isSafeExternalUrl } from '../../shared/externalUrl'

// Menu do botão direito da janela principal. O Electron não tem menu
// padrão: sem isto, o botão direito sobre texto selecionado, link ou campo
// de texto não faz nada. Onde o app tem menu próprio (linha da mensagem,
// usuário, canal), o renderer chama preventDefault e este menu não aparece.

/** O que o menu usa do params do evento 'context-menu'. */
export interface ContextMenuParams {
  selectionText: string
  linkURL: string
  isEditable: boolean
  editFlags: { canCut: boolean; canCopy: boolean; canPaste: boolean; canSelectAll: boolean }
}

export type ContextMenuItem =
  | { type: 'separator' }
  | { label: string; role: 'cut' | 'copy' | 'paste' | 'selectAll'; enabled?: boolean }
  | { label: string; action: 'copyLink' | 'openLink'; url: string }

/** Itens do menu para este clique; lista vazia = não abre menu. */
export function contextMenuItems(params: ContextMenuParams): ContextMenuItem[] {
  if (params.isEditable) {
    const { canCut, canCopy, canPaste, canSelectAll } = params.editFlags
    return [
      { label: 'Recortar', role: 'cut', enabled: canCut },
      { label: 'Copiar', role: 'copy', enabled: canCopy },
      { label: 'Colar', role: 'paste', enabled: canPaste },
      { type: 'separator' },
      { label: 'Selecionar tudo', role: 'selectAll', enabled: canSelectAll }
    ]
  }

  const items: ContextMenuItem[] = []
  if (params.selectionText.trim()) items.push({ label: 'Copiar', role: 'copy' })
  if (params.linkURL) {
    if (items.length) items.push({ type: 'separator' })
    items.push({ label: 'Copiar link', action: 'copyLink', url: params.linkURL })
    // Abrir só http/https, pelo navegador de fora (como o setWindowOpenHandler).
    if (isSafeExternalUrl(params.linkURL)) {
      items.push({ label: 'Abrir no navegador', action: 'openLink', url: params.linkURL })
    }
  }
  return items
}
