import { useRouter } from 'expo-router'
import { useCallback } from 'react'

/** Abre o cartão de perfil de uma pessoa (rota `/perfil/<id>`). */
export function useOpenProfile(): (userId: string) => void {
  const router = useRouter()
  return useCallback((userId) => router.push({ pathname: '/perfil/[id]', params: { id: userId } }), [router])
}
