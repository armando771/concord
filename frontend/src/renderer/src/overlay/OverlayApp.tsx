import { useState } from 'react'
import type { OverlaySize } from '../features/overlay/lib/overlayLayout'
import OverlayBox from './OverlayBox'
import { useOverlayHost } from './useOverlayHost'

/**
 * Overlay de jogo: lista de quem está na call, por cima do jogo. A lista é uma
 * caixa posicionada em coordenadas da área de trabalho; a janela (que ignora o
 * mouse) fica só em volta dela, e o main diz onde ela começa (frame). No modo
 * de edição (atalho, controlado pelo main) a janela vira a área inteira e a
 * caixa ganha moldura para arrastar e redimensionar. O estado vem do main.
 */
function OverlayApp(): React.JSX.Element | null {
  const host = useOverlayHost()
  const [box, setBox] = useState<OverlaySize>({ width: 0, height: 0 })
  const { snapshot } = host
  if (!snapshot || snapshot.members.length === 0) return null
  return <OverlayBox {...host} snapshot={snapshot} box={box} setBox={setBox} />
}

export default OverlayApp
