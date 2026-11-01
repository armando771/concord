package serverlevel

import (
	"os"
	"strings"
	"testing"

	"github.com/google/uuid"
)

// backfillSQL é o trecho "Retroativo" da migration 000150.
func backfillSQL(t *testing.T) string {
	t.Helper()
	raw, err := os.ReadFile("../../migrations/000150_server_levels.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	_, sql, ok := strings.Cut(string(raw), "-- Retroativo")
	if !ok {
		t.Fatal("trecho do retroativo não achado na migration")
	}
	return "-- Retroativo" + sql
}

// O retroativo roda numa transação desfeita no fim, com as tabelas do nível
// zeradas (ele cobre todos os servidores do banco).
func TestBackfillCalculaOXPInicialSemAvisarSubida(t *testing.T) {
	db, ctx := testDB(t)
	tx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := tx.Exec(ctx, sql, args...); err != nil {
			t.Fatalf("%s: %v", sql, err)
		}
	}
	user := func(verified, bot bool) string {
		id := uuid.NewString()
		name := "bf" + strings.ReplaceAll(id, "-", "")[:12]
		exec(`INSERT INTO users (id, username, display_name, email, password_hash, email_verified_at, is_bot)
			VALUES ($1, $2::text, $2::text, $2::text || '@ex.com', 'x', CASE WHEN $3 THEN NOW() END, $4)`, id, name, verified, bot)
		return id
	}
	ana, bia, nova, bot := user(true, false), user(true, false), user(false, false), user(true, true)
	server, channel := uuid.NewString(), uuid.NewString()
	exec(`INSERT INTO servers (id, name, owner_id) VALUES ($1, 'bf', $2)`, server, ana)
	exec(`INSERT INTO channels (id, server_id, name, created_by) VALUES ($1, $2, 'geral', $3)`, channel, server, ana)
	exec(`INSERT INTO server_members (server_id, user_id) VALUES ($1, $2), ($1, $3), ($1, $4), ($1, $5)`, server, ana, bia, nova, bot)

	msg := func(author, content, ago string) {
		exec(`INSERT INTO messages (id, author_id, channel_id, content, created_at) VALUES ($1, $2, $3, $4, NOW() - $5::interval)`,
			uuid.NewString(), author, channel, content, ago)
	}
	msg(ana, "oi", "40 days 3 hours")
	msg(ana, "oi", "40 days 2 hours 30 minutes") // repetida em < 1 h: não conta
	msg(ana, "oi", "40 days 1 hour")             // repetida depois de 1 h: conta
	msg(nova, "oi", "40 days")                   // sem e-mail confirmado
	msg(bot, "oi", "40 days")                    // bot
	for i := 0; i < 60; i++ {                    // 60 mensagens no mesmo dia: teto de 100 XP
		msg(bia, "msg "+uuid.NewString(), "20 days")
	}
	exec(`INSERT INTO server_stickers (id, server_id, uploader_id, name, file_id, content_type, size_bytes) VALUES ($1, $2, $3, 'f', $1, 'image/png', 10)`, uuid.NewString(), server, ana)
	exec(`INSERT INTO soundboard_sounds (id, server_id, uploader_id, name, content_type, size_bytes, duration_ms) VALUES ($1, $2, $3, 's', 'audio/ogg', 10, 1000)`, uuid.NewString(), server, bia)

	// O que os triggers somaram ao inserir sai; fica só o retroativo.
	exec(`DELETE FROM server_level_daily`)
	exec(`DELETE FROM server_level_members`)
	exec(`DELETE FROM server_levels`)
	exec(backfillSQL(t))

	var xp int64
	var level *int
	if err := tx.QueryRow(ctx, `SELECT xp, level FROM server_levels WHERE server_id = $1`, server).Scan(&xp, &level); err != nil {
		t.Fatal(err)
	}
	// membros: ana e bia (100) + mensagens: ana 2 (4) e bia no teto (100) +
	// figurinha (10) + som (10).
	if xp != 224 {
		t.Errorf("xp = %d, quer 224", xp)
	}
	if level != nil {
		t.Errorf("level = %v, quer NULL (o backend acerta sem aviso)", *level)
	}
	var members int
	if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM server_level_members WHERE server_id = $1`, server).Scan(&members); err != nil {
		t.Fatal(err)
	}
	if members != 2 {
		t.Errorf("membros contados = %d, quer 2 (sem a conta sem e-mail e o bot)", members)
	}
}
