import { describe, expectTypeOf, it } from 'vitest'
import type { PublicUser, User } from './authStore'
import type { listFriends } from '../api/friends'
import type { getMe, searchUsers } from '../api/users'

// Checado pelo `yarn typecheck`: o backend não manda o e-mail de outras
// pessoas, então nada fora da própria conta pode contar com ele.
describe('PublicUser', () => {
  it('não tem e-mail; só a própria conta tem', () => {
    expectTypeOf<PublicUser>().not.toHaveProperty('email')
    expectTypeOf<User>().toHaveProperty('email').toEqualTypeOf<string>()
  })

  it('busca e amigos devolvem PublicUser; /users/me devolve User', () => {
    expectTypeOf<Awaited<ReturnType<typeof searchUsers>>>().toEqualTypeOf<PublicUser[]>()
    expectTypeOf<Awaited<ReturnType<typeof listFriends>>>().toEqualTypeOf<PublicUser[]>()
    expectTypeOf<Awaited<ReturnType<typeof getMe>>>().toEqualTypeOf<User>()
  })
})
