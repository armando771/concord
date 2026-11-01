import { describe, expect, it } from 'vitest'
import {
  detectLinuxGpu,
  linuxGpuLog,
  nvidiaVideoEnv,
  videoDriverHint,
  type LinuxGpuFs
} from './linuxGpu'

/** sysfs falso: devices = { '0000:01:00.0': ['0x030000', '0x10de'] }; files = .so instalados. */
function fakeFs(devices: Record<string, [string, string]>, files: string[] = []): LinuxGpuFs {
  return {
    readdir: (dir) => {
      if (dir !== '/sys/bus/pci/devices') throw new Error('ENOENT')
      return Object.keys(devices)
    },
    read: (path) => {
      const [, id, name] = /^\/sys\/bus\/pci\/devices\/([^/]+)\/(class|vendor)$/.exec(path) ?? []
      const device = devices[id]
      if (!device) throw new Error('ENOENT')
      return `${name === 'class' ? device[0] : device[1]}\n`
    },
    exists: (path) => files.includes(path)
  }
}

const RTX = { '0000:01:00.0': ['0x030000', '0x10de'] as [string, string] }
const AUDIO_HDMI = { '0000:01:00.1': ['0x040300', '0x10de'] as [string, string] }
const INTEL = { '0000:00:02.0': ['0x030000', '0x8086'] as [string, string] }

describe('detectLinuxGpu', () => {
  it('só NVIDIA, com o nvidia-vaapi-driver instalado', () => {
    const gpu = detectLinuxGpu(
      fakeFs({ ...RTX, ...AUDIO_HDMI }, ['/usr/lib/dri/nvidia_drv_video.so']),
      {}
    )
    expect(gpu).toEqual({ nvidiaOnly: true, nvidiaVaapi: true })
  })

  it('o driver também é procurado no LIBVA_DRIVERS_PATH e nas pastas do Debian/Fedora', () => {
    const debian = '/usr/lib/x86_64-linux-gnu/dri/nvidia_drv_video.so'
    expect(detectLinuxGpu(fakeFs(RTX, [debian]), {}).nvidiaVaapi).toBe(true)
    expect(
      detectLinuxGpu(fakeFs(RTX, ['/usr/lib64/dri/nvidia_drv_video.so']), {}).nvidiaVaapi
    ).toBe(true)
    expect(
      detectLinuxGpu(fakeFs(RTX, ['/opt/va/nvidia_drv_video.so']), {
        LIBVA_DRIVERS_PATH: '/x:/opt/va'
      }).nvidiaVaapi
    ).toBe(true)
  })

  it('notebook híbrido (Intel + NVIDIA): não conta como só NVIDIA (a Intel tem VA-API própria)', () => {
    expect(detectLinuxGpu(fakeFs({ ...INTEL, ...RTX }), {}).nvidiaOnly).toBe(false)
  })

  it('AMD/Intel ou sysfs ilegível: nada de NVIDIA', () => {
    expect(detectLinuxGpu(fakeFs(INTEL), {})).toEqual({ nvidiaOnly: false, nvidiaVaapi: false })
    const broken: LinuxGpuFs = {
      readdir: () => {
        throw new Error('EACCES')
      },
      read: () => '',
      exists: () => false
    }
    expect(detectLinuxGpu(broken, {})).toEqual({ nvidiaOnly: false, nvidiaVaapi: false })
  })
})

describe('videoDriverHint', () => {
  it('NVIDIA sem o driver VA-API: diz o que instalar', () => {
    expect(videoDriverHint({ nvidiaOnly: true, nvidiaVaapi: false })).toBe(
      'Instale o nvidia-vaapi-driver para usar a placa de vídeo'
    )
  })

  it('com o driver, ou sem NVIDIA: nada', () => {
    expect(videoDriverHint({ nvidiaOnly: true, nvidiaVaapi: true })).toBeNull()
    expect(videoDriverHint({ nvidiaOnly: false, nvidiaVaapi: false })).toBeNull()
    expect(videoDriverHint(null)).toBeNull()
  })
})

describe('nvidiaVideoEnv', () => {
  it('NVIDIA com o driver: o libva 2.20+ precisa do LIBVA_DRIVER_NAME=nvidia', () => {
    expect(nvidiaVideoEnv({ nvidiaOnly: true, nvidiaVaapi: true }, {})).toEqual({
      LIBVA_DRIVER_NAME: 'nvidia'
    })
  })

  it('não sobrescreve o que a pessoa já configurou, nem mexe sem o driver', () => {
    expect(
      nvidiaVideoEnv({ nvidiaOnly: true, nvidiaVaapi: true }, { LIBVA_DRIVER_NAME: 'vdpau' })
    ).toEqual({})
    expect(nvidiaVideoEnv({ nvidiaOnly: true, nvidiaVaapi: false }, {})).toEqual({})
    expect(nvidiaVideoEnv(null, {})).toEqual({})
  })
})

describe('linuxGpuLog', () => {
  it('gpu.log diz se é NVIDIA, se o driver está lá e o que fazer', () => {
    expect(linuxGpuLog({ nvidiaOnly: true, nvidiaVaapi: false })).toBe(
      ' nvidia=sim nvidia_vaapi_driver=nao (Instale o nvidia-vaapi-driver para usar a placa de vídeo)'
    )
    expect(linuxGpuLog({ nvidiaOnly: true, nvidiaVaapi: true })).toBe(
      ' nvidia=sim nvidia_vaapi_driver=sim'
    )
    expect(linuxGpuLog({ nvidiaOnly: false, nvidiaVaapi: false })).toBe('')
    expect(linuxGpuLog(null)).toBe('')
  })
})
