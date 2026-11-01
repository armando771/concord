import { ipcRenderer } from 'electron'
import type { OverlaySnapshot } from '../renderer/src/features/overlay/lib/overlayState'
import type { OverlayFrame, OverlayLayout } from '../renderer/src/features/overlay/lib/overlayLayout'

// window.api.overlay: overlay de jogo (main/overlay).
export const overlayApi = {
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
