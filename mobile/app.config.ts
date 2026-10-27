import type { ExpoConfig } from 'expo/config'

// O package id e o keystore ficam fixos: trocar depois quebra as atualizações
// do APK instalado e as credenciais do FCM (ADR 0004).
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
      backgroundColor: '#1e1f22',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png'
    },
    predictiveBackGestureEnabled: false
  },
  plugins: ['expo-router', 'expo-secure-store', 'expo-status-bar'],
  experiments: { typedRoutes: true }
}

export default config
