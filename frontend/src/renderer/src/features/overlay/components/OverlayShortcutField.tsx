import { useEffect, useState } from 'react'
import { acceleratorFromKey } from '../lib/overlayShortcut'
import { useOverlayPrefsStore } from '../store/overlayPrefsStore'

/** Atalho e se outro programa já tem ele. */
interface ShortcutStatus {
  accelerator: string
  taken: boolean
}

/**
 * "Atalho para mover o overlay": clica, aperta a combinação (Esc cancela).
 * Avisa se outro programa já tem o atalho (o main tenta registrar).
 */
function OverlayShortcutField({ disabled }: { disabled: boolean }): React.JSX.Element {
  const overlay = window.api?.overlay
  const shortcut = useOverlayPrefsStore((s) => s.shortcut)
  const setShortcut = useOverlayPrefsStore((s) => s.setShortcut)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<ShortcutStatus | null>(null)

  // Ao abrir e a cada troca: o atalho está livre? E o resultado de segurar no jogo.
  useEffect(() => {
    if (!overlay) return
    let alive = true
    void overlay.checkShortcut(shortcut).then((result) => {
      if (alive && result) setStatus(result)
    })
    const off = overlay.onShortcutStatus(setStatus)
    return () => {
      alive = false
      off()
    }
  }, [overlay, shortcut])

  const inUse = status?.accelerator === shortcut && status.taken

  const start = (): void => {
    if (disabled) return
    setError(null)
    setRecording(true)
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (!recording) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        start()
      }
      return
    }
    // Gravando: a tecla é o atalho, não navegação (Tab não muda o foco).
    e.preventDefault()
    e.stopPropagation()
    const result = acceleratorFromKey(e)
    if (result.kind === 'pending') return
    setRecording(false)
    if (result.kind === 'invalid') setError(result.message)
    else if (result.kind === 'ok') setShortcut(result.accelerator)
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-strong">Atalho para mover o overlay</span>
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-label={`Atalho para mover o overlay: ${shortcut}. Clique e aperte a combinação nova.`}
          onClick={() => (recording ? setRecording(false) : start())}
          onKeyDown={onKeyDown}
          onBlur={() => setRecording(false)}
          className={`min-w-[9rem] shrink-0 cursor-pointer select-none rounded-lg border px-3 py-2 text-center text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-violet-400 ${
            recording
              ? 'border-brand bg-brand/15 text-strong'
              : 'border-subtle bg-fg/10 text-strong hover:bg-fg/15'
          } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
        >
          {recording ? 'Aperte a combinação…' : <kbd className="font-semibold">{shortcut}</kbd>}
        </div>
      </div>
      <span className="text-xs text-gray-400">
        {recording
          ? 'Aperte a combinação com Ctrl, Alt ou Shift. Esc cancela.'
          : `Durante o jogo, ${shortcut} liga o modo de mover e redimensionar o overlay (${shortcut} ou Esc para sair).`}
      </span>
      {error && <p className="text-xs text-amber-300">{error}</p>}
      {inUse && (
        <p className="text-xs text-amber-300">Atalho em uso por outro programa — escolha outro</p>
      )}
      <span className="text-xs text-gray-500">
        Shift+Tab também abre o overlay da Steam e pode atrapalhar jogos que usam Shift (correr) +
        Tab (placar)
      </span>
    </div>
  )
}

export default OverlayShortcutField
