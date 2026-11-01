import type { OverlaySnapshot } from '../../renderer/src/features/overlay/lib/overlayState'
import type { OverlayLayout } from '../../renderer/src/features/overlay/lib/overlayLayout'
import type { Foreground } from './overlayPolicy'

// Contrato entre o controlador do overlay (overlay.ts: estado da call, jogo na
// frente, atalhos) e quem desenha a lista por cima do jogo: a janela do
// Electron (electronOverlay.ts) ou a janela nativa do helper (nativeOverlay.ts).

/** O que a superfície pede ao controlador. */
export interface OverlayHost {
  /** Último estado do renderer principal (null fora da call ou saindo do app). */
  snapshot: () => OverlaySnapshot | null
  /** Modo de edição (mover/redimensionar) ligado. */
  editing: () => boolean
  /** A superfície saiu da edição sozinha (ex.: a página recarregou). */
  stopEditing: () => void
  /** Posição/tamanho novos no fim do arraste: o renderer principal salva. */
  saveLayout: (layout: OverlayLayout) => void
  /** A janela sumiu (a página caiu): o controlador refaz o que estiver à vista. */
  lost: () => void
  /** A superfície não tem conserto nesta sessão (helper nativo saiu): troque de superfície. */
  failed: (reason: string) => void
}

/** Quem desenha o overlay por cima do jogo. */
export interface OverlaySurface {
  /** Estado novo do renderer principal (à vista ou não). */
  onState: () => void
  /** Mostra (ou atualiza) sobre o jogo, no monitor dele. */
  show: (foreground: NonNullable<Foreground>) => void
  hide: () => void
  /** O controlador ligou/desligou a edição. */
  setEditing: (editing: boolean) => void
  /** Já dá para ligar a edição (a página carregou / o helper respondeu). */
  canEdit: () => boolean
  /** Fim da call, overlay desligado ou saindo do app. */
  destroy: () => void
}
