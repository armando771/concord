/**
 * Mensagens em português para falhas nas telas de login e cadastro. Decide
 * pelo status HTTP (o texto do backend vem em inglês e pode mudar), não pela
 * mensagem.
 */

/** Status do ApiError; null quando nem chegou ao servidor (fetch rejeitou). */
export function statusOf(err: unknown): number | null | undefined {
  if (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { status?: unknown }).status === 'number'
  ) {
    return (err as { status: number }).status
  }
  // fetch rejeita com TypeError quando nem chega ao servidor.
  return err instanceof TypeError ? null : undefined
}

/** Nem chegou ao servidor (rede, DNS, bloqueio): a tela oferece os detalhes da conexão. */
export function isConnectionError(err: unknown): boolean {
  const status = statusOf(err)
  return status === null || status === 0
}

export function commonMessage(status: number | null | undefined): string | null {
  if (status === null || status === 0) return 'Sem conexão com o servidor.'
  if (status === undefined) return null
  if (status === 429) return 'Muitas tentativas. Espere um pouco e tente de novo.'
  if (status >= 500) return 'Erro no servidor. Tente de novo em instantes.'
  return null
}

export function loginErrorMessage(err: unknown): string {
  const status = statusOf(err)
  if (status === 401) return 'E-mail/usuário ou senha incorretos.'
  if (status === 400) return 'Não foi possível entrar. Confira os dados e tente de novo.'
  return commonMessage(status) ?? 'Falha ao entrar.'
}

/** Falhas de "esqueci a senha", redefinição e confirmação de e-mail. */
export function emailActionErrorMessage(err: unknown): string {
  const status = statusOf(err)
  // O backend não diz se o link expirou, já foi usado ou nunca existiu.
  if (status === 400) return 'Este link é inválido ou expirou. Peça um novo.'
  return commonMessage(status) ?? 'Algo deu errado. Tente de novo.'
}

export function registerErrorMessage(err: unknown): string {
  const status = statusOf(err)
  // O backend não diz qual dos dois, para não revelar e-mails cadastrados.
  if (status === 409) return 'Nome de usuário ou e-mail já em uso.'
  if (status === 400) return 'Confira os dados e tente de novo.'
  return commonMessage(status) ?? 'Falha ao criar conta.'
}
