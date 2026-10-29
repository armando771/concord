package main

import (
	"context"
	"log"
	"os"

	"github.com/gin-gonic/gin"

	"gin-quickstart/backend/internal/call"
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
	notifier := push.NewNotifier(push.Deps{
		Presence: a.hub, Settings: settings, Directory: repo,
		Access: push.ViewAccess{Perms: a.permissionService}, Tokens: repo, Sender: client,
	})
	a.pushTap.Set(notifier)
	a.pushNotifier, a.pushRepo, a.pushEnabled = notifier, repo, client.Enabled()
	handler := push.PushHandler(push.NewService(repo))
	a.route(func(_ *gin.Engine, api *gin.RouterGroup) {
		push.Routes(api, handler, a.authMiddleware)
	})
}

// wirePushCalls liga a chamada de DM ao push (depois do wireCalls): quem está offline mas tem o app com push
// registrado pode ser chamado, e o convite vira notificação. Sem credenciais do FCM nada muda.
func (a *app) wirePushCalls() {
	if a.pushNotifier == nil || !a.pushEnabled {
		return
	}
	a.callService.SetOfflineRinger(func(userID string) bool {
		return a.pushRepo.HasToken(context.Background(), userID)
	})
	a.callService.OnDMInvite(func(i call.DMInvite) {
		a.pushNotifier.OnCallInvite(push.CallInvite{
			CallID: i.CallID, ConversationID: i.ConversationID, CalleeID: i.CalleeID, InitiatorName: i.InitiatorName,
		})
	})
}
