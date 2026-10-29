package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"

	"gin-quickstart/backend/internal/notifysettings"
	"gin-quickstart/backend/internal/platform/fcm"
	"gin-quickstart/backend/internal/push"
)

// wirePush liga o push do app mobile (ADR 0022). Sem credenciais do Firebase o envio fica desligado,
// mas as rotas de token continuam respondendo para o app registrar o aparelho.
func (a *app) wirePush() {
	repo := push.NewRepository(a.db)
	cfg, err := fcm.LoadConfig(os.Getenv, os.ReadFile)
	if err != nil {
		log.Printf("[push] credenciais do FCM inválidas, push desligado: %v", err)
	}
	client := fcm.New(cfg, nil, nil)
	if client.Enabled() {
		log.Println("[push] push ligado")
	} else {
		log.Println("[push] push desligado (sem credenciais do FCM)")
	}
	settings := notifysettings.NotifySettingsService(notifysettings.NotifySettingsRepository(a.db), a.permissionService, a.hub)
	a.pushTap.Set(push.NewNotifier(push.Deps{
		Presence: a.hub, Settings: settings, Directory: repo,
		Access: push.ViewAccess{Perms: a.permissionService}, Tokens: repo, Sender: client,
	}))
	handler := push.PushHandler(push.NewService(repo))
	a.route(func(_ *gin.Engine, api *gin.RouterGroup) {
		push.Routes(api, handler, a.authMiddleware)
	})
}
