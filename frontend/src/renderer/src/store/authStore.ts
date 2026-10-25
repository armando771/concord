import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AUTH_STORAGE_KEY } from '../lib/authRefresh'
import type { ChosenStatus } from '../lib/presenceStatus'

export interface ProfileLink {
  url: string
}

export interface User {
  id: string
  username: string
  display_name: string
  email: string
  avatar_url?: string | null
  // Perfil (Configurações → Perfis). Opcionais: listas de amigos e sessões
  // salvas antes do perfil existir não trazem.
  banner_url?: string | null
  banner_color?: string | null
  pronouns?: string
  bio?: string
  status_text?: string
  links?: ProfileLink[]
  status?: ChosenStatus
  created_at: string
  updated_at: string
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  setTokens: (accessToken: string, refreshToken: string) => void
  setUser: (user: User) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      clear: () => set({ accessToken: null, refreshToken: null, user: null })
    }),
    { name: AUTH_STORAGE_KEY }
  )
)

// Login, logout ou renovação em outra aba (app web): esta aba passa a usar a
// mesma sessão. O evento não dispara na própria aba (nem no Electron, que tem
// uma janela só).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === AUTH_STORAGE_KEY || event.key === null) {
      void useAuthStore.persist.rehydrate()
    }
  })
}
