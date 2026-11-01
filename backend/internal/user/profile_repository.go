package user

import (
	"context"

	"gin-quickstart/backend/internal/profiletheme"

	"github.com/jackc/pgx/v5"
)

// rowQuerier: o pool ou uma transação.
type rowQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// UpdateProfile grava os campos do perfil; estilo do nome e tema nil mantêm o
// que já estava salvo (COALESCE).
func (r *Repository) UpdateProfile(ctx context.Context, id string, in ProfileInput) (*User, error) {
	return updateProfile(ctx, r.db, id, in)
}

func updateProfile(ctx context.Context, q rowQuerier, id string, in ProfileInput) (*User, error) {
	return scanUser(q.QueryRow(
		ctx,
		`
		UPDATE users
		SET display_name = $2, pronouns = $3, bio = $4, status_text = $5,
			banner_color = $6, links = $7,
			name_font = COALESCE($8, name_font),
			name_effect = COALESCE($9, name_effect),
			name_colors = COALESCE($10, name_colors),
			profile_border = COALESCE($11, profile_border),
			profile_border_colors = COALESCE($12, profile_border_colors),
			profile_background = COALESCE($13, profile_background),
			profile_background_colors = COALESCE($14, profile_background_colors),
			profile_effect = COALESCE($15, profile_effect),
			profile_theme_extras = COALESCE($16, profile_theme_extras),
			updated_at = NOW()
		WHERE id = $1
		RETURNING `+userColumns,
		id,
		in.DisplayName,
		in.Pronouns,
		in.Bio,
		in.StatusText,
		in.BannerColor,
		in.Links,
		styleFont(in.NameStyle),
		styleEffect(in.NameStyle),
		styleColors(in.NameStyle),
		themeField(in.ProfileTheme, func(t *profiletheme.Theme) string { return t.Border }),
		themeColors(in.ProfileTheme, func(t *profiletheme.Theme) []string { return t.BorderColors }),
		themeField(in.ProfileTheme, func(t *profiletheme.Theme) string { return t.Background }),
		themeColors(in.ProfileTheme, func(t *profiletheme.Theme) []string { return t.BackgroundColors }),
		themeField(in.ProfileTheme, func(t *profiletheme.Theme) string { return t.Effect }),
		themeExtras(in.ProfileTheme),
	))
}

// ApplySnapshot troca o perfil inteiro (campos, avatar e banner) numa
// transação e devolve as URLs de avatar e banner que estavam antes.
func (r *Repository) ApplySnapshot(ctx context.Context, id string, s ProfileSnapshot) (*User, []*string, error) {
	var (
		u   *User
		old []*string
	)
	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		var err error
		if old, err = swapProfileMedia(ctx, tx, id, s); err != nil {
			return err
		}
		u, err = updateProfile(ctx, tx, id, s.Fields)
		return err
	})
	if err != nil {
		return nil, nil, err
	}
	return u, old, nil
}

// swapProfileMedia grava avatar e banner novos e devolve os que estavam.
func swapProfileMedia(ctx context.Context, tx pgx.Tx, id string, s ProfileSnapshot) ([]*string, error) {
	var avatar, banner *string
	if err := tx.QueryRow(ctx, `SELECT avatar_url, banner_url FROM users WHERE id = $1 FOR UPDATE`, id).Scan(&avatar, &banner); err != nil {
		return nil, err
	}
	_, err := tx.Exec(ctx, `UPDATE users SET avatar_url = $2, banner_url = $3 WHERE id = $1`, id, s.AvatarURL, s.BannerURL)
	return []*string{avatar, banner}, err
}
