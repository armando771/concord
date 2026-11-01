import * as Notifications from 'expo-notifications'
import { expoPlatform } from './expoPush'

describe('expoPlatform.ensureChannel', () => {
  it('cria o canal das mensagens e o das chamadas, com importância alta', async () => {
    await expoPlatform.ensureChannel()
    const calls = jest.mocked(Notifications.setNotificationChannelAsync).mock.calls
    const ids = calls.map(([id]) => id)
    expect(ids).toEqual(expect.arrayContaining(['mensagens', 'chamadas']))
    expect(calls.every(([, channel]) => channel.importance === Notifications.AndroidImportance.HIGH)).toBe(true)
  })
})
