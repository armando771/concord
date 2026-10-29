import { createPushRegistration, type PushPlatform } from './pushRegistration'

function rig(over: Partial<PushPlatform> = {}) {
  let listener: ((t: string) => void) | null = null
  const platform: PushPlatform = {
    ensureChannel: jest.fn().mockResolvedValue(undefined),
    requestPermission: jest.fn().mockResolvedValue(true),
    getToken: jest.fn().mockResolvedValue('tok-1'),
    onTokenChange: jest.fn((cb) => {
      listener = cb
      return () => {
        listener = null
      }
    }),
    ...over
  }
  const api = { register: jest.fn().mockResolvedValue(undefined), unregister: jest.fn().mockResolvedValue(undefined) }
  return { platform, api, reg: createPushRegistration(platform, api), emit: (t: string) => listener?.(t), hasListener: () => listener !== null }
}

describe('createPushRegistration', () => {
  it('cria o canal, pede permissão e registra o token no servidor', async () => {
    const { reg, platform, api } = rig()
    await reg.start()
    expect(platform.ensureChannel).toHaveBeenCalled()
    expect(api.register).toHaveBeenCalledWith('tok-1')
  })

  it('sem permissão não registra nada', async () => {
    const { reg, api } = rig({ requestPermission: jest.fn().mockResolvedValue(false) })
    await reg.start()
    expect(api.register).not.toHaveBeenCalled()
  })

  it('sem Firebase configurado (token nulo) fica quieto', async () => {
    const { reg, api } = rig({ getToken: jest.fn().mockResolvedValue(null) })
    await expect(reg.start()).resolves.toBeUndefined()
    expect(api.register).not.toHaveBeenCalled()
  })

  it('getToken que lança (Firebase ausente) não derruba o app', async () => {
    const { reg, api } = rig({ getToken: jest.fn().mockRejectedValue(new Error('FirebaseApp')) })
    await expect(reg.start()).resolves.toBeUndefined()
    expect(api.register).not.toHaveBeenCalled()
  })

  it('falha do servidor não derruba o app', async () => {
    const { reg, api } = rig()
    api.register.mockRejectedValue(new Error('rede'))
    await expect(reg.start()).resolves.toBeUndefined()
  })

  it('token renovado pelo FCM é registrado de novo', async () => {
    const { reg, api, emit } = rig()
    await reg.start()
    emit('tok-2')
    expect(api.register).toHaveBeenLastCalledWith('tok-2')
  })

  it('forget remove o token do servidor e para de ouvir', async () => {
    const { reg, api, hasListener } = rig()
    await reg.start()
    await reg.forget()
    expect(api.unregister).toHaveBeenCalledWith('tok-1')
    expect(hasListener()).toBe(false)
  })

  it('forget sem token registrado não chama o servidor', async () => {
    const { reg, api } = rig()
    await reg.forget()
    expect(api.unregister).not.toHaveBeenCalled()
  })
})
