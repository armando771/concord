import { describe, expect, it } from 'vitest'
import {
  addPending,
  isRetryableSendError,
  removePending,
  retryableSendErrorText,
  settlePending,
  updatePending,
  type PendingMessage
} from './pendingMessages'

const pending = (
  localId: string,
  content: string,
  status: PendingMessage['status'] = 'sending'
): PendingMessage => ({
  localId,
  content,
  replyToId: null,
  status,
  error: null
})

describe('fila de mensagens pendentes', () => {
  it('adiciona no fim, marca falha e volta a "enviando" ao tentar de novo', () => {
    let list = addPending(undefined, pending('a', 'oi'))
    list = addPending(list, pending('b', 'tudo bem?'))
    expect(list.map((p) => p.localId)).toEqual(['a', 'b'])

    list = updatePending(list, 'a', { status: 'failed', error: 'Você está sem internet.' })
    expect(list[0]).toMatchObject({ status: 'failed', error: 'Você está sem internet.' })

    list = updatePending(list, 'a', { status: 'sending', error: null })
    expect(list[0]).toMatchObject({ status: 'sending', error: null })
  })

  it('remover ou atualizar quem não existe não muda a lista', () => {
    const list = [pending('a', 'oi')]
    expect(removePending(list, 'x')).toBe(list)
    expect(updatePending(list, 'x', { status: 'failed' })).toBe(list)
    expect(removePending(list, 'a')).toEqual([])
    expect(removePending(undefined, 'a')).toEqual([])
  })

  it('mensagem minha que chegou do servidor tira a pendente igual mais antiga', () => {
    const list = [pending('a', 'ok', 'failed'), pending('b', 'ok'), pending('c', 'outra')]
    expect(
      settlePending(list, { content: ' ok ', author_id: 'eu' }, 'eu').map((p) => p.localId)
    ).toEqual(['b', 'c'])
  })

  it('mensagem de outra pessoa ou com texto diferente não mexe', () => {
    const list = [pending('a', 'ok')]
    expect(settlePending(list, { content: 'ok', author_id: 'ana' }, 'eu')).toBe(list)
    expect(settlePending(list, { content: 'oi', author_id: 'eu' }, 'eu')).toBe(list)
    expect(settlePending(list, { content: 'ok', author_id: 'eu' }, null)).toBe(list)
  })
})

describe('isRetryableSendError', () => {
  it('rede caiu, sem resposta e servidor reiniciando: vale tentar de novo', () => {
    expect(isRetryableSendError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isRetryableSendError({ status: 0 })).toBe(true)
    expect(isRetryableSendError({ status: 502 })).toBe(true)
    expect(isRetryableSendError({ status: 503 })).toBe(true)
    expect(isRetryableSendError({ status: 504 })).toBe(true)
  })

  it('sem permissão, inválida, limite: não adianta repetir', () => {
    expect(isRetryableSendError({ status: 403 })).toBe(false)
    expect(isRetryableSendError({ status: 400 })).toBe(false)
    expect(isRetryableSendError({ status: 429 })).toBe(false)
    expect(isRetryableSendError(new Error('x'))).toBe(false)
    expect(isRetryableSendError(null)).toBe(false)
  })

  it('texto da falha diz se é a internet', () => {
    expect(retryableSendErrorText(new TypeError('x'), false)).toBe('Você está sem internet.')
    expect(retryableSendErrorText(new TypeError('x'), true)).toBe('Sem conexão com o servidor.')
    expect(retryableSendErrorText({ status: 0 }, true)).toMatch(/não respondeu/)
    expect(retryableSendErrorText({ status: 503 }, true)).toMatch(/reiniciando/)
  })
})
