import { ApiError } from '../../../shared/api/client'

const GENERIC = 'Não foi possível entrar na chamada. Tente de novo.'

const BY_STATUS: Record<number, string> = {
  423: 'Sala trancada. Peça para alguém abrir.',
  403: 'Você não tem permissão para entrar nesse canal de voz.',
  409: 'Essa pessoa já está em outra chamada.'
}

/** Texto para o aviso quando `POST /calls` (ou o token) falha. */
export function callErrorMessage(err: unknown): string {
  return (err instanceof ApiError && BY_STATUS[err.status]) || GENERIC
}
