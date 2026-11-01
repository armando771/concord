import { request } from '../../../shared/api/client'
import { getMe } from './auth'

jest.mock('../../../shared/api/client')

const requestMock = jest.mocked(request)
const ME = { id: 'u1', username: 'ana', display_name: 'Ana', email: 'a@b.co' }

describe('getMe', () => {
  beforeEach(() => requestMock.mockReset())

  it('chamadas simultâneas compartilham uma única requisição', async () => {
    let resolve: (v: unknown) => void = () => {}
    requestMock.mockReturnValue(new Promise((r) => (resolve = r)))
    const first = getMe()
    const second = getMe()
    resolve(ME)
    expect(await first).toEqual(ME)
    expect(await second).toEqual(ME)
    expect(requestMock).toHaveBeenCalledTimes(1)
  })

  it('depois de terminar, a próxima chamada busca de novo', async () => {
    requestMock.mockResolvedValue(ME)
    await getMe()
    await getMe()
    expect(requestMock).toHaveBeenCalledTimes(2)
  })

  it('falha não trava as próximas chamadas', async () => {
    requestMock.mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce(ME)
    await expect(getMe()).rejects.toThrow('rede')
    expect(await getMe()).toEqual(ME)
  })
})
