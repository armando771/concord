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
)

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
	GithubIssueNumber *int       `json:"github_issue_number,omitempty"`
	GithubIssueURL    *string    `json:"github_issue_url,omitempty"`
	YesVotes          int        `json:"yes_votes"`
	NoVotes           int        `json:"no_votes"`
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
