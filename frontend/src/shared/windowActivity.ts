// Estado da janela principal que o main manda ao renderer ('window:activity').
// O renderer não descobre isso sozinho: com o throttling de segundo plano
// desligado (em chamada) o Chromium diz que a página está sempre visível e em
// foco, mesmo minimizada ou atrás do jogo.

export interface WindowActivity {
  /** A janela tem o foco do teclado (a pessoa está usando o app agora). */
  focused: boolean
  /** A janela aparece: não está minimizada nem escondida na bandeja. */
  visible: boolean
}

/** Antes do primeiro aviso do main (e no app web): janela em uso. */
export const ACTIVE_WINDOW: WindowActivity = { focused: true, visible: true }

export function sameActivity(a: WindowActivity, b: WindowActivity): boolean {
  return a.focused === b.focused && a.visible === b.visible
}

/** Valida o que chega pelo IPC; null se não for um WindowActivity. */
export function parseWindowActivity(raw: unknown): WindowActivity | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { focused, visible } = raw as Record<string, unknown>
  if (typeof focused !== 'boolean' || typeof visible !== 'boolean') return null
  return { focused, visible }
}

/** A pessoa não está olhando para o app: sem foco ou fora da tela. */
export const inBackground = (activity: WindowActivity): boolean =>
  !activity.focused || !activity.visible
