import { describe, expect, it } from 'vitest'
import { retry } from './retry'

describe('retry', () => {
  it('tenta de novo enquanto shouldRetry aceitar o erro', async () => {
    let attempts = 0
    const result = await retry(
      async () => {
        attempts++
        if (attempts < 3) throw new Error('403')
        return 'token'
      },
      { attempts: 5, delayMs: 0, shouldRetry: () => true }
    )
    expect(result).toBe('token')
    expect(attempts).toBe(3)
  })

  it('desiste após o número máximo de tentativas', async () => {
    let attempts = 0
    await expect(
      retry(
        async () => {
          attempts++
          throw new Error('403')
        },
        { attempts: 4, delayMs: 0, shouldRetry: () => true }
      )
    ).rejects.toThrow('403')
    expect(attempts).toBe(4)
  })

  it('não repete erros que shouldRetry recusa', async () => {
    let attempts = 0
    await expect(
      retry(
        async () => {
          attempts++
          throw new Error('500')
        },
        { attempts: 5, delayMs: 0, shouldRetry: (err) => (err as Error).message === '403' }
      )
    ).rejects.toThrow('500')
    expect(attempts).toBe(1)
  })
})
