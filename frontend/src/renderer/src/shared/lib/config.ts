import { appTarget } from './platform'
import { resolveServerUrls } from './serverUrl'

/** Build web (navegador, yarn build:web) — sem Electron nem window.api. */
export const IS_WEB = appTarget(import.meta.env.VITE_APP_TARGET) === 'web'

// Desktop: endereço do servidor embutido no build (VITE_SERVER_URL); sem ele,
// o backend local do dev. Navegador: a própria origem da página.
export const {
  apiBaseUrl: API_BASE_URL,
  wsUrl: WS_URL,
  liveKitUrl: LIVEKIT_URL
} = resolveServerUrls({
  web: IS_WEB,
  serverUrl: import.meta.env.VITE_SERVER_URL,
  pageOrigin: typeof location !== 'undefined' ? location.origin : undefined
})
