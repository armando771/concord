import { request } from '../../../shared/api/client'
import { getProfile } from './users'

jest.mock('../../../shared/api/client')

const requestMock = jest.mocked(request)
const PROFILE = { id: 'u1', username: 'ana', display_name: 'Ana', links: [{ url: 'https://x.com/ana' }] }

describe('getProfile', () => {
  beforeEach(() => requestMock.mockReset())

  it('busca o cartão pelo id e devolve o JSON', async () => {
    requestMock.mockResolvedValue(PROFILE)
    expect(await getProfile('u1')).toEqual(PROFILE)
    expect(requestMock).toHaveBeenCalledWith('/users/u1/profile')
  })

  it('escapa o id na URL', async () => {
    requestMock.mockResolvedValue(PROFILE)
    await getProfile('a/b?c')
    expect(requestMock).toHaveBeenCalledWith('/users/a%2Fb%3Fc/profile')
  })

  it('o erro do servidor (ex.: 404) sobe como veio', async () => {
    const error = Object.assign(new Error('Request failed'), { status: 404 })
    requestMock.mockRejectedValue(error)
    await expect(getProfile('x')).rejects.toMatchObject({ status: 404 })
  })
})
