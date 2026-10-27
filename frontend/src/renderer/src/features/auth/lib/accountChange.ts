import { ApiError } from '../../../shared/api/client'
import { emailError, usernameError } from './authForms'

// Troca do nome de usuário e do e-mail em Configurações → Minha conta: a
// validação (as regras do cadastro), a senha atual e as mensagens de erro.

export type AccountField = 'username' | 'email'

const TAKEN: Record<AccountField, string> = {
  username: 'Esse nome de usuário já está em uso.',
  email: 'Esse e-mail já está em uso.'
}

const UNCHANGED: Record<AccountField, string> = {
  username: 'Esse já é o seu nome de usuário.',
  email: 'Esse já é o seu e-mail.'
}

const VALIDATE: Record<AccountField, (value: string) => string | null> = {
  username: usernameError,
  email: emailError
}

const GENERIC = 'Não foi possível salvar. Tente de novo.'

const COOLDOWN_RULE = 'Você só pode trocar o nome de usuário uma vez a cada 7 dias.'

/** "03/11", no fuso de quem está vendo. */
export function formatDayMonth(iso: string): string {
  const date = new Date(iso)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`
}

const cooldownMessage = (iso: string): string =>
  `Você pode trocar o nome de usuário de novo em ${formatDayMonth(iso)}.`

/**
 * O @ só troca uma vez a cada 7 dias: com a data em que libera
 * (username_change_available_at) ainda no futuro, o aviso; senão null.
 */
export function usernameLock(
  availableAt: string | null | undefined,
  now: Date = new Date()
): string | null {
  if (!availableAt || new Date(availableAt) <= now) return null
  return cooldownMessage(availableAt)
}

/** O 429 do prazo do @ traz a data em que libera (available_at). */
function cooldownError(err: ApiError): string {
  const at = err.body?.available_at
  return typeof at === 'string' ? cooldownMessage(at) : COOLDOWN_RULE
}

/** Mensagem para o erro do PUT /users/me/username ou /users/me/email. */
export function accountChangeError(err: unknown, field: AccountField): string {
  if (!(err instanceof ApiError)) return GENERIC
  if (err.code === 'wrong_password') return 'Senha incorreta.'
  if (err.code === 'username_cooldown') return cooldownError(err)
  if (err.status === 409) return TAKEN[field]
  if (err.status === 429) return 'Muitas tentativas. Espere alguns minutos e tente de novo.'
  if (err.status === 400 && /reservado/.test(err.message)) return 'Esse nome de usuário é reservado.'
  return GENERIC
}

export interface AccountChange {
  kind: AccountField
  value: string
  password: string
  /** O valor salvo hoje. */
  current: string
  send: (value: string, password: string) => Promise<void>
}

/** Confere, manda e devolve a mensagem de erro (null = salvou). */
export async function submitAccountChange(change: AccountChange): Promise<string | null> {
  const value = change.value.trim()
  const invalid = VALIDATE[change.kind](value)
  if (invalid) return invalid
  if (value === change.current) return UNCHANGED[change.kind]
  if (!change.password) return 'Digite sua senha atual.'
  try {
    await change.send(value, change.password)
    return null
  } catch (err) {
    return accountChangeError(err, change.kind)
  }
}
