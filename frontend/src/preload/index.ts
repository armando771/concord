import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { OverlaySnapshot } from '../renderer/src/lib/overlayState'
import type { OverlayFrame, OverlayLayout } from '../renderer/src/lib/overlayLayout'
import type { CallResume, PendingCallResume } from '../shared/callResume'

interface ScreenSourceInfo {
  id: string
  name: string
  thumbnail: string
  appIcon: string | null
  displayId: string
}

// Custom APIs for renderer
const api = {
  screenPicker: {
    /** Main avisa que um pedido de getDisplayMedia está aguardando seleção. */
    onShow(cb: () => void): () => void {
      const listener = (): void => cb()
      ipcRenderer.on('screen-picker:show', listener)
      return () => ipcRenderer.removeListener('screen-picker:show', listener)
    },
    listSources(): Promise<ScreenSourceInfo[]> {
      return ipcRenderer.invoke('screen-picker:sources')
    },
    select(sourceId: string): void {
      ipcRenderer.send('screen-picker:select', sourceId)
    },
    cancel(): void {
      ipcRenderer.send('screen-picker:cancel')
    }
  },
  screenAudio: {
    /** Não deu para capturar só a janela: o som vai ser o do sistema. */
    onFallback(cb: (logPath: string) => void): () => void {
      const listener = (_e: unknown, logPath: string): void => cb(logPath)
      ipcRenderer.on('screen-audio:fallback', listener)
      return () => ipcRenderer.removeListener('screen-audio:fallback', listener)
    },
    /** Para a captura do som da janela (fim do compartilhamento). */
    stop(): void {
      ipcRenderer.send('screen-audio:stop')
    }
  },
  updates: {
    setCallSnapshot(snapshot: CallResume | null): void {
      ipcRenderer.send('update:call-snapshot', snapshot)
    },
    takeCallResume(): Promise<PendingCallResume | null> {
      return ipcRenderer.invoke('update:take-call-resume')
    },
    /** Versão nova conhecida (e se já está pronta para instalar), ou null. */
    status(): Promise<{ version: string; ready: boolean } | null> {
      return ipcRenderer.invoke('update:status')
    },
    /** Existe versão nova (pode ainda estar baixando). */
    onAvailable(cb: (version: string) => void): () => void {
      const listener = (_e: unknown, version: string): void => cb(version)
      ipcRenderer.on('update:available', listener)
      return () => ipcRenderer.removeListener('update:available', listener)
    },
    onReady(cb: (version: string) => void): () => void {
      const listener = (_e: unknown, version: string): void => cb(version)
      ipcRenderer.on('update:ready', listener)
      return () => ipcRenderer.removeListener('update:ready', listener)
    },
    onProgress(cb: (percent: number) => void): () => void {
      const listener = (_e: unknown, percent: number): void => cb(percent)
      ipcRenderer.on('update:progress', listener)
      return () => ipcRenderer.removeListener('update:progress', listener)
    },
    onError(cb: (message: string) => void): () => void {
      const listener = (_e: unknown, message: string): void => cb(message)
      ipcRenderer.on('update:error', listener)
      return () => ipcRenderer.removeListener('update:error', listener)
    },
    /** Instala (baixando antes, se precisar) e reinicia o app. */
    install(): void {
      ipcRenderer.send('update:install')
    }
  },
  background: {
    /** Estado da chamada para o menu da bandeja. */
    setCallState(state: { inCall: boolean; muted: boolean }): void {
      ipcRenderer.send('call:state', state)
    },
    /**
     * Notificação nativa e aviso na barra de tarefas (só se a janela não
     * estiver à vista). `toast`/`taskbar` = preferências do usuário.
     */
    notify(payload: {
      title: string
      body: string
      route: string
      urgent?: boolean
      toast?: boolean
      taskbar?: boolean
    }): void {
      ipcRenderer.send('notify', payload)
    },
    quit(): void {
      ipcRenderer.send('app:quit')
    },
    getAutostart(): Promise<boolean | null> {
      return ipcRenderer.invoke('settings:autostart')
    },
    setAutostart(enabled: boolean): Promise<boolean | null> {
      return ipcRenderer.invoke('settings:set-autostart', enabled)
    },
    onToggleMute(cb: () => void): () => void {
      const listener = (): void => cb()
      ipcRenderer.on('tray:toggle-mute', listener)
      return () => ipcRenderer.removeListener('tray:toggle-mute', listener)
    },
    onQuitRequested(cb: () => void): () => void {
      const listener = (): void => cb()
      ipcRenderer.on('app:quit-requested', listener)
      return () => ipcRenderer.removeListener('app:quit-requested', listener)
    },
    onNavigate(cb: (route: string) => void): () => void {
      const listener = (_e: unknown, route: string): void => cb(route)
      ipcRenderer.on('navigate', listener)
      return () => ipcRenderer.removeListener('navigate', listener)
    }
  },
  overlay: {
    /** Overlay de jogo existe nesta plataforma (só Windows). */
    supported: process.platform === 'win32',
    /** Renderer principal → main: estado atual da call para o overlay. */
    setState(snapshot: OverlaySnapshot): void {
      ipcRenderer.send('overlay:state', snapshot)
    },
    /**
     * Página do overlay: avisa que carregou (chamar depois de assinar onUpdate e
     * onEditing) e recebe o último estado e se está no modo de edição.
     */
    ready(): Promise<{
      snapshot: OverlaySnapshot | null
      editing: boolean
      frame: OverlayFrame | null
    }> {
      return ipcRenderer.invoke('overlay:ready')
    },
    /** Página do overlay: onde a janela está na área de trabalho (muda ao mover/editar). */
    onFrame(cb: (frame: OverlayFrame) => void): () => void {
      const listener = (_e: unknown, frame: OverlayFrame): void => cb(frame)
      ipcRenderer.on('overlay:frame', listener)
      return () => ipcRenderer.removeListener('overlay:frame', listener)
    },
    /** Página do overlay: tamanho medido da lista, para a janela ficar só em volta dela. */
    reportBox(size: { width: number; height: number }): void {
      ipcRenderer.send('overlay:box', size)
    },
    /** Página do overlay: novos estados. */
    onUpdate(cb: (snapshot: OverlaySnapshot) => void): () => void {
      const listener = (_e: unknown, snapshot: OverlaySnapshot): void => cb(snapshot)
      ipcRenderer.on('overlay:update', listener)
      return () => ipcRenderer.removeListener('overlay:update', listener)
    },
    /** Página do overlay: modo de edição (Shift+Tab) ligado/desligado. */
    onEditing(cb: (editing: boolean) => void): () => void {
      const listener = (_e: unknown, editing: boolean): void => cb(editing)
      ipcRenderer.on('overlay:editing', listener)
      return () => ipcRenderer.removeListener('overlay:editing', listener)
    },
    /** Página do overlay: posição/tamanho novos, ao soltar o mouse. */
    saveLayout(layout: OverlayLayout): void {
      ipcRenderer.send('overlay:layout', layout)
    },
    /** Configurações: o atalho está livre? null = atalho inválido. */
    checkShortcut(accelerator: string): Promise<{ accelerator: string; taken: boolean } | null> {
      return ipcRenderer.invoke('overlay:check-shortcut', accelerator)
    },
    /** Configurações: resultado de segurar o atalho no jogo (outro programa pode ter). */
    onShortcutStatus(cb: (status: { accelerator: string; taken: boolean }) => void): () => void {
      const listener = (_e: unknown, status: { accelerator: string; taken: boolean }): void =>
        cb(status)
      ipcRenderer.on('overlay:shortcut-status', listener)
      return () => ipcRenderer.removeListener('overlay:shortcut-status', listener)
    },
    /** Renderer principal: posição/tamanho editados no jogo, para salvar. */
    onLayout(cb: (layout: OverlayLayout) => void): () => void {
      const listener = (_e: unknown, layout: OverlayLayout): void => cb(layout)
      ipcRenderer.on('overlay:layout', listener)
      return () => ipcRenderer.removeListener('overlay:layout', listener)
    }
  }
}

// Som da janela compartilhada: o MessagePort não passa pelo contextBridge,
// então vai ao mundo da página por window.postMessage (padrão do Electron).
ipcRenderer.on('screen-audio:port', (event) => {
  window.postMessage('concord:screen-audio-port', '*', event.ports)
})

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
