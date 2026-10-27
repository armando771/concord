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
	// DJ: músicas postas na fila do Maestro.
	a.musicManager.OnQueued(func(userID string, n int) {
		badges.Count(context.Background(), userID, "dj", int64(n))
	})
	// Barulhento: sons da mesa de áudio tocados com alguém ouvindo. Fora do
	// WebSocket de quem tocou: gravar não atrasa o próximo som.
	a.callService.OnSoundPlayed(func(_, userID string) {
		go badges.Count(context.Background(), userID, "barulhento", 1)
	})
}
