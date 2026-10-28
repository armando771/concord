import { request } from '../../../shared/api/client'

/** Outra pessoa: o backend nunca manda o e-mail de ninguém além do da própria conta. */
export interface Friend {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
}

// Só leitura nesta fatia (a busca das DMs): pedidos, bloquear e adicionar são do 2b-2.
export function listFriends(): Promise<Friend[]> {
  return request<Friend[]>('/friends')
}
