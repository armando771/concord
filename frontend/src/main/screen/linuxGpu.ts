import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

// Placa de vídeo no Linux, lida do sysfs no boot: as features do Chromium
// precisam ir no --enable-features antes do `ready`, e o app.getGPUInfo só
// responde depois. O Chromium faz vídeo por VA-API; a NVIDIA não tem VA-API
// próprio, só pelo nvidia-vaapi-driver (decodifica; não codifica). Ver
// docs/adr/0020-qualidade-das-lives.md.

export interface LinuxGpu {
  /** Todas as placas de vídeo são NVIDIA (híbrido Intel/AMD + NVIDIA não conta). */
  nvidiaOnly: boolean
  /** nvidia-vaapi-driver instalado (nvidia_drv_video.so). */
  nvidiaVaapi: boolean
}

export interface LinuxGpuFs {
  readdir(dir: string): string[]
  read(path: string): string
  exists(path: string): boolean
}

const PCI = '/sys/bus/pci/devices'
const NVIDIA = '0x10de'
/** Classe PCI 0x03xxxx = controladora de vídeo. */
const DISPLAY_CLASS = '0x03'
const DRIVER = 'nvidia_drv_video.so'
const DRIVER_DIRS = [
  '/usr/lib/dri',
  '/usr/lib64/dri',
  '/usr/lib/x86_64-linux-gnu/dri',
  '/usr/lib/aarch64-linux-gnu/dri'
]

export const NVIDIA_DRIVER_HINT = 'Instale o nvidia-vaapi-driver para usar a placa de vídeo'

const nodeFs: LinuxGpuFs = {
  readdir: (dir) => readdirSync(dir),
  read: (path) => readFileSync(path, 'utf8'),
  exists: (path) => existsSync(path)
}

function displayVendors(fs: LinuxGpuFs): string[] {
  try {
    return fs.readdir(PCI).flatMap((device) => {
      const base = `${PCI}/${device}`
      if (!fs.read(`${base}/class`).trim().startsWith(DISPLAY_CLASS)) return []
      return [fs.read(`${base}/vendor`).trim().toLowerCase()]
    })
  } catch {
    return []
  }
}

function hasNvidiaVaapi(fs: LinuxGpuFs, env: NodeJS.ProcessEnv): boolean {
  const custom = env.LIBVA_DRIVERS_PATH?.split(':').filter(Boolean) ?? []
  return [...custom, ...DRIVER_DIRS].some((dir) => fs.exists(join(dir, DRIVER)))
}

export function detectLinuxGpu(
  fs: LinuxGpuFs = nodeFs,
  env: NodeJS.ProcessEnv = process.env
): LinuxGpu {
  const vendors = displayVendors(fs)
  const nvidiaOnly = vendors.length > 0 && vendors.every((vendor) => vendor === NVIDIA)
  return { nvidiaOnly, nvidiaVaapi: nvidiaOnly && hasNvidiaVaapi(fs, env) }
}

/** Dica para o painel/gpu.log quando a NVIDIA decodificaria, mas falta o driver. */
export function videoDriverHint(gpu: LinuxGpu | null): string | null {
  return gpu?.nvidiaOnly && !gpu.nvidiaVaapi ? NVIDIA_DRIVER_HINT : null
}

/** O libva 2.20+ só carrega o driver da NVIDIA com LIBVA_DRIVER_NAME (sem sobrescrever o da pessoa). */
export function nvidiaVideoEnv(
  gpu: LinuxGpu | null,
  env: NodeJS.ProcessEnv
): Record<string, string> {
  if (!gpu?.nvidiaVaapi || env.LIBVA_DRIVER_NAME) return {}
  return { LIBVA_DRIVER_NAME: 'nvidia' }
}

/** Pedaço do gpu.log (só com NVIDIA): a placa, o driver e a dica. */
export function linuxGpuLog(gpu: LinuxGpu | null): string {
  if (!gpu?.nvidiaOnly) return ''
  const hint = videoDriverHint(gpu)
  return ` nvidia=sim nvidia_vaapi_driver=${gpu.nvidiaVaapi ? 'sim' : 'nao'}${hint ? ` (${hint})` : ''}`
}
