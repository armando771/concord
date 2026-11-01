import { useWindowActivityStore } from '../../../shared/store/windowActivityStore'
import { useScreenVisibilityStore, type LiveElement } from '../store/screenVisibilityStore'

// Quando pausar o VÍDEO recebido (setEnabled(false): o servidor para de mandar).
// O som da live nunca pausa: dá para continuar ouvindo um podcast fazendo outra
// coisa. Pausa com a janela minimizada/na bandeja (todo vídeo) e com a live fora
// da área visível do app (só ela). Perder o foco não pausa: alt-tab com o app
// visível no outro monitor, ou dividindo a tela, a live continua.
// Janela totalmente coberta por outra não é detectável aqui: a oclusão nativa do
// Chromium fica desligada para não congelar a captura (main/screen/captureSwitches.ts).

export interface VideoPauseState {
  /** Janela minimizada ou na bandeja. */
  windowHidden: boolean
  /** Lives (userId) com todos os <video> fora da área visível. */
  offscreen: ReadonlySet<string>
}

/** Rolar a lista não pode pausar e despausar a cada pixel. */
export const OFFSCREEN_PAUSE_MS = 1500

export function videoEnabled(source: string, identity: string, state: VideoPauseState): boolean {
  if (state.windowHidden) return false
  return !(source === 'screen_share' && state.offscreen.has(identity))
}

/** Fora de vista = nenhum <video> daquela live aparece. */
export function offscreenLives(elements: Record<string, LiveElement>): string[] {
  const seen = new Map<string, boolean>()
  for (const { userId, visible } of Object.values(elements)) {
    seen.set(userId, (seen.get(userId) ?? false) || visible)
  }
  return [...seen].filter(([, visible]) => !visible).map(([userId]) => userId)
}

const sameIds = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((id) => b.includes(id))

/**
 * Chama `onChange` já e a cada mudança; sumir de vista espera
 * OFFSCREEN_PAUSE_MS, voltar é imediato. Devolve o unsubscribe.
 */
export function watchVideoPause(onChange: (state: VideoPauseState) => void): () => void {
  const windowHidden = (): boolean => !useWindowActivityStore.getState().activity.visible
  const elements = (): Record<string, LiveElement> => useScreenVisibilityStore.getState().elements
  let hidden = windowHidden()
  let offscreen: string[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  const emit = (): void => onChange({ windowHidden: hidden, offscreen: new Set(offscreen) })
  const applyOffscreen = (next: string[]): void => {
    if (sameIds(next, offscreen)) return
    offscreen = next
    emit()
  }
  const syncOffscreen = (): void => {
    clearTimeout(timer)
    const now = offscreenLives(elements())
    applyOffscreen(offscreen.filter((id) => now.includes(id)))
    if (now.some((id) => !offscreen.includes(id))) {
      timer = setTimeout(() => applyOffscreen(offscreenLives(elements())), OFFSCREEN_PAUSE_MS)
    }
  }
  emit()
  const stopWindow = useWindowActivityStore.subscribe(() => {
    if (windowHidden() === hidden) return
    hidden = windowHidden()
    emit()
  })
  const stopVisibility = useScreenVisibilityStore.subscribe(syncOffscreen)
  return () => {
    clearTimeout(timer)
    stopWindow()
    stopVisibility()
  }
}
