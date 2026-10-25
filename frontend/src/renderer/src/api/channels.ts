import { request } from './client'

export type ChannelType = 'text' | 'voice'

export interface Channel {
  id: string
  server_id: string
  name: string
  type: ChannelType
  position?: number
  created_by: string
  created_at: string
  updated_at: string
}

export function listChannels(serverId: string): Promise<Channel[]> {
  return request<Channel[]>(`/servers/${serverId}/channels`)
}

export function createChannel(
  serverId: string,
  name: string,
  type: ChannelType = 'text'
): Promise<Channel> {
  return request<Channel>(`/servers/${serverId}/channels`, {
    method: 'POST',
    body: JSON.stringify({ name, type })
  })
}

export function updateChannel(serverId: string, channelId: string, name: string): Promise<Channel> {
  return request<Channel>(`/servers/${serverId}/channels/${channelId}`, {
    method: 'PUT',
    body: JSON.stringify({ name })
  })
}

export function reorderChannels(serverId: string, channelIds: string[]): Promise<Channel[]> {
  return request<Channel[]>(`/servers/${serverId}/channels`, {
    method: 'PUT',
    body: JSON.stringify({ channel_ids: channelIds })
  })
}

export function deleteChannel(serverId: string, channelId: string): Promise<void> {
  return request<void>(`/servers/${serverId}/channels/${channelId}`, {
    method: 'DELETE'
  })
}
