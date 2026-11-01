import { ApiError } from '../../../shared/api/client'

/** O que dizer quando entrar pelo link ou gerar o link falha. Puro. */
const BY_CODE: Record<string, string> = {
  guest_invite_not_found: 'Este link não existe mais, foi revogado ou já expirou.',
  invalid_name: 'O nome precisa ter de 2 a 32 caracteres.',
  invite_full: 'Este link já foi usado pelo número máximo de visitantes.',
  access_ended: 'Seu acesso de visitante foi encerrado.',
  not_in_call: 'Entre na call para convidar um visitante.',
  missing_permission: 'Você não tem permissão para convidar visitantes nesta call.',
  invalid_duration: 'Escolha 2 horas, 6 horas, 12 horas ou 1 dia.'
}

export function guestErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return 'Muitas tentativas. Espere um pouco e tente de novo.'
    if (err.code && BY_CODE[err.code]) return BY_CODE[err.code]
  }
  return fallback
}

/** Quem já é membro e abriu o link: o caminho do canal de voz (o app abre normalmente). */
export function alreadyMemberPath(err: unknown): string | null {
  if (!(err instanceof ApiError) || err.code !== 'already_member') return null
  return `/servers/${String(err.body.server_id)}/channels/${String(err.body.channel_id)}`
}
