import { useState } from 'react'
import { moveToVoiceChannel } from '../../call/api/calls'
import { useServerStore } from '../../servers/store/serverStore'
import { showToast } from '../../../shared/store/toastStore'
import { runMenuAction, toggleMemberRole } from '../lib/runMenuAction'

export interface StandardUserMenuActions {
  saving: boolean
  /** Move a pessoa de canal de voz e fecha o menu. */
  moveTo: (channelId: string, channelName: string) => Promise<void>
  /** Roda uma ação de moderação e fecha o menu se deu certo. */
  moderate: (action: () => Promise<unknown>, fallback: string) => Promise<void>
  /** Alterna o cargo sem fechar o menu: dá para marcar vários seguidos. */
  toggleRole: (roleId: string, has: boolean) => Promise<void>
}

/** As ações (com estado "salvando") do menu de contexto de um usuário qualquer. */
export function useStandardUserMenuActions(
  target: { userId: string; name: string },
  serverId: string | undefined,
  close: () => void
): StandardUserMenuActions {
  const [saving, setSaving] = useState(false)
  const addMemberRole = useServerStore((s) => s.addMemberRole)
  const removeMemberRole = useServerStore((s) => s.removeMemberRole)

  return {
    saving,
    moveTo: (channelId, channelName) =>
      runMenuAction({
        setSaving,
        action: async () => {
          await moveToVoiceChannel(target.userId, channelId)
          showToast.success(`${target.name} foi movido para ${channelName}.`)
        },
        fallback: 'Não foi possível mover.',
        onSuccess: close
      }),
    moderate: (action, fallback) =>
      runMenuAction({ setSaving, action, fallback, onSuccess: close }),
    toggleRole: async (roleId, has) => {
      if (!serverId) return
      await runMenuAction({
        setSaving,
        action: () =>
          toggleMemberRole({
            has,
            serverId,
            userId: target.userId,
            roleId,
            add: addMemberRole,
            remove: removeMemberRole
          }),
        fallback: 'Não foi possível mudar o cargo.'
      })
    }
  }
}
