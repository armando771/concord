// Um atalho é uma string: teclado ("Ctrl+Shift+M", "Alt+Up", "F9") ou botão do
// mouse ("Mouse3"). Tem a sintaxe de accelerator do Electron, então o mesmo
// valor serve para o atalho da janela e para o global (o main usa este arquivo).

export type Binding = string

export interface KeyEventLike {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

const NAMED_KEYS: Record<string, string> = {
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ' ': 'Space',
  Tab: 'Tab',
  Enter: 'Enter',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown'
}

/** Teclas que não digitam nada: valem com Shift sozinho. */
const NAV_KEYS = new Set([
  'Up',
  'Down',
  'Left',
  'Right',
  'Tab',
  'Insert',
  'Delete',
  'Home',
  'End',
  'PageUp',
  'PageDown'
])
const PUNCTUATION = new Set("-=[]\\;',./`".split(''))

function isFunctionKey(name: string): boolean {
  const m = /^F(\d{1,2})$/.exec(name)
  return Boolean(m) && Number(m![1]) >= 1 && Number(m![1]) <= 24
}

/** `KeyboardEvent.key` → nome da tecla no atalho, ou null se não pode ser atalho. */
function keyName(key: string): string | null {
  if (NAMED_KEYS[key]) return NAMED_KEYS[key]
  if (isFunctionKey(key)) return key
  if (key.length === 1) {
    if (/[a-z]/i.test(key)) return key.toUpperCase()
    if (/\d/.test(key) || PUNCTUATION.has(key)) return key
  }
  return null
}

/**
 * Um keydown → atalho. Sem Ctrl/Alt (Cmd conta como Ctrl) só F1–F24 valem sozinhas
 * e, com Shift apenas, só teclas que não digitam. Esc e modificadores soltos: null.
 */
export function bindingFromKeyEvent(e: KeyEventLike): Binding | null {
  const name = keyName(e.key)
  if (!name) return null
  const ctrl = e.ctrlKey || e.metaKey
  const allowed = isFunctionKey(name) || ctrl || e.altKey || (e.shiftKey && NAV_KEYS.has(name))
  if (!allowed) return null
  const parts: string[] = []
  if (ctrl) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  parts.push(name)
  return parts.join('+')
}

/** Valor salvo/recebido é um atalho que bindingFromKeyEvent/bindingFromMouseButton geraria? */
export function isValidBinding(binding: unknown): binding is Binding {
  if (typeof binding !== 'string') return false
  if (/^Mouse\d+$/.test(binding)) return mouseButtonOf(binding) !== null
  const parts = binding.split('+')
  const name = parts.pop() ?? ''
  const mods = ['Ctrl', 'Alt', 'Shift'].filter((m) => parts.includes(m))
  if (mods.length !== parts.length || mods.join('+') !== parts.join('+')) return false
  const known =
    isFunctionKey(name) ||
    NAV_KEYS.has(name) ||
    ['Space', 'Enter', 'Backspace'].includes(name) ||
    /^[A-Z0-9]$/.test(name) ||
    PUNCTUATION.has(name)
  if (!known) return false
  return (
    isFunctionKey(name) ||
    mods.includes('Ctrl') ||
    mods.includes('Alt') ||
    (mods.includes('Shift') && NAV_KEYS.has(name))
  )
}

const MOUSE_PREFIX = 'Mouse'

/**
 * `MouseEvent.button` → atalho. Esquerdo (0) e direito (2) ficam de fora: o app
 * não funcionaria. 1 = meio, 3 e 4 = botões laterais.
 */
export function bindingFromMouseButton(button: number): Binding | null {
  if (!Number.isInteger(button) || button < 1 || button === 2) return null
  return `${MOUSE_PREFIX}${button}`
}

export function isMouseBinding(binding: Binding): boolean {
  return mouseButtonOf(binding) !== null
}

/** Número do botão (`MouseEvent.button`) de um atalho de mouse, senão null. */
export function mouseButtonOf(binding: Binding): number | null {
  const m = /^Mouse(\d+)$/.exec(binding)
  if (!m) return null
  return bindingFromMouseButton(Number(m[1])) ? Number(m[1]) : null
}

/**
 * Botão do hook global (1 esquerdo, 2 direito, 3 meio, 4 e 5 laterais…) →
 * `MouseEvent.button`. Esquerdo e direito não viram atalho.
 */
export function mouseButtonFromHook(hookButton: number): number | null {
  if (!Number.isInteger(hookButton) || hookButton < 3) return null
  return hookButton === 3 ? 1 : hookButton - 1
}

const MOUSE_LABELS: Record<number, string> = {
  1: 'Botão do meio',
  3: 'Botão lateral 1',
  4: 'Botão lateral 2'
}

/** Partes para mostrar na tela, ex.: ['Ctrl', 'Shift', 'M'] ou ['Botão lateral 1']. */
export function bindingLabels(binding: Binding, isMac: boolean): string[] {
  const button = mouseButtonOf(binding)
  if (button !== null) return [MOUSE_LABELS[button] ?? `Botão ${button + 1}`]
  return binding.split('+').map((part) => {
    if (part === 'Up') return '↑'
    if (part === 'Down') return '↓'
    if (part === 'Left') return '←'
    if (part === 'Right') return '→'
    if (part === 'Ctrl') return isMac ? '⌘' : 'Ctrl'
    if (part === 'Alt') return isMac ? '⌥' : 'Alt'
    if (part === 'Shift') return isMac ? '⇧' : 'Shift'
    return part
  })
}

/** Atalho de teclado → accelerator do Electron (Ctrl vira Cmd no macOS). Mouse: null. */
export function toElectronAccelerator(binding: Binding): string | null {
  if (isMouseBinding(binding)) return null
  const parts = binding.split('+')
  const key = parts[parts.length - 1]
  if (!key) return null
  return parts.map((p) => (p === 'Ctrl' ? 'CommandOrControl' : p)).join('+')
}
