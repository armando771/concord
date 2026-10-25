package proposal

import "time"

const (
	StatusVoting     = "voting"
	StatusProposed   = "proposed"
	StatusInProgress = "in_progress"
	StatusDone       = "done"
	StatusRejected   = "rejected"
)

// VotingDuration é quanto tempo uma proposta fica em votação.
const VotingDuration = 7 * 24 * time.Hour

// MaxOpenPerUser limita as propostas em votação ao mesmo tempo por pessoa.
const MaxOpenPerUser = 3

const (
	MaxTitleLen       = 120
	MaxDescriptionLen = 2000
	MaxCommentLen     = 1000

	MaxImagesPerProposal  = 4
	MaxMentionsPerComment = 10
	// MaxImageBytes é o limite de cada imagem anexada (o app usa o mesmo número).
	MaxImageBytes int64 = 8 << 20
	// PendingImageTTL: quanto tempo uma imagem enviada pode ficar sem card.
	PendingImageTTL = 24 * time.Hour
	// CommentsPerMinute limita o spam de comentários por pessoa.
	CommentsPerMinute = 10
)

// ImagesDir é a subpasta dos uploads onde ficam as imagens das propostas, fora
// da raiz que a limpeza dos anexos do chat varre.
const ImagesDir = "proposals"

const imagePath = "/api/proposal-media/"

// Image é uma imagem anexada a uma proposta.
type Image struct {
	ID          string `json:"id"`
	URL         string `json:"url"`
	ContentType string `json:"content_type"`
}

func imageURL(id string) string { return imagePath + id }

// Mention é uma pessoa marcada num comentário.
type Mention struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
}

// Comment é um comentário de um card.
type Comment struct {
	ID              string     `json:"id"`
	ProposalID      string     `json:"proposal_id"`
	AuthorID        string     `json:"author_id"`
	AuthorName      string     `json:"author_name"`
	AuthorAvatarURL *string    `json:"author_avatar_url,omitempty"`
	Body            string     `json:"body"`
	CreatedAt       time.Time  `json:"created_at"`
	EditedAt        *time.Time `json:"edited_at,omitempty"`
	Mentions        []Mention  `json:"mentions"`
}

// PendingMention é uma menção ainda não vista (GET /proposals/mentions).
type PendingMention struct {
	ProposalID    string    `json:"proposal_id"`
	CommentID     string    `json:"comment_id"`
	ProposalTitle string    `json:"proposal_title"`
	AuthorName    string    `json:"author_name"`
	Snippet       string    `json:"snippet"`
	CreatedAt     time.Time `json:"created_at"`
}

// Proposal é um card do quadro.
type Proposal struct {
	ID                string     `json:"id"`
	AuthorID          string     `json:"author_id"`
	AuthorName        string     `json:"author_name"`
	AuthorAvatarURL   *string    `json:"author_avatar_url,omitempty"`
	Title             string     `json:"title"`
	Description       string     `json:"description"`
	Status            string     `json:"status"`
	CreatedAt         time.Time  `json:"created_at"`
	VotingEndsAt      time.Time  `json:"voting_ends_at"`
	ClosedAt          *time.Time `json:"closed_at,omitempty"`
	EditedAt          *time.Time `json:"edited_at,omitempty"`
	GithubIssueNumber *int       `json:"github_issue_number,omitempty"`
	GithubIssueURL    *string    `json:"github_issue_url,omitempty"`
	YesVotes          int        `json:"yes_votes"`
	NoVotes           int        `json:"no_votes"`
	CommentCount      int        `json:"comment_count"`
	Images            []Image    `json:"images"`
	// MyVote: true = sim, false = não, nulo = ainda não votou. Preenchido só
	// nas respostas para a própria pessoa (não vai no evento de tempo real).
	MyVote *bool `json:"my_vote,omitempty"`
}

// Board é a resposta de GET /proposals.
type Board struct {
	Proposals []Proposal `json:"proposals"`
	// IsTech: a pessoa pode mover os cards do time tech.
	IsTech bool `json:"is_tech"`
}

// Approved: o sim precisa ganhar do não (empate e zero voto rejeitam).
func (p Proposal) Approved() bool { return p.YesVotes > p.NoVotes }

// IsOpen diz se ainda dá para votar.
func (p Proposal) IsOpen(now time.Time) bool {
	return p.Status == StatusVoting && now.Before(p.VotingEndsAt)
}
