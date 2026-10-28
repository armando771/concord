package badge

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
)

const reacoesMigration = "../../migrations/000095_badge_reacoes_por_mensagem.up.sql"

func TestReacoesTiers(t *testing.T) {
	c := category(t, "reacoes")
	if c.Unit != UnitReactions || c.Exclusive {
		t.Fatalf("category = %+v", c)
	}
	assertTiers(t, "reacoes", []Tier{
		{"Curtidor", 50, RarityCommon},
		{"Emotivo", 500, RarityRare},
		{"Emojista", 2000, RarityEpic},
	})
}

func TestReacoesBackfillMatchesCatalog(t *testing.T) {
	assertBackfillMatchesCatalog(t, "reacoes", reacoesMigration)
}

// messages cria n mensagens de author no canal e devolve os ids.
func (d *testDB) messages(author, channelID string, n int) []string {
	d.t.Helper()
	ids := make([]string, n)
	for i := range ids {
		ids[i] = uuid.NewString()
		d.exec(`INSERT INTO messages (id, author_id, channel_id, content) VALUES ($1, $2, $3, 'oi')`, ids[i], author, channelID)
	}
	return ids
}

// react põe as reações de userID em messageID.
func (d *testDB) react(messageID, userID string, emojis ...string) {
	d.t.Helper()
	for _, e := range emojis {
		d.exec(`INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)`, messageID, userID, e)
	}
}

func (d *testDB) reactions(repo *Repository, userID string) int64 {
	d.t.Helper()
	s, err := repo.Stats(d.ctx, userID)
	if err != nil {
		d.t.Fatal(err)
	}
	return s.Reactions
}

// Reações contam uma vez por mensagem: várias da mesma pessoa na mesma
// mensagem valem 1, e tirar e pôr de novo não sobe.
func TestReacoesCountOncePerMessageDB(t *testing.T) {
	d := newTestDB(t)
	ana, _ := d.user()
	bia, _ := d.user()
	_, channelID := d.server(bia)
	msgs := d.messages(bia, channelID, 3)
	own := d.messages(ana, channelID, 1)[0]
	repo := BadgeRepository(d.db)

	d.react(msgs[0], ana, "👍", "🔥", "😂", "❤️")
	if got := d.reactions(repo, ana); got != 1 {
		t.Fatalf("4 reações na mesma mensagem = %d, want 1", got)
	}
	d.react(msgs[1], ana, "👍")
	d.react(own, ana, "🎉") // a própria mensagem também conta (como antes)
	if got := d.reactions(repo, ana); got != 3 {
		t.Fatalf("3 mensagens = %d, want 3", got)
	}
	// Tirar, pôr e tirar de novo na mesma mensagem não acumula.
	for i := 0; i < 3; i++ {
		d.react(msgs[2], ana, "👀")
		d.exec(`DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2`, msgs[2], ana)
	}
	d.react(msgs[2], ana, "👀")
	if got := d.reactions(repo, ana); got != 4 {
		t.Fatalf("tira e põe = %d, want 4", got)
	}
	// Tirar uma das reações da mensagem não desconta; tirar a última, sim.
	d.exec(`DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji <> '👍'`, msgs[0], ana)
	if got := d.reactions(repo, ana); got != 4 {
		t.Fatalf("ainda com 👍 = %d, want 4", got)
	}
	d.exec(`DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2`, msgs[0], ana)
	if got := d.reactions(repo, ana); got != 3 {
		t.Fatalf("sem reação na mensagem = %d, want 3", got)
	}
}

// O backfill rebaixa quem farmou várias reações na mesma mensagem e mantém
// quem chegou ao tier por mensagens diferentes, com a data de antes. Depois
// dele, reavaliar não devolve o tier nem avisa desbloqueio.
func TestReacoesBackfillDemotesFarmersDB(t *testing.T) {
	d := newTestDB(t)
	farmer, _ := d.user()
	honest, _ := d.user()
	owner, _ := d.user()
	_, channelID := d.server(owner)
	msgs := d.messages(owner, channelID, 50)

	// Farmou: 60 reações em 3 mensagens (o contador antigo dava Curtidor).
	for _, id := range msgs[:3] {
		emojis := make([]string, 20)
		for i := range emojis {
			emojis[i] = string(rune('a' + i))
		}
		d.react(id, farmer, emojis...)
	}
	// Honesto: uma reação em cada uma das 50 mensagens.
	for _, id := range msgs {
		d.react(id, honest, "👍")
	}
	earned := time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)
	d.exec(`INSERT INTO user_badges (user_id, category, tier, unlocked_at) VALUES ($1, 'reacoes', 1, $3), ($1, 'reacoes', 2, $3), ($2, 'reacoes', 1, $3), ($1, 'mensagens', 1, $3)`, farmer, honest, earned)

	d.runBackfill(reacoesMigration)

	repo := BadgeRepository(d.db)
	unlocks, _ := repo.Unlocks(d.ctx, farmer)
	if got := unlocks["reacoes"]; len(got) != 0 {
		t.Fatalf("farmer reacoes = %v, want rebaixado para nada", got)
	}
	if got := unlocks["mensagens"]; len(got) != 1 {
		t.Fatalf("farmer mensagens = %v: o backfill só mexe em reacoes", got)
	}
	unlocks, _ = repo.Unlocks(d.ctx, honest)
	if got := unlocks["reacoes"]; len(got) != 1 || !got[1].Equal(earned) {
		t.Fatalf("honest reacoes = %v, want o tier 1 de antes", got)
	}

	pub := &fakePublisher{}
	s := BadgeService(repo, pub, &fakeCalls{}, &fakeOnline{}, time.UTC)
	res, err := s.Badges(context.Background(), farmer, farmer)
	if err != nil {
		t.Fatal(err)
	}
	// Sem tier, o badge fica escondido (só aparece depois de conquistado).
	if hasBadge(res.Badges.([]Badge), "reacoes") {
		t.Fatalf("farmer reacoes depois do backfill aparece: %+v", res.Badges)
	}
	for _, ev := range pub.events {
		for _, u := range ev.Unlocks {
			if u.Category == "reacoes" {
				t.Fatalf("avisou desbloqueio de reacoes: %+v", ev)
			}
		}
	}
}
