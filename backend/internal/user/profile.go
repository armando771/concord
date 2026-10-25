package user

import (
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"unicode/utf8"
)

// Limites do perfil (os mesmos do Discord; o app usa os mesmos números).
const (
	MaxDisplayName = 32
	MaxPronouns    = 40
	MaxBio         = 190
	MaxStatusText  = 128
	MaxLinks       = 5
	MaxLinkLength  = 256
)

var ErrInvalidProfile = errors.New("perfil inválido")

var bannerColorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// ProfileInput é o que a pessoa edita no "Perfis" das configurações.
type ProfileInput struct {
	DisplayName string        `json:"display_name"`
	Pronouns    string        `json:"pronouns"`
	Bio         string        `json:"bio"`
	StatusText  string        `json:"status_text"`
	BannerColor *string       `json:"banner_color"`
	Links       []ProfileLink `json:"links"`
}

func invalid(msg string) error {
	return fmt.Errorf("%w: %s", ErrInvalidProfile, msg)
}

// ValidateProfile confere os limites e devolve o perfil arrumado (sem espaços
// nas pontas, cor em minúsculas, links nunca nil). Tamanhos contam caracteres,
// não bytes: "ç" e emoji contam como um.
func ValidateProfile(in ProfileInput) (ProfileInput, error) {
	out := ProfileInput{
		DisplayName: strings.TrimSpace(in.DisplayName),
		Pronouns:    strings.TrimSpace(in.Pronouns),
		Bio:         strings.TrimSpace(in.Bio),
		StatusText:  strings.TrimSpace(in.StatusText),
		Links:       []ProfileLink{},
	}

	if n := utf8.RuneCountInString(out.DisplayName); n < 1 || n > MaxDisplayName {
		return ProfileInput{}, invalid(fmt.Sprintf("o nome de exibição precisa ter de 1 a %d caracteres", MaxDisplayName))
	}
	if utf8.RuneCountInString(out.Pronouns) > MaxPronouns {
		return ProfileInput{}, invalid(fmt.Sprintf("os pronomes podem ter até %d caracteres", MaxPronouns))
	}
	if utf8.RuneCountInString(out.Bio) > MaxBio {
		return ProfileInput{}, invalid(fmt.Sprintf("o \"Sobre mim\" pode ter até %d caracteres", MaxBio))
	}
	if utf8.RuneCountInString(out.StatusText) > MaxStatusText {
		return ProfileInput{}, invalid(fmt.Sprintf("a nota pode ter até %d caracteres", MaxStatusText))
	}

	if in.BannerColor != nil && *in.BannerColor != "" {
		if !bannerColorPattern.MatchString(*in.BannerColor) {
			return ProfileInput{}, invalid("cor do banner inválida")
		}
		color := strings.ToLower(*in.BannerColor)
		out.BannerColor = &color
	}

	if len(in.Links) > MaxLinks {
		return ProfileInput{}, invalid(fmt.Sprintf("o perfil pode ter até %d links", MaxLinks))
	}
	seen := map[string]bool{}
	for _, link := range in.Links {
		raw := strings.TrimSpace(link.URL)
		if !validLink(raw) {
			return ProfileInput{}, invalid(fmt.Sprintf("link inválido: %q", raw))
		}
		key := strings.ToLower(raw)
		if seen[key] {
			return ProfileInput{}, invalid(fmt.Sprintf("link repetido: %q", raw))
		}
		seen[key] = true
		out.Links = append(out.Links, ProfileLink{URL: raw})
	}

	return out, nil
}

// validLink aceita só http(s) com host: barra javascript:, data:, file: etc.
func validLink(raw string) bool {
	if raw == "" || len(raw) > MaxLinkLength {
		return false
	}
	u, err := url.Parse(raw)
	if err != nil {
		return false
	}
	return (u.Scheme == "http" || u.Scheme == "https") && u.Hostname() != ""
}

// Status que a pessoa escolhe. "offline" não é escolha: é o que os outros
// veem quando ela está desconectada ou invisível.
const (
	StatusOnline    = "online"
	StatusIdle      = "idle"
	StatusDND       = "dnd"
	StatusInvisible = "invisible"
	StatusOffline   = "offline"
)

var ErrInvalidStatus = errors.New("status inválido")

func ValidStatus(status string) bool {
	switch status {
	case StatusOnline, StatusIdle, StatusDND, StatusInvisible:
		return true
	}
	return false
}

// EffectiveStatus é o status que os outros veem.
func EffectiveStatus(chosen string, connected bool) string {
	if !connected || chosen == StatusInvisible {
		return StatusOffline
	}
	if !ValidStatus(chosen) {
		return StatusOnline
	}
	return chosen
}
