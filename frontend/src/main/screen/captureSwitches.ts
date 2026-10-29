import { app } from 'electron'
import { appendLog } from '../app/appLog'
import { chromiumFeatures } from './chromiumFeatures'

// Janela coberta/minimizada não pode ser tratada como oculta: o Windows marca
// como "ocluída" e o Chromium para de renderizar (a captura congela).
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
// Captura WGC + vídeo na placa de vídeo, numa chamada por switch (ver chromiumFeatures).
const features = chromiumFeatures(process.platform)
app.commandLine.appendSwitch('enable-features', features.enable)
app.commandLine.appendSwitch('disable-features', features.disable)

// Diagnóstico: se a placa de vídeo está liberada para codificar/decodificar
// (a lista de bloqueio do Chromium pode desligar por driver).
void app.whenReady().then(() => {
  const status = app.getGPUFeatureStatus()
  appendLog('gpu.log', `video_decode=${status.video_decode} video_encode=${status.video_encode}`)
})
