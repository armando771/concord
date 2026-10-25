package proposal

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("proposal not found")

type Repository struct {
	db *pgxpool.Pool
}

func ProposalRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// $1 é quem está olhando (nulo nos eventos de tempo real: sem my_vote).
const selectProposal = `
	SELECT p.id, p.author_id, u.display_name, u.avatar_url, p.title, p.description,
		p.status, p.created_at, p.voting_ends_at, p.closed_at,
		p.github_issue_number, p.github_issue_url,
		(SELECT COUNT(*) FROM proposal_votes v WHERE v.proposal_id = p.id AND v.approve)::int,
		(SELECT COUNT(*) FROM proposal_votes v WHERE v.proposal_id = p.id AND NOT v.approve)::int,
		(SELECT v.approve FROM proposal_votes v WHERE v.proposal_id = p.id AND v.user_id = $1::uuid)
	FROM proposals p
	JOIN users u ON u.id = p.author_id
`

func scanProposal(row pgx.Row) (Proposal, error) {
	var p Proposal
	err := row.Scan(
		&p.ID, &p.AuthorID, &p.AuthorName, &p.AuthorAvatarURL, &p.Title, &p.Description,
		&p.Status, &p.CreatedAt, &p.VotingEndsAt, &p.ClosedAt,
		&p.GithubIssueNumber, &p.GithubIssueURL,
		&p.YesVotes, &p.NoVotes, &p.MyVote,
	)
	return p, err
}

func (r *Repository) query(ctx context.Context, viewerID *string, where string, args ...any) ([]Proposal, error) {
	rows, err := r.db.Query(ctx, selectProposal+where, append([]any{viewerID}, args...)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []Proposal{}
	for rows.Next() {
		p, err := scanProposal(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, p)
	}
	return list, rows.Err()
}

// List devolve o quadro inteiro: o que está em votação e o que o time tech
// ainda não concluiu, mais as recusadas e concluídas dos últimos 30 dias.
func (r *Repository) List(ctx context.Context, viewerID string) ([]Proposal, error) {
	return r.query(ctx, &viewerID, `
		WHERE p.status IN ('voting', 'proposed', 'in_progress')
		   OR p.closed_at > NOW() - INTERVAL '30 days'
		ORDER BY p.created_at DESC
		LIMIT 500`)
}

func (r *Repository) Get(ctx context.Context, id string, viewerID *string) (*Proposal, error) {
	list, err := r.query(ctx, viewerID, `WHERE p.id = $2::uuid`, id)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, ErrNotFound
	}
	return &list[0], nil
}

func (r *Repository) Create(ctx context.Context, authorID, title, description string, endsAt time.Time) (string, error) {
	var id string
	err := r.db.QueryRow(ctx, `
		INSERT INTO proposals (author_id, title, description, voting_ends_at)
		VALUES ($1, $2, $3, $4)
		RETURNING id`,
		authorID, title, description, endsAt,
	).Scan(&id)
	return id, err
}

func (r *Repository) CountOpenByAuthor(ctx context.Context, authorID string, now time.Time) (int, error) {
	var n int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM proposals
		WHERE author_id = $1 AND status = 'voting' AND voting_ends_at > $2`,
		authorID, now,
	).Scan(&n)
	return n, err
}

// UpsertVote grava ou troca o voto; false se a votação já fechou (a checagem
// fica no SQL para não depender do relógio do app entre o Get e o INSERT).
func (r *Repository) UpsertVote(ctx context.Context, id, userID string, approve bool, now time.Time) (bool, error) {
	tag, err := r.db.Exec(ctx, `
		INSERT INTO proposal_votes (proposal_id, user_id, approve)
		SELECT p.id, $2, $3 FROM proposals p
		WHERE p.id = $1 AND p.status = 'voting' AND p.voting_ends_at > $4
		ON CONFLICT (proposal_id, user_id) DO UPDATE SET approve = EXCLUDED.approve`,
		id, userID, approve, now,
	)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (r *Repository) DeleteVote(ctx context.Context, id, userID string, now time.Time) (bool, error) {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM proposal_votes v USING proposals p
		WHERE v.proposal_id = p.id AND p.id = $1 AND v.user_id = $2
		  AND p.status = 'voting' AND p.voting_ends_at > $3`,
		id, userID, now,
	)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (r *Repository) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM proposals WHERE id = $1`, id)
	return err
}

// SetStatus muda o status de uma proposta já fechada (time tech).
func (r *Repository) SetStatus(ctx context.Context, id, status string) error {
	tag, err := r.db.Exec(ctx, `UPDATE proposals SET status = $2 WHERE id = $1`, id, status)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// CloseDue fecha de uma vez as votações vencidas (aprovada vira proposed, o
// resto rejected) e devolve os ids. Um UPDATE só: seguro com reinício e com
// mais de uma instância.
func (r *Repository) CloseDue(ctx context.Context, now time.Time) ([]string, error) {
	rows, err := r.db.Query(ctx, `
		UPDATE proposals p SET
			status = CASE WHEN
				(SELECT COUNT(*) FROM proposal_votes v WHERE v.proposal_id = p.id AND v.approve)
				> (SELECT COUNT(*) FROM proposal_votes v WHERE v.proposal_id = p.id AND NOT v.approve)
				THEN 'proposed' ELSE 'rejected' END,
			closed_at = $1
		WHERE p.status = 'voting' AND p.voting_ends_at <= $1
		RETURNING p.id`,
		now,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// WithoutIssue lista as propostas aprovadas que ainda não têm issue (a criação
// falhou ou não havia token na hora).
func (r *Repository) WithoutIssue(ctx context.Context) ([]Proposal, error) {
	return r.query(ctx, nil, `
		WHERE p.status IN ('proposed', 'in_progress', 'done') AND p.github_issue_url IS NULL
		ORDER BY p.closed_at
		LIMIT 20`)
}

func (r *Repository) SetIssue(ctx context.Context, id string, number int, url string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE proposals SET github_issue_number = $2, github_issue_url = $3 WHERE id = $1`,
		id, number, url,
	)
	return err
}
