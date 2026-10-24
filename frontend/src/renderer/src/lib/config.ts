import { deriveServerUrls } from './serverUrl'

// Endereço do servidor embutido no build (VITE_SERVER_URL). Sem ele, o app
// aponta para o backend local do dev.
export const {
  apiBaseUrl: API_BASE_URL,
  wsUrl: WS_URL,
  liveKitUrl: LIVEKIT_URL
} = deriveServerUrls(import.meta.env.VITE_SERVER_URL)
