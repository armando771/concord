import { request } from '../../../shared/api/client'
import type { User } from '../../auth/store/authStore'

/**
 * Sobe o som de entrada: o corpo é o próprio arquivo (até 2 MB) e a duração
 * medida pelo app vai na URL. Devolve a conta com o entrance_sound_url novo.
 */
export function uploadEntranceSound(file: File, durationMs: number): Promise<User> {
  return request<User>(`/users/me/entrance-sound?duration_ms=${Math.round(durationMs)}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file
  })
}

/** Volta ao som padrão. */
export function deleteEntranceSound(): Promise<User> {
  return request<User>('/users/me/entrance-sound', { method: 'DELETE' })
}
