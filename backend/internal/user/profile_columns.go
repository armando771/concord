package user

import (
	"gin-quickstart/backend/internal/namestyle"
	"gin-quickstart/backend/internal/profiletheme"
)

// Parâmetros do UPDATE do perfil: estilo do nome e tema nil viram NULL, e o
// COALESCE do SQL mantém o que já estava salvo.

// themeField e themeColors: tema nil vira NULL (COALESCE mantém o salvo).
func themeField(t *profiletheme.Theme, get func(*profiletheme.Theme) string) *string {
	if t == nil {
		return nil
	}
	v := get(t)
	return &v
}

// Lista vazia grava '{}' (nunca NULL): o tema validado sempre traz slices.
func themeColors(t *profiletheme.Theme, get func(*profiletheme.Theme) []string) []string {
	if t == nil {
		return nil
	}
	if c := get(t); c != nil {
		return c
	}
	return []string{}
}

func styleFont(s *namestyle.Style) *string {
	if s == nil {
		return nil
	}
	return &s.Font
}

func styleEffect(s *namestyle.Style) *string {
	if s == nil {
		return nil
	}
	return &s.Effect
}

// styleColors: nil vira NULL (COALESCE mantém); um slice vazio grava '{}'.
func styleColors(s *namestyle.Style) []string {
	if s == nil {
		return nil
	}
	return s.Colors
}
