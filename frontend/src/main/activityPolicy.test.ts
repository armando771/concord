import { describe, expect, it } from 'vitest'
import {
  activityPermissionAllowed,
  activityUserAgent,
  activityWindowOptions,
  canNavigateActivity,
  createExternalOpenGate,
  isUserGestureInput,
  opensExternally
} from './activityPolicy'

describe('activityPolicy', () => {
  it('janela do Krunker: moldura normal, sessão própria, sem node nem preload', () => {
    const options = activityWindowOptions('krunker')
    expect(options).toMatchObject({
      title: 'Krunker.io — Salinha',
      resizable: true,
      frame: true,
      webPreferences: {
        partition: 'persist:activity-krunker',
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    expect(options?.webPreferences).not.toHaveProperty('preload')
    expect(activityWindowOptions('doom')).toBeNull()
  })

  it('libera pointer lock e tela cheia só para o site do jogo', () => {
    expect(activityPermissionAllowed('krunker', 'pointerLock', 'https://krunker.io')).toBe(true)
    expect(activityPermissionAllowed('krunker', 'fullscreen', 'https://krunker.io/')).toBe(true)
    expect(activityPermissionAllowed('krunker', 'pointerLock', 'https://ads.example.com')).toBe(
      false
    )
    expect(activityPermissionAllowed('krunker', 'media', 'https://krunker.io')).toBe(false)
    expect(activityPermissionAllowed('krunker', 'notifications', 'https://krunker.io')).toBe(false)
    expect(activityPermissionAllowed('krunker', 'geolocation', 'https://krunker.io')).toBe(false)
    expect(activityPermissionAllowed('krunker', 'pointerLock', '')).toBe(false)
    expect(activityPermissionAllowed('doom', 'pointerLock', 'https://krunker.io')).toBe(false)
  })

  it('navegação da janela fica no site do jogo', () => {
    expect(canNavigateActivity('krunker', 'https://krunker.io/?game=FRA:abc12')).toBe(true)
    expect(canNavigateActivity('krunker', 'https://krunker.io/social.html')).toBe(true)
    expect(canNavigateActivity('krunker', 'https://evil.com/')).toBe(false)
    expect(canNavigateActivity('krunker', 'file:///etc/passwd')).toBe(false)
  })

  it('links de nova janela vão para o navegador só se forem http(s)', () => {
    expect(opensExternally('https://discord.gg/krunker')).toBe(true)
    expect(opensExternally('http://example.com')).toBe(true)
    expect(opensExternally('file:///C:/Windows/system32/calc.exe')).toBe(false)
    expect(opensExternally('ms-settings:privacy')).toBe(false)
    expect(opensExternally('não é url')).toBe(false)
  })

  it('user agent sem Electron nem o nome do app', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) salinha/0.6.0 Chrome/140.0.0.0 Electron/44.9.3 Safari/537.36'
    expect(activityUserAgent(ua)).toBe(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
    )
  })

  it('navegação same-origin com URL longa continua na janela (limite de 512 é só do link da sala)', () => {
    const long = 'https://krunker.io/social.html?p=' + 'a'.repeat(2000)
    expect(canNavigateActivity('krunker', long)).toBe(true)
    expect(activityPermissionAllowed('krunker', 'pointerLock', long)).toBe(true)
    expect(
      canNavigateActivity('krunker', 'https://krunker.io.evil.com/?x=' + 'a'.repeat(600))
    ).toBe(false)
    expect(canNavigateActivity('krunker', 'https://krunker.io:8443/')).toBe(false)
    expect(canNavigateActivity('krunker', 'não é url')).toBe(false)
  })

  it('só clique e tecla contam como gesto', () => {
    expect(isUserGestureInput('mouseDown')).toBe(true)
    expect(isUserGestureInput('keyDown')).toBe(true)
    expect(isUserGestureInput('mouseMove')).toBe(false)
    expect(isUserGestureInput('keyUp')).toBe(false)
    expect(isUserGestureInput('mouseWheel')).toBe(false)
  })

  describe('createExternalOpenGate', () => {
    it('sem gesto recente, nada abre no navegador', () => {
      const gate = createExternalOpenGate()
      expect(gate.allow(10_000)).toBe(false)
      gate.recordInput(10_000)
      expect(gate.allow(11_001)).toBe(false)
    })

    it('com gesto há menos de 1 s, abre', () => {
      const gate = createExternalOpenGate()
      gate.recordInput(10_000)
      expect(gate.allow(10_900)).toBe(true)
    })

    it('no máximo 1 a cada 3 s, mesmo com gestos', () => {
      const gate = createExternalOpenGate()
      gate.recordInput(10_000)
      expect(gate.allow(10_100)).toBe(true)
      gate.recordInput(10_200)
      expect(gate.allow(10_300)).toBe(false)
      gate.recordInput(12_900)
      expect(gate.allow(13_000)).toBe(false)
      gate.recordInput(13_100)
      expect(gate.allow(13_200)).toBe(true)
    })

    it('um gesto vale para uma abertura só', () => {
      const gate = createExternalOpenGate()
      gate.recordInput(10_000)
      expect(gate.allow(10_100)).toBe(true)
      expect(gate.allow(13_200)).toBe(false)
    })
  })
})
