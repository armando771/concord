package proposal

import (
	"context"
	"encoding/json"
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
		p.status, p.created_at, p.voting_ends_at, p.closed_at, p.moved_at, p.close_reason,
		(SELECT cu.display_name FROM users cu WHERE cu.id = p.closed_by), p.edited_at,
		p.github_issue_number, p.github_issue_url,
		(SELECT COUNT(*) FROM proposal_votes v WHERE v.proposal_id = p.id AND v.approve)::int,
		(SELECT COUNT(*) FROM proposal_votes v WHERE v.proposal_id = p.id AND NOT v.approve)::int,
		(SELECT COUNT(*) FROM proposal_comments c WHERE c.proposal_id = p.id)::int,
		COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'content_type', i.content_type)
			ORDER BY i.position, i.created_at)
			FROM proposal_images i WHERE i.proposal_id = p.id), '[]'::jsonb),
		(SELECT v.approve FROM proposal_votes v WHERE v.proposal_id = p.id AND v.user_id = $1::uuid)
	FROM proposals p
	JOIN users u ON u.id = p.author_id
`

func scanProposal(row pgx.Row) (Proposal, error) {
	var p Proposal
	var images []byte
	err := row.Scan(
		&p.ID, &p.AuthorID, &p.AuthorName, &p.AuthorAvatarURL, &p.Title, &p.Description,
		&p.Status, &p.CreatedAt, &p.VotingEndsAt, &p.ClosedAt, &p.MovedAt, &p.CloseReason,
		&p.ClosedByName, &p.EditedAt,
		&p.GithubIssueNumber, &p.GithubIssueURL,
		&p.YesVotes, &p.NoVotes, &p.CommentCount, &images, &p.MyVote,
	)
	if err != nil {
		return p, err
	}
	p.Images = []Image{}
	if err := json.Unmarshal(images, &p.Images); err != nil {
		return p, err
	}
	for i := range p.Images {
		p.Images[i].URL = imageURL(p.Images[i].ID)
	}
	return p, nil
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
		   OR p.moved_at > NOW() - INTERVAL '30 days'
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

// CreateWithLimit cria a proposta e anexa as imagens numa transação só. O
// advisory lock por autor serializa as criações dele: sem ele, dois pedidos ao
// mesmo tempo passariam da conta e ultrapassariam o limite.
func (r *Repository) CreateWithLimit(ctx context.Context, authorID, title, description string, endsAt, now time.Time, max int, imageIDs []string) (string, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, "proposal:"+authorID); err != nil {
		return "", err
	}
	var open int
	if err := tx.QueryRow(ctx, `
		SELECT COUNT(*) FROM proposals
		WHERE author_id = $1 AND status = 'voting' AND voting_ends_at > $2`,
		authorID, now,
	).Scan(&open); err != nil {
		return "", err
	}
	if open >= max {
		return "", ErrTooManyOpen
	}
	var id string
	if err := tx.QueryRow(ctx, `
		INSERT INTO proposals (author_id, title, description, voting_ends_at)
		VALUES ($1, $2, $3, $4)
		RETURNING id`,
		authorID, title, description, endsAt,
	).Scan(&id); err != nil {
		return "", err
	}
	if _, err := attachImages(ctx, tx, id, authorID, imageIDs); err != nil {
		return "", err
	}
	return id, tx.Commit(ctx)
}

// attachImages deixa o card com exatamente imageIDs, na ordem dada. Valem as
// imagens que já são dele e as pendentes de uploaderID; qualquer outra id
// devolve ErrInvalidImage. Devolve as ids que saíram do card (já removidas do
// banco) para o chamador apagar os arquivos.
func attachImages(ctx context.Context, tx pgx.Tx, proposalID, uploaderID string, imageIDs []string) ([]string, error) {
	if imageIDs == nil {
		imageIDs = []string{} // NULL no ANY() não removeria nada
	}
	rows, err := tx.Query(ctx, `
		DELETE FROM proposal_images
		WHERE proposal_id = $1 AND NOT (id = ANY($2::uuid[]))
		RETURNING id`, proposalID, imageIDs)
	if err != nil {
		return nil, err
	}
	var removed []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, err
		}
		removed = append(removed, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for pos, id := range imageIDs {
		tag, err := tx.Exec(ctx, `
			UPDATE proposal_images SET proposal_id = $1, position = $3
			WHERE id = $2 AND (proposal_id = $1 OR (proposal_id IS NULL AND uploader_id = $4))`,
			proposalID, id, pos, uploaderID)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, ErrInvalidImage
		}
	}
	return removed, nil
}

// Update troca título, descrição e imagens do card e marca a edição.
func (r *Repository) Update(ctx context.Context, id, editorID, title, description string, imageIDs []string) ([]string, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `
		UPDATE proposals SET title = $2, description = $3, edited_at = NOW() WHERE id = $1`,
		id, title, description)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	removed, err := attachImages(ctx, tx, id, editorID, imageIDs)
	if err != nil {
		return nil, err
	}
	return removed, tx.Commit(ctx)
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

// SetStatus move o card (time tech), inclusive antes do fim da votação: o
// fechamento é marcado agora se ainda não foi, com quem encerrou. No UPDATE os
// valores à direita são os da linha antiga, então status = 'voting' vale como
// "estava em votação".
func (r *Repository) SetStatus(ctx context.Context, id, userID, status string) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE proposals SET
			closed_by = CASE WHEN status = 'voting' THEN $3::uuid ELSE closed_by END,
			close_reason = CASE WHEN status = 'voting' THEN 'manual' ELSE close_reason END,
			closed_at = COALESCE(closed_at, NOW()),
			moved_at = NOW(),
			status = $2
		WHERE id = $1`,
		id, status, userID)
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
			closed_at = $1,
			moved_at = $1,
			close_reason = 'deadline'
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

// --- imagens ---

// CreateImage registra uma imagem pendente (o arquivo já está no disco).
func (r *Repository) CreateImage(ctx context.Context, id, uploaderID, contentType string, size int64) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO proposal_images (id, uploader_id, content_type, size) VALUES ($1, $2, $3, $4)`,
		id, uploaderID, contentType, size)
	return err
}

// ImageIDs lista as imagens do card (para apagar os arquivos antes do DELETE).
func (r *Repository) ImageIDs(ctx context.Context, proposalID string) ([]string, error) {
	rows, err := r.db.Query(ctx, `SELECT id FROM proposal_images WHERE proposal_id = $1`, proposalID)
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

// ImageContentType devolve o tipo guardado de uma imagem do card ou pendente.
func (r *Repository) ImageContentType(ctx context.Context, id string) (string, error) {
	var contentType string
	err := r.db.QueryRow(ctx, `SELECT content_type FROM proposal_images WHERE id = $1`, id).Scan(&contentType)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return contentType, err
}

// DeletePendingImages remove as imagens pendentes anteriores a cutoff e devolve
// as ids para o chamador apagar os arquivos.
func (r *Repository) DeletePendingImages(ctx context.Context, cutoff time.Time) ([]string, error) {
	rows, err := r.db.Query(ctx, `
		DELETE FROM proposal_images WHERE proposal_id IS NULL AND created_at < $1 RETURNING id`, cutoff)
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

// --- comentários ---

const selectComment = `
	SELECT c.id, c.proposal_id, c.author_id, u.display_name, u.avatar_url,
		c.body, c.created_at, c.edited_at,
		COALESCE((SELECT jsonb_agg(jsonb_build_object('id', m.user_id, 'username', mu.username,
			'display_name', mu.display_name) ORDER BY mu.username)
			FROM proposal_comment_mentions m JOIN users mu ON mu.id = m.user_id
			WHERE m.comment_id = c.id), '[]'::jsonb)
	FROM proposal_comments c
	JOIN users u ON u.id = c.author_id
`

func scanComment(row pgx.Row) (Comment, error) {
	var c Comment
	var mentions []byte
	if err := row.Scan(&c.ID, &c.ProposalID, &c.AuthorID, &c.AuthorName, &c.AuthorAvatarURL,
		&c.Body, &c.CreatedAt, &c.EditedAt, &mentions); err != nil {
		return c, err
	}
	c.Mentions = []Mention{}
	return c, json.Unmarshal(mentions, &c.Mentions)
}

func (r *Repository) ListComments(ctx context.Context, proposalID string) ([]Comment, error) {
	rows, err := r.db.Query(ctx, selectComment+`WHERE c.proposal_id = $1 ORDER BY c.created_at, c.id LIMIT 500`, proposalID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []Comment{}
	for rows.Next() {
		c, err := scanComment(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, rows.Err()
}

func (r *Repository) GetComment(ctx context.Context, id string) (*Comment, error) {
	c, err := scanComment(r.db.QueryRow(ctx, selectComment+`WHERE c.id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrCommentNotFound
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// CreateComment grava o comentário e as menções (já validadas) juntos.
func (r *Repository) CreateComment(ctx context.Context, proposalID, authorID, body string, mentionIDs []string) (string, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var id string
	if err := tx.QueryRow(ctx, `
		INSERT INTO proposal_comments (proposal_id, author_id, body) VALUES ($1, $2, $3) RETURNING id`,
		proposalID, authorID, body).Scan(&id); err != nil {
		return "", err
	}
	for _, uid := range mentionIDs {
		if _, err := tx.Exec(ctx, `
			INSERT INTO proposal_comment_mentions (comment_id, user_id) VALUES ($1, $2)
			ON CONFLICT DO NOTHING`, id, uid); err != nil {
			return "", err
		}
	}
	return id, tx.Commit(ctx)
}

func (r *Repository) UpdateComment(ctx context.Context, id, body string) error {
	tag, err := r.db.Exec(ctx, `UPDATE proposal_comments SET body = $2, edited_at = NOW() WHERE id = $1`, id, body)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrCommentNotFound
	}
	return nil
}

func (r *Repository) DeleteComment(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM proposal_comments WHERE id = $1`, id)
	return err
}

// CountRecentComments conta os comentários da pessoa desde since (limite de spam).
func (r *Repository) CountRecentComments(ctx context.Context, authorID string, since time.Time) (int, error) {
	var n int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM proposal_comments WHERE author_id = $1 AND created_at > $2`,
		authorID, since).Scan(&n)
	return n, err
}

// --- menções ---

// MentionableUsers devolve, entre ids, quem existe e pode ser marcado por
// authorID: nem ele mesmo, nem quem bloqueou ele ou foi bloqueado por ele.
func (r *Repository) MentionableUsers(ctx context.Context, authorID string, ids []string) ([]string, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	rows, err := r.db.Query(ctx, `
		SELECT u.id FROM users u
		WHERE u.id = ANY($1::uuid[]) AND u.id <> $2
		  AND NOT EXISTS (
			SELECT 1 FROM user_blocks b
			WHERE (b.blocker_id = $2 AND b.blocked_id = u.id)
			   OR (b.blocker_id = u.id AND b.blocked_id = $2))`, ids, authorID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// UnseenMentions lista as menções que userID ainda não viu, da mais nova.
func (r *Repository) UnseenMentions(ctx context.Context, userID string) ([]PendingMention, error) {
	rows, err := r.db.Query(ctx, `
		SELECT c.proposal_id, c.id, p.title, u.display_name, c.body, c.created_at
		FROM proposal_comment_mentions m
		JOIN proposal_comments c ON c.id = m.comment_id
		JOIN proposals p ON p.id = c.proposal_id
		JOIN users u ON u.id = c.author_id
		WHERE m.user_id = $1 AND m.seen_at IS NULL
		ORDER BY c.created_at DESC
		LIMIT 100`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []PendingMention{}
	for rows.Next() {
		var m PendingMention
		if err := rows.Scan(&m.ProposalID, &m.CommentID, &m.ProposalTitle, &m.AuthorName, &m.Snippet, &m.CreatedAt); err != nil {
			return nil, err
		}
		m.Snippet = snippet(m.Snippet)
		list = append(list, m)
	}
	return list, rows.Err()
}

// MarkMentionsSeen marca como vistas as menções de userID: as de uma proposta
// ou, com proposalID nulo, todas.
func (r *Repository) MarkMentionsSeen(ctx context.Context, userID string, proposalID *string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE proposal_comment_mentions m SET seen_at = NOW()
		FROM proposal_comments c
		WHERE c.id = m.comment_id AND m.user_id = $1 AND m.seen_at IS NULL
		  AND ($2::uuid IS NULL OR c.proposal_id = $2::uuid)`, userID, proposalID)
	return err
}
