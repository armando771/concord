import { request } from '../../../shared/api/client'

export interface Birthday {
  day: number | null
  month: number | null
  year: number | null
  /** Os servidores podem anunciar (e mostrar o modal). */
  announce: boolean
}

export interface BirthdayGreeting {
  server_id: string
  server_name: string
  channel_id: string
}

export interface BirthdayToday {
  is_birthday: boolean
  name?: string
  /** Quantos anos está fazendo (só a própria pessoa vê). */
  age?: number
  /** Dia em Brasília (AAAA-MM-DD). */
  date: string
  servers: BirthdayGreeting[]
}

export function getBirthday(): Promise<Birthday> {
  return request<Birthday>('/users/me/birthday')
}

export function setBirthday(birthday: Birthday): Promise<Birthday> {
  return request<Birthday>('/users/me/birthday', {
    method: 'PUT',
    body: JSON.stringify(birthday)
  })
}

export function getBirthdayToday(): Promise<BirthdayToday> {
  return request<BirthdayToday>('/birthdays/today')
}
