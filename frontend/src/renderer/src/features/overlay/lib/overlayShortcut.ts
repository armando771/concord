// Atalho global para o modo de edição do overlay (mover/redimensionar no
// jogo). Na sintaxe de accelerator do Electron, com regras a mais: precisa de
// modificador, Esc é reservado (sai da edição) e Shift sozinho só com teclas que
// não são de digitar. Auto-contido: o main também usa.

export const OVERLAY_SHORTCUT_DEFAULT = 'Shift+Tab'

export type ParsedShortcut = { ok: true; accelerator: string } | { ok: false; message: string }

const MODIFIERS: Record<string, string> = {
  ctrl: 'Ctrl',
  control: 'Ctrl',
  cmdorctrl: 'Ctrl',
  commandorcontrol: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  super: 'Super',
  meta: 'Super',
  cmd: 'Super',
  command: 'Super'
}
const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Super']

/** Teclas que não digitam nada: com Shift sozinho, não atrapalham escrever. */
const NAV_KEYS = [
  'Tab',
  'Insert',
  'Delete',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Up',
  'Down',
  'Left',
  'Right'
]
const PUNCTUATION = ['-', '=', '[', ']', '\\', ';', "'", ',', '.', '/', '`']
const NUMPAD = ['numadd', 'numsub', 'nummult', 'numdiv', 'numdec']

/** Nome em minúsculas → nome no accelerator do Electron. */
const KEYS: Record<string, string> = {}
const addKey = (name: string, ...aliases: string[]): void => {
  for (const alias of [name, ...aliases]) KEYS[alias.toLowerCase()] = name
}
for (let c = 65; c <= 90; c++) addKey(String.fromCharCode(c))
for (let d = 0; d <= 9; d++) {
  addKey(String(d))
  addKey(`num${d}`)
}
for (let f = 1; f <= 24; f++) addKey(`F${f}`)
for (const name of [...NAV_KEYS, ...PUNCTUATION, ...NUMPAD, 'Space', 'Backspace', 'Plus'])
  addKey(name)
addKey('Enter', 'Return')

const MSG_MODIFIER = 'Use pelo menos um modificador (Ctrl, Alt ou Shift) junto com a tecla.'
const MSG_ESC = 'Esc é reservado para sair do modo de edição.'
const MSG_SHIFT_TYPING = 'Shift com letra, número ou símbolo atrapalha digitar. Use Ctrl ou Alt.'
const MSG_KEY = 'Essa tecla não pode ser usada em atalho.'

/** Accelerator (do usuário ou salvo) → canônico, ou o motivo de não valer. */
export function parseAccelerator(raw: string): ParsedShortcut {
  if (typeof raw !== 'string' || !raw.trim()) return { ok: false, message: MSG_KEY }
  const parts = raw.split('+').map((p) => p.trim())
  if (parts.some((p) => !p)) return { ok: false, message: MSG_KEY }
  const mods = new Set<string>()
  const keys: string[] = []
  for (const part of parts) {
    const lower = part.toLowerCase()
    if (MODIFIERS[lower]) mods.add(MODIFIERS[lower])
    else if (lower === 'esc' || lower === 'escape') return { ok: false, message: MSG_ESC }
    else if (KEYS[lower]) keys.push(KEYS[lower])
    else return { ok: false, message: MSG_KEY }
  }
  if (keys.length !== 1) return { ok: false, message: keys.length ? MSG_KEY : MSG_MODIFIER }
  if (mods.size === 0) return { ok: false, message: MSG_MODIFIER }
  const key = keys[0]
  const shiftOnly = mods.size === 1 && mods.has('Shift')
  if (shiftOnly && !NAV_KEYS.includes(key) && !/^F\d+$/.test(key)) {
    return { ok: false, message: MSG_SHIFT_TYPING }
  }
  const ordered = MODIFIER_ORDER.filter((m) => mods.has(m))
  return { ok: true, accelerator: [...ordered, key].join('+') }
}

/** Valor salvo/recebido → atalho válido (o que não valer volta ao padrão). */
export function normalizeOverlayShortcut(raw: unknown): string {
  const parsed = parseAccelerator(raw as string)
  return parsed.ok ? parsed.accelerator : OVERLAY_SHORTCUT_DEFAULT
}

/** O que a gravação de atalho precisa de um keydown. */
export interface ShortcutKey {
  code: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

export type CapturedShortcut =
  | { kind: 'ok'; accelerator: string }
  | { kind: 'cancel' }
  | { kind: 'pending' }
  | { kind: 'invalid'; message: string }

const MODIFIER_CODE = /^(Shift|Control|Alt|Meta|OS)(Left|Right)?$/

/** KeyboardEvent.code → nome da tecla no accelerator (pela posição, como o Windows). */
function keyFromCode(code: string): string | null {
  let m: RegExpExecArray | null
  if ((m = /^Key([A-Z])$/.exec(code))) return m[1]
  if ((m = /^Digit(\d)$/.exec(code))) return m[1]
  if ((m = /^Numpad(\d)$/.exec(code))) return `num${m[1]}`
  if (/^F\d{1,2}$/.test(code)) return code
  const named: Record<string, string> = {
    Tab: 'Tab',
    Space: 'Space',
    Enter: 'Enter',
    NumpadEnter: 'Enter',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backquote: '`',
    NumpadAdd: 'numadd',
    NumpadSubtract: 'numsub',
    NumpadMultiply: 'nummult',
    NumpadDivide: 'numdiv',
    NumpadDecimal: 'numdec'
  }
  return named[code] ?? null
}

/** Um keydown durante a gravação → atalho, cancelar (Esc), esperar ou inválido. */
export function acceleratorFromKey(e: ShortcutKey): CapturedShortcut {
  const hasMods = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey
  if (e.code === 'Escape')
    return hasMods ? { kind: 'invalid', message: MSG_ESC } : { kind: 'cancel' }
  if (MODIFIER_CODE.test(e.code)) return { kind: 'pending' }
  const key = keyFromCode(e.code)
  if (!key) return { kind: 'invalid', message: MSG_KEY }
  const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super']
  const parsed = parseAccelerator([...mods.filter(Boolean), key].join('+'))
  return parsed.ok
    ? { kind: 'ok', accelerator: parsed.accelerator }
    : { kind: 'invalid', message: parsed.message }
}
