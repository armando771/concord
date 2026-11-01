package badge

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

const mensagensMigration = "../../migrations/000113_badge_mensagens_antispam.up.sql"

// msg é uma mensagem de teste: figurinha/GIF, anexos ("nome:tamanho") e a
// data (zero = agora).
type msg struct {
	content      string
	sticker, gif any
	files        []string
	at           time.Time
}

// send grava a mensagem com os anexos numa transação só, como o app
// (CreateWithAttachments): o trigger dos badges roda no commit.
func (d *testDB) send(author, channelID string, m msg) string {
	d.t.Helper()
	var at any
	if !m.at.IsZero() {
		at = m.at
	}
	id := uuid.NewString()
	tx, err := d.db.Begin(d.ctx)
	if err != nil {
		d.t.Fatal(err)
	}
	defer tx.Rollback(d.ctx)
	if _, err := tx.Exec(d.ctx, `INSERT INTO messages (id, author_id, channel_id, content, sticker_id, gif_url, created_at) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, NOW()))`,
		id, author, channelID, m.content, m.sticker, m.gif, at); err != nil {
		d.t.Fatal(err)
	}
	for i, f := range m.files {
		name, size, _ := strings.Cut(f, ":")
		if _, err := tx.Exec(d.ctx, `INSERT INTO message_attachments (id, message_id, uploader_id, channel_id, kind, content_type, filename, size_bytes, position) VALUES (gen_random_uuid(), $1, $2, $3, 'image', 'image/png', $4, $5, $6)`,
			id, author, channelID, name, size, i); err != nil {
			d.t.Fatal(err)
		}
	}
	if err := tx.Commit(d.ctx); err != nil {
		d.t.Fatal(err)
	}
	return id
}

func (d *testDB) stats(id string) Stats {
	d.t.Helper()
	s, err := BadgeRepository(d.db).Stats(d.ctx, id)
	if err != nil {
		d.t.Fatal(err)
	}
	return s
}

func TestMensagensBackfillMatchesCatalog(t *testing.T) {
	assertBackfillMatchesCatalog(t, "mensagens", mensagensMigration)
}

// Mensagem igual à anterior da pessoa na sala (texto normalizado, figurinha,
// GIF e anexos), há menos de 1 hora, não conta.
func TestMensagensTriggerIgnoresRepeats(t *testing.T) {
	d := newTestDB(t)
	ana, _ := d.user()
	bia, _ := d.user()
	_, geral := d.server(ana)
	_, outro := d.server(ana)
	base := time.Now().Add(-6 * time.Hour)
	at := func(min int) time.Time { return base.Add(time.Duration(min) * time.Minute) }

	cases := []struct {
		who     string
		channel string
		m       msg
		counts  bool
	}{
		{ana, geral, msg{content: "Oi", at: at(0)}, true},
		{ana, geral, msg{content: "  oi ", at: at(1)}, false},           // igual depois de normalizar
		{bia, geral, msg{content: "oi", at: at(2)}, true},               // outra pessoa
		{ana, geral, msg{content: "OI   tudo\tbem", at: at(3)}, true},   // texto novo
		{ana, geral, msg{content: "oi tudo bem", at: at(4)}, false},     // igual à anterior dela
		{ana, outro, msg{content: "oi tudo bem", at: at(5)}, true},      // outra sala
		{ana, geral, msg{content: "oi tudo bem", at: at(5 + 61)}, true}, // mais de 1 hora depois
		{ana, geral, msg{content: "foto", files: []string{"a.png:10"}, at: at(70)}, true},
		{ana, geral, msg{content: "foto", files: []string{"b.png:20"}, at: at(71)}, true},  // anexo diferente
		{ana, geral, msg{content: "foto", files: []string{"b.png:20"}, at: at(72)}, false}, // mesmo anexo
		{ana, geral, msg{content: "foto", at: at(73)}, true},                               // sem o anexo
	}
	want := map[string]int64{}
	for i, tc := range cases {
		d.send(tc.who, tc.channel, tc.m)
		if tc.counts {
			want[tc.who]++
		}
		if got := d.stats(tc.who).MessagesSent; got != want[tc.who] {
			t.Fatalf("mensagem %d (%q): messages = %d, want %d", i, tc.m.content, got, want[tc.who])
		}
	}
}

// Apagada em até 2 minutos desconta (se tinha contado); depois disso, fica.
func TestMensagensDeleteWithinTwoMinutesUncounts(t *testing.T) {
	d := newTestDB(t)
	ana, _ := d.user()
	_, geral := d.server(ana)
	velha := d.send(ana, geral, msg{content: "velha", at: time.Now().Add(-5 * time.Minute)})
	nova := d.send(ana, geral, msg{content: "nova"})
	repetida := d.send(ana, geral, msg{content: "nova"}) // não contou
	if got := d.stats(ana).MessagesSent; got != 2 {
		t.Fatalf("messages = %d, want 2", got)
	}
	del := func(id string) { d.exec(`DELETE FROM messages WHERE id = $1`, id) }
	del(repetida)
	if got := d.stats(ana).MessagesSent; got != 2 {
		t.Fatalf("apagar a repetida: messages = %d, want 2", got)
	}
	del(nova)
	if got := d.stats(ana).MessagesSent; got != 1 {
		t.Fatalf("apagar em 2 min: messages = %d, want 1", got)
	}
	del(velha)
	if got := d.stats(ana).MessagesSent; got != 1 {
		t.Fatalf("apagar depois de 2 min: messages = %d, want 1", got)
	}
}

// Retroativo: quem farmou repetindo a mesma mensagem cai; quem conversou de
// verdade mantém (o contador nunca sobe).
func TestMensagensBackfillDemotes(t *testing.T) {
	d := newTestDB(t)
	farm, _ := d.user()
	turma, _ := d.user()
	_, geral := d.server(farm)
	base := time.Now().Add(-48 * time.Hour)
	for i := 0; i < 60; i++ {
		d.send(farm, geral, msg{content: "kkk", at: base.Add(time.Duration(i) * time.Second)})
		d.send(turma, geral, msg{content: "papo " + string(rune('a'+i%26)) + string(rune('a'+i/26)), at: base.Add(time.Duration(i) * time.Second)})
	}
	// Os contadores de antes do trigger novo: tudo contava, até as apagadas.
	d.exec(`UPDATE user_badge_stats SET messages_sent = 60 WHERE user_id = $1`, farm)
	d.exec(`UPDATE user_badge_stats SET messages_sent = 70 WHERE user_id = $1`, turma)
	d.exec(`INSERT INTO user_badges (user_id, category, tier) VALUES ($1, 'mensagens', 1), ($1, 'voz', 1), ($2, 'mensagens', 1)`, farm, turma)

	d.runBackfill(mensagensMigration)
	d.runBackfill(mensagensMigration) // de novo não muda nada
	repo := BadgeRepository(d.db)
	for _, tc := range []struct {
		name  string
		id    string
		value int64
		tiers int
	}{{"farm", farm, 1, 0}, {"turma", turma, 60, 1}} {
		if got := d.stats(tc.id).MessagesSent; got != tc.value {
			t.Fatalf("%s messages = %d, want %d", tc.name, got, tc.value)
		}
		unlocks, _ := repo.Unlocks(d.ctx, tc.id)
		if got := len(unlocks["mensagens"]); got != tc.tiers {
			t.Fatalf("%s mensagens tiers = %v, want %d", tc.name, unlocks["mensagens"], tc.tiers)
		}
	}
	if unlocks, _ := repo.Unlocks(d.ctx, farm); len(unlocks["voz"]) != 1 {
		t.Fatalf("outra categoria mexida: %v", unlocks)
	}
}
