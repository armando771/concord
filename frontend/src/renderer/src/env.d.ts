/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Endereço público do servidor da Salinha, ex.: http://abc.gl.at.ply.gg:12345 */
  readonly VITE_SERVER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
