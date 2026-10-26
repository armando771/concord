// Package bot guarda o que identifica os usuários-bot: o Maestro, o bot de
// música (server: membro fixo; music: o player), e o Salinha Bot, que avisa na
// DM o andamento das propostas. Nenhum dos dois faz login, tem amizade ou
// recebe DM de alguém (friendship).
package bot

import "strings"

// UserID é o usuário de sistema do Maestro, criado pela migration 000045.
const UserID = "4d414553-5452-4f00-8000-000000000001"

// DisplayName é o nome do bot na lista de membros e na sala de mídia.
const DisplayName = "Maestro"

// SalinhaBotID é o Salinha Bot (migration 000054): só escreve, na DM de quem
// sugeriu um card; ninguém responde nem liga para ele.
const SalinhaBotID = "53414c49-4e48-4100-8000-000000000002"

// SalinhaBotName é o nome dele nas DMs.
const SalinhaBotName = "Salinha Bot"

// IsBot diz se o usuário é um dos bots (sem presença, amizade nem DM de pessoas).
func IsBot(userID string) bool { return userID == UserID || userID == SalinhaBotID }

// IdentityPrefix marca o participante LiveKit do bot: um por canal de voz.
const IdentityPrefix = "bot-music:"

func Identity(channelID string) string { return IdentityPrefix + channelID }

func IsIdentity(identity string) bool { return strings.HasPrefix(identity, IdentityPrefix) }
