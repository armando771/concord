/** Para onde o renderer foi buildado: app Electron ou navegador (yarn build:web). */
export type AppTarget = 'desktop' | 'web'

/** Lê o VITE_APP_TARGET do build; sem ele, é o app desktop. */
export function appTarget(value: string | undefined): AppTarget {
  return value === 'web' ? 'web' : 'desktop'
}
