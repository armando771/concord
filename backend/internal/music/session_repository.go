package music

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SessionRepository guarda as sessões do Maestro (migration 000167).
type SessionRepository struct {
	db *pgxpool.Pool
}

func NewSessionRepository(db *pgxpool.Pool) *SessionRepository {
	return &SessionRepository{db: db}
}

// Save grava (ou troca) a sessão do canal.
func (r *SessionRepository) Save(ctx context.Context, s Session) error {
	now, queue := encodeSessionItems(s)
	_, err := r.db.Exec(ctx, `
		INSERT INTO music_sessions (channel_id, server_id, call_id, text_channel_id, now_item, position_ms, queue, saved_at)
		VALUES ($1, $2, $3, NULLIF($4, '')::uuid, NULLIF($5::jsonb, 'null'::jsonb), $6, $7::jsonb, $8)
		ON CONFLICT (channel_id) DO UPDATE SET
			server_id = EXCLUDED.server_id, call_id = EXCLUDED.call_id,
			text_channel_id = EXCLUDED.text_channel_id, now_item = EXCLUDED.now_item,
			position_ms = EXCLUDED.position_ms, queue = EXCLUDED.queue, saved_at = EXCLUDED.saved_at`,
		s.ChannelID, s.ServerID, s.CallID, s.TextChannelID, now, s.Position.Milliseconds(), queue, s.SavedAt)
	if err != nil {
		return fmt.Errorf("gravar sessão do maestro: %w", err)
	}
	return nil
}

func (r *SessionRepository) Delete(ctx context.Context, channelID string) error {
	if _, err := r.db.Exec(ctx, `DELETE FROM music_sessions WHERE channel_id = $1`, channelID); err != nil {
		return fmt.Errorf("apagar sessão do maestro: %w", err)
	}
	return nil
}

func (r *SessionRepository) List(ctx context.Context) ([]Session, error) {
	rows, _ := r.db.Query(ctx, `
		SELECT channel_id::text, server_id::text, call_id::text, COALESCE(text_channel_id::text, ''),
		       now_item, position_ms, queue, saved_at
		FROM music_sessions ORDER BY saved_at`)
	out, err := pgx.CollectRows(rows, scanSession)
	if err != nil {
		return nil, fmt.Errorf("listar sessões do maestro: %w", err)
	}
	return out, nil
}

func scanSession(row pgx.CollectableRow) (Session, error) {
	var s Session
	var now, queue []byte
	var posMs int64
	if err := row.Scan(&s.ChannelID, &s.ServerID, &s.CallID, &s.TextChannelID, &now, &posMs, &queue, &s.SavedAt); err != nil {
		return s, err
	}
	s.Position = time.Duration(posMs) * time.Millisecond
	return s, decodeSessionItems(now, queue, &s)
}

// encodeSessionItems: a faixa atual (null = nenhuma) e a fila ([] se vazia,
// a coluna é NOT NULL) em JSON. Item só tem texto e números: não falha.
func encodeSessionItems(s Session) (now, queue string) {
	items := s.Queue
	if items == nil {
		items = []*Item{}
	}
	n, _ := json.Marshal(s.Now)
	q, _ := json.Marshal(items)
	return string(n), string(q)
}

// decodeSessionItems: o inverso; now nil = coluna NULL (sem faixa atual).
func decodeSessionItems(now, queue []byte, s *Session) error {
	if now != nil {
		if err := json.Unmarshal(now, &s.Now); err != nil {
			return fmt.Errorf("faixa atual: %w", err)
		}
	}
	if err := json.Unmarshal(queue, &s.Queue); err != nil {
		return fmt.Errorf("fila: %w", err)
	}
	return nil
}
