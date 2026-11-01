import { create } from 'zustand'
import type { ScreenShareQuality } from '../lib/screenShareQuality'

type QualityRequest = {
  resolve: (quality: ScreenShareQuality | null) => void
}

export const useScreenQualityStore = create<{ request: QualityRequest | null }>(() => ({
  request: null
}))

export function requestScreenQuality(): Promise<ScreenShareQuality> {
  useScreenQualityStore.getState().request?.resolve(null)
  return new Promise<ScreenShareQuality>((resolve, reject) => {
    const request: QualityRequest = {
      resolve: (quality) => {
        if (useScreenQualityStore.getState().request !== request) return
        useScreenQualityStore.setState({ request: null })
        if (quality) resolve(quality)
        else reject(new DOMException('Compartilhamento cancelado', 'NotAllowedError'))
      }
    }
    useScreenQualityStore.setState({ request })
  })
}
