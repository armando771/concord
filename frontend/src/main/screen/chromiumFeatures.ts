// Features do Chromium ligadas/desligadas no boot (captura de tela e vídeo
// por placa de vídeo). Uma lista só por switch: o Chromium lê apenas o último
// --enable-features, então duas chamadas de appendSwitch se sobrescrevem.
// Ver docs/adr/0020-qualidade-das-lives.md.

/** Captura WGC (janela coberta continua entregando quadros). */
const CAPTURE = ['AllowWgcWindowCapturer', 'AllowWgcScreenCapturer']

/**
 * Codificar/decodificar na placa de vídeo. Windows: H.264 por Media Foundation
 * e decodificação D3D11 já vêm ligados; o AV1 por hardware no WebRTC vem
 * desligado, e o LiveKit publica tela em AV1 com L1T3 (o D3D12 só faz L1T3
 * com a feature). Linux: a codificação VA-API vem desligada.
 */
const HARDWARE_VIDEO: Partial<Record<NodeJS.Platform, string[]>> = {
  win32: ['WebRtcAV1HWEncode', 'D3D12VideoEncodeAcceleratorL1T3'],
  linux: ['AcceleratedVideoEncoder', 'AcceleratedVideoDecoder']
}

/** Oclusão nativa marca a janela coberta como oculta e congela a captura. */
const DISABLE = ['CalculateNativeWinOcclusion']

export function chromiumFeatures(platform: NodeJS.Platform): { enable: string; disable: string } {
  return {
    enable: [...CAPTURE, ...(HARDWARE_VIDEO[platform] ?? [])].join(','),
    disable: DISABLE.join(',')
  }
}
