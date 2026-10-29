import { freshCallResume, type PendingCallResume } from '../../../../../shared/callResume'

interface Context {
  userId: string | null
  backendUrl: string
  connected: boolean
  idle: boolean
}

interface Dependencies {
  take: () => Promise<PendingCallResume | null>
  context: () => Context
  join: (resume: PendingCallResume, signal: AbortSignal) => Promise<void>
  navigate: (resume: PendingCallResume) => void
  failed: () => void
  permanent: (error: unknown) => boolean
}

/** Uma retomada por boot, com até três tentativas para erros transitórios. */
export function createCallResumer(deps: Dependencies): {
  tick: () => Promise<void>
  cancel: () => void
  /** Já decidiu: voltou, desistiu ou não havia o que retomar. */
  settled: () => boolean
} {
  let loaded = false
  let pending: PendingCallResume | null = null
  let busy = false
  let cancelled = false
  let attempts = 0
  let retryAt = 0
  const controller = new AbortController()
  return {
    settled: () => cancelled || (loaded && !busy && pending === null),
    cancel: () => {
      cancelled = true
      pending = null
      controller.abort()
    },
    tick: async () => {
      if (busy || cancelled) return
      busy = true
      try {
        if (!loaded) {
          loaded = true
          pending = await deps.take()
        }
        if (cancelled || !pending) return
        const context = deps.context()
        if (
          !freshCallResume(pending) ||
          (context.userId !== null && context.userId !== pending.userId) ||
          context.backendUrl !== pending.backendUrl ||
          !context.idle
        ) {
          pending = null
          return
        }
        if (!context.userId || !context.connected || Date.now() < retryAt) return
        const resume = pending
        attempts++
        try {
          await deps.join(resume, controller.signal)
          pending = null
          if (!cancelled && deps.context().userId === resume.userId) deps.navigate(resume)
        } catch (error) {
          if (cancelled) return
          if (deps.permanent(error) || attempts >= 3) {
            pending = null
            deps.failed()
          } else {
            retryAt = Date.now() + 3000
          }
        }
      } catch {
        pending = null
        if (!cancelled) deps.failed()
      } finally {
        busy = false
      }
    }
  }
}
