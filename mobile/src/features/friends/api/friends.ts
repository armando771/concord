import { request } from '../../../shared/api/client'

/** Outra pessoa: o backend nunca manda o e-mail de ninguém além do da própria conta. */
export interface Friend {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
}

export interface PendingRequest {
  user_id: string
  username: string
  display_name: string
  avatar_url?: string | null
  direction: 'incoming' | 'outgoing'
  created_at: string
}

/** 'accepted' = a outra pessoa já tinha pedido: viraram amigos na hora. */
export type SendRequestResult = 'sent' | 'accepted'

const enc = encodeURIComponent
const message = (path: string, method: string): Promise<{ message: string }> => request(path, { method })

export const listFriends = (): Promise<Friend[]> => request<Friend[]>('/friends')
export const listPending = (): Promise<PendingRequest[]> => request<PendingRequest[]>('/friends/pending')
export const listBlocked = (): Promise<Friend[]> => request<Friend[]>('/friends/blocked')

export function sendFriendRequest(username: string): Promise<{ message: string; result: SendRequestResult }> {
  return request('/friends/request', { method: 'POST', body: JSON.stringify({ username }) })
}

export const acceptFriendRequest = (username: string) => message(`/friends/${enc(username)}/accept`, 'PUT')
export const declineFriendRequest = (username: string) => message(`/friends/${enc(username)}/decline`, 'PUT')
export const cancelFriendRequest = (username: string) => message(`/friends/request/${enc(username)}`, 'DELETE')
export const removeFriend = (username: string) => message(`/friends/${enc(username)}`, 'DELETE')
export const blockUser = (userId: string) => message(`/users/${userId}/block`, 'PUT')
export const unblockUser = (userId: string) => message(`/users/${userId}/block`, 'DELETE')
