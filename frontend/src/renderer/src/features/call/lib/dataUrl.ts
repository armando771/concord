// Os WASM dos worklets entram inline (data URL): o app empacotado roda em
// file://, onde fetch não funciona.

export function decodeDataUrl(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  return bytes.buffer
}
