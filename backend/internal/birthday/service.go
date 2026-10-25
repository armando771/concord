package birthday

import (
	"context"
	"errors"
	"log"
	"sync"
	"time"
	_ "time/tzdata" // fuso de Brasília também no Windows e em contêineres sem tzdata

	"gin-quickstart/backend/internal/message"
)

var errAnnouncePending = errors.New("algum anúncio de aniversário falhou; tenta de novo")

// A mensagem de aniversário sai às 9h de Brasília (a galera já acordou para
// ver e parabenizar).
const announceHour = 9

// MessagePoster grava a mensagem do servidor no canal (message.Service).
type MessagePoster interface {
	CreateSystemChannelMessage(ctx context.Context, channelID string, authorID string, content string, kind string) (*message.Message, error)
}

// Greeting: servidor que já parabenizou a pessoa hoje (para o modal).
type Greeting struct {
	ServerID   string `json:"server_id"`
	ServerName string `json:"server_name"`
	ChannelID  string `json:"channel_id"`
}

// Today é o que o app precisa para o modal de feliz aniversário.
type Today struct {
	IsBirthday bool       `json:"is_birthday"`
	Name       string     `json:"name,omitempty"`
	// Quantos anos está fazendo (só a própria pessoa vê, no modal).
	Age *int `json:"age,omitempty"`
	Date       string     `json:"date"`
	Servers    []Greeting `json:"servers"`
}

// announceStore: o que o anúncio diário usa do repositório.
type announceStore interface {
	Targets(ctx context.Context, month int, days []int) ([]target, error)
	Claim(ctx context.Context, serverID string, day time.Time, channelID string) (bool, error)
	SetMessage(ctx context.Context, serverID string, day time.Time, messageID string) error
	Release(ctx context.Context, serverID string, day time.Time) error
}

type Service struct {
	repository *Repository
	store      announceStore
	poster     MessagePoster
	location   *time.Location

	mu       sync.Mutex
	lastDone string // dia (AAAA-MM-DD) já anunciado por esta instância
}

func BirthdayService(repository *Repository, poster MessagePoster) *Service {
	location, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		log.Printf("[birthday] fuso America/Sao_Paulo indisponível, usando UTC-3: %v", err)
		location = time.FixedZone("BRT", -3*60*60)
	}
	return &Service{
		repository: repository,
		store:      repository,
		poster:     poster,
		location:   location,
	}
}

// Run confere a cada minuto se já passou das 9h e anuncia os aniversários do
// dia (uma vez por servidor por dia).
func (s *Service) Run(ctx context.Context) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	s.tick(ctx, time.Now())
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			s.tick(ctx, now)
		}
	}
}

func (s *Service) tick(ctx context.Context, now time.Time) {
	local := now.In(s.location)
	if local.Hour() < announceHour {
		return
	}
	day := dateOnly(local)
	key := day.Format(time.DateOnly)

	s.mu.Lock()
	done := s.lastDone == key
	s.mu.Unlock()
	if done {
		return
	}

	if err := s.announce(ctx, day); err != nil {
		log.Printf("[birthday] anúncio de %s: %v", key, err)
		return
	}
	s.mu.Lock()
	s.lastDone = key
	s.mu.Unlock()
}

func (s *Service) announce(ctx context.Context, day time.Time) error {
	month, days := DatesToCelebrate(day)
	targets, err := s.store.Targets(ctx, month, days)
	if err != nil {
		return err
	}

	failed := false
	for _, t := range targets {
		if t.ChannelID == nil || len(t.Usernames) == 0 {
			continue
		}
		claimed, err := s.store.Claim(ctx, t.ServerID, day, *t.ChannelID)
		if err != nil {
			return err
		}
		if !claimed {
			continue
		}

		content := FormatMessage(t.ServerName, t.Usernames)
		msg, err := s.poster.CreateSystemChannelMessage(ctx, *t.ChannelID, t.OwnerID, content, SystemKind)
		if err != nil {
			log.Printf("[birthday] mensagem no servidor %s: %v", t.ServerID, err)
			_ = s.store.Release(ctx, t.ServerID, day)
			failed = true
			continue
		}
		if err := s.store.SetMessage(ctx, t.ServerID, day, msg.ID); err != nil {
			log.Printf("[birthday] registrar mensagem do servidor %s: %v", t.ServerID, err)
		}
	}
	if failed {
		// Mantém o dia pendente: tenta de novo no próximo minuto.
		return errAnnouncePending
	}
	return nil
}

// TodayFor diz se hoje (Brasília) é aniversário da pessoa e quais servidores
// já a parabenizaram. Quem desligou o anúncio não recebe o modal.
func (s *Service) TodayFor(ctx context.Context, userID string, now time.Time) (*Today, error) {
	day := dateOnly(now.In(s.location))
	today := &Today{Date: day.Format(time.DateOnly), Servers: []Greeting{}}

	p, err := s.repository.person(ctx, userID)
	if err != nil {
		return nil, err
	}
	if p.Day == nil || p.Month == nil || !p.Announce || !IsBirthday(*p.Day, *p.Month, day) {
		return today, nil
	}

	today.IsBirthday = true
	today.Name = p.DisplayName
	if p.Year != nil {
		age := Age(*p.Year, day)
		today.Age = &age
	}
	greetings, err := s.repository.Greetings(ctx, userID, day)
	if err != nil {
		return nil, err
	}
	today.Servers = greetings
	return today, nil
}

// dateOnly: meia-noite do dia local, em UTC (para gravar como DATE).
func dateOnly(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}
