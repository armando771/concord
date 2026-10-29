import type { ScreenAdaptView } from '../store/screenAdaptStore'

// Textos do aviso para quem transmite quando o controlador de qualidade desce
// de degrau (toast) e da linha de estado no seletor de qualidade da live.

const BY: Record<string, string> = { cpu: 'pelo seu PC', bandwidth: 'pela sua conexão' }
const WHO: Record<string, string> = { cpu: 'Seu PC', bandwidth: 'Sua conexão' }

/** Toast só quando desce (mesma escolha, degrau maior). */
export function adaptDropNotice(
  prev: ScreenAdaptView | null,
  next: ScreenAdaptView | null
): string | null {
  if (!prev || !next || prev.chosen !== next.chosen || next.step <= prev.step) return null
  const why = next.reason ? ` ${BY[next.reason]}` : ''
  return `Qualidade reduzida para ${next.effective}${why}.`
}

/** Linha no seletor de qualidade: saindo abaixo do escolhido, ou limitada no piso. */
export function adaptStatusText(view: ScreenAdaptView | null): string | null {
  if (!view?.reason) return null
  if (view.reduced) return `Saindo em ${view.effective} ${BY[view.reason]}.`
  return `${WHO[view.reason]} não está dando conta de ${view.effective}.`
}
