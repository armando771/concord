/**
 * Mensagem em português para uma falha na tela de login. Decide pelo status
 * HTTP (o texto do backend vem em inglês e pode mudar), não pela mensagem.
 */
export function loginErrorMessage(err: unknown): string {
  const status =
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { status?: unknown }).status === 'number'
      ? (err as { status: number }).status
      : undefined

  if (status === undefined) {
    // fetch rejeita com TypeError quando nem chega ao servidor.
    return err instanceof TypeError ? 'Sem conexão com o servidor.' : 'Falha ao entrar.'
  }
  if (status === 0) return 'Sem conexão com o servidor.'
  if (status === 401) return 'E-mail/usuário ou senha incorretos.'
  if (status === 400) return 'Não foi possível entrar. Confira os dados e tente de novo.'
  if (status === 429) return 'Muitas tentativas. Espere um pouco e tente de novo.'
  if (status >= 500) return 'Erro no servidor. Tente de novo em instantes.'
  return 'Falha ao entrar.'
}
