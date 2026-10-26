package user

import "testing"

func names(us ...string) []User {
	out := make([]User, len(us))
	for i, u := range us {
		out[i] = User{ID: u, Username: u}
	}
	return out
}

func byUsername(u User) string { return u.Username }

func TestPickLoginMatch(t *testing.T) {
	cases := []struct {
		name       string
		candidates []User
		value      string
		wantID     string // "" = nenhum
	}{
		{"nenhum candidato", names(), "shaco", ""},
		{"único, mesma caixa", names("SHACO"), "SHACO", "SHACO"},
		{"único, caixa diferente", names("SHACO"), "shaco", "SHACO"},
		{"dois só na caixa, um exato", names("shaco", "SHACO"), "SHACO", "SHACO"},
		{"dois só na caixa, exato primeiro", names("SHACO", "shaco"), "shaco", "shaco"},
		{"dois só na caixa, nenhum exato: ambíguo", names("shaco", "SHACO"), "Shaco", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, ok := pickLoginMatch(c.candidates, c.value, byUsername)
			if c.wantID == "" {
				if ok {
					t.Fatalf("pickLoginMatch(%q) = %q, want nenhum", c.value, got.ID)
				}
				return
			}
			if !ok || got.ID != c.wantID {
				t.Fatalf("pickLoginMatch(%q) = (%v, %v), want %q", c.value, got, ok, c.wantID)
			}
		})
	}
}
