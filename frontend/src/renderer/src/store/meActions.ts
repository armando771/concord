import { logout } from '../api/auth'
import { clearSession } from '../api/client'
import { setStatus } from '../api/users'
import type { ChosenStatus } from '../lib/presenceStatus'
import router from '../router'
import { useAuthStore } from './authStore'
import { useChatStore } from './chatStore'
import { useFriendStore } from './friendStore'
import { useInviteStore } from './inviteStore'
import { useProfileCardStore } from './profileCardStore'
import { useProfileStore } from './profileStore'
import { useServerStore } from './serverStore'
import { useSettingsStore } from './settingsStore'
import { showToast } from './toastStore'

// Ações da própria pessoa usadas pela barra de baixo, pelo cartão de perfil e
// pelas Configurações.

/** Sai da conta: encerra a sessão no servidor (se der) e limpa tudo local. */
export async function logoutAndReset(): Promise<void> {
  try {
    await logout()
  } catch {
    // Limpa a sessão local mesmo assim.
  } finally {
    useFriendStore.getState().reset()
    useServerStore.getState().reset()
    useInviteStore.getState().reset()
    useProfileStore.getState().reset()
    useChatStore.getState().disconnect()
    useProfileCardStore.getState().close()
    useSettingsStore.getState().forceClose()
    await clearSession()
    void router.navigate('/login')
  }
}

/** Troca o status na hora e desfaz se o servidor recusar. */
export async function changeMyStatus(status: ChosenStatus): Promise<void> {
  const { user, setUser } = useAuthStore.getState()
  if (!user || user.status === status) return
  const previous = user.status
  setUser({ ...user, status })
  try {
    const saved = await setStatus(status)
    const current = useAuthStore.getState().user
    if (current) setUser({ ...current, status: saved.status ?? status })
  } catch (err) {
    const current = useAuthStore.getState().user
    if (current) setUser({ ...current, status: previous })
    showToast.error(err instanceof Error ? err.message : 'Não foi possível mudar o status.')
  }
}
