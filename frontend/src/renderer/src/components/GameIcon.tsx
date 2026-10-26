import { useState } from 'react'
import { gameAccent } from '../../../shared/gameCatalog'
import { gameIconPath } from '../lib/gameIcons'
import { steamIconUrl } from '../lib/steamIcon'
import { GamepadIcon } from './icons'

/**
 * Logo do jogo na cor dele; jogo da Steam fora do catálogo usa o ícone da
 * Steam (appid + hash); sem nenhum dos dois, ou se a imagem não carregar, o
 * controle.
 */
function GameIcon({
  name,
  appId,
  iconHash,
  className = 'h-4 w-4'
}: {
  name: string
  appId?: number
  iconHash?: string
  className?: string
}): React.JSX.Element {
  const path = gameIconPath(name)
  if (!path) return <SteamIcon appId={appId} iconHash={iconHash} className={className} />
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

function SteamIcon({
  appId,
  iconHash,
  className
}: {
  appId?: number
  iconHash?: string
  className: string
}): React.JSX.Element {
  const url = steamIconUrl(appId, iconHash)
  // `key` reinicia o erro ao trocar de jogo.
  return <SteamImage key={url ?? ''} url={url} className={className} />
}

function SteamImage({
  url,
  className
}: {
  url: string | null
  className: string
}): React.JSX.Element {
  const [failed, setFailed] = useState(false)
  if (!url || failed) return <GamepadIcon className={`${className} text-gray-400`} />
  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={() => setFailed(true)}
      className={`${className} rounded-[3px] object-cover`}
    />
  )
}

export default GameIcon
