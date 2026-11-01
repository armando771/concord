package main

import (
	"context"
	"log"

	"gin-quickstart/backend/internal/bot"
	"gin-quickstart/backend/internal/channel"
	"gin-quickstart/backend/internal/music"
)

// wireMusicCommands deixa a lista de comandos do Maestro fixada no #musica:
// na criação do servidor e, no boot, nos servidores que ainda não a têm.
func (a *app) wireMusicCommands() {
	a.channelService.OnSystemCreated(func(ctx context.Context, ch *channel.Channel) {
		pinMusicCommands(ctx, a.messageService, ch.ID)
	})
	go backfillMusicCommands(a.ctx, a.channelRepository, a.messageService, a.isServerMember)
}

// pinMusicCommands posta e fixa a lista de comandos num canal; falha só é logada.
func pinMusicCommands(ctx context.Context, board music.CommandsBoard, channelID string) {
	if _, err := music.PinCommands(ctx, board, channelID, bot.UserID); err != nil {
		log.Printf("[music] %v", err)
	}
}

// maestroChannelLister lista o #musica de todos os servidores.
type maestroChannelLister interface {
	MaestroChannels(ctx context.Context) ([]channel.Channel, error)
}

// backfillMusicCommands cuida dos servidores que já existiam: onde o Maestro
// está e o #musica ainda não tem a lista, posta e fixa. É idempotente (a lista
// só é postada uma vez por canal), então roda a cada boot.
func backfillMusicCommands(
	ctx context.Context,
	lister maestroChannelLister,
	board music.CommandsBoard,
	isMember func(ctx context.Context, serverID, userID string) bool,
) {
	channels, err := lister.MaestroChannels(ctx)
	if err != nil {
		log.Printf("[music] listar canais do Maestro: %v", err)
		return
	}
	for _, ch := range channels {
		if ctx.Err() != nil {
			return
		}
		if !isMember(ctx, ch.ServerID, bot.UserID) {
			continue
		}
		pinMusicCommands(ctx, board, ch.ID)
	}
}
