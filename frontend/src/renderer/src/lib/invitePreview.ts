import { commonMessage, statusOf } from './loginError'

const numberFormat = new Intl.NumberFormat('pt-BR')

/** "1 membro", "54.301 membros". */
export function formatInviteCount(count: number, singular: string, plural: string): string {
  return `${numberFormat.format(count)} ${count === 1 ? singular : plural}`
}

/** Falha ao abrir ou aceitar o convite, pelo status (o texto do backend pode mudar). */
export function inviteErrorMessage(err: unknown): string {
  const status = statusOf(err)
  if (status === 404) return 'Este convite é inválido ou expirou.'
  if (status === 403 && (err as { code?: unknown }).code === 'banned') {
    return 'Você foi banido deste servidor.'
  }
  return commonMessage(status) ?? 'Não foi possível abrir o convite.'
}
