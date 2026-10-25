import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { overlayRowOpacity, type OverlayMember, type OverlaySnapshot } from '../lib/overlayState'
import {
  moveOverlayBox,
  normalizeOverlayLayout,
  OVERLAY_DEFAULT_LAYOUT,
  pixelsToFraction,
  placeOverlayBox,
  resizeOverlayScale,
  settleOverlayDraft,
  shownOverlayLayout,
  type OverlayBoxPx,
  type OverlayDraft,
  type OverlayFrame,
  type OverlayLayout,
  type OverlaySize
} from '../lib/overlayLayout'
import VoiceStateIcons from '../components/call/VoiceStateIcons'

const EDIT_HINT = 'Arraste para mover · canto para redimensionar · Shift+Tab ou Esc para sair'

/** Opacidade na pílula (não na janela nem na lista): quem fala se destaca dos outros. */
function rowStyle(resting: number, speaking: boolean): React.CSSProperties {
  return { opacity: overlayRowOpacity(resting, speaking) / 100 }
}

/** Uma pessoa da call: avatar + nome + mic/fone cortados (estilo Discord). */
function OverlayPill({
  member,
  opacity
}: {
  member: OverlayMember
  opacity: number
}): React.JSX.Element {
  return (
    <div
      className="flex w-fit max-w-[240px] items-center gap-2 rounded-full bg-black/55 py-1 pl-1 pr-3 transition-opacity duration-150"
      style={rowStyle(opacity, member.speaking)}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white ${
          member.speaking ? 'ring-2 ring-[#23a55a]' : ''
        }`}
      >
        {member.initial}
      </div>
      <span
        className={`truncate text-sm ${
          member.speaking ? 'font-bold text-white' : 'font-medium text-gray-200'
        }`}
      >
        {member.name}
      </span>
      {member.self && <span className="shrink-0 text-[10px] uppercase text-gray-400">você</span>}
      <VoiceStateIcons muted={member.muted} deafened={member.deafened} />
    </div>
  )
}

/**
 * Área de trabalho do monitor do jogo e onde a janela começa nela (DIP = px do
 * CSS). Até o main dizer, a janela é a área inteira.
 */
function initialFrame(): OverlayFrame {
  return { area: { width: window.innerWidth, height: window.innerHeight }, origin: { x: 0, y: 0 } }
}

interface Drag {
  mode: 'move' | 'resize'
  pointerId: number
  x0: number
  y0: number
  start: OverlayBoxPx
  startBox: OverlaySize
  startLayout: OverlayLayout
  /** Layout salvo no começo do arraste. */
  base: OverlayLayout
}

/**
 * Overlay de jogo: lista de quem está na call, por cima do jogo. A lista é uma
 * caixa posicionada aqui em coordenadas da área de trabalho; a janela (que
 * ignora o mouse) fica só em volta dela, e o main diz onde ela começa (frame).
 * No modo de edição (atalho, controlado pelo main) a janela vira a área inteira
 * e a caixa ganha moldura para arrastar e redimensionar. O estado vem do main.
 */
function OverlayApp(): React.JSX.Element | null {
  const [snapshot, setSnapshot] = useState<OverlaySnapshot | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<OverlayDraft | null>(null)
  const [box, setBox] = useState<OverlaySize>({ width: 0, height: 0 })
  const [frame, setFrame] = useState<OverlayFrame>(initialFrame)
  const { area, origin } = frame
  const boxRef = useRef<HTMLDivElement | null>(null)
  const drag = useRef<Drag | null>(null)
  const draftRef = useRef<OverlayDraft | null>(null)

  useEffect(() => {
    const overlay = window.api?.overlay
    if (!overlay) return
    let alive = true
    const offUpdate = overlay.onUpdate((next) => {
      setSnapshot(next)
      // Salvo novo: o arraste que esperava por ele acabou.
      setDraft((prev) => settleOverlayDraft(normalizeOverlayLayout(next.layout), prev))
    })
    const offEditing = overlay.onEditing(setEditing)
    const offFrame = overlay.onFrame(setFrame)
    // Depois de assinar: o main só liga a edição com a página ouvindo.
    overlay.ready().then((state) => {
      if (!alive) return
      if (state.snapshot) setSnapshot((prev) => prev ?? state.snapshot)
      if (state.frame) setFrame(state.frame)
      setEditing(state.editing)
    })
    return () => {
      alive = false
      offUpdate()
      offEditing()
      offFrame()
    }
  }, [])

  const savedRaw = snapshot?.layout
  const saved = useMemo(
    () => (savedRaw ? normalizeOverlayLayout(savedRaw) : OVERLAY_DEFAULT_LAYOUT),
    [savedRaw]
  )

  const commit = useCallback((): void => {
    drag.current = null
    const current = draftRef.current
    draftRef.current = null
    if (current) window.api?.overlay?.saveLayout(current.layout)
  }, [])

  // Saiu do modo de edição no meio do arraste (Esc/Shift+Tab): salva onde parou.
  useEffect(() => {
    if (!editing && drag.current) commit()
  }, [editing, commit])

  // Tamanho da caixa (muda com a escala e com quem entra/sai): para mantê-la na
  // tela e para o main deixar a janela só em volta dela.
  const hasMembers = !!snapshot && snapshot.members.length > 0
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const size = { width: el.offsetWidth, height: el.offsetHeight }
      window.api?.overlay?.reportBox(size)
      setBox((prev) => (prev.width === size.width && prev.height === size.height ? prev : size))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMembers])

  if (!snapshot || !hasMembers) return null

  const layout = shownOverlayLayout(saved, draft)
  const pos = placeOverlayBox(layout.position, area, box)

  const begin = (mode: Drag['mode'], e: React.PointerEvent): void => {
    if (!editing || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    boxRef.current?.setPointerCapture(e.pointerId)
    drag.current = {
      mode,
      pointerId: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      start: pos,
      startBox: box,
      // Redimensionar segura o canto de cima à esquerda onde ele está.
      startLayout: { ...layout, position: layout.position ?? pixelsToFraction(pos, area) },
      base: saved
    }
    draftRef.current = null
  }

  const onPointerMove = (e: React.PointerEvent): void => {
    const d = drag.current
    if (!d || e.pointerId !== d.pointerId) return
    const dx = e.clientX - d.x0
    const dy = e.clientY - d.y0
    const next: OverlayLayout =
      d.mode === 'move'
        ? { ...d.startLayout, position: moveOverlayBox(d.start, dx, dy, area, d.startBox) }
        : { ...d.startLayout, scale: resizeOverlayScale(d.startLayout.scale, d.startBox, dx, dy) }
    const nextDraft = { layout: next, base: d.base }
    draftRef.current = nextDraft
    setDraft(nextDraft)
  }

  const onPointerUp = (e: React.PointerEvent): void => {
    if (drag.current?.pointerId === e.pointerId) commit()
  }

  const hintBelow = pos.top + box.height + 40 <= area.height
  const hintRight = pos.left + box.width / 2 > area.width / 2

  return (
    <div className="relative h-full w-full">
      <div
        ref={boxRef}
        // w-max: a largura não depende da janela (que é do tamanho da caixa).
        className={`absolute w-max rounded-xl border-2 p-2 ${
          editing ? 'cursor-move border-dashed border-[#23a55a] bg-black/20' : 'border-transparent'
        }`}
        // Escondida até medir: sem o tamanho, não dá para centralizar nem encaixar.
        style={{
          left: pos.left - origin.x,
          top: pos.top - origin.y,
          visibility: box.width ? 'visible' : 'hidden'
        }}
        onPointerDown={(e) => begin('move', e)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="flex flex-col gap-1.5" style={{ zoom: layout.scale }}>
          {snapshot.members.map((m) => (
            <OverlayPill key={m.id} member={m} opacity={snapshot.opacity} />
          ))}
          {snapshot.more > 0 && (
            <div
              className="w-fit rounded-full bg-black/55 px-3 py-1 text-sm font-medium text-gray-200"
              style={rowStyle(snapshot.opacity, false)}
            >
              +{snapshot.more}
            </div>
          )}
        </div>
        {editing && (
          <>
            <div
              aria-label="Redimensionar"
              className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-[#23a55a] bg-black/70"
              onPointerDown={(e) => begin('resize', e)}
            />
            <div
              className={`pointer-events-none absolute whitespace-nowrap rounded-md bg-black/75 px-2 py-1 text-xs font-medium text-white ${
                hintBelow ? 'top-full mt-3' : 'bottom-full mb-3'
              } ${hintRight ? 'right-0' : 'left-0'}`}
            >
              {EDIT_HINT}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default OverlayApp
