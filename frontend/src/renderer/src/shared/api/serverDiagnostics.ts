import type { ServerDiagnostics } from '../../../../shared/serverConnection'

/** Só o app desktop tem o teste de rede do main (o navegador não). */
export function hasServerDiagnostics(): boolean {
  return typeof window !== 'undefined' && !!window.api?.server
}

/** Versão, endereço em uso e teste de rede; `retest` testa de novo agora. */
export async function loadServerDiagnostics(retest = false): Promise<ServerDiagnostics | null> {
  return (await window.api?.server?.diagnostics(retest)) ?? null
}
