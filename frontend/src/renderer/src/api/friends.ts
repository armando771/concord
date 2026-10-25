import { request } from './client'
import type { PublicUser } from '../store/authStore'

export interface PendingRequest {
  user_id: string
  username: string
  display_name: string
  avatar_url?: string | null
  direction: 'incoming' | 'outgoing'
  created_at: string
}

export function sendFriendRequest(username: string): Promise<{ message: string }> {
  return request<{ message: string }>('/friends/request', {
    method: 'POST',
    body: JSON.stringify({ username })
  })
}

export function listFriends(): Promise<PublicUser[]> {
  return request<PublicUser[]>('/friends')
}

export function listPending(): Promise<PendingRequest[]> {
  return request<PendingRequest[]>('/friends/pending')
}

export function acceptFriendRequest(username: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/friends/${encodeURIComponent(username)}/accept`, {
    method: 'PUT'
  })
}

export function declineFriendRequest(username: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/friends/${encodeURIComponent(username)}/decline`, {
    method: 'PUT'
  })
}

export function cancelFriendRequest(username: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/friends/request/${encodeURIComponent(username)}`, {
    method: 'DELETE'
  })
}

export function removeFriend(username: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/friends/${encodeURIComponent(username)}`, {
    method: 'DELETE'
  })
}
