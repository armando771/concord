import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  activityPageScript,
  activityPermissionAllowed,
  activityWindowOptions,
  canNavigateActivity,
  createExternalOpenGate,
  createRoomTracker,
  dismissKrunkerClientNotice,
  isUserGestureInput,
  KRUNKER_CLIENT_NOTICE,
  opensExternally
} from './activityPolicy'

const NOTICE_TEXT =
  'We are discontinuing this version of the Krunker Client. If you want to update your client to the latest version. Please download and install the new client'

/** O pedaço do DOM do Krunker que o script usa (#genericPop e #popupBack). */
function fakeKrunkerPage(): {
  doc: Document
  pop: { style: { display: string }; textContent: string }
  click: ReturnType<typeof vi.fn>
  mutate: () => void
  MutationObserver: unknown
} {
  const pop = { style: { display: '' }, textContent: '' }
  const click = vi.fn(() => {
    // clearPops() do jogo: esconde e esvazia o popup.
    pop.style.display = 'none'
    pop.textContent = ''
  })
  const callbacks: (() => void)[] = []
  class FakeMutationObserver {
    constructor(callback: () => void) {
      callbacks.push(callback)
    }
    observe(): void {}
  }
  const elements: Record<string, unknown> = { genericPop: pop, popupBack: { click } }
  const doc = { getElementById: (id: string) => elements[id] ?? null } as unknown as Document
  return {
    doc,
    pop,
    click,
    mutate: () => callbacks.forEach((cb) => cb()),
    MutationObserver: FakeMutationObserver
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

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

  it('aviso de cliente descontinuado do Krunker é fechado como um clique fora', () => {
    const page = fakeKrunkerPage()
    vi.stubGlobal('MutationObserver', page.MutationObserver)
    dismissKrunkerClientNotice(page.doc, KRUNKER_CLIENT_NOTICE)
    expect(page.click).not.toHaveBeenCalled()
    // O jogo abre o aviso depois de carregar.
    page.pop.textContent = NOTICE_TEXT
    page.pop.style.display = 'block'
    page.mutate()
    expect(page.click).toHaveBeenCalledTimes(1)
    expect(page.pop.style.display).toBe('none')
    page.mutate()
    expect(page.click).toHaveBeenCalledTimes(1)
  })

  it('outros popups do Krunker continuam abertos', () => {
    const page = fakeKrunkerPage()
    vi.stubGlobal('MutationObserver', page.MutationObserver)
    page.pop.textContent = 'Claim your reward'
    page.pop.style.display = 'block'
    dismissKrunkerClientNotice(page.doc, KRUNKER_CLIENT_NOTICE)
    page.mutate()
    expect(page.click).not.toHaveBeenCalled()
    // Texto do aviso ainda no DOM mas escondido: nada a fechar.
    page.pop.textContent = NOTICE_TEXT
    page.pop.style.display = 'none'
    page.mutate()
    expect(page.click).not.toHaveBeenCalled()
  })

  it('página sem o popup (o Krunker mudou): o script não faz nada', () => {
    const doc = { getElementById: () => null } as unknown as Document
    expect(() => dismissKrunkerClientNotice(doc, KRUNKER_CLIENT_NOTICE)).not.toThrow()
  })

  it('script da página: só no site do Krunker, e roda sozinho como texto', () => {
    expect(activityPageScript('survev', 'https://survev.io/')).toBeNull()
    expect(activityPageScript('krunker', 'https://krunker.io.evil.com/')).toBeNull()
    expect(activityPageScript('krunker', 'about:blank')).toBeNull()
    const script = activityPageScript('krunker', 'https://krunker.io/?game=FRA:abc12')
    expect(script).not.toBeNull()
    // Como na página: só document e os globais do navegador.
    const page = fakeKrunkerPage()
    page.pop.textContent = NOTICE_TEXT
    page.pop.style.display = 'block'
    new Function('document', 'MutationObserver', script!)(page.doc, page.MutationObserver)
    expect(page.click).toHaveBeenCalledTimes(1)
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

  describe('createRoomTracker (sala lida da janela do jogo)', () => {
    it('avisa cada sala nova uma vez só', () => {
      const tracker = createRoomTracker('krunker')
      expect(tracker.visit('https://krunker.io/')).toBeNull()
      expect(tracker.visit('https://krunker.io/?game=BRZ:tukbo')).toBe(
        'https://krunker.io/?game=BRZ:tukbo'
      )
      expect(tracker.visit('https://krunker.io/?game=BRZ:tukbo')).toBeNull()
      expect(tracker.visit('https://krunker.io/?game=FRA:abc12')).toBe(
        'https://krunker.io/?game=FRA:abc12'
      )
    })

    it('sair da sala não apaga a última (quem entrar depois ainda cai nela)', () => {
      const tracker = createRoomTracker('krunker')
      const room = 'https://krunker.io/?game=BRZ:tukbo'
      expect(tracker.visit(room)).toBe(room)
      expect(tracker.visit('https://krunker.io/')).toBeNull()
      expect(tracker.visit(room)).toBeNull()
    })

    it('reset: a mesma sala volta a ser avisada (janela reaberta)', () => {
      const tracker = createRoomTracker('krunker')
      const room = 'https://krunker.io/?game=BRZ:tukbo'
      tracker.visit(room)
      tracker.reset()
      expect(tracker.visit(room)).toBe(room)
    })
  })
})
