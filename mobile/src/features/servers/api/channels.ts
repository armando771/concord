import { request } from '../../../shared/api/client'

export type ChannelType = 'text' | 'voice'

export interface Channel {
  id: string
  server_id: string
  name: string
  type: ChannelType
  /** Ordem dentro da seção (texto ou voz). */
  position?: number
  is_system?: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export function listChannels(serverId: string): Promise<Channel[]> {
  return request<Channel[]>(`/servers/${serverId}/channels`)
}
