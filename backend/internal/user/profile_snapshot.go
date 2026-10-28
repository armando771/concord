package user

import (
	"context"
	"slices"
)

// ProfileSnapshot é o perfil inteiro como aparece em Configurações → Perfis:
// os campos editáveis mais avatar e banner, por URL (o arquivo não é
// copiado). É o que um perfil salvo guarda e reaplica. O som de entrada fica
// de fora: é da pessoa, não do visual do perfil.
type ProfileSnapshot struct {
	Fields    ProfileInput `json:"fields"`
	AvatarURL *string      `json:"avatar_url"`
	BannerURL *string      `json:"banner_url"`
}

// Snapshot tira a foto do perfil atual, sem ponteiro nem slice em comum com u.
func (u *User) Snapshot() ProfileSnapshot {
	style := u.NameStyle
	style.Colors = slices.Clone(style.Colors)
	theme := u.ProfileTheme
	theme.BorderColors = slices.Clone(theme.BorderColors)
	theme.BackgroundColors = slices.Clone(theme.BackgroundColors)
	return ProfileSnapshot{
		Fields: ProfileInput{
			DisplayName:  u.DisplayName,
			Pronouns:     u.Pronouns,
			Bio:          u.Bio,
			StatusText:   u.StatusText,
			BannerColor:  clonePtr(u.BannerColor),
			Links:        slices.Clone(u.Links),
			NameStyle:    &style,
			ProfileTheme: &theme,
		},
		AvatarURL: clonePtr(u.AvatarURL),
		BannerURL: clonePtr(u.BannerURL),
	}
}

func clonePtr(s *string) *string {
	if s == nil {
		return nil
	}
	v := *s
	return &v
}

// ValidateSnapshot confere os campos (as regras podem ter mudado desde que a
// foto foi tirada) e que avatar e banner são mídia do perfil: nunca uma URL
// de fora.
func ValidateSnapshot(s ProfileSnapshot) (ProfileSnapshot, error) {
	fields, err := ValidateProfile(s.Fields)
	if err != nil {
		return ProfileSnapshot{}, err
	}
	if !profileMediaOrNil(s.AvatarURL) || !profileMediaOrNil(s.BannerURL) {
		return ProfileSnapshot{}, invalid("imagem do perfil inválida")
	}
	return ProfileSnapshot{Fields: fields, AvatarURL: s.AvatarURL, BannerURL: s.BannerURL}, nil
}

func profileMediaOrNil(url *string) bool {
	if url == nil {
		return true
	}
	_, ok := mediaIDFromURL(url)
	return ok
}

// ApplySnapshot troca o perfil inteiro de uma vez e avisa todo mundo, como
// qualquer edição. Devolve as URLs de mídia que saíram (para quem chama
// apagar o arquivo, se ninguém mais usar).
func (s *ProfileService) ApplySnapshot(ctx context.Context, userID string, snap ProfileSnapshot) (*User, []*string, error) {
	clean, err := ValidateSnapshot(snap)
	if err != nil {
		return nil, nil, err
	}
	u, old, err := s.repo.ApplySnapshot(ctx, userID, clean)
	if err != nil {
		return nil, nil, notFound(err)
	}
	s.publish(u)
	return u, replacedMedia(old, u), nil
}

// replacedMedia tira das URLs antigas as nulas e as que continuam em uso.
func replacedMedia(old []*string, u *User) []*string {
	var out []*string
	for _, url := range old {
		if url != nil && !sameURL(url, u.AvatarURL) && !sameURL(url, u.BannerURL) {
			out = append(out, url)
		}
	}
	return out
}

func sameURL(a, b *string) bool { return b != nil && *a == *b }
