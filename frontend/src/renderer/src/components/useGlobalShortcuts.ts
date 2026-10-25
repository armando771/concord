import { useEffect } from 'react'
import { matchPath } from 'react-router-dom'
import { router } from '../router'
import { useAuthStore } from '../store/authStore'
import { useCallStore } from '../store/callStore'
import { useChatStore } from '../store/chatStore'
import { useKeybindStore } from '../store/keybindStore'
import { useServerStore } from '../store/serverStore'
import { useServerSettingsStore } from '../store/serverSettingsStore'
import { useSettingsStore } from '../store/settingsStore'
import { useUIStore } from '../store/uiStore'
import { conversationRoute } from '../lib/conversations'
import { bindingFromKeyEvent, bindingFromMouseButton } from '../lib/keybinds'
import { effectiveBindings, globalBindingList } from '../lib/keybindPrefs'
import { nextTarget } from '../lib/navOrder'
import {
  SHORTCUT_BY_ID,
  actionForBinding,
  type ShortcutDef,
  type ShortcutId
} from '../lib/shortcuts'

const NAVIGATION_IDS = new Set<ShortcutId>([
  'prevChannel',
  'nextChannel',
  'prevUnreadChannel',
  'nextUnreadChannel',
  'prevServer',
  'nextServer',
  'prevUnreadServer',
  'nextUnreadServer'
])

// Rota e navegação direto do router: uma segunda tecla logo após a primeira já
// parte da rota nova (o estado do React ainda não renderizou).
const currentPath = (): string => router.state.location.pathname
const go = (to: string): void => void router.navigate(to)

/** Esta ação está com o main (atalho global registrado): a janela não a trata. */
function ownedByMain(id: ShortcutId): boolean {
  const { global, globalActive } = useKeybindStore.getState()
  return Boolean(global[id] && globalActive[id])
}

/** Vale agora? Gravando, nas configurações ou com a busca/lista por cima, não. */
function canRun(def: ShortcutDef, repeat: boolean): boolean {
  if (useKeybindStore.getState().recording) return false
  if (ownedByMain(def.id)) return false
  const ui = useUIStore.getState()
  const isOwnToggle = def.id === 'quickSwitcher' || def.id === 'shortcutsList'
  // Configurações são tela cheia; busca e lista de atalhos ficam por cima do app.
  if (useSettingsStore.getState().open || useServerSettingsStore.getState().open) return false
  if (NAVIGATION_IDS.has(def.id) && (ui.quickSwitcherOpen || ui.shortcutsModalOpen)) return false
  if (repeat && (isOwnToggle || !NAVIGATION_IDS.has(def.id))) return false
  return true
}

/**
 * Atalhos de teclado e de botão do mouse do app (estilo Discord). Os de voz
 * podem valer também com o app em segundo plano (o main registra e avisa).
 */
export function useGlobalShortcuts(): void {
  useEffect(() => {
    const goChannel = (dir: 1 | -1, onlyUnread: boolean): void => {
      const chat = useChatStore.getState()
      const path = currentPath()
      const inServer = matchPath({ path: '/servers/:id', end: false }, path)

      if (inServer) {
        const serverId = inServer.params.id
        const channelId = matchPath('/servers/:id/channels/:channelId', path)?.params.channelId
        const text = useServerStore
          .getState()
          .channels.filter((c) => c.server_id === serverId && (c.type ?? 'text') === 'text')
        const target = nextTarget(
          text.map((c) => c.id),
          channelId ?? null,
          dir,
          onlyUnread ? (id) => (chat.unreadByRoom[`channel:${id}`] ?? 0) > 0 : undefined
        )
        if (target) go(`/servers/${serverId}/channels/${target}`)
        return
      }

      // Fora de servidor: percorre as DMs na ordem da barra lateral.
      const meId = useAuthStore.getState().user?.id
      const routes = new Map(
        chat.conversations.map((c) => [conversationRoute(c, meId), c.id] as const)
      )
      const target = nextTarget(
        [...routes.keys()],
        path,
        dir,
        onlyUnread
          ? (route) => (chat.unreadByRoom[`conversation:${routes.get(route)}`] ?? 0) > 0
          : undefined
      )
      if (target) go(target)
    }

    const goServer = (dir: 1 | -1, onlyUnread: boolean): void => {
      const unreadByServer = useChatStore.getState().unreadByServer
      const current = matchPath({ path: '/servers/:id', end: false }, currentPath())
      const target = nextTarget(
        useServerStore.getState().servers.map((s) => s.id),
        current?.params.id ?? null,
        dir,
        onlyUnread ? (id) => (unreadByServer[id] ?? 0) > 0 : undefined
      )
      if (target) go(`/servers/${target}`)
    }

    const run = (id: ShortcutId): void => {
      const ui = useUIStore.getState()
      switch (id) {
        case 'quickSwitcher':
          ui.setQuickSwitcherOpen(!ui.quickSwitcherOpen)
          break
        case 'shortcutsList':
          ui.setShortcutsModalOpen(!ui.shortcutsModalOpen)
          break
        case 'openSettings':
          useSettingsStore.getState().openSettings()
          break
        case 'prevChannel':
          goChannel(-1, false)
          break
        case 'nextChannel':
          goChannel(1, false)
          break
        case 'prevUnreadChannel':
          goChannel(-1, true)
          break
        case 'nextUnreadChannel':
          goChannel(1, true)
          break
        case 'prevServer':
          goServer(-1, false)
          break
        case 'nextServer':
          goServer(1, false)
          break
        case 'prevUnreadServer':
          goServer(-1, true)
          break
        case 'nextUnreadServer':
          goServer(1, true)
          break
        case 'toggleMute':
          if (useCallStore.getState().status === 'active') useCallStore.getState().toggleMute()
          break
        case 'toggleDeafen':
          if (useCallStore.getState().status === 'active') useCallStore.getState().toggleDeafen()
          break
        case 'uploadFile':
          ui.requestFilePicker()
          break
      }
    }

    const findAction = (binding: string | null): ShortcutDef | null =>
      binding
        ? actionForBinding(binding, effectiveBindings(useKeybindStore.getState().overrides))
        : null

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) return
      const def = findAction(bindingFromKeyEvent(e))
      if (!def || !canRun(def, e.repeat)) return
      e.preventDefault()
      run(def.id)
    }

    // Botões laterais também navegam (voltar/avançar) por padrão: o atalho tem
    // que engolir mousedown, mouseup e auxclick do botão que acionou.
    const swallowed = new Set<number>()
    const onMouseDown = (e: MouseEvent): void => {
      const def = findAction(bindingFromMouseButton(e.button))
      if (!def || !canRun(def, false)) return
      swallowed.add(e.button)
      e.preventDefault()
      run(def.id)
    }
    const onMouseUp = (e: MouseEvent): void => {
      if (!swallowed.has(e.button)) return
      swallowed.delete(e.button)
      e.preventDefault()
    }
    const onAuxClick = (e: MouseEvent): void => {
      if (swallowed.has(e.button) || findAction(bindingFromMouseButton(e.button)))
        e.preventDefault()
    }

    // Atalhos globais (desktop): o main avisa quando um é acionado.
    const keybinds = window.api?.keybinds
    const offFire = keybinds?.onFire((id) => {
      if (id in SHORTCUT_BY_ID && SHORTCUT_BY_ID[id as ShortcutId].canBeGlobal) {
        run(id as ShortcutId)
      }
    })
    const offStatus = keybinds?.onStatus((status) =>
      useKeybindStore.getState().setGlobalActive(status as Partial<Record<ShortcutId, boolean>>)
    )

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mousedown', onMouseDown, true)
    window.addEventListener('mouseup', onMouseUp, true)
    window.addEventListener('auxclick', onAuxClick, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', onMouseDown, true)
      window.removeEventListener('mouseup', onMouseUp, true)
      window.removeEventListener('auxclick', onAuxClick, true)
      offFire?.()
      offStatus?.()
    }
  }, [])

  // Manda ao main os atalhos de voz que valem fora do app e guarda quais registraram.
  const overrides = useKeybindStore((s) => s.overrides)
  const global = useKeybindStore((s) => s.global)
  useEffect(() => {
    const keybinds = window.api?.keybinds
    if (!keybinds) return
    let alive = true
    void keybinds
      .setGlobal(globalBindingList(effectiveBindings(overrides), global))
      .then((result) => {
        if (alive)
          useKeybindStore.getState().setGlobalActive(result as Partial<Record<ShortcutId, boolean>>)
      })
    return () => {
      alive = false
    }
  }, [overrides, global])

  // Gravando um atalho nas configurações: o main solta os globais até terminar.
  const recording = useKeybindStore((s) => s.recording)
  useEffect(() => {
    const keybinds = window.api?.keybinds
    if (!keybinds || !recording) return
    keybinds.suspend(true)
    return () => keybinds.suspend(false)
  }, [recording])
}
