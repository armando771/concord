// O Electron recusa o getDisplayMedia com AbortError — o mesmo erro de uma
// captura que falhou. Para não mostrar "Não foi possível compartilhar a tela"
// quando o usuário só clicou em Cancelar, o modal marca o cancelamento e a
// recusa seguinte vira NotAllowedError (o que o resto do app trata como
// "cancelou").

let cancelled = false

/** O modal do seletor foi cancelado (botão Cancelar ou Esc). */
export function notePickerCancelled(): void {
  cancelled = true
}

/** Começo de um novo pedido: esquece cancelamentos antigos. */
export function resetPickerCancel(): void {
  cancelled = false
}

/** Erro do getDisplayMedia, trocado por NotAllowedError se foi cancelamento. */
export function pickerError(err: unknown): unknown {
  if (!cancelled) return err
  cancelled = false
  return new DOMException('Compartilhamento de tela cancelado', 'NotAllowedError')
}
