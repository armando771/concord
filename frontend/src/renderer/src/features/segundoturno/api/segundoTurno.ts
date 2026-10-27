import { request } from '../../../shared/api/client'

/** Backend: internal/segundoturno. */
export interface SegundoTurnoEstado {
  /** Conta criada antes do corte: vê o banner. */
  elegivel: boolean
  respondeu: boolean
  /** A resposta dada; só vale com `respondeu`. */
  fez_o_l: boolean
}

export function fetchSegundoTurno(): Promise<SegundoTurnoEstado> {
  return request<SegundoTurnoEstado>('/users/me/segundo-turno')
}

/** Resposta única: o servidor recusa (409) uma segunda. */
export function responderSegundoTurno(fezOL: boolean): Promise<SegundoTurnoEstado> {
  return request<SegundoTurnoEstado>('/users/me/segundo-turno', {
    method: 'POST',
    body: JSON.stringify({ fez_o_l: fezOL })
  })
}
