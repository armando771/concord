package main

import (
	"context"
	"os"
	"path/filepath"

	"gin-quickstart/backend/internal/badge"
	"gin-quickstart/backend/internal/birthday"
	"gin-quickstart/backend/internal/bot"
	"gin-quickstart/backend/internal/changelog"
	"gin-quickstart/backend/internal/conversation"
	"gin-quickstart/backend/internal/level"
	"gin-quickstart/backend/internal/message"
	"gin-quickstart/backend/internal/notifysettings"
	"gin-quickstart/backend/internal/proposal"
	"gin-quickstart/backend/internal/segundoturno"

	"github.com/gin-gonic/gin"
)

// wireEngagement: aniversários, níveis, badges, propostas, preferências de
// notificação e changelog, com os jobs de fundo de cada um.
func (a *app) wireEngagement() {
	// Aniversários (mensagem do servidor às 9h + modal para o aniversariante)
	birthdayService := birthday.BirthdayService(birthday.BirthdayRepository(a.db), a.messageService)
	birthdayHandler := birthday.BirthdayHandler(birthdayService)
	go birthdayService.Run(context.Background())

	// Level (XP por tempo em call, sem mute)
	levelService := level.LevelService(level.LevelRepository(a.db), a.hub, a.callService)
	levelHandler := level.LevelHandler(levelService)
	go levelService.Run(a.ctx)

	// Propostas (kanban com votação de 7 dias; aprovadas viram issue no GitHub)
	issueCreator := newIssueCreator()
	techIDs := envList("TECH_TEAM_USER_IDS")
	// Imagens das propostas numa subpasta que a limpeza dos anexos não varre.
	proposalImages := mustStore(filepath.Join(a.uploadsDir, proposal.ImagesDir), "proposal images dir")
	// Badges do perfil (tempo transmitindo, madrugada, maior call... somados
	// olhando as chamadas; o resto vem dos contadores do banco)
	// Horas de Coruja/Madrugador em Brasília (nil), não no relógio da VPS. No
	// desligamento grava o que estava na memória antes de fechar o banco.
	badgeService := badge.BadgeService(badge.BadgeRepository(a.db), a.hub, a.callService, a.hub, nil)
	badgeHandler := badge.BadgeHandler(badgeService)

	// Banner "fez o L no segundo turno?": o sim reavalia o badge na hora e só
	// contas criadas antes do corte do Pioneiro veem o banner.
	segundoTurnoHandler := segundoturno.SegundoTurnoHandler(segundoturno.SegundoTurnoService(
		segundoturno.SegundoTurnoRepository(a.db), badgeService, badge.FounderCutoff,
	))

	// Card novo no quadro já reavalia o badge Contribuinte de quem criou.
	proposalService := proposal.ProposalService(proposal.ProposalRepository(a.db), a.hub, issueCreator, proposalImages, techIDs).
		WithNotifier(salinhaBotNotifier{conversations: a.conversationService, messages: a.messageService}).
		WithBadges(badgeService)
	proposalHandler := proposal.ProposalHandler(proposalService, proposalImages, a.uploadSpace)
	go proposalService.Run(a.ctx)
	notifySettingsHandler := notifysettings.NotifySettingsHandler(
		notifysettings.NotifySettingsService(notifysettings.NotifySettingsRepository(a.db), a.permissionService, a.hub),
	)
	a.badgeDone = make(chan struct{})
	go func() {
		defer close(a.badgeDone)
		badgeService.Run(a.ctx)
	}()

	a.route(func(_ *gin.Engine, api *gin.RouterGroup) {
		level.LevelRoutes(api, levelHandler, a.authMiddleware)
		badge.BadgeRoutes(api, badgeHandler, a.authMiddleware)
		segundoturno.SegundoTurnoRoutes(api, segundoTurnoHandler, a.authMiddleware)
		notifysettings.Routes(api, notifySettingsHandler, a.authMiddleware)
		proposal.ProposalRoutes(api, proposalHandler, a.authMiddleware, a.requireVerified)
		birthday.BirthdayRoutes(api, birthdayHandler, a.authMiddleware)
		changelog.Routes(api, changelog.NewHandler(changelog.NewRepository(a.db), os.Getenv("CHANGELOG_TOKEN")), a.authMiddleware)
	})
}

// salinhaBotNotifier: o Salinha Bot escreve na DM de quem sugeriu o card
// (abre a DM sem as regras de amizade; a conversa é só leitura para a pessoa).
type salinhaBotNotifier struct {
	conversations *conversation.Service
	messages      *message.Service
}

func (n salinhaBotNotifier) Notify(ctx context.Context, userID, text string) error {
	conv, err := n.conversations.GetOrCreateBotDM(ctx, bot.SalinhaBotID, userID)
	if err != nil {
		return err
	}
	_, err = n.messages.CreateConversationMessage(ctx, conv.ID, bot.SalinhaBotID, text, nil, nil, nil, nil, nil)
	return err
}
