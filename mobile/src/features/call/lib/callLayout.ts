import type { CallPhase } from './callTypes'

/** Colunas da grade da chamada: 2 no celular (360 px), 3 a partir de 600 px, 4 a partir de 1000 px. */
export function gridColumns(width: number, people: number): number {
  const byWidth = width >= 1000 ? 4 : width >= 600 ? 3 : 2
  return Math.max(1, Math.min(byWidth, people))
}

const LABELS: Partial<Record<CallPhase, string>> = {
  outgoing: 'Chamando…',
  connecting: 'Conectando…',
  reconnecting: 'Reconectando…'
}

/** O texto de estado na barra e na tela da chamada (vazio quando está tudo normal). */
export const phaseLabel = (phase: CallPhase): string => LABELS[phase] ?? ''
