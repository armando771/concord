import * as SecureStore from 'expo-secure-store'
import type { StoredTokens, Tokens } from '../../../shared/lib/authRefresh'

// Tokens são credenciais: ficam no Keystore do Android (expo-secure-store),
// nunca em AsyncStorage. Um item só, em JSON.
const KEY = 'salinha-auth'

const NONE: StoredTokens = { accessToken: null, refreshToken: null }

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null)

export async function loadTokens(): Promise<StoredTokens> {
  try {
    const raw = await SecureStore.getItemAsync(KEY)
    const data = JSON.parse(raw ?? 'null') as Record<string, unknown> | null
    return { accessToken: str(data?.accessToken), refreshToken: str(data?.refreshToken) }
  } catch {
    return NONE
  }
}

export function saveTokens(tokens: Tokens): Promise<void> {
  return SecureStore.setItemAsync(KEY, JSON.stringify(tokens))
}

export function clearTokens(): Promise<void> {
  return SecureStore.deleteItemAsync(KEY)
}
