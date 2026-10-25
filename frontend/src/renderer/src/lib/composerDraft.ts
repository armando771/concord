// Campo de envio: o texto sai do campo na hora do Enter (o que for digitado
// durante o envio não se perde). Se o envio falhar, o texto que falhou também
// não se perde: volta sozinho se o campo continua vazio; se a pessoa já
// começou outra mensagem, o aviso de erro oferece "Restaurar".

export type SendFailureAction = 'restore' | 'offer' | 'nothing'

/**
 * O que fazer depois de um envio que falhou. restore: devolve texto e
 * resposta ao campo; offer: mantém o texto novo e oferece restaurar; nothing:
 * não havia texto nem resposta (os anexos continuam no rascunho).
 */
export function afterSendFailure(
  sentText: string,
  sentHadReply: boolean,
  currentText: string
): SendFailureAction {
  if (sentText.trim() === '' && !sentHadReply) return 'nothing'
  return currentText.trim() === '' ? 'restore' : 'offer'
}

/** "Restaurar": o texto que falhou vem antes do que foi digitado depois. */
export function restoreFailedText(sentText: string, currentText: string): string {
  if (sentText.trim() === '') return currentText
  if (currentText.trim() === '') return sentText
  return `${sentText.trimEnd()} ${currentText.trimStart()}`
}
