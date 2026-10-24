// Dispositivos de áudio escolhidos pelo usuário (por máquina). '' = padrão do
// sistema.

export interface AudioPrefs {
  inputId: string
  outputId: string
}

const KEY = 'concord.audio'
const DEFAULT_PREFS: AudioPrefs = { inputId: '', outputId: '' }

export function loadAudioPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed = JSON.parse(raw) as Partial<AudioPrefs>
    return {
      inputId: typeof parsed.inputId === 'string' ? parsed.inputId : '',
      outputId: typeof parsed.outputId === 'string' ? parsed.outputId : ''
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function saveAudioPrefs(prefs: AudioPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // armazenamento indisponível: a escolha vale só nesta sessão
  }
}

/** O id escolhido se o dispositivo ainda existe; senão o padrão (''). */
export function resolveDeviceId(
  devices: MediaDeviceInfo[],
  kind: MediaDeviceKind,
  id: string
): string {
  if (!id) return ''
  return devices.some((d) => d.kind === kind && d.deviceId === id) ? id : ''
}
