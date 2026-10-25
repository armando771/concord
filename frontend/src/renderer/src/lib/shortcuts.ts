import type { Binding } from './keybinds'

export type ShortcutId =
  | 'quickSwitcher'
  | 'shortcutsList'
  | 'openSettings'
  | 'prevChannel'
  | 'nextChannel'
  | 'prevUnreadChannel'
  | 'nextUnreadChannel'
  | 'prevServer'
  | 'nextServer'
  | 'prevUnreadServer'
  | 'nextUnreadServer'
  | 'toggleMute'
  | 'toggleDeafen'
  | 'uploadFile'

export type ShortcutGroup = 'navigation' | 'voice' | 'chat'

export interface ShortcutDef {
  id: ShortcutId
  group: ShortcutGroup
  label: string
  /** Atalho de fábrica (Ctrl vira Cmd no macOS). */
  defaultBinding: Binding
  /** Pode valer com o app em segundo plano (só ações de voz). */
  canBeGlobal?: boolean
}

export const SHORTCUT_GROUP_LABELS: Record<ShortcutGroup, string> = {
  navigation: 'Navegação',
  voice: 'Voz',
  chat: 'Chat'
}

export const SHORTCUTS: ShortcutDef[] = [
  {
    id: 'quickSwitcher',
    group: 'navigation',
    label: 'Abrir a busca rápida',
    defaultBinding: 'Ctrl+K'
  },
  {
    id: 'shortcutsList',
    group: 'navigation',
    label: 'Mostrar os atalhos de teclado',
    defaultBinding: 'Ctrl+/'
  },
  {
    id: 'openSettings',
    group: 'navigation',
    label: 'Abrir as configurações do usuário',
    defaultBinding: 'Ctrl+,'
  },
  {
    id: 'prevChannel',
    group: 'navigation',
    label: 'Canal ou conversa anterior',
    defaultBinding: 'Alt+Up'
  },
  {
    id: 'nextChannel',
    group: 'navigation',
    label: 'Próximo canal ou conversa',
    defaultBinding: 'Alt+Down'
  },
  {
    id: 'prevUnreadChannel',
    group: 'navigation',
    label: 'Canal ou conversa anterior com não lidas',
    defaultBinding: 'Alt+Shift+Up'
  },
  {
    id: 'nextUnreadChannel',
    group: 'navigation',
    label: 'Próximo canal ou conversa com não lidas',
    defaultBinding: 'Alt+Shift+Down'
  },
  {
    id: 'prevServer',
    group: 'navigation',
    label: 'Servidor anterior',
    defaultBinding: 'Ctrl+Alt+Up'
  },
  {
    id: 'nextServer',
    group: 'navigation',
    label: 'Próximo servidor',
    defaultBinding: 'Ctrl+Alt+Down'
  },
  {
    id: 'prevUnreadServer',
    group: 'navigation',
    label: 'Servidor anterior com não lidas',
    defaultBinding: 'Ctrl+Alt+Shift+Up'
  },
  {
    id: 'nextUnreadServer',
    group: 'navigation',
    label: 'Próximo servidor com não lidas',
    defaultBinding: 'Ctrl+Alt+Shift+Down'
  },
  {
    id: 'toggleMute',
    group: 'voice',
    label: 'Ativar ou desativar o microfone',
    defaultBinding: 'Ctrl+Shift+M',
    canBeGlobal: true
  },
  {
    id: 'toggleDeafen',
    group: 'voice',
    label: 'Ensurdecer ou desensurdecer',
    defaultBinding: 'Ctrl+Shift+D',
    canBeGlobal: true
  },
  { id: 'uploadFile', group: 'chat', label: 'Enviar um arquivo', defaultBinding: 'Ctrl+Shift+U' }
]

export const SHORTCUT_BY_ID = Object.fromEntries(SHORTCUTS.map((s) => [s.id, s])) as Record<
  ShortcutId,
  ShortcutDef
>

/** Atalho de cada ação (null = sem atalho). */
export type BindingMap = Record<ShortcutId, Binding | null>

export function defaultBindings(): BindingMap {
  return Object.fromEntries(SHORTCUTS.map((s) => [s.id, s.defaultBinding])) as BindingMap
}

/** Ação que usa este atalho, ou null. */
export function actionForBinding(binding: Binding, bindings: BindingMap): ShortcutDef | null {
  return SHORTCUTS.find((s) => bindings[s.id] === binding) ?? null
}

/** Outra ação que já usa este atalho (para avisar antes de trocar). */
export function findConflict(
  id: ShortcutId,
  binding: Binding,
  bindings: BindingMap
): ShortcutDef | null {
  return SHORTCUTS.find((s) => s.id !== id && bindings[s.id] === binding) ?? null
}

export function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
}
