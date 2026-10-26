import { describe, expect, it } from 'vitest'
import { githubUsernameError, needsTakeover } from './proposals'
import { BOT_DM_PERMISSIONS, isBotUser, SALINHA_BOT_USER_ID } from './bots'
import { MAESTRO_USER_ID } from './music'

describe('needsTakeover', () => {
  const ana = { assignee: { id: 'ana', name: 'Ana' } }

  it('card de outro dev: confirma antes de mover', () => {
    expect(needsTakeover(ana, 'beto', 'in_progress')).toBe(true)
    expect(needsTakeover(ana, 'beto', 'proposed')).toBe(true)
    expect(needsTakeover(ana, 'beto', 'rejected')).toBe(true)
  })

  it('arrastar para Concluída não tira de ninguém (pode ser só o deploy)', () => {
    expect(needsTakeover(ana, 'beto', 'done')).toBe(false)
  })

  it('card meu ou sem ninguém: move direto', () => {
    expect(needsTakeover(ana, 'ana', 'proposed')).toBe(false)
    expect(needsTakeover({ assignee: null }, 'beto', 'in_progress')).toBe(false)
    expect(needsTakeover({}, 'beto', 'in_progress')).toBe(false)
    expect(needsTakeover(ana, null, 'in_progress')).toBe(false)
  })
})

describe('githubUsernameError', () => {
  it('aceita o formato do GitHub, com @ opcional, e vazio (apaga)', () => {
    expect(githubUsernameError('dev-tech')).toBeNull()
    expect(githubUsernameError(' @Dev123 ')).toBeNull()
    expect(githubUsernameError('')).toBeNull()
  })

  it('recusa o que o GitHub não aceita', () => {
    for (const bad of ['-comeca', 'tem espaço', 'a--b', 'fim-', 'a'.repeat(40), 'acento-é']) {
      expect(githubUsernameError(bad)).not.toBeNull()
    }
  })
})

describe('bots', () => {
  it('reconhece o Salinha Bot e o Maestro', () => {
    expect(isBotUser(SALINHA_BOT_USER_ID)).toBe(true)
    expect(isBotUser(MAESTRO_USER_ID)).toBe(true)
    expect(isBotUser('alguem')).toBe(false)
    expect(isBotUser(undefined)).toBe(false)
  })

  it('DM com bot é só leitura (sem enviar, anexar nem reagir)', () => {
    expect(BOT_DM_PERMISSIONS).toMatchObject({ canSend: false, canAttach: false, canReact: false })
    expect(BOT_DM_PERMISSIONS.canReadHistory).toBe(true)
  })
})
