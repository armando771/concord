// Package bot guarda o que identifica o Maestro, o bot de música: é usado por
// server (membro fixo), friendship (sem amizade/DM) e music (o player).
package bot

import "strings"

// UserID é o usuário de sistema do Maestro, criado pela migration 000029.
const UserID = "4d414553-5452-4f00-8000-000000000001"

// DisplayName é o nome do bot na lista de membros e na sala de mídia.
const DisplayName = "Maestro"

// IdentityPrefix marca o participante LiveKit do bot: um por canal de voz.
const IdentityPrefix = "bot-music:"

func Identity(channelID string) string { return IdentityPrefix + channelID }

func IsIdentity(identity string) bool { return strings.HasPrefix(identity, IdentityPrefix) }
