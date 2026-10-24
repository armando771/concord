import { beforeEach, describe, expect, it } from 'vitest'
import { loadAudioPrefs, resolveDeviceId, saveAudioPrefs } from './audioDevices'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size
    }
  }
}

const devices = [
  { deviceId: 'default', kind: 'audioinput', label: 'Padrão' },
  { deviceId: 'mic-usb', kind: 'audioinput', label: 'Mic USB' },
  { deviceId: 'cam-mic', kind: 'audioinput', label: 'Webcam' },
  { deviceId: 'fone', kind: 'audiooutput', label: 'Fone' }
] as MediaDeviceInfo[]

describe('audioDevices', () => {
  beforeEach(() => {
    globalThis.localStorage = memoryStorage()
  })

  it('lembra a entrada e a saída escolhidas', () => {
    saveAudioPrefs({ inputId: 'mic-usb', outputId: 'fone' })
    expect(loadAudioPrefs()).toEqual({ inputId: 'mic-usb', outputId: 'fone' })
  })

  it('sem nada salvo usa o padrão do sistema', () => {
    expect(loadAudioPrefs()).toEqual({ inputId: '', outputId: '' })
  })

  it('ignora preferência corrompida', () => {
    localStorage.setItem('concord.audio', '{oops')
    expect(loadAudioPrefs()).toEqual({ inputId: '', outputId: '' })
  })

  it('mantém o dispositivo escolhido se ele ainda existe', () => {
    expect(resolveDeviceId(devices, 'audioinput', 'mic-usb')).toBe('mic-usb')
  })

  it('volta para o padrão quando o dispositivo sumiu', () => {
    expect(resolveDeviceId(devices, 'audioinput', 'mic-que-foi-desconectado')).toBe('')
    // id de saída não serve como entrada
    expect(resolveDeviceId(devices, 'audioinput', 'fone')).toBe('')
  })
})
