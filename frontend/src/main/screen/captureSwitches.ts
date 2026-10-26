import { app } from 'electron'

// Janela coberta/minimizada não pode ser tratada como oculta: o Windows marca
// como "ocluída" e o Chromium para de renderizar (a captura congela).
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
// Captura de janela/tela via Windows Graphics Capture: continua entregando
// quadros de uma janela coberta por outra (o capturador GDI antigo congela).
app.commandLine.appendSwitch('enable-features', 'AllowWgcWindowCapturer,AllowWgcScreenCapturer')
