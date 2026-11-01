import { DIRECT_CHAT_PERMISSIONS, type ChatPermissions } from '../../chat/lib/chatPermissions'
import { MAESTRO_USER_ID } from './music'

// Mesmo UUID da migration 000054 (backend/internal/bot): o Salinha Bot avisa na
// DM o andamento das propostas de quem sugeriu.
export const SALINHA_BOT_USER_ID = '53414c49-4e48-4100-8000-000000000002'

/** Os usuários-bot (sem presença, amizade nem DM de pessoas). */
export function isBotUser(id: string | null | undefined): boolean {
  return id === SALINHA_BOT_USER_ID || id === MAESTRO_USER_ID
}

/** DM com bot é só leitura: ele avisa, ninguém responde nem reage (o servidor recusa). */
export const BOT_DM_PERMISSIONS: ChatPermissions = {
  ...DIRECT_CHAT_PERMISSIONS,
  canSend: false,
  canAttach: false,
  canReact: false
}

export const BOT_DM_NOTICE =
  'O Salinha Bot só manda avisos sobre as suas sugestões; não dá para responder.'
