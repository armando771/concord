import { app, ipcMain } from 'electron'
import { appendLog } from '../app/appLog'
import { chromiumFeatures } from './chromiumFeatures'
import { detectLinuxGpu, linuxGpuLog, nvidiaVideoEnv, videoDriverHint } from './linuxGpu'

// Janela coberta/minimizada não pode ser tratada como oculta: o Windows marca
// como "ocluída" e o Chromium para de renderizar (a captura congela).
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
// Linux: a placa de vídeo decide as features de VA-API (NVIDIA só com o driver).
const gpu = process.platform === 'linux' ? detectLinuxGpu() : null
// Antes do processo da GPU nascer: ele herda o ambiente.
Object.assign(process.env, nvidiaVideoEnv(gpu, process.env))
// Captura WGC + vídeo na placa de vídeo, numa chamada por switch (ver chromiumFeatures).
const features = chromiumFeatures(process.platform, gpu)
app.commandLine.appendSwitch('enable-features', features.enable)
app.commandLine.appendSwitch('disable-features', features.disable)

// Diagnóstico: se a placa de vídeo está liberada para codificar/decodificar
// (a lista de bloqueio do Chromium pode desligar por driver).
void app.whenReady().then(() => {
  const status = app.getGPUFeatureStatus()
  appendLog(
    'gpu.log',
    `video_decode=${status.video_decode} video_encode=${status.video_encode}${linuxGpuLog(gpu)}`
  )
})

// Painel da live: o que falta para a placa de vídeo decodificar (null = nada).
ipcMain.handle('screen-share:video-hint', () => videoDriverHint(gpu))
