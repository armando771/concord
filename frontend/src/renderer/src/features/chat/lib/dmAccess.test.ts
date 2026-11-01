import { describe, expect, it } from 'vitest'
import { BOT_DM_NOTICE, BOT_DM_PERMISSIONS } from '../../music/lib/bots'
import { dmAccess } from './dmAccess'

describe('dmAccess', () => {
  it('DM comum: sem aviso e com as permissões padrão', () => {
    const a = dmAccess(false, false)
    expect(a.disabledReason).toBeUndefined()
    expect(a.permissions).toBeUndefined()
  })

  it('bot: só leitura, com o aviso do bot', () => {
    const a = dmAccess(true, false)
    expect(a.disabledReason).toBe(BOT_DM_NOTICE)
    expect(a.permissions).toBe(BOT_DM_PERMISSIONS)
  })

  it('pessoa bloqueada: aviso para desbloquear', () => {
    expect(dmAccess(false, true).disabledReason).toMatch(/Desbloqueie/)
  })

  it('bot tem prioridade sobre bloqueio', () => {
    expect(dmAccess(true, true).disabledReason).toBe(BOT_DM_NOTICE)
  })
})
