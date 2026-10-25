import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useCallStore } from '../../store/callStore'
import { useSettingsStore } from '../../store/settingsStore'
import { deviceOptions } from '../../lib/audioDevices'
import { CAN_CHOOSE_OUTPUT, useAudioDevices } from '../useAudioDevices'
import { CheckIcon } from '../icons'

const MENU_WIDTH = 260
const GAP = 8
const MARGIN = 8

export type AudioDeviceKind = 'input' | 'output'

/**
 * Menu da setinha ao lado do microfone/fone (como no Discord): escolhe o
 * dispositivo de entrada ou de saída sem abrir as Configurações. Usa as mesmas
 * ações do store que Configurações → Voz.
 */
function AudioDeviceMenu({
  kind,
  anchor,
  onClose
}: {
  kind: AudioDeviceKind
  anchor: HTMLElement
  onClose: () => void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const devices = useAudioDevices()
  const selected = useCallStore((s) => (kind === 'input' ? s.inputDeviceId : s.outputDeviceId))
  const setInputDevice = useCallStore((s) => s.setInputDevice)
  const setOutputDevice = useCallStore((s) => s.setOutputDevice)
  const openSettings = useSettingsStore((s) => s.openSettings)

  const title = kind === 'input' ? 'Dispositivo de entrada' : 'Dispositivo de saída'
  const canChoose = kind === 'input' || CAN_CHOOSE_OUTPUT
  const options = deviceOptions(devices, kind === 'input' ? 'audioinput' : 'audiooutput')

  // Acima da setinha, sem sair da janela (a sidebar fica colada na esquerda).
  const rect = anchor.getBoundingClientRect()
  const left = Math.min(
    Math.max(MARGIN, rect.right - MENU_WIDTH),
    window.innerWidth - MENU_WIDTH - MARGIN
  )
  const bottom = window.innerHeight - rect.top + GAP

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      const target = e.target as Node
      if (!ref.current?.contains(target) && !anchor.contains(target)) onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [anchor, onClose])

  const choose = (id: string): void => {
    if (kind === 'input') void setInputDevice(id)
    else setOutputDevice(id)
    onClose()
  }

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={title}
      style={{ width: MENU_WIDTH, left, bottom }}
      className="fixed z-50 rounded-lg border border-white/10 bg-[#111214] p-1.5 shadow-2xl"
    >
      <p className="px-2 pb-1 pt-0.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">
        {title}
      </p>
      {canChoose ? (
        <div className="max-h-64 overflow-y-auto">
          {options.map((o) => {
            const checked = o.id === selected
            return (
              <button
                key={o.id || 'default'}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                onClick={() => choose(o.id)}
                title={o.label}
                className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-[#5865f2] hover:text-white ${
                  checked ? 'text-white' : 'text-gray-300'
                }`}
              >
                <span className="min-w-0 truncate">{o.label}</span>
                {checked && <CheckIcon className="h-4 w-4 shrink-0" />}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="px-2 py-1.5 text-xs text-gray-400">
          Este navegador não deixa escolher a saída de áudio.
        </p>
      )}
      <div className="my-1 border-t border-white/10" />
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onClose()
          openSettings('voice')
        }}
        className="flex w-full cursor-pointer items-center rounded px-2 py-1.5 text-left text-sm text-gray-300 transition-colors hover:bg-[#5865f2] hover:text-white"
      >
        Configurações de voz
      </button>
    </div>,
    document.body
  )
}

export default AudioDeviceMenu
