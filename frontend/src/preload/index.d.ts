import { ElectronAPI } from '@electron-toolkit/preload'
import type { OverlaySnapshot } from '../renderer/src/lib/overlayState'
import type { OverlayFrame, OverlayLayout } from '../renderer/src/lib/overlayLayout'
import type { CallResume, PendingCallResume } from '../shared/callResume'

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
  setCallSnapshot(snapshot: CallResume | null): void
  takeCallResume(): Promise<PendingCallResume | null>
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

export interface OverlayApi {
  /** Overlay de jogo existe nesta plataforma (só Windows). */
  supported: boolean
  /** Renderer principal → main: estado atual da call para o overlay. */
  setState(snapshot: OverlaySnapshot): void
  /**
   * Página do overlay: avisa que carregou (chamar depois de assinar onUpdate e
   * onEditing) e recebe o último estado e se está no modo de edição.
   */
  ready(): Promise<{
    snapshot: OverlaySnapshot | null
    editing: boolean
    frame: OverlayFrame | null
  }>
  /** Página do overlay: onde a janela está na área de trabalho. Retorna unsubscribe. */
  onFrame(cb: (frame: OverlayFrame) => void): () => void
  /** Página do overlay: tamanho medido da lista, para a janela ficar só em volta dela. */
  reportBox(size: { width: number; height: number }): void
  /** Página do overlay: novos estados. Retorna unsubscribe. */
  onUpdate(cb: (snapshot: OverlaySnapshot) => void): () => void
  /** Página do overlay: modo de edição (Shift+Tab) ligado/desligado. Retorna unsubscribe. */
  onEditing(cb: (editing: boolean) => void): () => void
  /** Página do overlay: posição/tamanho novos, ao soltar o mouse. */
  saveLayout(layout: OverlayLayout): void
  /** Renderer principal: posição/tamanho editados no jogo, para salvar. Retorna unsubscribe. */
  onLayout(cb: (layout: OverlayLayout) => void): () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api?: {
      screenPicker: ScreenPickerApi
      background?: BackgroundApi
      updates?: UpdatesApi
      screenAudio?: ScreenAudioApi
      overlay?: OverlayApi
    }
  }
}
