import { useEffect, useState } from 'react'
import { useConnectionStore } from '../store/connectionStore'
import { useChatStore } from '../../features/chat/store/chatStore'
import {
  connectionBanner,
  nextBannerChange,
  type ConnectionBanner as Banner
} from '../lib/wsStatus'

const TONE: Record<Banner['kind'], string> = {
  offline: 'border-danger/30 bg-danger/15',
  lost: 'border-danger/30 bg-danger/15',
  restarting: 'border-brand/30 bg-brand/15',
  reconnected: 'border-success/30 bg-success/15'
}

/** Cor do ponto e do botão (texto do tema, com contraste AA). */
const ACCENT: Record<Banner['kind'], string> = {
  offline: 'text-danger',
  lost: 'text-danger',
  restarting: 'text-brand',
  reconnected: 'text-success'
}

function bannerText(banner: Banner): string {
  switch (banner.kind) {
    case 'offline':
      return 'Você está offline — confira sua internet. O app reconecta sozinho quando ela voltar.'
    case 'lost':
      return `Sem conexão — tentando reconectar… (tentativa ${banner.attempt})`
    case 'restarting':
      return 'Servidor atualizando — volta em instantes…'
    case 'reconnected':
      return 'Reconectado'
  }
}

/**
 * Aviso no topo do app quando o chat (WebSocket) cai, o servidor está
 * reiniciando ou o navegador está offline. Some sozinho quando volta.
 */
function ConnectionBanner(): React.JSX.Element | null {
  const ws = useConnectionStore((s) => s.ws)
  const online = useConnectionStore((s) => s.online)
  const [now, setNow] = useState(() => Date.now())

  // Os avisos dependem de quanto tempo passou: reavalia na hora em que mudariam.
  useEffect(() => {
    const current = Date.now()
    // Evento novo com a hora velha: acerta logo; senão, na próxima virada.
    const at = current - now > 100 ? current : nextBannerChange(ws, online, current)
    if (at === null) return
    const id = window.setTimeout(() => setNow(Date.now()), Math.max(0, at - current) + 20)
    return () => window.clearTimeout(id)
  }, [ws, online, now])

  const banner = connectionBanner(ws, online, now)
  if (!banner) return null

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="connection-banner"
      data-kind={banner.kind}
      className={`flex items-center gap-3 border-b px-4 py-2 text-sm text-normal ${TONE[banner.kind]}`}
    >
      {banner.kind !== 'reconnected' && (
        <span
          aria-hidden="true"
          className={`h-2 w-2 shrink-0 animate-pulse rounded-full bg-current ${ACCENT[banner.kind]}`}
        />
      )}
      <span className="min-w-0 flex-1 truncate">{bannerText(banner)}</span>
      {banner.kind === 'lost' && (
        <button
          type="button"
          onClick={() => useChatStore.getState().retryWsNow()}
          className={`shrink-0 cursor-pointer rounded font-semibold underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand ${ACCENT[banner.kind]}`}
        >
          Tentar agora
        </button>
      )}
    </div>
  )
}

export default ConnectionBanner
