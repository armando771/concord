package badge

import (
	"context"
	"testing"

	"gin-quickstart/backend/internal/level"
)

func (f *fakeStore) top10RankLocked(userID string) int64 {
	for i, id := range f.top10 {
		if id == userID {
			return int64(i + 1)
		}
	}
	return 0
}

func (f *fakeStore) ClaimTop10(_ context.Context, userID string) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if rank := f.top10RankLocked(userID); rank > 0 {
		return rank, nil
	}
	if len(f.top10) >= Top10Slots {
		return 0, nil
	}
	f.top10 = append(f.top10, userID)
	return int64(len(f.top10)), nil
}

// xpForLevel é o XP mínimo para chegar ao nível n.
func xpForLevel(n int) int64 {
	var xp int64
	for l := 1; l < n; l++ {
		xp += level.XPToNext(l)
	}
	return xp
}

func TestTop10GoesToTheFirstTenAtLevel100(t *testing.T) {
	s, st, pub, _, _ := newTestService()
	top := xpForLevel(Top10Level)
	st.stats["quase"] = Stats{CreatedAt: now, XP: top - 1}
	for _, id := range []string{"u01", "u02", "u03", "u04", "u05", "u06", "u07", "u08", "u09", "u10", "u11"} {
		st.stats[id] = Stats{CreatedAt: now, XP: top}
	}

	// Nível 99 não entra na fila.
	if res, _ := s.Badges(context.Background(), "quase", "quase"); hasCategory(res.Badges.([]Badge), "top10") {
		t.Fatal("nível 99 ganhou o Top 10")
	}
	for _, id := range []string{"u01", "u02", "u03", "u04", "u05", "u06", "u07", "u08", "u09", "u10", "u11"} {
		s.Refresh(context.Background(), id)
	}
	res, _ := s.Badges(context.Background(), "u03", "u03")
	b := find(t, res.Badges.([]Badge), "top10")
	if b.Value != 3 || b.Tier != 1 || b.Rarity != RarityMythic {
		t.Fatalf("u03 top10 = %+v, want #3 mítico", b)
	}
	if res, _ := s.Badges(context.Background(), "u11", "u11"); hasCategory(res.Badges.([]Badge), "top10") {
		t.Fatal("o 11º ganhou o Top 10")
	}
	// Com as 10 vagas cheias, não pergunta mais ao banco.
	if !s.top10Full.Load() {
		t.Fatal("o serviço não guardou que as vagas acabaram")
	}
	// O aviso de badge novo do Top 10 vem antes dos outros (mítico).
	var announced bool
	for _, ev := range pub.events {
		announced = announced || (ev.UserID == "u01" && ev.Unlocks[0].Category == "top10")
	}
	if !announced {
		t.Fatalf("u01 não foi avisado do Top 10 primeiro: %+v", pub.events)
	}
}

func TestTop10ShowsRankToOthers(t *testing.T) {
	s, st, _, _, _ := newTestService()
	st.stats["ana"] = Stats{CreatedAt: now, XP: xpForLevel(Top10Level)}
	st.top10 = []string{"bia", "ana"}
	res, _ := s.Badges(context.Background(), "bia", "ana")
	for _, b := range res.Badges.([]PublicBadge) {
		if b.Category == "top10" {
			if b.Value != 2 {
				t.Fatalf("posição vista por outra pessoa = %d, want 2", b.Value)
			}
			return
		}
	}
	t.Fatal("top10 não aparece no perfil público")
}

func TestTop10IsTheFirstAndRarestBadge(t *testing.T) {
	if Catalog[0].Key != "top10" || !Catalog[0].Exclusive || Catalog[0].Tiers[0].Rarity != RarityMythic {
		t.Fatalf("primeiro do catálogo = %+v, want o Top 10 exclusivo e mítico", Catalog[0])
	}
}

func hasCategory(badges []Badge, key string) bool {
	for _, b := range badges {
		if b.Category == key {
			return true
		}
	}
	return false
}
