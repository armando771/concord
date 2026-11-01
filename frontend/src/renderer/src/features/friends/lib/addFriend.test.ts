import { describe, expect, it, vi } from 'vitest'
import { canSubmitFriend, cleanUsername, feedbackTone, submitFriendRequest } from './addFriend'

describe('canSubmitFriend', () => {
  it('exige nome e nenhum envio em andamento', () => {
    expect(canSubmitFriend('maria', false)).toBe(true)
    expect(canSubmitFriend(' @ ', false)).toBe(false)
    expect(canSubmitFriend('maria', true)).toBe(false)
  })
})

describe('cleanUsername', () => {
  it('tira espaços e o @ inicial', () => {
    expect(cleanUsername('  @maria ')).toBe('maria')
  })
})

describe('submitFriendRequest', () => {
  it('campo vazio não envia', async () => {
    const send = vi.fn()
    expect(await submitFriendRequest(send, '  @ ')).toBeNull()
    expect(send).not.toHaveBeenCalled()
  })
  it('pedido enviado', async () => {
    const send = vi.fn(async () => 'sent' as const)
    expect(await submitFriendRequest(send, '@maria')).toEqual({
      ok: true,
      name: 'maria',
      accepted: false
    })
    expect(send).toHaveBeenCalledWith('maria')
  })
  it('a outra pessoa já tinha mandado: viram amigos', async () => {
    const out = await submitFriendRequest(async () => 'accepted', 'maria')
    expect(out).toMatchObject({ ok: true, accepted: true })
  })
  it('falha vira texto de erro', async () => {
    const out = await submitFriendRequest(async () => Promise.reject(new Error('x')), 'maria')
    expect(out).toMatchObject({ ok: false })
    expect(typeof (out as { error: string }).error).toBe('string')
  })
})

describe('feedbackTone', () => {
  it('neutro, sucesso e erro', () => {
    expect(feedbackTone(null).border).toBe('border-black/40')
    expect(feedbackTone({ ok: true, name: 'a', accepted: false }).text).toBe('text-success')
    expect(feedbackTone({ ok: false, error: 'e' }).text).toBe('text-danger')
  })
})
