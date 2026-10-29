import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCallStore } from '../store/callStore'
import { useCallNicknames } from '../../servers/hooks/useServerNames'
import { serverDisplayName } from '../../servers/lib/serverNames'
import {
  clampMiniPlayer,
  loadMiniPlayerOffset,
  MiniPlayerGesture,
  saveMiniPlayerOffset,
  type MiniPlayerOffset,
  type MiniPlayerViewport
} from '../lib/miniPlayerPosition'
import { miniPlayerTarget } from '../lib/screenWatch'
import { XIcon } from '../../../shared/ui/icons'
import VideoFill from './VideoFill'
import { callRoute } from '../lib/callUtils'

// w-72 + aspect-video (no render; nos eventos vale o tamanho medido).
const MINI_PLAYER_SIZE = { width: 288, height: 162 }

/** Janela menos a barra de título própria (var --titlebar-height do TitleBar). */
function readViewport(): MiniPlayerViewport {
  const bar = getComputedStyle(document.documentElement).getPropertyValue('--titlebar-height')
  return { width: window.innerWidth, height: window.innerHeight, top: parseFloat(bar) || 0 }
}

function sizeOf(el: HTMLElement | null): { width: number; height: number } {
  return el && el.offsetWidth > 0
    ? { width: el.offsetWidth, height: el.offsetHeight }
    : MINI_PLAYER_SIZE
}

/**
 * Transmissão assistida fora da tela da call (outro canal, servidor, DM ou
 * DM minimizada): miniatura que continua passando, no canto ou onde o usuário
 * arrastar (lembrado entre aberturas). O som segue no CallOverlay. Clicar sem
 * arrastar (ou Enter/Espaço) volta à call com a transmissão em destaque.
 */
function ScreenMiniPlayer(): React.JSX.Element | null {
  const navigate = useNavigate()
  const nicknames = useCallNicknames()
  const ref = useRef<HTMLDivElement>(null)
  const [gesture] = useState(() => new MiniPlayerGesture())
  const [offset, setOffset] = useState(loadMiniPlayerOffset)
  const [viewport, setViewport] = useState(readViewport)
  const [dragging, setDragging] = useState(false)
  const status = useCallStore((s) => s.status)
  const type = useCallStore((s) => s.type)
  const serverId = useCallStore((s) => s.serverId)
  const channelId = useCallStore((s) => s.channelId)
  const participants = useCallStore((s) => s.participants)
  const mediaPeers = useCallStore((s) => s.mediaPeers)
  const stageVisible = useCallStore((s) => s.stageVisible)
  const watchedScreenIds = useCallStore((s) => s.watchedScreenIds)
  const focusedScreenUserId = useCallStore((s) => s.focusedScreenUserId)
  const screenStreams = useCallStore((s) => s.screenStreams)
  const focusWatchedScreen = useCallStore((s) => s.focusWatchedScreen)
  const stopWatchingScreen = useCallStore((s) => s.stopWatchingScreen)

  const id = miniPlayerTarget(watchedScreenIds, focusedScreenUserId, screenStreams)
  const visible = status === 'active' && !stageVisible && !!id

  // Janela redimensionada: a posição salva é reencaixada para continuar à vista.
  // Lê de novo ao montar: a altura da barra de título só existe depois do
  // layout effect do TitleBar.
  useEffect(() => {
    const onResize = (): void => setViewport(readViewport())
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Sumiu no meio do arrasto (transmissão acabou, voltou à call): o cursor
  // não pode ficar preso em "grabbing" (ajuste no render, como pede o React).
  const [wasVisible, setWasVisible] = useState(visible)
  if (wasVisible !== visible) {
    setWasVisible(visible)
    if (!visible) setDragging(false)
  }

  // ...e o arrasto em andamento é solto, guardando onde parou (também ao desmontar).
  useEffect(() => {
    const finish = (): void => {
      const last = gesture.end()
      if (last) saveMiniPlayerOffset(last)
    }
    if (!visible) finish()
    return finish
  }, [gesture, visible])

  if (!visible || !id) return null

  const shown = clampMiniPlayer(offset, MINI_PLAYER_SIZE, viewport)

  const name = serverDisplayName(
    { nickname: nicknames?.[id] },
    { display_name: participants.find((p) => p.id === id)?.display_name || mediaPeers[id] }
  )

  const handleOpen = (): void => {
    focusWatchedScreen(id)
    const route = callRoute({ type, serverId, channelId, peerId: participants[0]?.id ?? null })
    if (route) navigate(route)
  }

  const fit = (next: MiniPlayerOffset): MiniPlayerOffset =>
    clampMiniPlayer(next, sizeOf(ref.current), readViewport())

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return
    gesture.down(e.pointerId, e.clientX, e.clientY, shown)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const next = gesture.move(e.pointerId, e.clientX, e.clientY, fit)
    if (!next) return
    setDragging(true)
    setOffset(next)
  }

  // pointerup, pointercancel ou captura perdida: o "voltar à call" fica no click.
  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>): void => {
    const final = gesture.end(e.pointerId)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    setDragging(false)
    if (!final) return
    setOffset(final)
    saveMiniPlayerOffset(final)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    // Enter no X (que está dentro) é do X.
    if (e.target !== e.currentTarget) return
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    handleOpen()
  }

  return (
    <div
      ref={ref}
      onClick={() => {
        if (gesture.takeClick()) handleOpen()
      }}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
      role="button"
      tabIndex={0}
      aria-label={`Voltar para a chamada: transmissão de ${name}`}
      title="Voltar para a chamada (arraste para mover)"
      style={{ right: shown.right, bottom: shown.bottom }}
      className={`on-media fixed z-40 aspect-video w-72 touch-none select-none overflow-hidden rounded-2xl bg-black shadow-xl ring-2 ring-success focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
        dragging ? 'cursor-grabbing' : 'cursor-pointer'
      }`}
    >
      <VideoFill stream={screenStreams[id]} fit="contain" />
      <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-danger-strong px-1.5 py-0.5">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-white">Ao vivo</span>
      </div>
      <button
        // O X não começa arrasto nem conta como clique de voltar à call.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          stopWatchingScreen(id)
        }}
        aria-label="Fechar transmissão"
        title="Fechar transmissão"
        className="absolute right-2 top-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-black/60 text-gray-200 backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white on-media"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
      <div className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] rounded-md bg-black/60 px-2 py-1 backdrop-blur-sm on-media">
        <span className="block truncate text-xs font-semibold text-strong">{name}</span>
      </div>
    </div>
  )
}

export default ScreenMiniPlayer
