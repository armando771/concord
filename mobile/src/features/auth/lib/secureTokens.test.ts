import * as SecureStore from 'expo-secure-store'
import { clearTokens, loadTokens, saveTokens } from './secureTokens'

jest.mock('expo-secure-store')

const store = jest.mocked(SecureStore)

describe('secureTokens', () => {
  const memory = new Map<string, string>()

  beforeEach(() => {
    memory.clear()
    store.getItemAsync.mockImplementation(async (key) => memory.get(key) ?? null)
    store.setItemAsync.mockImplementation(async (key, value) => void memory.set(key, value))
    store.deleteItemAsync.mockImplementation(async (key) => void memory.delete(key))
  })

  it('sem nada salvo: sem tokens', async () => {
    expect(await loadTokens()).toEqual({ accessToken: null, refreshToken: null })
  })

  it('guarda e lê os tokens', async () => {
    await saveTokens({ accessToken: 'a1', refreshToken: 'r1' })
    expect(await loadTokens()).toEqual({ accessToken: 'a1', refreshToken: 'r1' })
  })

  it('limpar apaga os dois', async () => {
    await saveTokens({ accessToken: 'a1', refreshToken: 'r1' })
    await clearTokens()
    expect(await loadTokens()).toEqual({ accessToken: null, refreshToken: null })
  })

  it('conteúdo corrompido vira "sem tokens"', async () => {
    memory.set('salinha-auth', '{quebrado')
    expect(await loadTokens()).toEqual({ accessToken: null, refreshToken: null })
  })

  it('falha do Keystore também vira "sem tokens"', async () => {
    store.getItemAsync.mockRejectedValueOnce(new Error('keystore'))
    expect(await loadTokens()).toEqual({ accessToken: null, refreshToken: null })
  })
})
