/** O bcrypt do backend só aceita senhas de até 72 bytes. */
const MAX_PASSWORD_BYTES = 72

export const PASSWORD_TOO_LONG = 'Senha muito longa (máx. 72 bytes).'

/** Conta bytes em UTF-8 (acentos e emojis valem mais de um). */
export function passwordTooLong(password: string): boolean {
  return new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES
}
