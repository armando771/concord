package badge

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"
)

// recente: criada depois dos dois cortes (Pioneiro e segundo turno), sem
// nada conquistado.
func recente() Stats {
	return Stats{CreatedAt: FounderCutoff.Add(time.Hour), Top10Full: true}
}

func hiddenOf(s Stats) int {
	badges, _ := Evaluate(s, nil, now)
	return HiddenRemaining(s, badges)
}

// Conta recente, vagas do Top 10 acabadas: saem Criador (só dos devs),
// Pioneiro (depois do corte), Top 10 (vagas acabaram) e os três da enquete
// (fora do corte). Caçador de bugs, Primeira mensagem e Aniversariante,
// que a pessoa ainda pode ganhar, ficam na conta.
func TestHiddenRemainingExcludesWhatNoLongerCanBeWon(t *testing.T) {
	if got, want := hiddenOf(recente()), len(Catalog)-6; got != want {
		t.Fatalf("hidden = %d, want %d", got, want)
	}
}

func TestHiddenRemainingTop10CountsWhileThereAreSlots(t *testing.T) {
	s := recente()
	s.Top10Full = false
	if got, want := hiddenOf(s), len(Catalog)-5; got != want {
		t.Fatalf("hidden = %d, want %d", got, want)
	}
}

// Dentro do corte e sem escolher: a enquete vale 1 (a escolha é uma só), e o
// Pioneiro já foi conquistado.
func TestHiddenRemainingPollCountsOnceWhileEligible(t *testing.T) {
	s := recente()
	s.CreatedAt = SegundoTurnoCorte.AddDate(0, 0, -3)
	// Fora: Criador, Top 10 e Pioneiro (já tem) e 2 dos 3 da enquete.
	if got, want := hiddenOf(s), len(Catalog)-5; got != want {
		t.Fatalf("hidden = %d, want %d", got, want)
	}
}

func TestHiddenRemainingPollAnsweredClosesTheOtherTwo(t *testing.T) {
	s := recente()
	s.CreatedAt = SegundoTurnoCorte.AddDate(0, 0, -3)
	s.Escolhas = map[string]bool{"segundo-turno:l": true}
	// Fora: Criador, Top 10, Pioneiro, L (já tem), 22 e Nulo.
	if got, want := hiddenOf(s), len(Catalog)-6; got != want {
		t.Fatalf("hidden = %d, want %d", got, want)
	}
}

func TestHiddenRemainingDropsWhatTheyAlreadyHave(t *testing.T) {
	s := recente()
	before := hiddenOf(s)
	s.MessagesSent = 100
	if after := hiddenOf(s); after != before-1 {
		t.Fatalf("hidden = %d, want %d", after, before-1)
	}
}

func TestHiddenRemainingIsZeroWhenNothingIsLeft(t *testing.T) {
	if got := HiddenRemaining(recente(), allBadges()); got != 0 {
		t.Fatalf("hidden = %d, want 0", got)
	}
}

func allBadges() []Badge {
	out := make([]Badge, len(Catalog))
	for i, c := range Catalog {
		out[i] = Badge{Category: c.Key}
	}
	return out
}

func hiddenBody(t *testing.T, st Stats, viewer string) (map[string]any, string) {
	t.Helper()
	s, store, _, _, _ := newTestService()
	store.stats[ownerID] = st
	w := serve(t, s, "/api/users/"+ownerID+"/badges", viewer)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	var res map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	return res, w.Body.String()
}

// O próprio perfil e o de outra pessoa mostram o mesmo número.
func TestHandlerReturnsHiddenRemainingToSelfAndOthers(t *testing.T) {
	want := float64(len(Catalog) - 6)
	for _, viewer := range []string{ownerID, otherID} {
		res, body := hiddenBody(t, recente(), viewer)
		if res["hidden_remaining"] != want {
			t.Fatalf("viewer %s: hidden_remaining = %v, want %v (%s)", viewer, res["hidden_remaining"], want, body)
		}
	}
}

// Sem nada conquistado, nenhum nome, chave, descrição ou tier do catálogo
// pode aparecer no corpo: só o número.
func TestHandlerHiddenRemainingLeaksNoCategoryData(t *testing.T) {
	for _, viewer := range []string{ownerID, otherID} {
		_, body := hiddenBody(t, recente(), viewer)
		for _, c := range Catalog {
			leaks := []string{`"` + c.Key + `"`, c.Name, c.Description}
			for _, tier := range c.Tiers {
				leaks = append(leaks, tier.Name)
			}
			for _, leak := range leaks {
				if strings.Contains(body, leak) {
					t.Fatalf("viewer %s: %q vazou em %s", viewer, leak, body)
				}
			}
		}
		if !strings.Contains(body, `"badges":[]`) {
			t.Fatalf("badges deveria vir vazio: %s", body)
		}
	}
}

// Chegar ao nível 100 com vaga: ganha Top 10 e Nível, que saem da conta.
func TestServiceBadgesDropsTop10AfterClaimingASlot(t *testing.T) {
	s, st, _, _, _ := newTestService()
	st.stats["a"] = Stats{CreatedAt: recente().CreatedAt, XP: xpForLevel(Top10Level)}
	res, err := s.Badges(context.Background(), "a", "a")
	if err != nil {
		t.Fatal(err)
	}
	// Fora: Criador, Pioneiro, 3 da enquete, Top 10 e Nível (já tem).
	if want := len(Catalog) - 7; res.HiddenRemaining != want {
		t.Fatalf("hidden = %d, want %d", res.HiddenRemaining, want)
	}
}

// Com as 10 vagas dadas, quem não tem uma não conta o Top 10, mesmo no nível 100.
func TestServiceBadgesIgnoresTop10WhenSlotsRanOut(t *testing.T) {
	s, st, _, _, _ := newTestService()
	st.top10 = []string{"1", "2", "3", "4", "5", "6", "7", "8", "9", "10"}
	st.stats["a"] = Stats{CreatedAt: recente().CreatedAt}
	res, err := s.Badges(context.Background(), "a", "a")
	if err != nil {
		t.Fatal(err)
	}
	if want := len(Catalog) - 6; res.HiddenRemaining != want {
		t.Fatalf("hidden = %d, want %d", res.HiddenRemaining, want)
	}
}
