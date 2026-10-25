package permission

import (
	"os"
	"regexp"
	"strconv"
	"strings"
	"testing"
)

func readMigration(t *testing.T, name string) string {
	t.Helper()
	raw, err := os.ReadFile("../../migrations/" + name)
	if err != nil {
		t.Fatal(err)
	}
	return string(raw)
}

// A migration 000029 grava os padrões da época como números e a 000031 liga
// os bits de apelido por cima. Somadas, têm que dar os padrões de hoje: se os
// bits mudarem aqui, elas têm que mudar junto.
func TestMigrationDefaultsMatchConstants(t *testing.T) {
	sql := readMigration(t, "000029_add_roles_permissions.up.sql")
	added := nicknameMigrationBits(t)
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
		if got|added[name] != want {
			t.Errorf("%s: migrations = %d, Go = %d", name, got|added[name], want)
		}
	}
}

// nicknameMigrationBits: o que a 000031 liga em cada cargo padrão.
func nicknameMigrationBits(t *testing.T) map[string]int64 {
	t.Helper()
	sql := readMigration(t, "000031_add_member_nicknames.up.sql")
	re := regexp.MustCompile(`UPDATE roles SET permissions = permissions \| (\d+) WHERE (.+);`)
	targets := map[string]string{
		"is_default":                            "@everyone",
		"name = 'Moderador' AND NOT is_default": "Moderador",
	}
	added := map[string]int64{}
	for _, m := range re.FindAllStringSubmatch(sql, -1) {
		name, ok := targets[m[2]]
		if !ok {
			t.Fatalf("UPDATE inesperado na 000031: %q", m[0])
		}
		bits, err := strconv.ParseInt(m[1], 10, 64)
		if err != nil {
			t.Fatal(err)
		}
		added[name] |= bits
	}
	if added["@everyone"] != ChangeNickname {
		t.Errorf("@everyone ganha %d na 000031, want CHANGE_NICKNAME (%d)", added["@everyone"], ChangeNickname)
	}
	if added["Moderador"] != ChangeNickname|ManageNicknames {
		t.Errorf("Moderador ganha %d na 000031, want os dois bits de apelido", added["Moderador"])
	}
	return added
}

// O down da 000031 desliga exatamente os bits que o up ligou.
func TestNicknameMigrationDownClearsBits(t *testing.T) {
	sql := readMigration(t, "000031_add_member_nicknames.down.sql")
	want := "permissions & ~" + strconv.FormatInt(ChangeNickname|ManageNicknames, 10)
	if !strings.Contains(sql, want) {
		t.Errorf("down devia ter %q", want)
	}
}
