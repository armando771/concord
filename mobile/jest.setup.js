// Os ícones do @expo/vector-icons carregam fonte/asset que o Jest não registra.
jest.mock('@expo/vector-icons', () => ({ Ionicons: Object.assign(() => null, { glyphMap: {} }) }))

// O módulo nativo de notificações não existe no Jest; o comportamento real é coberto por testes com portas.
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  getDevicePushTokenAsync: jest.fn().mockResolvedValue({ type: 'android', data: 'tok-test' }),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  clearLastNotificationResponseAsync: jest.fn().mockResolvedValue(undefined)
}))

// Módulos nativos de WebRTC/LiveKit não existem no Jest; a lógica da chamada usa uma CallMedia falsa (ADR 0023).
jest.mock('@livekit/react-native', () => ({
  registerGlobals: jest.fn(),
  AudioSession: { startAudioSession: jest.fn().mockResolvedValue(undefined), stopAudioSession: jest.fn().mockResolvedValue(undefined) }
}))
jest.mock('livekit-client', () => ({
  Room: jest.fn(),
  RoomEvent: {},
  ConnectionState: { Disconnected: 'disconnected' }
}))
