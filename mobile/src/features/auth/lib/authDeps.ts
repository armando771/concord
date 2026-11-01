import * as api from '../api/auth'
import { useAuthStore } from '../store/authStore'
import type { AuthDeps } from './authFlow'

/** As dependências reais dos fluxos de conta: a API e o authStore. */
export const authDeps: AuthDeps = {
  login: api.login,
  register: api.register,
  forgotPassword: api.forgotPassword,
  getMe: api.getMe,
  signIn: (tokens) => useAuthStore.getState().signIn(tokens),
  setUser: (user) => useAuthStore.getState().setUser(user)
}
