import { useEffect, useState } from 'react'

/**
 * Microfones e saídas da máquina, atualizados quando algo é plugado ou tirado
 * (Configurações → Voz e o menu da setinha do microfone/fone).
 */
export function useAudioDevices({ probe = true }: { probe?: boolean } = {}): MediaDeviceInfo[] {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

  useEffect(() => {
    let cancelled = false
    const refresh = async (): Promise<void> => {
      let list = await navigator.mediaDevices.enumerateDevices()
      // Sem permissão de microfone os nomes vêm vazios: pede uma vez e relista.
      // (probe: false no menu da setinha, para um clique não pedir permissão.)
      if (probe && list.some((d) => d.kind === 'audioinput' && !d.label)) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          stream.getTracks().forEach((t) => t.stop())
          list = await navigator.mediaDevices.enumerateDevices()
        } catch {
          // sem permissão: fica com os ids sem nome
        }
      }
      if (!cancelled) setDevices(list)
    }
    void refresh()
    navigator.mediaDevices.addEventListener('devicechange', refresh)
    return () => {
      cancelled = true
      navigator.mediaDevices.removeEventListener('devicechange', refresh)
    }
  }, [probe])

  return devices
}

/** Dá para escolher a saída de áudio (setSinkId) neste navegador/Electron. */
export const CAN_CHOOSE_OUTPUT =
  typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype
