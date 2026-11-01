import { request } from '../../../shared/api/client'

export interface Server {
  id: string
  name: string
  icon_url?: string
  owner_id: string
  primary_channel_id?: string | null
}

export function listServers(): Promise<Server[]> {
  return request<Server[]>('/servers')
}
