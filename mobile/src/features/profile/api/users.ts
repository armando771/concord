import { request } from '../../../shared/api/client'
import type { ProfileData } from '../lib/profileTypes'

/** O cartão de qualquer usuário (o do próprio vem da sessão, em /users/me). */
export const getProfile = (userId: string): Promise<ProfileData> =>
  request<ProfileData>(`/users/${encodeURIComponent(userId)}/profile`)
