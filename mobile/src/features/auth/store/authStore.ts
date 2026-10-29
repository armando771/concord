import { create } from 'zustand'
import type { Tokens } from '../../../shared/lib/authRefresh'
import { clearTokens, loadTokens, saveTokens } from '../lib/secureTokens'

/** A própria conta (/users/me): com o e-mail. Só o que o app mobile usa por ora. */
export interface User {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
  email: string
  /** false até a pessoa abrir o link do e-mail de confirmação. */
  email_verified?: boolean
}

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut'

export const SESSION_EXPIRED_NOTICE = 'Sua sessão expirou'

interface AuthState {
  status: AuthStatus
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  /** Aviso mostrado na tela de login (ex.: sessão expirada). */
  notice: string | null
  restore: () => Promise<void>
  signIn: (tokens: Tokens) => Promise<void>
  setTokens: (tokens: Tokens) => Promise<void>
  setUser: (user: User) => void
  signOut: () => Promise<void>
  expire: () => Promise<void>
}

const SIGNED_OUT = { status: 'signedOut', accessToken: null, refreshToken: null, user: null } as const

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'loading',
  accessToken: null,
  refreshToken: null,
  user: null,
  notice: null,
  restore: async () => {
    const { accessToken, refreshToken } = await loadTokens()
    if (accessToken && refreshToken) set({ status: 'signedIn', accessToken, refreshToken })
    else set(SIGNED_OUT)
  },
  signIn: async (tokens) => {
    await saveTokens(tokens)
    set({ status: 'signedIn', ...tokens, notice: null })
  },
  setTokens: async (tokens) => {
    await saveTokens(tokens)
    set(tokens)
  },
  setUser: (user) => set({ user }),
  signOut: async () => {
    await clearTokens()
    set({ ...SIGNED_OUT, notice: null })
  },
  expire: async () => {
    await clearTokens()
    set({ ...SIGNED_OUT, notice: SESSION_EXPIRED_NOTICE })
  }
}))
