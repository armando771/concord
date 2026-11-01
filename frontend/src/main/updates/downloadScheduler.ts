// Quando baixar a versão oferecida pelo manifesto: sozinho, em segundo plano,
// assim que ela aparece — também em chamada, porque baixar não interrompe nada
// (só a instalação reinicia o app). Espalha os downloads (backgroundDownloadDelayMs),
// espera cada vez mais depois de falhas (retryDelayMs) e busca o .sig antes do
// pacote. Não sabe nada do Electron nem do backend: quem cria passa o download
// e a busca do .sig.
import { backgroundDownloadDelayMs, retryDelayMs, type ReleaseId } from './updatePolicy'

export interface DownloadSchedulerDeps {
  /** backend.downloadUpdate(): baixa a versão do último manifesto */
  download: () => Promise<unknown>
  /** conteúdo do .sig do arquivo (relativo ao endereço das atualizações) */
  fetchSignature: (file: string) => Promise<string>
  /** ainda falta baixar algo (versão nova, não recusada e ainda não pronta) */
  wanted: () => boolean
  /** falhou: só tenta de novo em `retryInMs` (a não ser que a pessoa peça) */
  onFailure: (message: string, error: unknown, retryInMs: number) => void
  /** o .sig não veio, então o pacote nem foi baixado */
  onSignatureUnavailable: () => void
  /** quando o app abriu (Date.now()) */
  startedAt: number
  random?: () => number
}

export interface DownloadScheduler {
  /** Manifesto lido: versão + sha512 diferentes zeram a espera entre tentativas. */
  offer(release: ReleaseId, file: string | null): void
  /** O que o manifesto oferece agora. */
  release(): ReleaseId | null
  /** Baixa a versão oferecida. `force`: a pessoa clicou em Atualizar. */
  request(force: boolean): void
  /** O backend parou de baixar (terminou ou deu erro). */
  settled(): void
  /** Falha depois do download (verificação): entra na espera. */
  failed(message: string, error: unknown): void
  /** Baixou e verificou: zera a espera. */
  succeeded(): void
  /** .sig já baixado para o arquivo, ou null. */
  signatureFor(file: string): string | null
  forgetSignature(): void
}

export function createDownloadScheduler(deps: DownloadSchedulerDeps): DownloadScheduler {
  const random = deps.random ?? Math.random
  let release: ReleaseId | null = null
  let file: string | null = null
  /** Falhas seguidas de download/verificação desta oferta, e quando tentar de novo. */
  let failures = 0
  let retryAt = 0
  /** .sig já baixado (antes do pacote) para o arquivo oferecido. */
  let signature: { file: string; value: string } | null = null
  let downloading = false
  /** Download em segundo plano esperando o sorteio. */
  let timer: ReturnType<typeof setTimeout> | null = null

  const fail = (message: string, error: unknown): void => {
    failures += 1
    retryAt = Date.now() + retryDelayMs(failures)
    deps.onFailure(message, error, retryDelayMs(failures))
  }

  /**
   * Primeiro o .sig (poucos bytes): sem ele publicado não adianta baixar o
   * pacote (~140 MB). Depois o pacote.
   */
  async function run(): Promise<void> {
    const wanted = file
    if (wanted && signature?.file !== wanted) {
      try {
        signature = { file: wanted, value: await deps.fetchSignature(wanted) }
      } catch (error) {
        downloading = false
        fail('assinatura indisponível', error)
        deps.onSignatureUnavailable()
        return
      }
    }
    try {
      await deps.download()
    } catch (error) {
      downloading = false
      fail('download falhou', error)
    }
  }

  function startNow(): void {
    if (downloading || !deps.wanted()) return
    downloading = true
    void run()
  }

  function request(force: boolean): void {
    if (downloading || !deps.wanted()) return
    // Depois de falhas, só o clique em Atualizar fura a espera.
    if (!force && Date.now() < retryAt) return
    if (timer) {
      // Já esperando o sorteio: só o clique em Atualizar fura a fila.
      if (!force) return
      clearTimeout(timer)
      timer = null
    }
    const delay = backgroundDownloadDelayMs({
      force,
      msSinceStart: Date.now() - deps.startedAt,
      random: random()
    })
    if (delay > 0) {
      timer = setTimeout(() => {
        timer = null
        startNow()
      }, delay)
      return
    }
    startNow()
  }

  function offer(next: ReleaseId, nextFile: string | null): void {
    if (next.version === release?.version && next.sha512 === release.sha512) return
    release = next
    file = nextFile
    failures = 0
    retryAt = 0
    signature = null
  }

  return {
    offer,
    release: () => release,
    request,
    settled: () => {
      downloading = false
    },
    failed: fail,
    succeeded: () => {
      failures = 0
      retryAt = 0
    },
    signatureFor: (name) => (signature?.file === name ? signature.value : null),
    forgetSignature: () => {
      signature = null
    }
  }
}
