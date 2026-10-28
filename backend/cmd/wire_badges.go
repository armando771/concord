package main

import (
	"context"

	"gin-quickstart/backend/internal/badge"
)

// wireBadgeEvents liga aos badges os eventos que só o backend vê (não ficam
// no banco por outro motivo): cada um soma na contagem do badge dele.
func (a *app) wireBadgeEvents(badges *badge.Service) {
	// Câmera ligada: quem está de câmera vem do LiveKit, a cada tick.
	badges.WithCameras(a.liveKitAdmin)
	// Festeiro: só contas reais (e-mail confirmado e 7 dias de conta) fazem pico.
	badges.WithRealAccounts(badge.BadgeRepository(a.db))
	// DJ: músicas do Maestro que tocaram 30 s com mais alguém ouvindo (o
	// timer do player chama fora de qualquer lock).
	a.musicManager.OnPlayed(func(userID string) {
		badges.Count(context.Background(), userID, "dj", 1)
	})
	// Barulhento: sons da mesa de áudio tocados com alguém ouvindo. Fora do
	// WebSocket de quem tocou: gravar não atrasa o próximo som.
	a.callService.OnSoundPlayed(func(_, userID string) {
		go badges.Count(context.Background(), userID, "barulhento", 1)
	})
}
