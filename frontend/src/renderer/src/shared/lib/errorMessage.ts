/** Texto do erro para o toast: a mensagem do próprio erro ou o padrão da tela. */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}
