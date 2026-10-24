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
  onFallback(cb: (logPath: string) => void): () => void
  stop(): void
}

export interface UpdatesApi {
  status(): Promise<{ version: string; ready: boolean } | null>
  onAvailable(cb: (version: string) => void): () => void
  onReady(cb: (version: string) => void): () => void
  onProgress(cb: (percent: number) => void): () => void
  onError(cb: (message: string) => void): () => void
  install(): void
}

export interface BackgroundApi {
  setCallState(state: { inCall: boolean; muted: boolean }): void
  notify(payload: {
    title: string
    body: string
    route: string
    urgent?: boolean
    /** Toast nativo (padrão: ligado). */
    toast?: boolean
    /** Piscar + selo de não lidas na barra de tarefas (padrão: ligado). */
    taskbar?: boolean
  }): void
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
