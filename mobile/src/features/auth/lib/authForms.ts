import { nameCharsError } from './nameChars'
import { PASSWORD_TOO_LONG, passwordTooLong } from './password'

/**
 * Validação por campo das telas de conta (cadastro e redefinição de senha).
 * Funções puras: devolvem só os campos com erro, na mesma ordem da tela.
 */

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,32}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const MIN_PASSWORD_LENGTH = 8

export type RegisterField =
  'username' | 'displayName' | 'email' | 'password' | 'confirm'

export type FieldErrors<K extends string> = Partial<Record<K, string>>

export interface RegisterValues {
  username: string
  displayName: string
  email: string
  password: string
  confirm: string
}

export function usernameError(value: string): string | null {
  return USERNAME_REGEX.test(value.trim())
    ? null
    : 'Use de 3 a 32 caracteres: letras, números ou _.'
}

export function displayNameError(value: string): string | null {
  const name = value.trim()
  if (!name) return 'Informe seu nome de exibição.'
  return nameCharsError(name)
    ? 'O nome de exibição não pode ter caracteres invisíveis ou de controle.'
    : null
}

export function emailError(value: string): string | null {
  return EMAIL_REGEX.test(value.trim()) ? null : 'Informe um e-mail válido.'
}

export function passwordError(value: string): string | null {
  if ([...value].length < MIN_PASSWORD_LENGTH) {
    return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`
  }
  if (passwordTooLong(value)) return PASSWORD_TOO_LONG
  return null
}

export function confirmError(password: string, confirm: string): string | null {
  return password === confirm ? null : 'As senhas não conferem.'
}

export function validateRegister(v: RegisterValues): FieldErrors<RegisterField> {
  const errors: FieldErrors<RegisterField> = {}
  const set = (field: RegisterField, message: string | null): void => {
    if (message) errors[field] = message
  }
  set('username', usernameError(v.username))
  set('displayName', displayNameError(v.displayName))
  set('email', emailError(v.email))
  set('password', passwordError(v.password))
  set('confirm', confirmError(v.password, v.confirm))
  return errors
}

export type ResetField = 'password' | 'confirm'

export function validateReset(password: string, confirm: string): FieldErrors<ResetField> {
  const errors: FieldErrors<ResetField> = {}
  const p = passwordError(password)
  if (p) errors.password = p
  const c = confirmError(password, confirm)
  if (c) errors.confirm = c
  return errors
}

/** Força da senha de 0 a 4, só para a barrinha do cadastro (não bloqueia nada). */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0
  let score = 0
  const length = [...password].length
  if (length >= MIN_PASSWORD_LENGTH) score++
  if (length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++
  return Math.max(1, score) as 1 | 2 | 3 | 4
}
