import { useEffect } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { sanitizeDetectedTrack } from '../lib/listeningActivity'
import { useListeningStore } from '../store/listeningStore'

/**
 * Ouvindo (só no Electron, Windows e Linux): liga a detecção da música do main
 * enquanto há login e a opção está ligada, e repassa a faixa ao servidor.
 */
function MusicActivityBridge(): null {
  const music = window.api?.music
  const loggedIn = useAuthStore((s) => Boolean(s.accessToken))
  const enabled = useListeningStore((s) => s.enabled)
  const setDetected = useListeningStore((s) => s.setDetected)
  const active = loggedIn && enabled

  useEffect(() => {
    if (!music) return
    if (!active) {
      music.watch(false)
      setDetected(null)
      return
    }
    const off = music.onChange((track) => setDetected(sanitizeDetectedTrack(track)))
    music.watch(true)
    void music.current().then((track) => {
      const detected = sanitizeDetectedTrack(track)
      if (detected) setDetected(detected)
    })
    return () => {
      off()
      music.watch(false)
    }
  }, [music, active, setDetected])

  return null
}

export default MusicActivityBridge
