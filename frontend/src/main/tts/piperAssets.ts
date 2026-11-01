// O que a voz do /tts no Linux baixa no primeiro uso (docs/adr/0014-voz-piper-no-linux.md):
// o Piper standalone (traz espeak-ng-data e onnxruntime) e a voz pt-BR faber,
// direto das fontes oficiais. URL, sha256 e tamanho fixos: trocar de versão é
// trocar estas constantes (e o PIPER_BUNDLE, que vira a pasta nova).
import { join } from 'path'

export interface PiperAsset {
  name: string
  url: string
  sha256: string
  size: number
  /** .tar.gz extraído na pasta da versão (o arquivo em si não fica). */
  extract: boolean
}

/** Pasta da versão em <userData>/tts/. Mudou um arquivo, muda o nome. */
export const PIPER_BUNDLE = 'piper-2023.11.14-2_faber-medium'
export const TTS_STAGING_PREFIX = '.staging-'
/** Gravado por último: a pasta só vale com ele. */
export const TTS_READY_FILE = 'pronto'

const PIPER_RELEASE = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2'
/** Commit fixo do rhasspy/piper-voices: o arquivo não muda por baixo. */
const VOICES =
  'https://huggingface.co/rhasspy/piper-voices/resolve/5041a7a49ae5b3a0f30e6837769eb03fdbb231bd'
const MODEL = 'pt_BR-faber-medium.onnx'

const PIPER_BY_ARCH: Record<string, PiperAsset> = {
  x64: {
    name: 'piper_linux_x86_64.tar.gz',
    url: `${PIPER_RELEASE}/piper_linux_x86_64.tar.gz`,
    sha256: 'a50cb45f355b7af1f6d758c1b360717877ba0a398cc8cbe6d2a7a3a26e225992',
    size: 26_460_462,
    extract: true
  },
  arm64: {
    name: 'piper_linux_aarch64.tar.gz',
    url: `${PIPER_RELEASE}/piper_linux_aarch64.tar.gz`,
    sha256: 'fea0fd2d87c54dbc7078d0f878289f404bd4d6eea6e7444a77835d1537ab88eb',
    size: 26_004_717,
    extract: true
  }
}

const VOICE: PiperAsset[] = [
  {
    name: MODEL,
    url: `${VOICES}/pt/pt_BR/faber/medium/${MODEL}`,
    sha256: '858555e3a064209c57088fe6bd70c4c3dc54d03eaa00c45d5ecaf43a33f95aa7',
    size: 63_201_294,
    extract: false
  },
  {
    name: `${MODEL}.json`,
    url: `${VOICES}/pt/pt_BR/faber/medium/${MODEL}.json`,
    sha256: '7e694de195ae3fc36dd732c445eb04fb49b649854893cb5506b978f0d50a1d6f',
    size: 4_855,
    extract: false
  }
]

/** Arquivos para o processador (process.arch); null = sem binário do Piper. */
export function piperAssetsFor(arch: string): PiperAsset[] | null {
  const piper = PIPER_BY_ARCH[arch]
  return piper ? [piper, ...VOICE] : null
}

export function piperPaths(dir: string): { binary: string; model: string } {
  return { binary: join(dir, 'piper', 'piper'), model: join(dir, MODEL) }
}

/** Tudo em <userData>/tts/ menos a versão atual e a extração deste processo. */
export function ttsDirsToPrune(entries: string[], pid: number): string[] {
  const mine = `${TTS_STAGING_PREFIX}${PIPER_BUNDLE}-${pid}`
  return entries.filter((e) => e !== PIPER_BUNDLE && e !== mine)
}
