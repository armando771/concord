package bot

import "testing"

func TestIdentity(t *testing.T) {
	id := Identity("abc")
	if id != "bot-music:abc" {
		t.Fatalf("identity = %q", id)
	}
	if !IsIdentity(id) || IsIdentity("abc") {
		t.Fatal("IsIdentity errado")
	}
}

func TestUserIDIsUUID(t *testing.T) {
	if len(UserID) != 36 || UserID[14] != '4' {
		t.Fatalf("UserID precisa ser um UUID v4 fixo: %q", UserID)
	}
}
