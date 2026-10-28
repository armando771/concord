package main

import (
	"context"
	"log"

	"gin-quickstart/backend/internal/auth"
	"gin-quickstart/backend/internal/call"
	"gin-quickstart/backend/internal/channel"
	"gin-quickstart/backend/internal/conversation"
	"gin-quickstart/backend/internal/friendship"
	"gin-quickstart/backend/internal/message"
	"gin-quickstart/backend/internal/music"
	"gin-quickstart/backend/internal/permission"
	"gin-quickstart/backend/internal/platform/livekit"
	"gin-quickstart/backend/internal/platform/media"
	"gin-quickstart/backend/internal/platform/websocket"
	"gin-quickstart/backend/internal/role"
	"gin-quickstart/backend/internal/server"
	"gin-quickstart/backend/internal/soundboard"
	"gin-quickstart/backend/internal/user"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// app é a raiz de composição: o que uma área monta e outra usa. Cada
// wire*.go monta uma área (na ordem de main) e registra as rotas dela.
type app struct {
	ctx context.Context
	db  *pgxpool.Pool
	hub *websocket.Hub

	authRepository  *auth.Repository
	authService     *auth.Service
	authMiddleware  gin.HandlerFunc
	requireVerified gin.HandlerFunc

	userRepository *user.Repository
	userService    *user.Service
	profileHandler *user.ProfileHandler

	permissionService *permission.Service
	roleRepository    *role.Repository
	roleService       *role.Service

	serverService     *server.Service
	moderationService *server.Moderation
	nicknameService   *server.Nicknames

	friendshipService *friendship.Service
	// friendAccepted: amizade aceita reavalia o badge Amigos (wireEngagement).
	friendAccepted         *friendship.AcceptHook
	channelRepository      *channel.Repository
	channelService         *channel.Service
	conversationRepository *conversation.Repository
	conversationService    *conversation.Service

	uploadsDir           string
	uploadSpace          *media.Space
	messageService       *message.Service
	messageHandler       *message.Handler
	roomAccess           *message.ServiceRoomAccess
	soundboardRepository *soundboard.Repository

	liveKitTokens *livekit.TokenIssuer
	liveKitAdmin  *livekit.Admin
	liveKitPort   string
	callService   *call.Service
	// callAFK: o tempo de call (XP e badges) visto sem quem está 10 min sem falar.
	callAFK      *call.AFK
	musicManager *music.Manager

	// badgeDone fecha quando os badges terminam de gravar no desligamento.
	badgeDone chan struct{}

	routes []func(router *gin.Engine, api *gin.RouterGroup)
}

// route guarda o registro de rotas de uma área para depois do wiring.
func (a *app) route(register func(router *gin.Engine, api *gin.RouterGroup)) {
	a.routes = append(a.routes, register)
}

func (a *app) registerRoutes(router *gin.Engine) {
	api := router.Group("/api")
	for _, register := range a.routes {
		register(router, api)
	}
}

// mustStore abre uma pasta de mídia ou derruba o boot.
func mustStore(dir, what string) *media.Store {
	store, err := media.NewStore(dir)
	if err != nil {
		log.Fatalf("failed to open %s: %v", what, err)
	}
	return store
}

// wire monta todas as áreas na ordem em que uma depende da outra.
func wire(ctx context.Context, db *pgxpool.Pool) *app {
	a := &app{ctx: ctx, db: db}
	a.wireCore()
	a.wireChat()
	a.wireCalls()
	a.wireMusic()
	a.wireEngagement()
	a.wireRealtime()
	a.wireAccount()
	a.wireUpdates()
	return a
}
