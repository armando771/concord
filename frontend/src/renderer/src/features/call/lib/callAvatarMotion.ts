import type { AvatarAnimate } from '../../../shared/ui/Avatar'

// Quando o GIF do avatar anima na chamada. Cada GIF animado faz o Chromium
// redesenhar a janela a cada quadro do GIF; com vários na call isso soma CPU e
// GPU o tempo todo. Regra: anima enquanto a pessoa fala ou com o mouse/foco em
// cima do avatar ('hover' do Avatar); parado no resto do tempo; e sempre parado
// com o app em segundo plano.

export interface CallAvatarMotion {
  /** App sem foco, minimizado ou na bandeja. */
  background: boolean
  speaking: boolean
}

export function callAvatarAnimate({ background, speaking }: CallAvatarMotion): AvatarAnimate {
  if (background) return 'never'
  return speaking ? 'always' : 'hover'
}
