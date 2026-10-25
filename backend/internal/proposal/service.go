package proposal

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"strings"
	"time"
	"unicode/utf8"
)

var (
	ErrInvalidTitle       = errors.New("invalid title")
	ErrInvalidDescription = errors.New("invalid description")
	ErrTooManyOpen        = errors.New("too many open proposals")
	ErrVotingClosed       = errors.New("voting closed")
	ErrForbidden          = errors.New("forbidden")
	ErrInvalidStatus      = errors.New("invalid status")
)

// Intervalo do fechamento das votações e das novas tentativas de issue.
const tickInterval = time.Minute

type store interface {
	List(ctx context.Context, viewerID string) ([]Proposal, error)
	Get(ctx context.Context, id string, viewerID *string) (*Proposal, error)
	Create(ctx context.Context, authorID, title, description string, endsAt time.Time) (string, error)
	CountOpenByAuthor(ctx context.Context, authorID string, now time.Time) (int, error)
	UpsertVote(ctx context.Context, id, userID string, approve bool, now time.Time) (bool, error)
	DeleteVote(ctx context.Context, id, userID string, now time.Time) (bool, error)
	Delete(ctx context.Context, id string) error
	SetStatus(ctx context.Context, id, status string) error
	CloseDue(ctx context.Context, now time.Time) ([]string, error)
	WithoutIssue(ctx context.Context) ([]Proposal, error)
	SetIssue(ctx context.Context, id string, number int, url string) error
}

type EventPublisher interface {
	BroadcastAll(event []byte)
}

type Service struct {
	store     store
	publisher EventPublisher
	issues    IssueCreator // nil: sem token do GitHub, não cria issue
	tech      map[string]bool
	now       func() time.Time
}

// ProposalService: techIDs são os usuários do time tech (TECH_TEAM_USER_IDS).
func ProposalService(repository *Repository, publisher EventPublisher, issues IssueCreator, techIDs []string) *Service {
	return newService(repository, publisher, issues, techIDs)
}

func newService(st store, publisher EventPublisher, issues IssueCreator, techIDs []string) *Service {
	tech := make(map[string]bool, len(techIDs))
	for _, id := range techIDs {
		tech[id] = true
	}
	return &Service{store: st, publisher: publisher, issues: issues, tech: tech, now: time.Now}
}

func (s *Service) IsTech(userID string) bool { return s.tech[userID] }

func (s *Service) Board(ctx context.Context, userID string) (*Board, error) {
	list, err := s.store.List(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &Board{Proposals: list, IsTech: s.IsTech(userID)}, nil
}

func (s *Service) Create(ctx context.Context, authorID, title, description string) (*Proposal, error) {
	title = strings.TrimSpace(title)
	description = strings.TrimSpace(description)
	if n := utf8.RuneCountInString(title); n < 3 || n > MaxTitleLen {
		return nil, ErrInvalidTitle
	}
	if utf8.RuneCountInString(description) > MaxDescriptionLen {
		return nil, ErrInvalidDescription
	}

	now := s.now()
	open, err := s.store.CountOpenByAuthor(ctx, authorID, now)
	if err != nil {
		return nil, err
	}
	if open >= MaxOpenPerUser {
		return nil, ErrTooManyOpen
	}

	id, err := s.store.Create(ctx, authorID, title, description, now.Add(VotingDuration))
	if err != nil {
		return nil, err
	}
	p, err := s.store.Get(ctx, id, &authorID)
	if err != nil {
		return nil, err
	}
	s.publish("proposal:create", id)
	return p, nil
}

// Vote registra ou troca o voto de quem está logado.
func (s *Service) Vote(ctx context.Context, id, userID string, approve bool) (*Proposal, error) {
	if _, err := s.store.Get(ctx, id, nil); err != nil {
		return nil, err
	}
	ok, err := s.store.UpsertVote(ctx, id, userID, approve, s.now())
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrVotingClosed
	}
	s.publish("proposal:update", id)
	return s.store.Get(ctx, id, &userID)
}

func (s *Service) RemoveVote(ctx context.Context, id, userID string) (*Proposal, error) {
	if _, err := s.store.Get(ctx, id, nil); err != nil {
		return nil, err
	}
	ok, err := s.store.DeleteVote(ctx, id, userID, s.now())
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrVotingClosed
	}
	s.publish("proposal:update", id)
	return s.store.Get(ctx, id, &userID)
}

// Delete: o autor remove enquanto está em votação; o time tech, a qualquer hora.
func (s *Service) Delete(ctx context.Context, id, userID string) error {
	p, err := s.store.Get(ctx, id, nil)
	if err != nil {
		return err
	}
	if !s.IsTech(userID) && (p.AuthorID != userID || p.Status != StatusVoting) {
		return ErrForbidden
	}
	if err := s.store.Delete(ctx, id); err != nil {
		return err
	}
	s.publish("proposal:delete", id)
	return nil
}

// nextStatus: o que o time tech pode mover a partir de cada coluna.
var nextStatus = map[string][]string{
	StatusProposed:   {StatusInProgress, StatusRejected},
	StatusInProgress: {StatusProposed, StatusDone, StatusRejected},
	StatusDone:       {StatusInProgress},
}

// SetStatus move o card depois da votação (só o time tech).
func (s *Service) SetStatus(ctx context.Context, id, userID, status string) (*Proposal, error) {
	if !s.IsTech(userID) {
		return nil, ErrForbidden
	}
	p, err := s.store.Get(ctx, id, nil)
	if err != nil {
		return nil, err
	}
	allowed := false
	for _, next := range nextStatus[p.Status] {
		if next == status {
			allowed = true
		}
	}
	if !allowed {
		return nil, ErrInvalidStatus
	}
	if err := s.store.SetStatus(ctx, id, status); err != nil {
		return nil, err
	}
	s.publish("proposal:update", id)
	return s.store.Get(ctx, id, &userID)
}

// Run fecha as votações vencidas e cria as issues que faltam até ctx acabar.
func (s *Service) Run(ctx context.Context) {
	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()
	for {
		s.Tick(ctx)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (s *Service) Tick(ctx context.Context) {
	ids, err := s.store.CloseDue(ctx, s.now())
	if err != nil {
		log.Printf("[proposal] close due: %v", err)
	}
	for _, id := range ids {
		s.publish("proposal:update", id)
	}
	s.createMissingIssues(ctx)
}

func (s *Service) createMissingIssues(ctx context.Context) {
	if s.issues == nil {
		return
	}
	pending, err := s.store.WithoutIssue(ctx)
	if err != nil {
		log.Printf("[proposal] list without issue: %v", err)
		return
	}
	for _, p := range pending {
		number, url, err := s.issues.CreateIssue(ctx, p)
		if err != nil {
			// Tenta de novo no próximo tick; o card já está em "proposto".
			log.Printf("[proposal] create issue for %s: %v", p.ID, err)
			continue
		}
		if err := s.store.SetIssue(ctx, p.ID, number, url); err != nil {
			log.Printf("[proposal] save issue for %s: %v", p.ID, err)
			continue
		}
		s.publish("proposal:update", p.ID)
	}
}

// publish manda o card atualizado a todos (sem my_vote: cada app mantém o seu).
func (s *Service) publish(typ, id string) {
	payload := any(map[string]string{"id": id})
	if typ != "proposal:delete" {
		p, err := s.store.Get(context.Background(), id, nil)
		if err != nil {
			log.Printf("[proposal] publish %s: %v", id, err)
			return
		}
		payload = p
	}
	data, err := json.Marshal(map[string]any{"type": typ, "payload": payload})
	if err != nil {
		return
	}
	s.publisher.BroadcastAll(data)
}
