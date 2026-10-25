package main

import (
	"context"
	"log"
	"os"
	"time"

	"gin-quickstart/backend/internal/auth"
	"gin-quickstart/backend/internal/birthday"
	"gin-quickstart/backend/internal/call"
	"gin-quickstart/backend/internal/channel"
	"gin-quickstart/backend/internal/clientip"
	"gin-quickstart/backend/internal/conversation"
	"gin-quickstart/backend/internal/database"
	"gin-quickstart/backend/internal/friendship"
	"gin-quickstart/backend/internal/httplog"
	"gin-quickstart/backend/internal/level"
	"gin-quickstart/backend/internal/livekit"
	"gin-quickstart/backend/internal/media"
	"gin-quickstart/backend/internal/message"
	"gin-quickstart/backend/internal/server"
	"gin-quickstart/backend/internal/updates"
	"gin-quickstart/backend/internal/user"
	"gin-quickstart/backend/internal/websocket"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func loadEnv() {
	candidates := []string{".env", "../.env", "../../.env", "backend/.env"}
	for _, path := range candidates {
		if _, err := os.Stat(path); err == nil {
			if err := godotenv.Load(path); err != nil {
				log.Printf("failed to load %s: %v", path, err)
			}
			return
		}
	}
	log.Println("No .env file found")
}

func findMigrationsDir() string {
	candidates := []string{"migrations", "../migrations", "../../migrations", "backend/migrations"}
	for _, path := range candidates {
		if info, err := os.Stat(path); err == nil && info.IsDir() {
			return path
		}
	}
	return "migrations"
}

func main() {
	loadEnv()

	databaseURL := os.Getenv("DATABASE_URL")

	db, err := database.Connect(databaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := database.Migrate(db, findMigrationsDir()); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}

	// Como o gin.Default(), mas o log não grava tokens que vão na URL.
	router := gin.New()
	// Em quem confiar para o IP do cliente (log e limite de login).
	trustedProxies := clientip.TrustedProxies(os.Getenv("HOST"), os.Getenv("TRUSTED_PROXIES"))
	if err := clientip.Configure(router, trustedProxies); err != nil {
		log.Fatalf("invalid TRUSTED_PROXIES: %v", err)
	}
	log.Printf("trusted proxies: %v", trustedProxies)
	router.Use(gin.LoggerWithConfig(gin.LoggerConfig{Formatter: httplog.Formatter}), gin.Recovery())

	router.Use(cors.New(cors.Config{
		// O app empacotado carrega via file:// e a auth é por Bearer (sem
		// cookies), então qualquer origem pode chamar a API.
		AllowOriginFunc:  func(string) bool { return true },
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Auth
	authRepository := auth.AuthRepository(db)
	authService := auth.AuthService(authRepository)

	// User
	userRepository := user.UserRepository(db)
	userService := user.UserService(userRepository)

	// WebSocket hub (created before services that publish events)
	hub := websocket.NewHub()

	// Server
	serverRepository := server.ServerRepository(db)
	serverService := server.ServerService(serverRepository, hub)

	// Friendship
	friendshipRepository := friendship.FriendshipRepository(db)
	friendshipService := friendship.FriendshipService(friendshipRepository, userService, hub)
	friendshipHandler := friendship.FriendshipHandler(friendshipService)

	// Channel
	channelRepository := channel.ChannelRepository(db)
	channelService := channel.ChannelService(channelRepository, hub)
	channelHandler := channel.ChannelHandler(channelService)

	serverHandler := server.ServerHandler(serverService, friendshipService, userService, channelService)

	// Conversation (DM)
	conversationRepository := conversation.ConversationRepository(db)
	conversationService := conversation.ConversationService(conversationRepository)
	conversationHandler := conversation.ConversationHandler(conversationService, friendshipService, serverService, userService)

	// Mídia do chat (arquivos no disco, fora do binário e do deploy)
	uploadsDir := os.Getenv("UPLOADS_DIR")
	if uploadsDir == "" {
		uploadsDir = "uploads"
	}
	uploads, err := media.NewStore(uploadsDir)
	if err != nil {
		log.Fatalf("failed to open uploads dir: %v", err)
	}

	// Message
	messageRepository := message.MessageRepository(db)
	messageService := message.MessageService(messageRepository, hub, channelRepository, conversationRepository, uploads)
	// Limpeza horária de arquivos sem dono (cascatas e uploads abandonados).
	go message.NewJanitor(messageRepository, uploads).Run(context.Background(), time.Hour)
	messageHandler := message.MessageHandler(messageService, channelService, conversationService, friendshipService, serverService)
	uploadSpace := media.NewSpace(uploadsDir, media.ReserveFromEnv(os.Getenv("UPLOADS_MIN_FREE_GB")))
	roomAccess := message.NewServiceRoomAccess(channelService, serverService, conversationService, friendshipService)
	attachmentHandler := message.NewAttachmentHandler(messageRepository, uploads, uploadSpace, roomAccess, authService)

	// LiveKit (mídia das chamadas)
	liveKitKey, liveKitSecret := os.Getenv("LIVEKIT_API_KEY"), os.Getenv("LIVEKIT_API_SECRET")
	if liveKitKey == "" || liveKitSecret == "" {
		log.Fatal("LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set")
	}
	liveKitTokens := livekit.NewTokenIssuer(liveKitKey, liveKitSecret)
	liveKitPort := os.Getenv("LIVEKIT_PORT")
	if liveKitPort == "" {
		liveKitPort = "7880"
	}
	rtcProxy, err := livekit.NewRTCProxy("http://127.0.0.1:" + liveKitPort)
	if err != nil {
		log.Fatalf("invalid LiveKit address: %v", err)
	}

	// Call (ciclo de vida da chamada; mídia via LiveKit)
	callRepository := call.CallRepository(db)
	callService := call.CallService(callRepository, hub, conversationService, serverService, channelService, userService, hub.IsOnline)
	callHandler := call.CallHandler(callService, liveKitTokens)
	// Reinício do servidor não derruba quem está em chamada.
	callService.RestoreActive(context.Background())

	// Aniversários (mensagem do servidor às 9h + modal para o aniversariante)
	birthdayRepository := birthday.BirthdayRepository(db)
	birthdayService := birthday.BirthdayService(birthdayRepository, messageService)
	birthdayHandler := birthday.BirthdayHandler(birthdayService)
	go birthdayService.Run(context.Background())

	// Level (XP por tempo em call, sem mute)
	levelRepository := level.LevelRepository(db)
	levelService := level.LevelService(levelRepository, hub, callService)
	levelHandler := level.LevelHandler(levelService)
	go levelService.Run(context.Background())

	// WebSocket handler
	wsHandler := websocket.WsHandler(hub, authService, channelService, serverService, conversationService, callService)
	hub.SetDisconnectHandler(callService.HandleDisconnect)

	// Auth middleware
	authMiddleware := auth.AuthMiddleware(authService)

	api := router.Group("/api")

	// Auth routes (public)
	authHandler := auth.AuthHandler(authService, userService)
	auth.AuthRoutes(api, authHandler, authMiddleware)

	// Protected routes
	userHandler := user.UserHandler(userService)
	user.UserRoutes(api, userHandler, authMiddleware)
	friendship.FriendRoutes(api, friendshipHandler, authMiddleware)
	server.ServerRoutes(api, serverHandler, authMiddleware)
	channel.ChannelRoutes(api, channelHandler, authMiddleware)
	conversation.ConversationRoutes(api, conversationHandler, authMiddleware)
	message.MessageRoutes(api, messageHandler, authMiddleware)
	message.AttachmentRoutes(api, attachmentHandler, authMiddleware)
	call.CallRoutes(api, callHandler, authMiddleware)
	level.LevelRoutes(api, levelHandler, authMiddleware)
	birthday.BirthdayRoutes(api, birthdayHandler, authMiddleware)

	// Presence (protected)
	presence := api.Group("/presence")
	presence.Use(authMiddleware)
	{
		presence.GET("", wsHandler.Presence)
		presence.GET("/", wsHandler.Presence)
	}

	// WebSocket endpoint (public, auth via ?token=)
	router.GET("/ws", wsHandler.ServeWS)

	// Atualizações do app (scripts/release-win.sh publica nesta pasta)
	updatesDir := os.Getenv("UPDATES_DIR")
	if updatesDir == "" {
		updatesDir = "updates"
	}
	updates.Routes(router, updatesDir)

	// Sinalização do LiveKit (auth pelo token do LiveKit em ?access_token=)
	router.Any("/rtc", rtcProxy)
	router.Any("/rtc/*path", rtcProxy)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// HOST=127.0.0.1 quando há um proxy na frente (Caddy na VPS).
	if err := router.Run(os.Getenv("HOST") + ":" + port); err != nil {
		log.Fatal(err)
	}
}
