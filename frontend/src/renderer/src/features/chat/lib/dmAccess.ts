import { BOT_DM_NOTICE, BOT_DM_PERMISSIONS } from '../../music/lib/bots'
import type { ChatPermissions } from './chatPermissions'

// O que dá para fazer numa DM: com bot é só leitura; pessoa bloqueada não
// recebe mensagem. Sem restrição, o ChatPane usa as permissões padrão.

export interface DmAccess {
  disabledReason?: string
  permissions?: ChatPermissions
}

export function dmAccess(withBot: boolean, blocked: boolean): DmAccess {
  const disabledReason = withBot
    ? BOT_DM_NOTICE
    : blocked
      ? 'Você bloqueou esta pessoa. Desbloqueie para mandar mensagens.'
      : undefined
  return { disabledReason, permissions: withBot ? BOT_DM_PERMISSIONS : undefined }
}
