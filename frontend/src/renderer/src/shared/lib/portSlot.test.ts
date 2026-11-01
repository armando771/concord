import { describe, expect, it } from 'vitest'
import { PortSlot } from './portSlot'

const newPort = (): MessagePort => new MessageChannel().port1

describe('PortSlot', () => {
  it('entrega a porta que já chegou', async () => {
    const slot = new PortSlot()
    const port = newPort()
    slot.offer(port)
    expect(await slot.take(0)).toBe(port)
  })

  it('espera a porta que chega um pouco depois (canais de IPC sem ordem garantida)', async () => {
    const slot = new PortSlot()
    const port = newPort()
    setTimeout(() => slot.offer(port), 20)
    expect(await slot.take(500)).toBe(port)
  })

  it('sem porta dentro do prazo, devolve null', async () => {
    expect(await new PortSlot().take(30)).toBeNull()
  })

  it('porta velha descartada não vaza para o próximo compartilhamento', async () => {
    const slot = new PortSlot()
    slot.offer(newPort())
    slot.discard()
    expect(await slot.take(0)).toBeNull()
  })

  it('cada porta é entregue uma vez só', async () => {
    const slot = new PortSlot()
    slot.offer(newPort())
    await slot.take(0)
    expect(await slot.take(0)).toBeNull()
  })
})
