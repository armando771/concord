package badge

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

const figurinhaMigration = "../../migrations/000114_badge_figurinha_antispam.up.sql"

func TestFigurinhaTiers(t *testing.T) {
	c := category(t, "figurinha")
	if c.Name != "Figurinha" || c.Unit != UnitStickers || c.Exclusive {
		t.Fatalf("category = %+v", c)
	}
	assertTiers(t, "figurinha", []Tier{
		{"Figurinha Repetida", 10, RarityCommon},
		{"Colecionador", 100, RarityRare},
		{"Álbum da Copa", 500, RarityEpic},
		{"Rei do GIF", 2000, RarityLegendary},
	})
}

func TestEvaluateFigurinhaUsesStickersSent(t *testing.T) {
	badges, _ := Evaluate(Stats{CreatedAt: FounderCutoff, StickersSent: 120}, nil, now)
	if b := find(t, badges, "figurinha"); b.Value != 120 || b.Tier != 2 {
		t.Fatalf("figurinha = %+v", b)
	}
}

func TestFigurinhaBackfillMatchesCatalog(t *testing.T) {
	assertBackfillMatchesCatalog(t, "figurinha", figurinhaMigration)
}

// sticker cria uma figurinha no servidor.
func (d *testDB) sticker(serverID, uploader string) string {
	d.t.Helper()
	id := uuid.NewString()
	d.exec(`INSERT INTO server_stickers (id, server_id, uploader_id, name, file_id, content_type, size_bytes) VALUES ($1, $2, $3, 'oi', gen_random_uuid(), 'image/png', 10)`, id, serverID, uploader)
	return id
}

// A mesma figurinha ou o mesmo GIF logo em seguida (a mensagem anterior da
// pessoa na sala, há menos de 1 hora) não conta para Figurinha; para
// Mensagens, só se a mensagem inteira for igual.
func TestFigurinhaTriggerIgnoresRepeats(t *testing.T) {
	d := newTestDB(t)
	ana, _ := d.user()
	serverID, geral := d.server(ana)
	s := d.sticker(serverID, ana)
	const gif = "https://media.giphy.com/x.gif"
	base := time.Now().Add(-6 * time.Hour)
	at := func(min int) time.Time { return base.Add(time.Duration(min) * time.Minute) }

	cases := []struct {
		m                  msg
		sticker, mensagens bool
	}{
		{msg{gif: gif, at: at(0)}, true, true},
		{msg{gif: gif, at: at(1)}, false, false}, // mesmo GIF, mensagem igual
		{msg{sticker: s, at: at(2)}, true, true},
		{msg{gif: gif, at: at(3)}, true, true}, // a anterior era a figurinha
		{msg{content: "kkk", sticker: s, at: at(4)}, true, true},
		{msg{content: "oi", sticker: s, at: at(5)}, false, true}, // mesma figurinha, texto novo
		{msg{content: "oi", at: at(6)}, false, true},
		{msg{sticker: s, at: at(7)}, true, true},      // a anterior era texto
		{msg{sticker: s, at: at(7 + 61)}, true, true}, // a mesma, mas mais de 1 hora depois
	}
	var wantS, wantM int64
	for i, tc := range cases {
		d.send(ana, geral, tc.m)
		if tc.sticker {
			wantS++
		}
		if tc.mensagens {
			wantM++
		}
		if st := d.stats(ana); st.StickersSent != wantS || st.MessagesSent != wantM {
			t.Fatalf("mensagem %d: stickers %d messages %d, want %d/%d", i, st.StickersSent, st.MessagesSent, wantS, wantM)
		}
	}
	// Mensagem do sistema não conta.
	d.exec(`INSERT INTO messages (id, author_id, channel_id, content, gif_url, system_kind) VALUES (gen_random_uuid(), $1, $2, '', 'https://media.giphy.com/y.gif', 'x')`, ana, geral)
	if got := d.stats(ana).StickersSent; got != wantS {
		t.Fatalf("sistema: stickers = %d, want %d", got, wantS)
	}
}

// Apagada em até 2 minutos desconta; depois disso, fica.
func TestFigurinhaDeleteWithinTwoMinutesUncounts(t *testing.T) {
	d := newTestDB(t)
	ana, _ := d.user()
	_, geral := d.server(ana)
	velha := d.send(ana, geral, msg{gif: "https://media.giphy.com/a.gif", at: time.Now().Add(-5 * time.Minute)})
	nova := d.send(ana, geral, msg{gif: "https://media.giphy.com/b.gif"})
	if got := d.stats(ana).StickersSent; got != 2 {
		t.Fatalf("stickers = %d, want 2", got)
	}
	d.exec(`DELETE FROM messages WHERE id = $1`, nova)
	if st := d.stats(ana); st.StickersSent != 1 || st.MessagesSent != 1 {
		t.Fatalf("apagar em 2 min: stickers %d messages %d, want 1/1", st.StickersSent, st.MessagesSent)
	}
	d.exec(`DELETE FROM messages WHERE id = $1`, velha)
	if got := d.stats(ana).StickersSent; got != 1 {
		t.Fatalf("apagar depois de 2 min: stickers = %d, want 1", got)
	}
}

// Retroativo: quem farmou mandando o mesmo GIF em série cai; quem alterna
// mantém (o contador nunca sobe).
func TestFigurinhaBackfillDemotes(t *testing.T) {
	d := newTestDB(t)
	farm, _ := d.user()
	turma, _ := d.user()
	_, geral := d.server(farm)
	base := time.Now().Add(-48 * time.Hour)
	for i := 0; i < 20; i++ {
		d.send(farm, geral, msg{gif: "https://media.giphy.com/x.gif", at: base.Add(time.Duration(i) * time.Second)})
	}
	for i := 0; i < 12; i++ {
		gif := []string{"https://media.giphy.com/a.gif", "https://media.giphy.com/b.gif"}[i%2]
		d.send(turma, geral, msg{gif: gif, at: base.Add(time.Duration(i) * time.Second)})
	}
	d.exec(`UPDATE user_badge_stats SET stickers_sent = 20 WHERE user_id = $1`, farm)
	d.exec(`UPDATE user_badge_stats SET stickers_sent = 15 WHERE user_id = $1`, turma)
	d.exec(`INSERT INTO user_badges (user_id, category, tier) VALUES ($1, 'figurinha', 1), ($1, 'voz', 1), ($2, 'figurinha', 1)`, farm, turma)

	d.runBackfill(figurinhaMigration)
	d.runBackfill(figurinhaMigration) // de novo não muda nada
	repo := BadgeRepository(d.db)
	for _, tc := range []struct {
		name  string
		id    string
		value int64
		tiers int
	}{{"farm", farm, 1, 0}, {"turma", turma, 12, 1}} {
		if got := d.stats(tc.id).StickersSent; got != tc.value {
			t.Fatalf("%s stickers = %d, want %d", tc.name, got, tc.value)
		}
		unlocks, _ := repo.Unlocks(d.ctx, tc.id)
		if got := len(unlocks["figurinha"]); got != tc.tiers {
			t.Fatalf("%s figurinha tiers = %v, want %d", tc.name, unlocks["figurinha"], tc.tiers)
		}
	}
	if unlocks, _ := repo.Unlocks(d.ctx, farm); len(unlocks["voz"]) != 1 {
		t.Fatalf("outra categoria mexida: %v", unlocks)
	}
}
