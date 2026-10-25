import { useEffect, useState } from 'react'
import { clampOverlayOpacity, type OverlayMember, type OverlaySnapshot } from '../lib/overlayState'
import VoiceStateIcons from '../components/call/VoiceStateIcons'

/** Uma pessoa da call: avatar + nome + mic/fone cortados (estilo Discord). */
function OverlayPill({ member }: { member: OverlayMember }): React.JSX.Element {
  return (
    <div className="flex w-fit max-w-[240px] items-center gap-2 rounded-full bg-black/55 py-1 pl-1 pr-3">
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
 * Overlay de jogo: lista só-leitura de quem está na call, no meio da lateral
 * esquerda do monitor. A janela ignora o mouse; o estado vem do main.
 */
function OverlayApp(): React.JSX.Element | null {
  const [snapshot, setSnapshot] = useState<OverlaySnapshot | null>(null)

  useEffect(() => {
    const overlay = window.api?.overlay
    if (!overlay) return
    let alive = true
    overlay.current().then((s) => {
      if (alive && s) setSnapshot((prev) => prev ?? s)
    })
    const off = overlay.onUpdate(setSnapshot)
    return () => {
      alive = false
      off()
    }
  }, [])

  if (!snapshot || snapshot.members.length === 0) return null
  // Opacidade na lista inteira (não na janela): transparência e click-through
  // da janela continuam iguais.
  return (
    <div
      className="flex h-full flex-col justify-center gap-1.5 pl-4"
      style={{ opacity: clampOverlayOpacity(snapshot.opacity) / 100 }}
    >
      {snapshot.members.map((m) => (
        <OverlayPill key={m.id} member={m} />
      ))}
      {snapshot.more > 0 && (
        <div className="w-fit rounded-full bg-black/55 px-3 py-1 text-sm font-medium text-gray-200">
          +{snapshot.more}
        </div>
      )}
    </div>
  )
}

export default OverlayApp
