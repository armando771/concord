import { request } from '../../../shared/api/client'

export interface LevelProgress {
  user_id: string
  level: number
  xp: number
  xp_into_level: number
  xp_for_next: number
  voice_seconds: number
}

export type LevelMap = Record<string, LevelProgress>

export function fetchLevels(userIds: string[]): Promise<LevelMap> {
  const unique = Array.from(new Set(userIds.filter(Boolean)))
  if (unique.length === 0) return Promise.resolve({})
  return request<LevelMap>(`/levels?user_ids=${encodeURIComponent(unique.join(','))}`)
}

export function fetchMyLevel(): Promise<LevelProgress> {
  return request<LevelProgress>('/levels/me')
}
