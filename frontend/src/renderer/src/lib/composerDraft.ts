// Campo de envio: o texto sai do campo na hora do Enter (o que for digitado
// durante o envio não se perde). Se o envio falhar, o texto volta só se a
// pessoa não começou outra mensagem.

/** Texto para pôr de volta no campo depois de um envio que falhou, ou null para manter o atual. */
export function draftAfterSendFailure(sent: string, current: string): string | null {
  if (sent.trim() === '') return null
  return current.trim() === '' ? sent : null
}
