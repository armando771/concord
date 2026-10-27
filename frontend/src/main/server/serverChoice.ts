// Qual endereço do servidor o app desktop usa nesta abertura. O build traz o
// principal e os alternativos (serverCandidates); antes de abrir a janela o
// main testa cada um e fica com o primeiro que responde. Puro: quem chama
// passa o fetch (o net.fetch do Electron, que usa a mesma rede do renderer).

import type { ServerProbe } from '../../shared/serverConnection'

export type { ServerProbe }

export type ProbeFetch = (url: string, init: { signal: AbortSignal }) => Promise<{ status: number }>

/** Espera do teste de cada endereço ao abrir o app. */
export const PROBE_TIMEOUT_MS = 6000

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function secondsText(ms: number): string {
  return `${(ms / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} s`
}

/** Testa se a rede alcança o servidor (GET /healthz). Nunca rejeita. */
export async function probeServer(
  url: string,
  fetchFn: ProbeFetch,
  timeoutMs = PROBE_TIMEOUT_MS
): Promise<ServerProbe> {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchFn(`${url}/healthz`, { signal: controller.signal })
    return { url, ok: true, detail: `HTTP ${res.status}`, ms: Date.now() - started }
  } catch (err) {
    const detail = controller.signal.aborted
      ? `sem resposta em ${secondsText(timeoutMs)}`
      : errorText(err)
    return { url, ok: false, detail, ms: Date.now() - started }
  } finally {
    clearTimeout(timer)
  }
}

export interface ServerChoice {
  url: string
  /** Resultado de todos os testes (o alternativo pode terminar depois da escolha). */
  probes: Promise<ServerProbe[]>
}

/**
 * Testa todos ao mesmo tempo e fica com o primeiro, na ordem de preferência,
 * que responde; não espera o alternativo se o principal já respondeu. Nenhum
 * respondeu: o principal (o aviso de conexão mostra os erros).
 */
export async function chooseServer(
  candidates: string[],
  probe: (url: string) => Promise<ServerProbe>
): Promise<ServerChoice> {
  const pending = candidates.map((url) => probe(url))
  const probes = Promise.all(pending)
  for (const [i, result] of pending.entries()) {
    if ((await result).ok) return { url: candidates[i], probes }
  }
  return { url: candidates[0], probes }
}

/** Atualizações do app: do servidor escolhido. Build sem atualização (dev): nenhuma. */
export function updateFeedFor(buildFeed: string, server: string | undefined): string {
  if (!buildFeed || !server) return buildFeed
  return new URL('/updates/', server).toString()
}
