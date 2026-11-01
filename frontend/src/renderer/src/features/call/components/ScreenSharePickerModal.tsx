import { useCallback, useEffect, useRef, useState } from 'react'
import { notePickedSource } from '../lib/windowAudio'
import type { ScreenSourceInfo } from '../../../../../preload/index.d'
import Button from '../../../shared/ui/Button'
import { MonitorIcon } from '../../../shared/ui/icons'
import { notePickerCancelled } from '../lib/screenPickerCancel'
import { loadScreenQuality, saveScreenQuality } from '../lib/screenShareQuality'
import ScreenQualityControls from './ScreenQualityControls'
import { trapTab } from '../../../shared/lib/focusTrap'
import { ScreenSourceGridSkeleton } from '../../../shared/ui/skeleton/layouts'

/**
 * Picker de fonte para compartilhamento de tela (estilo Discord).
 * Aberto quando o main process sinaliza um getDisplayMedia pendente
 * (`screen-picker:show`); a seleção volta via IPC.
 */
function ScreenSharePickerModal(): React.JSX.Element | null {
  // No navegador (fora do Electron) não há preload/IPC: o picker nativo
  // do Chromium cuida do getDisplayMedia e este modal fica inerte.
  const screenPicker = typeof window !== 'undefined' ? window.api?.screenPicker : undefined

  const [open, setOpen] = useState(false)
  const [quality, setQuality] = useState(loadScreenQuality)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [sources, setSources] = useState<ScreenSourceInfo[]>([])
  // Listar as fontes demora (miniaturas): antes disso não dá para dizer "nenhuma opção".
  const [sourcesLoaded, setSourcesLoaded] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState<'screen' | 'window'>('screen')

  useEffect(() => {
    if (!screenPicker) return
    const off = screenPicker.onShow(() => {
      setSelected(null)
      setSourcesLoaded(false)
      setQuality(loadScreenQuality())
      setTab('screen')
      setOpen(true)
    })
    return off
  }, [screenPicker])

  useEffect(() => {
    if (!open || !screenPicker) return
    let cancelled = false
    screenPicker
      .listSources()
      .then((all) => {
        if (cancelled) return
        setSources(all)
        setSourcesLoaded(true)
        const firstScreen = all.find((s) => s.displayId !== '')
        if (firstScreen) setSelected(firstScreen.id)
      })
      .catch(() => setOpen(false))
    return () => {
      cancelled = true
    }
  }, [open, screenPicker])

  const close = useCallback((): void => {
    setOpen(false)
  }, [])

  const cancel = useCallback((): void => {
    notePickerCancelled()
    screenPicker?.cancel()
    close()
  }, [screenPicker, close])

  const confirm = useCallback((): void => {
    if (!selected) return
    saveScreenQuality(quality)
    notePickedSource(selected)
    screenPicker?.select(selected)
    close()
  }, [screenPicker, selected, close, quality])

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') cancel()
      trapTab(e, dialogRef.current)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previousFocus?.focus()
    }
  }, [open, cancel])

  if (!open) return null

  const screens = sources.filter((s) => s.displayId !== '')
  const windows = sources.filter((s) => s.displayId === '')
  const visible = tab === 'screen' ? screens : windows

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        role="dialog"
        ref={dialogRef}
        tabIndex={-1}
        aria-modal="true"
        aria-label="Compartilhe sua tela"
        className="rounded-2xl border border-subtle bg-modal shadow-2xl shadow-black/70 max-h-[95vh] w-full max-w-2xl overflow-y-auto p-6"
      >
        <h2 className="text-xl font-bold text-strong">Compartilhe sua tela</h2>
        <div className="mt-4 flex gap-4 border-b border-subtle">
          <button
            onClick={() => {
              setTab('screen')
              setSelected(screens[0]?.id ?? null)
            }}
            className={`cursor-pointer border-b-2 px-3 pb-2 text-sm font-semibold transition-colors ${
              tab === 'screen'
                ? 'border-[var(--text-strong)] text-strong'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Telas
          </button>
          <button
            onClick={() => {
              setTab('window')
              setSelected(windows[0]?.id ?? null)
            }}
            className={`cursor-pointer border-b-2 px-3 pb-2 text-sm font-semibold transition-colors ${
              tab === 'window'
                ? 'border-[var(--text-strong)] text-strong'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Aplicativos
          </button>
        </div>

        <div className="mt-5 grid max-h-[46vh] grid-cols-2 gap-3 overflow-y-auto pr-1">
          {!sourcesLoaded && <ScreenSourceGridSkeleton />}
          {sourcesLoaded && visible.length === 0 && (
            <p className="col-span-2 py-8 text-center text-sm text-gray-500">
              Nenhuma opção disponível.
            </p>
          )}
          {visible.map((source) => (
            <button
              key={source.id}
              onClick={() => setSelected(source.id)}
              className={`group cursor-pointer rounded-lg p-2 text-left transition-colors ${
                selected === source.id ? 'bg-brand/20' : 'bg-fg/[0.03] hover:bg-fg/[0.07]'
              }`}
            >
              <div
                className={`relative mb-2 aspect-video overflow-hidden rounded-md bg-black ${
                  selected === source.id
                    ? 'ring-2 ring-brand'
                    : 'ring-1 ring-fg/10 group-hover:ring-fg/25'
                }`}
              >
                {source.thumbnail ? (
                  <img
                    src={source.thumbnail}
                    alt={source.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <MonitorIcon className="h-8 w-8 text-gray-600" />
                  </div>
                )}
                {selected === source.id && (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                    ✓
                  </span>
                )}
              </div>
              <p className="truncate text-xs font-semibold text-gray-200">{source.name}</p>
            </button>
          ))}
        </div>

        <ScreenQualityControls value={quality} onChange={setQuality} />

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="ghost" onClick={cancel}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={!selected} onClick={confirm}>
            Compartilhar
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ScreenSharePickerModal
