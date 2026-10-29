import { registerPushToken, unregisterPushToken } from '../api/push'
import { expoPlatform } from './expoPush'
import { createPushRegistration } from './pushRegistration'

/** Um registro só por app: o hook liga no login e o botão Sair desliga antes de apagar a sessão. */
export const pushRegistration = createPushRegistration(expoPlatform, {
  register: registerPushToken,
  unregister: unregisterPushToken
})
