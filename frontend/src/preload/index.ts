import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

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
    /** Para a captura do som da janela (fim do compartilhamento). */
    stop(): void {
      ipcRenderer.send('screen-audio:stop')
    }
  },
  updates: {
    /** Versão pronta para instalar (já baixada e com assinatura válida). */
    status(): Promise<string | null> {
      return ipcRenderer.invoke('update:status')
    },
    onReady(cb: (version: string) => void): () => void {
      const listener = (_e: unknown, version: string): void => cb(version)
      ipcRenderer.on('update:ready', listener)
      return () => ipcRenderer.removeListener('update:ready', listener)
    },
    install(): void {
      ipcRenderer.send('update:install')
    }
  },
  background: {
    /** Estado da chamada para o menu da bandeja. */
    setCallState(state: { inCall: boolean; muted: boolean }): void {
      ipcRenderer.send('call:state', state)
    },
    /** Notificação nativa (só aparece se a janela não estiver à vista). */
    notify(payload: { title: string; body: string; route: string; urgent?: boolean }): void {
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
