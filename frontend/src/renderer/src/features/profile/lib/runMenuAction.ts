import { showToast } from '../../../shared/store/toastStore'
import { actionErrorMessage } from '../../servers/lib/permissionErrors'

type RoleChange = (serverId: string, userId: string, roleId: string) => Promise<void>

/**
 * Roda uma ação do menu de usuário com o "salvando" ligado; erro vira toast.
 * `onSuccess` só roda se deu certo (ex.: fechar o menu).
 */
export async function runMenuAction({
  setSaving,
  action,
  fallback,
  onSuccess
}: {
  setSaving: (saving: boolean) => void
  action: () => Promise<unknown>
  fallback: string
  onSuccess?: () => void
}): Promise<void> {
  setSaving(true)
  try {
    await action()
    onSuccess?.()
  } catch (err) {
    showToast.error(actionErrorMessage(err, fallback))
  } finally {
    setSaving(false)
  }
}

/** Tira o cargo de quem tem; dá o cargo a quem não tem. */
export function toggleMemberRole({
  has,
  serverId,
  userId,
  roleId,
  add,
  remove
}: {
  has: boolean
  serverId: string
  userId: string
  roleId: string
  add: RoleChange
  remove: RoleChange
}): Promise<void> {
  return (has ? remove : add)(serverId, userId, roleId)
}
