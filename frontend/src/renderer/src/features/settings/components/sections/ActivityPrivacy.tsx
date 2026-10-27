import { Toggle } from '../Toggle'
import { usePresenceActivityStore } from '../../../activity/store/presenceActivityStore'
import { useListeningStore } from '../../../activity/store/listeningStore'

function GameToggle(): React.JSX.Element {
  const showActivity = usePresenceActivityStore((s) => s.enabled)
  const setShowActivity = usePresenceActivityStore((s) => s.setEnabled)
  return (
    <Toggle
      title="Mostrar o jogo que estou jogando"
      description="Amigos e membros de servidores em comum veem o jogo em andamento embaixo do seu nome. Só jogos conhecidos são detectados; nada mais sai do seu computador."
      checked={showActivity}
      onChange={() => setShowActivity(!showActivity)}
    />
  )
}

function MusicToggle(): React.JSX.Element {
  const showMusic = useListeningStore((s) => s.enabled)
  const setShowMusic = useListeningStore((s) => s.setEnabled)
  return (
    <Toggle
      title="Mostrar a música que estou ouvindo"
      description="Amigos e membros de servidores em comum veem a música tocando agora (Spotify, YouTube Music, Deezer e outros players conhecidos), com o artista e o tempo. Vídeos e apps desconhecidos não aparecem."
      checked={showMusic}
      onChange={() => setShowMusic(!showMusic)}
    />
  )
}

/**
 * Privacidade → Atividade: mostrar ou não o jogo e a música em andamento. Só
 * no app de desktop (o navegador não detecta nada).
 */
export function ActivityPrivacy(): React.JSX.Element | null {
  const api = window.api
  if (!api?.games && !api?.music) return null
  return (
    <section className="border-b border-subtle pb-6">
      <h2 className="mb-3 text-ds-sm font-medium text-gray-400">Atividade</h2>
      <div className="flex flex-col gap-4">
        {api.games && <GameToggle />}
        {api.music && <MusicToggle />}
      </div>
    </section>
  )
}
