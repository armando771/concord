import { gameAccent } from '../../../shared/gameCatalog'
import { gameIconPath } from '../lib/gameIcons'
import { GamepadIcon } from './icons'

/** Logo do jogo na cor dele; sem logo no catálogo, o ícone de controle. */
function GameIcon({
  name,
  className = 'h-4 w-4'
}: {
  name: string
  className?: string
}): React.JSX.Element {
  const path = gameIconPath(name)
  if (!path) return <GamepadIcon className={`${className} text-gray-400`} />
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={{ color: gameAccent(name) }}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  )
}

export default GameIcon
