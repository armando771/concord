// O que falta para a placa de vídeo decodificar a live (Linux com NVIDIA sem o
// nvidia-vaapi-driver). Vem do main (main/screen/linuxGpu), uma vez por sessão.

let cached: Promise<string | null> | null = null

export function loadVideoDriverHint(): Promise<string | null> {
  const ask = typeof window === 'undefined' ? undefined : window.api?.screenShare?.videoHint
  cached ??= (ask ? ask() : Promise.resolve(null)).catch(() => null)
  return cached
}

/** Testes. */
export function clearVideoDriverHint(): void {
  cached = null
}
