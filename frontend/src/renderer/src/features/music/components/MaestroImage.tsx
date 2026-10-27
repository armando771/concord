import maestroGif from '../../../assets/maestro.gif'
import maestroStill from '../../../assets/maestro-still.png'
import { useInBackground } from '../../../shared/store/windowActivityStore'

/**
 * Imagem do Maestro (GIF embutido no app). Com o app em segundo plano fica no
 * primeiro quadro: o GIF animado faz o Chromium redesenhar a janela ~12 vezes por
 * segundo, e ele aparece na lista de membros de todo servidor.
 */
function MaestroImage({
  className,
  style
}: {
  className: string
  style?: React.CSSProperties
}): React.JSX.Element {
  const background = useInBackground()
  return (
    <img
      src={background ? maestroStill : maestroGif}
      alt=""
      draggable={false}
      style={{ imageRendering: 'pixelated', ...style }}
      className={className}
      aria-hidden="true"
    />
  )
}

export default MaestroImage
