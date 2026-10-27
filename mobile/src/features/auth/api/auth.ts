export interface AuthResponse {
  access_token: string
  refresh_token: string
}

export interface LoginInput {
  /** E-mail ou nome de usuário (com ou sem "@" na frente). */
  login: string
  /** Campo antigo; mesmo valor de login, para backends ainda não atualizados. */
  email: string
  password: string
}
