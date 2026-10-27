import { describe, expect, it } from 'vitest'
import {
  overlayEditHint,
  acceleratorFromKey,
  normalizeOverlayShortcut,
  OVERLAY_SHORTCUT_DEFAULT,
  parseAccelerator,
  type ShortcutKey
} from './overlayShortcut'

const key = (code: string, mods: Partial<ShortcutKey> = {}): ShortcutKey => ({
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...mods
})

describe('parseAccelerator', () => {
  it('padrão é Shift+Tab', () => {
    expect(OVERLAY_SHORTCUT_DEFAULT).toBe('Shift+Tab')
    expect(parseAccelerator('Shift+Tab')).toEqual({ ok: true, accelerator: 'Shift+Tab' })
  })

  it('aceita a sintaxe do Electron e deixa canônico (ordem e nomes)', () => {
    expect(parseAccelerator('shift+ctrl+o')).toEqual({ ok: true, accelerator: 'Ctrl+Shift+O' })
    expect(parseAccelerator('Control+Alt+F12')).toEqual({ ok: true, accelerator: 'Ctrl+Alt+F12' })
    expect(parseAccelerator('CmdOrCtrl+Shift+Up')).toEqual({
      ok: true,
      accelerator: 'Ctrl+Shift+Up'
    })
    expect(parseAccelerator('Alt+num5')).toEqual({ ok: true, accelerator: 'Alt+num5' })
    expect(parseAccelerator('Super+Alt+Return')).toEqual({
      ok: true,
      accelerator: 'Alt+Super+Enter'
    })
  })

  it('tecla sozinha (sem modificador) não vale', () => {
    for (const raw of ['Tab', 'O', 'F12', 'Space'])
      expect(parseAccelerator(raw)).toMatchObject({ ok: false })
  })

  it('Esc não vale (é a saída do modo de edição)', () => {
    expect(parseAccelerator('Escape')).toMatchObject({ ok: false })
    expect(parseAccelerator('Esc')).toMatchObject({ ok: false })
    expect(parseAccelerator('Shift+Escape')).toMatchObject({ ok: false })
  })

  it('Shift + tecla de digitar não vale (atrapalha escrever); com Ctrl/Alt vale', () => {
    for (const raw of ['Shift+A', 'Shift+1', 'Shift+Space', 'Shift+/', 'Shift+Enter'])
      expect(parseAccelerator(raw)).toMatchObject({ ok: false })
    expect(parseAccelerator('Shift+F5')).toMatchObject({ ok: true })
    expect(parseAccelerator('Shift+Home')).toMatchObject({ ok: true })
    expect(parseAccelerator('Ctrl+Shift+A')).toMatchObject({ ok: true })
  })

  it('só modificadores, tecla desconhecida, vazio ou lixo não vale', () => {
    for (const raw of ['Shift', 'Ctrl+Alt', 'Ctrl+Ç', 'Ctrl+', '', '+', 'Ctrl+Ctrl+A+B', 'AltGr+A'])
      expect(parseAccelerator(raw)).toMatchObject({ ok: false })
    expect(parseAccelerator(42 as unknown as string)).toMatchObject({ ok: false })
  })

  it('erro vem com uma mensagem para mostrar', () => {
    const result = parseAccelerator('O')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/modificador/)
  })
})

describe('normalizeOverlayShortcut', () => {
  it('válido fica (canônico); inválido ou ausente volta ao padrão', () => {
    expect(normalizeOverlayShortcut('ctrl+shift+o')).toBe('Ctrl+Shift+O')
    expect(normalizeOverlayShortcut('Tab')).toBe(OVERLAY_SHORTCUT_DEFAULT)
    expect(normalizeOverlayShortcut(undefined)).toBe(OVERLAY_SHORTCUT_DEFAULT)
    expect(normalizeOverlayShortcut(null)).toBe(OVERLAY_SHORTCUT_DEFAULT)
  })
})

describe('acceleratorFromKey', () => {
  it('combinação válida vira atalho do Electron', () => {
    expect(acceleratorFromKey(key('Tab', { shiftKey: true }))).toEqual({
      kind: 'ok',
      accelerator: 'Shift+Tab'
    })
    expect(acceleratorFromKey(key('KeyO', { ctrlKey: true, shiftKey: true }))).toEqual({
      kind: 'ok',
      accelerator: 'Ctrl+Shift+O'
    })
    expect(acceleratorFromKey(key('F12', { altKey: true }))).toEqual({
      kind: 'ok',
      accelerator: 'Alt+F12'
    })
    expect(acceleratorFromKey(key('ArrowUp', { ctrlKey: true }))).toEqual({
      kind: 'ok',
      accelerator: 'Ctrl+Up'
    })
    expect(acceleratorFromKey(key('Digit3', { ctrlKey: true }))).toEqual({
      kind: 'ok',
      accelerator: 'Ctrl+3'
    })
    expect(acceleratorFromKey(key('Numpad7', { altKey: true }))).toEqual({
      kind: 'ok',
      accelerator: 'Alt+num7'
    })
  })

  it('Esc sozinho cancela a gravação', () => {
    expect(acceleratorFromKey(key('Escape'))).toEqual({ kind: 'cancel' })
  })

  it('só modificador apertado: ainda esperando a tecla', () => {
    expect(acceleratorFromKey(key('ShiftLeft', { shiftKey: true }))).toEqual({ kind: 'pending' })
    expect(acceleratorFromKey(key('ControlRight', { ctrlKey: true }))).toEqual({
      kind: 'pending'
    })
    expect(acceleratorFromKey(key('AltLeft', { altKey: true }))).toEqual({ kind: 'pending' })
    expect(acceleratorFromKey(key('MetaLeft', { metaKey: true }))).toEqual({ kind: 'pending' })
  })

  it('tecla sem modificador, Esc com modificador ou tecla estranha: inválido, com mensagem', () => {
    expect(acceleratorFromKey(key('KeyO'))).toMatchObject({ kind: 'invalid' })
    expect(acceleratorFromKey(key('Escape', { shiftKey: true }))).toMatchObject({
      kind: 'invalid'
    })
    expect(acceleratorFromKey(key('IntlBackslash', { ctrlKey: true }))).toMatchObject({
      kind: 'invalid'
    })
    expect(acceleratorFromKey(key('KeyA', { shiftKey: true }))).toMatchObject({ kind: 'invalid' })
  })
})

describe('overlayEditHint', () => {
  it('diz como mover, redimensionar e sair com o atalho configurado', () => {
    expect(overlayEditHint('Ctrl+Shift+O')).toBe(
      'Arraste para mover · canto para redimensionar · Ctrl+Shift+O ou Esc para sair'
    )
  })
})
