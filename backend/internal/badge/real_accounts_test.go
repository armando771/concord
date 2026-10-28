package badge

import (
	"context"
	"errors"
	"reflect"
	"sort"
	"testing"
	"time"

	"gin-quickstart/backend/internal/call"
)

type fakeRealAccounts struct {
	real    map[string]bool
	err     error
	queries [][]string
}

func (f *fakeRealAccounts) RealAccounts(_ context.Context, ids []string) (map[string]bool, error) {
	sorted := append([]string(nil), ids...)
	sort.Strings(sorted)
	f.queries = append(f.queries, sorted)
	if f.err != nil {
		return nil, f.err
	}
	out := map[string]bool{}
	for _, id := range ids {
		if f.real[id] {
			out[id] = true
		}
	}
	return out, nil
}

func twoListeners(ids ...string) call.CallSnapshot {
	return call.CallSnapshot{CallID: "c1", Participants: ids, Listeners: ids}
}

func TestRealAccountsCachesAndAsksOnlyForPeakCandidates(t *testing.T) {
	src := &fakeRealAccounts{real: map[string]bool{"ana": true}}
	s := (&Service{}).WithRealAccounts(src)
	ctx := context.Background()
	alone := call.CallSnapshot{CallID: "c2", Participants: []string{"zé"}, Listeners: []string{"zé"}}

	got := s.realAccountsIn(ctx, []call.CallSnapshot{twoListeners("ana", "bia"), alone}, t0)
	if !reflect.DeepEqual(got, map[string]bool{"ana": true, "bia": false}) {
		t.Fatalf("contas reais = %v", got)
	}
	// Dentro dos 10 min: sem consulta nova.
	s.realAccountsIn(ctx, []call.CallSnapshot{twoListeners("ana", "bia")}, t0.Add(realAccountTTL-time.Second))
	// Venceu: consulta de novo; quem chegou agora vai junto.
	s.realAccountsIn(ctx, []call.CallSnapshot{twoListeners("ana", "bia", "caio")}, t0.Add(realAccountTTL))

	want := [][]string{{"ana", "bia"}, {"ana", "bia", "caio"}}
	if !reflect.DeepEqual(src.queries, want) {
		t.Fatalf("consultas = %v, want %v", src.queries, want)
	}
}

func TestRealAccountsForgetsWhoLeftAndSurvivesErrors(t *testing.T) {
	src := &fakeRealAccounts{real: map[string]bool{"ana": true, "bia": true}}
	s := (&Service{}).WithRealAccounts(src)
	ctx := context.Background()

	s.realAccountsIn(ctx, []call.CallSnapshot{twoListeners("ana", "bia")}, t0)
	src.err = errors.New("banco fora")
	got := s.realAccountsIn(ctx, []call.CallSnapshot{twoListeners("ana", "caio")}, t0.Add(time.Second))
	// ana já conferida segue valendo; caio nunca foi conferido: não conta.
	if !reflect.DeepEqual(got, map[string]bool{"ana": true, "caio": false}) {
		t.Fatalf("com o banco fora = %v", got)
	}
	if _, kept := s.real.checked["bia"]; kept {
		t.Fatal("bia saiu da call e continua no cache")
	}
}

func TestRealAccountsOffWithoutSource(t *testing.T) {
	s := &Service{}
	if got := s.realAccountsIn(context.Background(), []call.CallSnapshot{twoListeners("ana", "bia")}, t0); got != nil {
		t.Fatalf("sem fonte = %v, want nil (todos contam)", got)
	}
}

func TestRepositoryRealAccounts(t *testing.T) {
	d := newTestDB(t)
	real, _ := d.user()
	young, _ := d.user()
	unverified, _ := d.user()
	d.exec(`UPDATE users SET email_verified_at = now(), created_at = now() - interval '8 days' WHERE id = $1`, real)
	d.exec(`UPDATE users SET email_verified_at = now(), created_at = now() - interval '6 days' WHERE id = $1`, young)
	d.exec(`UPDATE users SET email_verified_at = NULL, created_at = now() - interval '30 days' WHERE id = $1`, unverified)

	got, err := BadgeRepository(d.db).RealAccounts(d.ctx, []string{real, young, unverified})
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, map[string]bool{real: true}) {
		t.Fatalf("contas reais = %v, want só a de 8 dias com e-mail confirmado", got)
	}
}
