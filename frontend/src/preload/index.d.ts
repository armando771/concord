import { ElectronAPI } from '@electron-toolkit/preload'

export interface ScreenSourceInfo {
  id: string
  name: string
  thumbnail: string
  appIcon: string | null
  displayId: string
}

export interface ScreenPickerApi {
  onShow(cb: () => void): () => void
  listSources(): Promise<ScreenSourceInfo[]>
  select(sourceId: string): void
  cancel(): void
}

export interface ScreenAudioApi {
  stop(): void
}

export interface UpdatesApi {
  status(): Promise<string | null>
  onReady(cb: (version: string) => void): () => void
  install(): void
}

export interface BackgroundApi {
  setCallState(state: { inCall: boolean; muted: boolean }): void
  notify(payload: { title: string; body: string; route: string; urgent?: boolean }): void
  quit(): void
  /** null = não suportado nesta plataforma */
  getAutostart(): Promise<boolean | null>
  setAutostart(enabled: boolean): Promise<boolean | null>
  onToggleMute(cb: () => void): () => void
  onQuitRequested(cb: () => void): () => void
  onNavigate(cb: (route: string) => void): () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api?: {
      screenPicker: ScreenPickerApi
      background?: BackgroundApi
      updates?: UpdatesApi
      screenAudio?: ScreenAudioApi
    }
  }
}
