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
	ErrInvalidImage       = errors.New("invalid image")
	ErrInvalidComment     = errors.New("invalid comment")
	ErrTooManyOpen        = errors.New("too many open proposals")
	ErrVotingClosed       = errors.New("voting closed")
	ErrForbidden          = errors.New("forbidden")
	ErrInvalidStatus      = errors.New("invalid status")
	ErrCommentNotFound    = errors.New("comment not found")
	ErrRateLimited        = errors.New("too many comments")
)

// Intervalo do fechamento das votações e das novas tentativas de issue.
const tickInterval = time.Minute

type store interface {
	List(ctx context.Context, viewerID string) ([]Proposal, error)
	Get(ctx context.Context, id string, viewerID *string) (*Proposal, error)
	CreateWithLimit(ctx context.Context, authorID, title, description string, endsAt, now time.Time, max int, imageIDs []string) (string, error)
	Update(ctx context.Context, id, editorID, title, description string, imageIDs []string) (removedImages []string, err error)
	UpsertVote(ctx context.Context, id, userID string, approve bool, now time.Time) (bool, error)
	DeleteVote(ctx context.Context, id, userID string, now time.Time) (bool, error)
	Delete(ctx context.Context, id string) error
	SetStatus(ctx context.Context, id, userID, status string) error
	CloseDue(ctx context.Context, now time.Time) ([]string, error)
	WithoutIssue(ctx context.Context) ([]Proposal, error)
	SetIssue(ctx context.Context, id string, number int, url string) error

	CreateImage(ctx context.Context, id, uploaderID, contentType string, size int64) error
	ImageIDs(ctx context.Context, proposalID string) ([]string, error)
	ImageContentType(ctx context.Context, id string) (string, error)
	DeletePendingImages(ctx context.Context, cutoff time.Time) ([]string, error)

	ListComments(ctx context.Context, proposalID string) ([]Comment, error)
	GetComment(ctx context.Context, id string) (*Comment, error)
	CreateComment(ctx context.Context, proposalID, authorID, body string, mentionIDs []string) (string, error)
	UpdateComment(ctx context.Context, id, body string) error
	DeleteComment(ctx context.Context, id string) error
	CountRecentComments(ctx context.Context, authorID string, since time.Time) (int, error)

	MentionableUsers(ctx context.Context, authorID string, ids []string) ([]string, error)
	UnseenMentions(ctx context.Context, userID string) ([]PendingMention, error)
	MarkMentionsSeen(ctx context.Context, userID string, proposalID *string) error
}

type EventPublisher interface {
	BroadcastAll(event []byte)
	SendToUser(userID string, event []byte)
}

// fileRemover apaga o arquivo de uma imagem (media.Store).
type fileRemover interface {
	Remove(name string) error
}

type Service struct {
	store     store
	publisher EventPublisher
	issues    IssueCreator // nil: sem token do GitHub, não cria issue
	files     fileRemover  // nil: não apaga arquivos (testes)
	tech      map[string]bool
	now       func() time.Time
}

// ProposalService: techIDs são os usuários do time tech (TECH_TEAM_USER_IDS).
// files apaga os arquivos das imagens quando elas saem do banco.
func ProposalService(repository *Repository, publisher EventPublisher, issues IssueCreator, files fileRemover, techIDs []string) *Service {
	s := newService(repository, publisher, issues, techIDs)
	s.files = files
	return s
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

// validateContent confere título, descrição e a quantidade de imagens.
func validateContent(title, description string, imageIDs []string) (string, string, error) {
	title = strings.TrimSpace(title)
	description = strings.TrimSpace(description)
	if n := utf8.RuneCountInString(title); n < 3 || n > MaxTitleLen {
		return "", "", ErrInvalidTitle
	}
	if utf8.RuneCountInString(description) > MaxDescriptionLen {
		return "", "", ErrInvalidDescription
	}
	if len(imageIDs) > MaxImagesPerProposal {
		return "", "", ErrInvalidImage
	}
	seen := make(map[string]bool, len(imageIDs))
	for _, id := range imageIDs {
		if seen[id] {
			return "", "", ErrInvalidImage
		}
		seen[id] = true
	}
	return title, description, nil
}

func (s *Service) Create(ctx context.Context, authorID, title, description string, imageIDs []string) (*Proposal, error) {
	title, description, err := validateContent(title, description, imageIDs)
	if err != nil {
		return nil, err
	}

	now := s.now()
	id, err := s.store.CreateWithLimit(ctx, authorID, title, description, now.Add(VotingDuration), now, MaxOpenPerUser, imageIDs)
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

// Update edita título, descrição e imagens: o time tech a qualquer hora, o
// autor só enquanto a votação está aberta.
func (s *Service) Update(ctx context.Context, id, userID, title, description string, imageIDs []string) (*Proposal, error) {
	p, err := s.store.Get(ctx, id, nil)
	if err != nil {
		return nil, err
	}
	if !s.IsTech(userID) && (p.AuthorID != userID || !p.IsOpen(s.now())) {
		return nil, ErrForbidden
	}
	title, description, err = validateContent(title, description, imageIDs)
	if err != nil {
		return nil, err
	}
	removed, err := s.store.Update(ctx, id, userID, title, description, imageIDs)
	if err != nil {
		return nil, err
	}
	s.removeFiles(removed)
	s.publish("proposal:update", id)
	return s.store.Get(ctx, id, &userID)
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
	images, err := s.store.ImageIDs(ctx, id)
	if err != nil {
		return err
	}
	if err := s.store.Delete(ctx, id); err != nil {
		return err
	}
	s.removeFiles(images)
	s.publish("proposal:delete", id)
	return nil
}

// validStatus: os status para onde o time tech pode mover um card. "voting"
// fica de fora: a votação só começa na criação e acaba no fechamento.
var validStatus = map[string]bool{
	StatusProposed:   true,
	StatusInProgress: true,
	StatusDone:       true,
	StatusRejected:   true,
}

// SetStatus move o card para qualquer coluna, a qualquer hora (só o time tech).
// Indo para uma coluna aprovada, a issue do GitHub sai na hora.
func (s *Service) SetStatus(ctx context.Context, id, userID, status string) (*Proposal, error) {
	if !s.IsTech(userID) {
		return nil, ErrForbidden
	}
	if !validStatus[status] {
		return nil, ErrInvalidStatus
	}
	p, err := s.store.Get(ctx, id, nil)
	if err != nil {
		return nil, err
	}
	if p.Status == status {
		return nil, ErrInvalidStatus
	}
	if err := s.store.SetStatus(ctx, id, userID, status); err != nil {
		return nil, err
	}
	if status != StatusRejected {
		if moved, err := s.store.Get(ctx, id, nil); err == nil {
			s.ensureIssue(ctx, *moved)
		}
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
	s.cleanPendingImages(ctx)
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
		s.ensureIssue(ctx, p)
	}
}

// ensureIssue abre a issue do card se ainda não tem. Falha (sem token ou erro
// do GitHub) só é registrada: o Tick tenta de novo, o card já está movido.
func (s *Service) ensureIssue(ctx context.Context, p Proposal) {
	if s.issues == nil || p.GithubIssueURL != nil {
		return
	}
	number, url, err := s.issues.CreateIssue(ctx, p)
	if err != nil {
		log.Printf("[proposal] create issue for %s: %v", p.ID, err)
		return
	}
	if err := s.store.SetIssue(ctx, p.ID, number, url); err != nil {
		log.Printf("[proposal] save issue for %s: %v", p.ID, err)
		return
	}
	s.publish("proposal:update", p.ID)
}

// cleanPendingImages apaga as imagens enviadas e nunca anexadas a um card.
func (s *Service) cleanPendingImages(ctx context.Context) {
	ids, err := s.store.DeletePendingImages(ctx, s.now().Add(-PendingImageTTL))
	if err != nil {
		log.Printf("[proposal] clean pending images: %v", err)
		return
	}
	s.removeFiles(ids)
}

func (s *Service) removeFiles(ids []string) {
	if s.files == nil {
		return
	}
	for _, id := range ids {
		if err := s.files.Remove(id); err != nil {
			log.Printf("[proposal] remove image %s: %v", id, err)
		}
	}
}

// RegisterImage guarda a imagem pendente de quem enviou.
func (s *Service) RegisterImage(ctx context.Context, id, uploaderID, contentType string, size int64) error {
	return s.store.CreateImage(ctx, id, uploaderID, contentType, size)
}

// ImageContentType: o tipo guardado da imagem (para servir o arquivo).
func (s *Service) ImageContentType(ctx context.Context, id string) (string, error) {
	return s.store.ImageContentType(ctx, id)
}

// --- comentários ---

func (s *Service) Comments(ctx context.Context, proposalID string) ([]Comment, error) {
	if _, err := s.store.Get(ctx, proposalID, nil); err != nil {
		return nil, err
	}
	return s.store.ListComments(ctx, proposalID)
}

func cleanComment(body string) (string, error) {
	body = strings.TrimSpace(body)
	if n := utf8.RuneCountInString(body); n == 0 || n > MaxCommentLen {
		return "", ErrInvalidComment
	}
	return body, nil
}

// AddComment grava o comentário e avisa quem foi marcado (mentionIDs vêm do
// autocomplete; descartamos o que não existe, é o próprio autor ou tem bloqueio).
func (s *Service) AddComment(ctx context.Context, proposalID, authorID, body string, mentionIDs []string) (*Comment, error) {
	body, err := cleanComment(body)
	if err != nil {
		return nil, err
	}
	if len(mentionIDs) > MaxMentionsPerComment {
		return nil, ErrInvalidComment
	}
	p, err := s.store.Get(ctx, proposalID, nil)
	if err != nil {
		return nil, err
	}
	recent, err := s.store.CountRecentComments(ctx, authorID, s.now().Add(-time.Minute))
	if err != nil {
		return nil, err
	}
	if recent >= CommentsPerMinute {
		return nil, ErrRateLimited
	}
	targets, err := s.store.MentionableUsers(ctx, authorID, mentionIDs)
	if err != nil {
		return nil, err
	}
	id, err := s.store.CreateComment(ctx, proposalID, authorID, body, targets)
	if err != nil {
		return nil, err
	}
	c, err := s.store.GetComment(ctx, id)
	if err != nil {
		return nil, err
	}
	s.broadcast("proposal:comment_create", c)
	s.publish("proposal:update", proposalID)
	for _, uid := range targets {
		s.sendToUser(uid, "proposal:mention", PendingMention{
			ProposalID:    proposalID,
			CommentID:     c.ID,
			ProposalTitle: p.Title,
			AuthorName:    c.AuthorName,
			Snippet:       snippet(c.Body),
			CreatedAt:     c.CreatedAt,
		})
	}
	return c, nil
}

// EditComment: só o autor do comentário edita. Menções não mudam nem avisam de novo.
func (s *Service) EditComment(ctx context.Context, proposalID, commentID, userID, body string) (*Comment, error) {
	c, err := s.commentOf(ctx, proposalID, commentID)
	if err != nil {
		return nil, err
	}
	if c.AuthorID != userID {
		return nil, ErrForbidden
	}
	body, err = cleanComment(body)
	if err != nil {
		return nil, err
	}
	if err := s.store.UpdateComment(ctx, commentID, body); err != nil {
		return nil, err
	}
	updated, err := s.store.GetComment(ctx, commentID)
	if err != nil {
		return nil, err
	}
	s.broadcast("proposal:comment_update", updated)
	return updated, nil
}

// DeleteComment: o autor do comentário ou o time tech.
func (s *Service) DeleteComment(ctx context.Context, proposalID, commentID, userID string) error {
	c, err := s.commentOf(ctx, proposalID, commentID)
	if err != nil {
		return err
	}
	if c.AuthorID != userID && !s.IsTech(userID) {
		return ErrForbidden
	}
	if err := s.store.DeleteComment(ctx, commentID); err != nil {
		return err
	}
	s.broadcast("proposal:comment_delete", map[string]string{"id": commentID, "proposal_id": proposalID})
	s.publish("proposal:update", proposalID)
	return nil
}

// commentOf devolve o comentário se ele é mesmo da proposta da rota.
func (s *Service) commentOf(ctx context.Context, proposalID, commentID string) (*Comment, error) {
	c, err := s.store.GetComment(ctx, commentID)
	if err != nil {
		return nil, err
	}
	if c.ProposalID != proposalID {
		return nil, ErrCommentNotFound
	}
	return c, nil
}

// PendingMentions lista as menções que a pessoa ainda não viu.
func (s *Service) PendingMentions(ctx context.Context, userID string) ([]PendingMention, error) {
	return s.store.UnseenMentions(ctx, userID)
}

// MarkMentionsSeen: de uma proposta, ou de todas quando proposalID é nulo.
func (s *Service) MarkMentionsSeen(ctx context.Context, userID string, proposalID *string) error {
	return s.store.MarkMentionsSeen(ctx, userID, proposalID)
}

// snippet resume o corpo do comentário para a notificação.
func snippet(body string) string {
	const max = 100
	body = strings.Join(strings.Fields(body), " ")
	if utf8.RuneCountInString(body) <= max {
		return body
	}
	return string([]rune(body)[:max]) + "…"
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
	s.broadcast(typ, payload)
}

func (s *Service) broadcast(typ string, payload any) {
	data, err := json.Marshal(map[string]any{"type": typ, "payload": payload})
	if err != nil {
		return
	}
	s.publisher.BroadcastAll(data)
}

func (s *Service) sendToUser(userID, typ string, payload any) {
	data, err := json.Marshal(map[string]any{"type": typ, "payload": payload})
	if err != nil {
		return
	}
	s.publisher.SendToUser(userID, data)
}
