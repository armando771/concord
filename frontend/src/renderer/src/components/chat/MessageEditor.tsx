import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Edição no lugar da mensagem (como no Discord): Enter salva, Esc cancela,
 * Shift+Enter quebra a linha.
 */
function MessageEditor({
  initial,
  saving,
  onSave,
  onCancel
}: {
  initial: string
  saving: boolean
  onSave: (draft: string) => void
  onCancel: () => void
}): React.JSX.Element {
  const [draft, setDraft] = useState(initial)
  const ref = useRef<HTMLTextAreaElement>(null)

  // Cresce com o texto, até um limite (depois rola).
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
  }, [draft])

  // Abre com o cursor no fim.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onCancel()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (!saving) onSave(draft)
    }
  }

  return (
    <div className="mt-1">
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        // Mesmo limite do campo de envio, sem cortar mensagem mais longa
        // que veio por outro caminho (o backend aceita até 4000).
        maxLength={Math.max(2000, initial.length)}
        aria-label="Editar mensagem"
        disabled={saving}
        className="w-full resize-none rounded-lg border border-subtle bg-input px-3 py-2 text-ds-chat text-strong outline-none focus:border-violet-500/40 disabled:opacity-60"
      />
      <div className="mt-0.5 text-ds-xs text-gray-500">
        Esc para{' '}
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer text-link hover:underline"
        >
          cancelar
        </button>{' '}
        • Enter para{' '}
        <button
          type="button"
          onClick={() => onSave(draft)}
          disabled={saving}
          className="cursor-pointer text-link hover:underline disabled:opacity-60"
        >
          salvar
        </button>
      </div>
    </div>
  )
}

export default MessageEditor
