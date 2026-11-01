package changelog

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) List(ctx context.Context) ([]Release, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, version, released_at, summary
		 FROM changelog_releases
		 ORDER BY released_at DESC, id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var releases []Release
	index := map[int64]int{}
	for rows.Next() {
		var id int64
		var rel Release
		if err := rows.Scan(&id, &rel.Version, &rel.ReleasedAt, &rel.Summary); err != nil {
			return nil, err
		}
		rel.Entries = []Entry{}
		index[id] = len(releases)
		releases = append(releases, rel)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	erows, err := r.db.Query(ctx,
		`SELECT release_id, kind, text FROM changelog_entries ORDER BY release_id, position`)
	if err != nil {
		return nil, err
	}
	defer erows.Close()
	for erows.Next() {
		var id int64
		var e Entry
		if err := erows.Scan(&id, &e.Kind, &e.Text); err != nil {
			return nil, err
		}
		if i, ok := index[id]; ok {
			releases[i].Entries = append(releases[i].Entries, e)
		}
	}
	return releases, erows.Err()
}

// Upsert cria a release ou troca as entradas da que já existe, numa transação:
// repetir o deploy deixa o mesmo resultado.
func (r *Repository) Upsert(ctx context.Context, version string, p Publication) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var id int64
	err = tx.QueryRow(ctx,
		`INSERT INTO changelog_releases (version, released_at, summary)
		 VALUES ($1, COALESCE($2::timestamptz, NOW()), $3)
		 ON CONFLICT (version) DO UPDATE
		   SET released_at = COALESCE($2::timestamptz, changelog_releases.released_at),
		       summary = EXCLUDED.summary
		 RETURNING id`,
		version, p.ReleasedAt, p.Summary).Scan(&id)
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM changelog_entries WHERE release_id = $1`, id); err != nil {
		return err
	}
	for i, e := range p.Entries {
		if _, err := tx.Exec(ctx,
			`INSERT INTO changelog_entries (release_id, kind, text, position) VALUES ($1, $2, $3, $4)`,
			id, e.Kind, e.Text, i); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
