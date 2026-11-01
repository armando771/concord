import { request } from '../../../shared/api/client'

export const registerPushToken = (token: string): Promise<void> =>
  request<void>('/push/token', { method: 'PUT', body: JSON.stringify({ token, platform: 'android' }) })

export const unregisterPushToken = (token: string): Promise<void> =>
  request<void>('/push/token', { method: 'DELETE', body: JSON.stringify({ token }) })
