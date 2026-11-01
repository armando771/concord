package main

import (
	"gin-quickstart/backend/internal/badge"
	"gin-quickstart/backend/internal/serverlevel"

	"github.com/gin-gonic/gin"
)

// wireServerLevel: nível do servidor (docs/adr/0016-nivel-do-servidor.md). O
// tempo de call vem das mesmas fotos sem AFK do XP e dos badges, só de contas
// reais; mensagens, figurinhas e sons são contados por trigger no banco.
func (a *app) wireServerLevel() {
	service := serverlevel.NewService(
		serverlevel.NewRepository(a.db),
		a.callAFK,
		badge.NewRealAccountCache(badge.BadgeRepository(a.db)),
		a.hub,
	)
	// O desligamento espera os badges (a.badgeDone); o nível grava o último
	// minuto junto, antes de o banco fechar.
	badgesDone := a.badgeDone
	done := make(chan struct{})
	go func() {
		defer close(done)
		service.Run(a.ctx)
		<-badgesDone
	}()
	a.badgeDone = done

	handler := serverlevel.NewHandler(service, a.serverService)
	a.route(func(_ *gin.Engine, api *gin.RouterGroup) {
		serverlevel.Routes(api, handler, a.authMiddleware)
	})
}
