import { request } from '../../../shared/api/client'
import type { NotifySettings } from '../lib/notificationMute'

export interface AllNotifySettings {
  servers: Record<string, NotifySettings>
  channels: Record<string, NotifySettings>
}

export function getNotifySettings(): Promise<AllNotifySettings> {
  return request<AllNotifySettings>('/users/me/notification-settings')
}

export function setServerNotifySettings(
  serverId: string,
  settings: NotifySettings
): Promise<NotifySettings> {
  return request<NotifySettings>(`/servers/${encodeURIComponent(serverId)}/notification-settings`, {
    method: 'PUT',
    body: JSON.stringify(settings)
  })
}

export function setChannelNotifySettings(
  serverId: string,
  channelId: string,
  settings: NotifySettings
): Promise<NotifySettings> {
  return request<NotifySettings>(
    `/servers/${encodeURIComponent(serverId)}/channels/${encodeURIComponent(channelId)}/notification-settings`,
    { method: 'PUT', body: JSON.stringify(settings) }
  )
}
