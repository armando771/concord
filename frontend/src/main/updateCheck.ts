// Quando checar atualização. Além da checagem periódica, o renderer pede uma
// na hora quando o backend avisa de versão nova (WS app:update) e quando o WS
// reconecta (deploy reinicia o backend). Pedidos em rajada viram um só, e
// nada se empilha sobre uma checagem que ainda não terminou: um pedido que
// chega durante ela vira uma checagem só, logo depois (a em andamento pode ter
// lido o manifesto antigo).

/** Agrupa pedidos próximos (ex.: manifestos do Windows e do Linux juntos). */
export const ON_DEMAND_DEBOUNCE_MS = 1_000

export interface UpdateCheckGate {
  /** Pedido de fora (WS): checa depois do debounce. */
  request: () => void
  /** Checa agora (ao abrir, periódica). */
  run: () => void
}

export function createUpdateCheckGate(
  check: () => Promise<unknown>,
  debounceMs = ON_DEMAND_DEBOUNCE_MS
): UpdateCheckGate {
  let inFlight = false
  /** Pedido de fora chegou durante a checagem em andamento. */
  let again = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const run = (): void => {
    if (inFlight) return
    inFlight = true
    // Quem passa `check` registra o erro; aqui só libera a próxima.
    check()
      .catch(() => {})
      .finally(() => {
        inFlight = false
        if (again) {
          again = false
          run()
        }
      })
  }

  const request = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      if (inFlight) again = true
      else run()
    }, debounceMs)
  }

  return { request, run }
}
