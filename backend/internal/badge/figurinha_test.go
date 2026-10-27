package badge

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

const figurinhaMigration = "../../migrations/000072_badge_figurinha.up.sql"

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

// Trigger e backfill num Postgres de verdade.
func TestFigurinhaDB(t *testing.T) {
	d := newTestDB(t)
	ana, _ := d.user()
	serverID, channelID := d.server(ana)
	stickerID := uuid.NewString()
	d.exec(`INSERT INTO server_stickers (id, server_id, uploader_id, name, file_id, content_type, size_bytes) VALUES ($1, $2, $3, 'oi', gen_random_uuid(), 'image/png', 10)`, stickerID, serverID, ana)
	base := time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)
	msg := func(n int, sticker, gif any, kind any) {
		d.exec(`INSERT INTO messages (id, author_id, channel_id, content, sticker_id, gif_url, system_kind, created_at) VALUES (gen_random_uuid(), $1, $2, '', $3, $4, $5, $6)`,
			ana, channelID, sticker, gif, kind, base.Add(time.Duration(n)*time.Hour))
	}
	for i := 0; i < 9; i++ {
		msg(i, nil, "https://media.giphy.com/x.gif", nil)
	}
	msg(9, stickerID, nil, nil)  // a 10ª: tier 1
	msg(10, nil, nil, nil)       // texto não conta
	msg(11, stickerID, nil, "x") // mensagem do sistema não conta

	repo := BadgeRepository(d.db)
	s, err := repo.Stats(d.ctx, ana)
	if err != nil || s.StickersSent != 10 {
		t.Fatalf("trigger: stickers = %d, %v (want 10)", s.StickersSent, err)
	}
	d.runBackfill(figurinhaMigration) // o backfill recalcula o mesmo número
	if s, _ = repo.Stats(d.ctx, ana); s.StickersSent != 10 {
		t.Fatalf("backfill: stickers = %d", s.StickersSent)
	}
	unlocks, _ := repo.Unlocks(d.ctx, ana)
	if got := unlocks["figurinha"]; len(got) != 1 || !got[1].Equal(base.Add(9*time.Hour)) {
		t.Fatalf("backfill unlocks = %v", got)
	}
}
