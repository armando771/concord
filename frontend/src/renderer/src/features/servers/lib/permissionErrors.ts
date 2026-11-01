import { permissionError } from './permissions'

/**
 * Mensagem em português para um erro de ação de cargos/moderação: usa o código
 * que o servidor manda (ApiError.code) e, sem ele, a mensagem do próprio erro.
 */
export function actionErrorMessage(err: unknown, fallback: string): string {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? ((err as { code?: unknown }).code as string | undefined)
      : undefined
  const known = permissionError(typeof code === 'string' ? code : undefined, '')
  if (known) return known
  return err instanceof Error && err.message ? err.message : fallback
}
