package user

import "time"

type User struct {
	ID           string        `json:"id"`
	Username     string        `json:"username"`
	DisplayName  string        `json:"display_name"`
	Email        string        `json:"email"`
	PasswordHash string        `json:"-"`
	AvatarURL    *string       `json:"avatar_url,omitempty"`
	BannerURL    *string       `json:"banner_url,omitempty"`
	BannerColor  *string       `json:"banner_color,omitempty"`
	Pronouns     string        `json:"pronouns"`
	Bio          string        `json:"bio"`
	StatusText   string        `json:"status_text"`
	Links        []ProfileLink `json:"links"`
	Status       string        `json:"status"`
	Active       bool          `json:"-"`
	CreatedAt    time.Time     `json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
}

// ProfileLink é um link do perfil (Steam, Twitch, site...). O app descobre o
// serviço pela URL.
type ProfileLink struct {
	URL string `json:"url"`
}

// PublicProfile é o que os outros veem no cartão de perfil: sem e-mail e com
// o status efetivo (invisível aparece como offline).
type PublicProfile struct {
	ID          string        `json:"id"`
	Username    string        `json:"username"`
	DisplayName string        `json:"display_name"`
	AvatarURL   *string       `json:"avatar_url,omitempty"`
	BannerURL   *string       `json:"banner_url,omitempty"`
	BannerColor *string       `json:"banner_color,omitempty"`
	Pronouns    string        `json:"pronouns"`
	Bio         string        `json:"bio"`
	StatusText  string        `json:"status_text"`
	Links       []ProfileLink `json:"links"`
	Status      string        `json:"status"`
	CreatedAt   time.Time     `json:"created_at"`
}

// Public monta o perfil público com o status já calculado por quem chama.
func (u *User) Public(status string) PublicProfile {
	links := u.Links
	if links == nil {
		links = []ProfileLink{}
	}
	return PublicProfile{
		ID:          u.ID,
		Username:    u.Username,
		DisplayName: u.DisplayName,
		AvatarURL:   u.AvatarURL,
		BannerURL:   u.BannerURL,
		BannerColor: u.BannerColor,
		Pronouns:    u.Pronouns,
		Bio:         u.Bio,
		StatusText:  u.StatusText,
		Links:       links,
		Status:      status,
		CreatedAt:   u.CreatedAt,
	}
}
