import config from '../app.config'

describe('app.config (voz)', () => {
  it('declara as permissões de áudio e o serviço em primeiro plano de microfone', () => {
    expect(config.android?.permissions).toEqual(
      expect.arrayContaining([
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_MICROPHONE'
      ])
    )
  })

  it('não pede câmera nem captura de tela nesta fatia (só áudio)', () => {
    const permissions = config.android?.permissions ?? []
    expect(permissions).not.toContain('android.permission.CAMERA')
    expect(permissions).not.toContain('android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION')
  })

  it('registra os plugins nativos do LiveKit e do WebRTC', () => {
    const names = (config.plugins ?? []).map((p) => (Array.isArray(p) ? p[0] : p))
    expect(names).toEqual(expect.arrayContaining(['@livekit/react-native-expo-plugin', '@config-plugins/react-native-webrtc']))
  })
})
