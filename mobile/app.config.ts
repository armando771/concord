import { existsSync } from 'node:fs'
import type { ExpoConfig } from 'expo/config'

// google-services.json (Firebase) é segredo do dono: vem de GOOGLE_SERVICES_JSON no build e fica fora do git.
// Sem ele o APK compila igual, só que sem push (docs/PUSH.md).
const googleServices = process.env.GOOGLE_SERVICES_JSON

// O package id e o keystore ficam fixos: trocar depois quebra as atualizações
// do APK instalado e as credenciais do FCM (ADR 0021).
const config: ExpoConfig = {
  name: 'Salinha',
  slug: 'salinha',
  scheme: 'salinha',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  icon: './assets/icon.png',
  android: {
    package: 'com.salinha.app',
    adaptiveIcon: {
      backgroundColor: '#3a17a8',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png'
    },
    predictiveBackGestureEnabled: false,
    // Só áudio nesta fatia (ADR 0023): sem câmera nem captura de tela.
    permissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE'
    ],
    ...(googleServices && existsSync(googleServices) ? { googleServicesFile: googleServices } : {})
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-notifications',
    '@livekit/react-native-expo-plugin',
    '@config-plugins/react-native-webrtc',
    'expo-status-bar',
    ['expo-splash-screen', { image: './assets/splash-icon.png', backgroundColor: '#121214', imageWidth: 200 }]
  ],
  experiments: { typedRoutes: true }
}

export default config
