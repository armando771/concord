import { deriveServerUrls } from './serverUrl'

// EXPO_PUBLIC_SERVER_URL é constante de build (o Metro troca o valor na hora do
// bundle); sem ela, o backend local do desenvolvimento.
export const { apiBaseUrl: API_BASE_URL, wsUrl: WS_URL, liveKitUrl: LIVEKIT_URL } = deriveServerUrls(
  process.env.EXPO_PUBLIC_SERVER_URL
)
