import { describe, expect, it } from 'vitest'
import { knockAlert } from './knockAlert'

const joao = { display_name: 'João', username: 'joao' }
const prefsOn = { desktop: true, taskbar: true, sound: true }

const base = {
  muted: false,
  deafened: false,
  prefs: prefsOn,
  serverId: 's1',
  channelId: 'c1'
}

describe('knockAlert (pedido para entrar na sala trancada)', () => {
  it('ouvindo e com tudo ligado: toca o som e avisa no desktop', () => {
    const alert = knockAlert(joao, base)
    expect(alert.sound).toBe(true)
    expect(alert.payload?.title).toBe('João quer entrar na sala')
    expect(alert.payload?.route).toBe('/servers/s1/channels/c1')
  })

  it('ensurdecido: não toca o som, mas o aviso visual continua', () => {
    const alert = knockAlert(joao, { ...base, deafened: true })
    expect(alert.sound).toBe(false)
    expect(alert.payload).not.toBeNull()
  })

  it('mutado: não toca o som, mas o aviso visual continua (#360)', () => {
    const alert = knockAlert(joao, { ...base, muted: true })
    expect(alert.sound).toBe(false)
    expect(alert.payload).not.toBeNull()
  })

  it('som das notificações desligado: sem som, aviso visual segue', () => {
    const alert = knockAlert(joao, { ...base, prefs: { ...prefsOn, sound: false } })
    expect(alert.sound).toBe(false)
    expect(alert.payload).not.toBeNull()
  })

  it('aviso do desktop e da barra desligados: sem aviso nativo', () => {
    const alert = knockAlert(joao, {
      ...base,
      prefs: { desktop: false, taskbar: false, sound: true }
    })
    expect(alert.payload).toBeNull()
    expect(alert.sound).toBe(true)
  })

  it('só o toast desligado: a barra de tarefas ainda pisca', () => {
    const alert = knockAlert(joao, { ...base, prefs: { ...prefsOn, desktop: false } })
    expect(alert.payload).toMatchObject({ toast: false, taskbar: true })
  })
})
