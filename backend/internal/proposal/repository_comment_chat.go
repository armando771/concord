package proposal

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// --- reações ---

// AddCommentReaction registra a reação (idempotente: repetir não muda nada).
// Um emoji novo só entra se o comentário ainda não tem MaxReactionEmojisPerComment
// emojis diferentes; senão devolve ErrTooManyReactions.
func (r *Repository) AddCommentReaction(ctx context.Context, commentID, userID, emoji string) error {
	tag, err := r.db.Exec(ctx, `
		INSERT INTO proposal_comment_reactions (comment_id, user_id, emoji)
		SELECT $1::uuid, $2::uuid, $3
		WHERE EXISTS (SELECT 1 FROM proposal_comment_reactions WHERE comment_id = $1::uuid AND emoji = $3)
		   OR (SELECT COUNT(DISTINCT emoji) FROM proposal_comment_reactions WHERE comment_id = $1::uuid) < $4
		ON CONFLICT DO NOTHING`,
		commentID, userID, emoji, MaxReactionEmojisPerComment)
	if err != nil {
		return err
	}
	if tag.RowsAffected() > 0 {
		return nil
	}
	// Nada gravado: ou a pessoa já tinha reagido (ok), ou o limite de emojis barrou.
	var had bool
	if err := r.db.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM proposal_comment_reactions
			WHERE comment_id = $1 AND user_id = $2 AND emoji = $3)`,
		commentID, userID, emoji).Scan(&had); err != nil {
		return err
	}
	if !had {
		return ErrTooManyReactions
	}
	return nil
}

func (r *Repository) RemoveCommentReaction(ctx context.Context, commentID, userID, emoji string) error {
	_, err := r.db.Exec(ctx, `
		DELETE FROM proposal_comment_reactions WHERE comment_id = $1 AND user_id = $2 AND emoji = $3`,
		commentID, userID, emoji)
	return err
}

// --- anexos ---

// CreateCommentAttachment registra um anexo pendente (o arquivo já está no disco).
func (r *Repository) CreateCommentAttachment(ctx context.Context, a CommentAttachmentRow) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO proposal_comment_attachments
			(id, uploader_id, kind, content_type, filename, size_bytes, width, height, duration_ms)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		a.ID, a.UploaderID, a.Kind, a.ContentType, a.Filename, a.SizeBytes, a.Width, a.Height, a.DurationMs)
	return err
}

// CommentAttachmentMeta devolve o tipo guardado de um anexo (para servir o arquivo).
func (r *Repository) CommentAttachmentMeta(ctx context.Context, id string) (kind, contentType string, err error) {
	err = r.db.QueryRow(ctx, `
		SELECT kind, content_type FROM proposal_comment_attachments WHERE id = $1`, id).Scan(&kind, &contentType)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", ErrNotFound
	}
	return kind, contentType, err
}

// CommentAttachmentIDs lista os anexos de um comentário (para apagar os
// arquivos antes do DELETE em cascata).
func (r *Repository) CommentAttachmentIDs(ctx context.Context, commentID string) ([]string, error) {
	return r.ids(ctx, `SELECT id FROM proposal_comment_attachments WHERE comment_id = $1`, commentID)
}

// ProposalCommentAttachmentIDs lista os anexos de todos os comentários da proposta.
func (r *Repository) ProposalCommentAttachmentIDs(ctx context.Context, proposalID string) ([]string, error) {
	return r.ids(ctx, `
		SELECT a.id FROM proposal_comment_attachments a
		JOIN proposal_comments c ON c.id = a.comment_id
		WHERE c.proposal_id = $1`, proposalID)
}

// DeletePendingCommentAttachments remove os anexos pendentes anteriores a
// cutoff e devolve as ids para o chamador apagar os arquivos.
func (r *Repository) DeletePendingCommentAttachments(ctx context.Context, cutoff time.Time) ([]string, error) {
	return r.ids(ctx, `
		DELETE FROM proposal_comment_attachments WHERE comment_id IS NULL AND created_at < $1 RETURNING id`, cutoff)
}

func (r *Repository) ids(ctx context.Context, sql string, args ...any) ([]string, error) {
	rows, err := r.db.Query(ctx, sql, args...)
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
