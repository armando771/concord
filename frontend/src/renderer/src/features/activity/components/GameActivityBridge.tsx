import { useEffect } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { usePresenceActivityStore } from '../store/presenceActivityStore'

/**
 * Em atividade (só no Electron do Windows): liga a detecção de jogos do main
 * enquanto há login e a opção está ligada, e repassa o jogo ao servidor.
 */
function GameActivityBridge(): null {
  const games = window.api?.games
  const loggedIn = useAuthStore((s) => Boolean(s.accessToken))
  const enabled = usePresenceActivityStore((s) => s.enabled)
  const setDetected = usePresenceActivityStore((s) => s.setDetected)
  const active = loggedIn && enabled

  useEffect(() => {
    if (!games) return
    if (!active) {
      games.watch(false)
      setDetected(null)
      return
    }
    const off = games.onChange(setDetected)
    games.watch(true)
    void games.current().then((game) => {
      if (game) setDetected(game)
    })
    return () => {
      off()
      games.watch(false)
    }
  }, [games, active, setDetected])

  return null
}

export default GameActivityBridge
