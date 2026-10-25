package server

import (
	"context"
	"os"
	"testing"

	"gin-quickstart/backend/internal/bot"
	"gin-quickstart/backend/internal/database"

	"github.com/google/uuid"
)

func TestMusicBotProvisioningDB(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL não definido")
	}
	ctx := context.Background()
	db, err := database.Connect(url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(db, "../../migrations"); err != nil {
		t.Fatal(err)
	}

	owner := uuid.NewString()
	if _, err := db.Exec(ctx,
		`INSERT INTO users (id, username, display_name, email, password_hash) VALUES ($1, $2, 'Dono', $3, 'x')`,
		owner, "u"+owner[:8], owner[:8]+"@t.dev"); err != nil {
		t.Fatal(err)
	}

	svc := ServerService(ServerRepository(db), nil, nil)
	var disabled []string
	svc.OnMusicBotDisabled(func(id string) { disabled = append(disabled, id) })
	s := &Server{Name: "Galera", OwnerID: owner}
	if err := svc.Create(ctx, s); err != nil {
		t.Fatal(err)
	}

	isMember := func() bool {
		ok, err := svc.IsMember(ctx, s.ID, bot.UserID)
		if err != nil {
			t.Fatal(err)
		}
		return ok
	}
	if !isMember() {
		t.Fatal("servidor novo deve receber o Maestro")
	}

	members, err := svc.ListMembers(ctx, s.ID)
	if err != nil {
		t.Fatal(err)
	}
	var found bool
	for _, m := range members {
		if m.UserID == bot.UserID {
			found = m.IsBot
		}
	}
	if !found {
		t.Fatal("o Maestro deve vir com is_bot=true na lista de membros")
	}

	if err := svc.SetMusicBot(ctx, s.ID, uuid.NewString(), false); err != ErrOnlyOwnerBot {
		t.Fatalf("só o dono remove: err = %v", err)
	}
	if err := svc.SetMusicBot(ctx, s.ID, owner, false); err != nil || isMember() {
		t.Fatalf("remover: err=%v member=%v", err, isMember())
	}
	if len(disabled) != 1 || disabled[0] != s.ID {
		t.Fatalf("hook de remoção = %v", disabled)
	}
	if err := svc.SetMusicBot(ctx, s.ID, owner, true); err != nil || !isMember() {
		t.Fatalf("readicionar: err=%v member=%v", err, isMember())
	}
	// Readicionar de novo não duplica nem falha.
	if err := svc.SetMusicBot(ctx, s.ID, owner, true); err != nil {
		t.Fatalf("readicionar duas vezes: %v", err)
	}
}

func TestMusicBotDisabledHooksRun(t *testing.T) {
	svc := &Service{}
	var got []string
	svc.OnMusicBotDisabled(func(id string) { got = append(got, "a:"+id) })
	svc.OnMusicBotDisabled(func(id string) { got = append(got, "b:"+id) })
	svc.notifyMusicBotDisabled("srv1")
	if len(got) != 2 || got[0] != "a:srv1" || got[1] != "b:srv1" {
		t.Fatalf("hooks = %v", got)
	}
}
