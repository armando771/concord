package level

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

type fakeRankingStore struct {
	top      []RankingEntry
	rank     map[string]MyRank
	topCalls int
	err      error
}

func (f *fakeRankingStore) TopRanking(_ context.Context, limit int) ([]RankingEntry, error) {
	f.topCalls++
	if f.err != nil {
		return nil, f.err
	}
	if limit < len(f.top) {
		return f.top[:limit], nil
	}
	return f.top, nil
}

func (f *fakeRankingStore) RankOf(_ context.Context, userID string) (MyRank, bool, error) {
	r, ok := f.rank[userID]
	return r, ok, f.err
}

func entries(n int) []RankingEntry {
	out := make([]RankingEntry, n)
	for i := range out {
		out[i] = RankingEntry{UserID: string(rune('a' + i)), XP: int64(1000 - i)}
	}
	return out
}

func newRankingTest(store *fakeRankingStore) (*RankingService, *time.Time) {
	now := t0
	s := &RankingService{store: store, ttl: time.Minute, now: func() time.Time { return now }}
	return s, &now
}

func TestRankingNumeraPosicoesELevel(t *testing.T) {
	store := &fakeRankingStore{top: []RankingEntry{{UserID: "a", XP: 5000}, {UserID: "b", XP: 100}}}
	s, _ := newRankingTest(store)

	got, err := s.Get(context.Background(), "x", 100)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Entries) != 2 || got.Entries[0].Position != 1 || got.Entries[1].Position != 2 {
		t.Fatalf("posições = %+v", got.Entries)
	}
	wantLevel, _, _ := FromXP(5000)
	if got.Entries[0].Level != wantLevel {
		t.Errorf("nível = %d, quer %d", got.Entries[0].Level, wantLevel)
	}
}

func TestRankingCacheCurto(t *testing.T) {
	store := &fakeRankingStore{top: entries(3)}
	s, now := newRankingTest(store)
	ctx := context.Background()

	s.Get(ctx, "x", 100)
	s.Get(ctx, "x", 100)
	if store.topCalls != 1 {
		t.Fatalf("consultas dentro do TTL = %d, quer 1", store.topCalls)
	}
	*now = now.Add(61 * time.Second)
	s.Get(ctx, "x", 100)
	if store.topCalls != 2 {
		t.Errorf("consultas depois do TTL = %d, quer 2", store.topCalls)
	}
}

func TestRankingLimiteMenorUsaOMesmoCache(t *testing.T) {
	store := &fakeRankingStore{top: entries(5)}
	s, _ := newRankingTest(store)
	ctx := context.Background()

	s.Get(ctx, "x", 100)
	got, _ := s.Get(ctx, "x", 3)
	if len(got.Entries) != 3 || store.topCalls != 1 {
		t.Errorf("entradas = %d, consultas = %d; quer 3 e 1", len(got.Entries), store.topCalls)
	}
}

func TestRankingLimiteFicaEntre1eMax(t *testing.T) {
	for in, want := range map[int]int{-5: DefaultRankingLimit, 0: DefaultRankingLimit, 7: 7, 500: MaxRankingLimit} {
		if got := clampRankingLimit(in); got != want {
			t.Errorf("clamp(%d) = %d, quer %d", in, got, want)
		}
	}
}

func TestRankingPosicaoDeQuemEstaForaDoTop(t *testing.T) {
	store := &fakeRankingStore{
		top:  entries(2),
		rank: map[string]MyRank{"fora": {Position: 250, XP: 40}},
	}
	s, _ := newRankingTest(store)

	got, err := s.Get(context.Background(), "fora", 100)
	if err != nil {
		t.Fatal(err)
	}
	if got.Me == nil || got.Me.Position != 250 || got.Me.XP != 40 {
		t.Fatalf("me = %+v", got.Me)
	}
	if want, _, _ := FromXP(40); got.Me.Level != want {
		t.Errorf("nível de me = %d, quer %d", got.Me.Level, want)
	}
}

func TestRankingQuemNaoTemXPNaoTemPosicao(t *testing.T) {
	s, _ := newRankingTest(&fakeRankingStore{top: entries(2)})

	got, err := s.Get(context.Background(), "novato", 100)
	if err != nil {
		t.Fatal(err)
	}
	if got.Me != nil {
		t.Errorf("me = %+v, quer nil", got.Me)
	}
}

func TestRankingErroDoBancoNaoCacheiaVazio(t *testing.T) {
	store := &fakeRankingStore{err: errors.New("banco fora")}
	s, _ := newRankingTest(store)
	ctx := context.Background()

	if _, err := s.Get(ctx, "x", 100); err == nil {
		t.Fatal("quer erro")
	}
	store.err = nil
	store.top = entries(1)
	got, err := s.Get(ctx, "x", 100)
	if err != nil || len(got.Entries) != 1 {
		t.Errorf("depois do erro: %+v, %v", got.Entries, err)
	}
}

func TestRankingHandlerResponde(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store := &fakeRankingStore{top: entries(2), rank: map[string]MyRank{"eu": {Position: 9, XP: 5}}}
	service, _ := newRankingTest(store)
	h := LevelRankingHandler(service)

	r := gin.New()
	r.GET("/levels/ranking", func(c *gin.Context) { c.Set("userID", "eu"); h.Get(c) })
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/levels/ranking?limit=1", nil))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	var body Ranking
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Entries) != 1 || body.Me == nil || body.Me.Position != 9 {
		t.Errorf("corpo = %s", w.Body.String())
	}
}

func TestRankingHandlerListaVaziaNaoViraNull(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service, _ := newRankingTest(&fakeRankingStore{top: []RankingEntry{}})
	h := LevelRankingHandler(service)

	r := gin.New()
	r.GET("/levels/ranking", func(c *gin.Context) { c.Set("userID", "eu"); h.Get(c) })
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/levels/ranking", nil))

	if !strings.Contains(w.Body.String(), `"entries":[]`) {
		t.Errorf("corpo = %s", w.Body.String())
	}
}

func TestRankingHandlerSemLoginNegado(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := LevelRankingHandler(&RankingService{})
	r := gin.New()
	r.GET("/levels/ranking", h.Get)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/levels/ranking", nil))
	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d", w.Code)
	}
}
