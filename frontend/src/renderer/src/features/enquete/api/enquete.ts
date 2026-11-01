import { request } from '../../../shared/api/client'

/** Backend: internal/enquete. */
export interface EnqueteOpcao {
  id: string
  rotulo: string
  /** Categoria do badge que a opção concede (internal/badge); sem badge, nenhuma. */
  badge?: string
}

export interface Enquete {
  id: string
  titulo: string
  descricao: string
  opcoes: EnqueteOpcao[]
}

export interface RespostaEnquete {
  enquete: string
  opcao: string
  badge?: string
}

/** As enquetes que a pessoa pode responder e ainda não respondeu. */
export async function fetchPendentes(): Promise<Enquete[]> {
  const res = await request<{ enquetes: Enquete[] }>('/users/me/enquetes')
  return res.enquetes
}

/** Resposta única: o servidor recusa (409) uma segunda. */
export function responderEnquete(id: string, opcao: string): Promise<RespostaEnquete> {
  return request<RespostaEnquete>(`/users/me/enquetes/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: JSON.stringify({ opcao })
  })
}
