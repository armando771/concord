import { beforeEach, describe, expect, it } from 'vitest'
import { notePickerCancelled, pickerError, resetPickerCancel } from './screenPickerCancel'

const abort = (): DOMException => new DOMException('Permission denied', 'AbortError')

describe('screenPickerCancel', () => {
  beforeEach(() => resetPickerCancel())

  it('Cancelar no modal: a recusa do Electron vira NotAllowedError (sem toast)', () => {
    notePickerCancelled()
    expect((pickerError(abort()) as DOMException).name).toBe('NotAllowedError')
  })

  it('falha de verdade (sem cancelar) continua sendo erro', () => {
    const err = abort()
    expect(pickerError(err)).toBe(err)
  })

  it('o cancelamento vale só para a recusa seguinte', () => {
    notePickerCancelled()
    pickerError(abort())
    const err = abort()
    expect(pickerError(err)).toBe(err)
  })

  it('um pedido novo esquece cancelamento antigo', () => {
    notePickerCancelled()
    resetPickerCancel()
    const err = abort()
    expect(pickerError(err)).toBe(err)
  })
})
