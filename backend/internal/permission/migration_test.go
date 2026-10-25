package permission

import (
	"os"
	"strconv"
	"strings"
	"testing"
)

// A migration 000029 grava os padrões como números; se os bits mudarem aqui,
// ela tem que mudar junto.
func TestMigrationDefaultsMatchConstants(t *testing.T) {
	raw, err := os.ReadFile("../../migrations/000029_add_roles_permissions.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	sql := string(raw)
	for name, want := range map[string]int64{"@everyone": DefaultEveryone, "Moderador": DefaultModerator} {
		needle := "'" + name + "', "
		i := strings.Index(sql, "SELECT id, "+needle)
		if i < 0 {
			t.Fatalf("INSERT do %s não encontrado", name)
		}
		fields := strings.Split(sql[i:strings.Index(sql[i:], "\n")+i], ", ")
		got, err := strconv.ParseInt(fields[3], 10, 64)
		if err != nil {
			t.Fatalf("%s: %v (%q)", name, err, fields)
		}
		if got != want {
			t.Errorf("%s: migration = %d, Go = %d", name, got, want)
		}
	}
}
