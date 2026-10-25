import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type AppNotification,
  callNotification,
  DEFAULT_NOTIFICATION_PREFS,
  desktopPayload,
  mentionNotification,
  messageNotification,
  notificationSound,
  notifyDesktop,
  setWebNotifier
} from './notifications'
import type { Message } from '../api/messages'

const dm = (over: Partial<Message> = {}): Message => ({
  id: 'm1',
  author_id: 'ana',
  author: { id: 'ana', username: 'ana', display_name: 'Ana' } as Message['author'],
  conversation_id: 'c1',
  content: 'bora jogar?',
  created_at: '',
  ...over
})

describe('messageNotification', () => {
  it('DM de outra pessoa vira notificação que abre a conversa', () => {
    expect(messageNotification(dm(), 'eu')).toEqual({
      kind: 'message',
      title: 'Ana',
      body: 'bora jogar?',
      route: '/dm/ana'
    })
  })

  it('não notifica as próprias mensagens', () => {
    expect(messageNotification(dm({ author_id: 'eu' }), 'eu')).toBeNull()
  })

  it('não notifica mensagens de canal de servidor', () => {
    expect(messageNotification(dm({ conversation_id: null, channel_id: 'ch1' }), 'eu')).toBeNull()
  })

  it('encurta mensagens longas', () => {
    const body = messageNotification(dm({ content: 'a'.repeat(300) }), 'eu')?.body ?? ''
    expect(body.length).toBeLessThanOrEqual(140)
    expect(body.endsWith('…')).toBe(true)
  })
})

describe('callNotification', () => {
  it('chamada recebida abre a DM de quem ligou', () => {
    expect(callNotification({ id: 'ana', display_name: 'Ana', username: 'ana' })).toEqual({
      kind: 'call',
      title: 'Ana está te ligando',
      body: 'Chamada de voz — clique para atender',
      route: '/dm/ana',
      urgent: true
    })
  })
})

describe('mentionNotification', () => {
  const me = { id: 'eu', username: 'fulano' }
  const inChannel = (over: Partial<Message> = {}): Message =>
    dm({ conversation_id: null, channel_id: 'ch1', content: 'bora @fulano?', ...over })

  it('menção em canal vira notificação que abre o canal', () => {
    expect(mentionNotification(inChannel(), me, 'srv1')).toEqual({
      kind: 'mention',
      title: 'Ana mencionou você',
      body: 'bora @fulano?',
      route: '/servers/srv1/channels/ch1'
    })
  })

  it('resposta a uma mensagem minha em canal vira notificação que abre o canal', () => {
    expect(
      mentionNotification(
        inChannel({
          content: 'fechado!',
          reply_to_id: 'm0',
          reply_to: {
            id: 'm0',
            author_id: 'eu',
            author: { id: 'eu', username: 'fulano', display_name: 'Fulano' },
            content: 'alguém aí?'
          }
        }),
        me,
        'srv1'
      )
    ).toEqual({
      kind: 'mention',
      title: 'Ana respondeu você',
      body: 'fechado!',
      route: '/servers/srv1/channels/ch1'
    })
  })

  it('sem menção, ou mensagem minha, não notifica', () => {
    expect(mentionNotification(inChannel({ content: 'bora jogar?' }), me, 'srv1')).toBeNull()
    expect(mentionNotification(inChannel({ author_id: 'eu' }), me, 'srv1')).toBeNull()
  })

  it('DM já tem a própria notificação', () => {
    expect(mentionNotification(dm({ content: '@fulano oi' }), me, null)).toBeNull()
  })

  it('@all pinga todo mundo do canal, pelo campo mention_everyone', () => {
    expect(
      mentionNotification(inChannel({ content: '@all bora', mention_everyone: 'all' }), me, 'srv1')
    ).toEqual({
      kind: 'mention',
      title: 'Ana mencionou @all',
      body: '@all bora',
      route: '/servers/srv1/channels/ch1'
    })
    expect(
      mentionNotification(
        inChannel({ content: '@all bora', mention_everyone: 'all' }),
        { ...me, status: 'idle' },
        'srv1'
      )?.title
    ).toBe('Ana mencionou @all')
  })

  it('@here só pinga quem está online', () => {
    const msg = inChannel({ content: '@here alguém?', mention_everyone: 'here' })
    expect(mentionNotification(msg, { ...me, status: 'online' }, 'srv1')?.title).toBe(
      'Ana mencionou @here'
    )
    expect(mentionNotification(msg, { ...me, status: 'idle' }, 'srv1')).toBeNull()
    expect(mentionNotification(msg, { ...me, status: 'invisible' }, 'srv1')).toBeNull()
  })

  it('"@all" no texto sem mention_everyone (autor sem permissão) não pinga', () => {
    expect(mentionNotification(inChannel({ content: '@all bora' }), me, 'srv1')).toBeNull()
    expect(
      mentionNotification(inChannel({ content: '@all bora', mention_everyone: null }), me, 'srv1')
    ).toBeNull()
  })

  it('quem mandou o @all não pinga a si mesmo', () => {
    expect(
      mentionNotification(
        inChannel({ author_id: 'eu', content: '@all', mention_everyone: 'all' }),
        me,
        'srv1'
      )
    ).toBeNull()
  })

  it('menção pessoal junto com @all continua "mencionou você"', () => {
    expect(
      mentionNotification(
        inChannel({ content: '@all e @fulano', mention_everyone: 'all' }),
        me,
        'srv1'
      )?.title
    ).toBe('Ana mencionou você')
  })

  it('resposta a mim com @all continua "respondeu você"', () => {
    expect(
      mentionNotification(
        inChannel({
          content: '@all fechado!',
          mention_everyone: 'all',
          reply_to_id: 'm0',
          reply_to: { id: 'm0', author_id: 'eu', content: 'alguém aí?' }
        }),
        me,
        'srv1'
      )?.title
    ).toBe('Ana respondeu você')
  })
})

describe('notificationSound', () => {
  it('DM toca "message", menção toca "mention"', () => {
    expect(notificationSound('message', { sound: true })).toBe('message')
    expect(notificationSound('mention', { sound: true })).toBe('mention')
  })

  it('com o som desligado, fica em silêncio', () => {
    expect(notificationSound('message', { sound: false })).toBeNull()
    expect(notificationSound('mention', { sound: false })).toBeNull()
  })

  it('chamada tem toque próprio', () => {
    expect(notificationSound('call', { sound: true })).toBeNull()
  })
})

describe('desktopPayload', () => {
  const message = messageNotification(dm(), 'eu') as AppNotification
  const call = callNotification({ id: 'ana', display_name: 'Ana', username: 'ana' })

  it('leva as preferências para o processo main (padrão: tudo ligado)', () => {
    expect(desktopPayload(message, DEFAULT_NOTIFICATION_PREFS)).toEqual({
      title: 'Ana',
      body: 'bora jogar?',
      route: '/dm/ana',
      toast: true,
      taskbar: true
    })
  })

  it('respeita "barra de tarefas" e "área de trabalho" desligadas', () => {
    const prefs = { desktop: false, taskbar: false, sound: true }
    expect(desktopPayload(message, prefs)).toMatchObject({ toast: false, taskbar: false })
  })

  it('chamada recebida sempre avisa, mesmo com tudo desligado', () => {
    const prefs = { desktop: false, taskbar: false, sound: false }
    expect(desktopPayload(call, prefs)).toMatchObject({ urgent: true, toast: true, taskbar: true })
  })
})

describe('notifyDesktop', () => {
  const dm: AppNotification = { kind: 'message', title: 'Ana', body: 'oi', route: '/dm/1' }
  const prefs = { desktop: true, taskbar: false, sound: true }

  afterEach(() => {
    setWebNotifier(null)
    vi.unstubAllGlobals()
  })

  it('no Electron vai para o processo main, nunca para o aviso do navegador', () => {
    const notify = vi.fn()
    const web = vi.fn()
    vi.stubGlobal('window', { api: { background: { notify } } })
    setWebNotifier(web)
    notifyDesktop(dm, prefs)
    expect(notify).toHaveBeenCalledWith(desktopPayload(dm, prefs))
    expect(web).not.toHaveBeenCalled()
  })

  it('no navegador entrega o mesmo payload ao aviso do build web', () => {
    const web = vi.fn()
    vi.stubGlobal('window', {})
    setWebNotifier(web)
    notifyDesktop(dm, prefs)
    expect(web).toHaveBeenCalledWith(desktopPayload(dm, prefs))
  })

  it('sem Electron e sem aviso ligado, não faz nada', () => {
    vi.stubGlobal('window', {})
    expect(() => notifyDesktop(dm, prefs)).not.toThrow()
  })
})
