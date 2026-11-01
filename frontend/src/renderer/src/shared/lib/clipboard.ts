import { showToast } from '../store/toastStore'

/** Copia o texto e avisa com um toast (o mesmo "Copiar texto" do chat e dos comentários). */
export function copyText(text: string): void {
  if (!navigator.clipboard) {
    showToast.error('Não deu para copiar.')
    return
  }
  navigator.clipboard.writeText(text).then(
    () => showToast.success('Copiado'),
    () => showToast.error('Não deu para copiar.')
  )
}
