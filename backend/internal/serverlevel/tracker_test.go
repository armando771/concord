package serverlevel

import (
	"reflect"
	"sort"
	"testing"
	"time"

	"gin-quickstart/backend/internal/call"
)

var t0 = time.Date(2026, 10, 28, 20, 0, 0, 0, time.UTC)

func srv(id string) *string { return &id }

func allReal(ids ...string) map[string]bool {
	out := make(map[string]bool, len(ids))
	for _, id := range ids {
		out[id] = true
	}
	return out
}

// minutes roda n ticks de 10 s com a mesma foto.
func minutes(tr *tracker, n int, snaps []call.CallSnapshot, real map[string]bool) {
	for i := 1; i <= n*6; i++ {
		tr.accrue(snaps, real, t0.Add(time.Duration(i)*tickInterval))
	}
}

func sorted(gs []grant) []grant {
	sort.Slice(gs, func(i, j int) bool {
		if gs[i].userID != gs[j].userID {
			return gs[i].userID < gs[j].userID
		}
		return gs[i].source < gs[j].source
	})
	return gs
}

func TestTrackerVozDaUmXPPorMinutoDeQuemEstaEmCallDeVerdade(t *testing.T) {
	tr := newTracker(t0)
	snap := call.CallSnapshot{ServerID: srv("s1"), Voice: []string{"ana", "bia"}, Listeners: []string{"ana", "bia"}}
	minutes(tr, 2, []call.CallSnapshot{snap}, allReal("ana", "bia"))

	want := []grant{{"s1", "ana", SourceVoice, 2}, {"s1", "bia", SourceVoice, 2}}
	if got := sorted(tr.drain()); !reflect.DeepEqual(got, want) {
		t.Errorf("drain = %+v, quer %+v", got, want)
	}
}

func TestTrackerIgnoraContaNaoRealECallDeDM(t *testing.T) {
	tr := newTracker(t0)
	dm := call.CallSnapshot{Voice: []string{"ana", "bia"}, Listeners: []string{"ana", "bia"}}
	server := call.CallSnapshot{ServerID: srv("s1"), Voice: []string{"ana", "fake"}, Listeners: []string{"ana", "fake"}}
	minutes(tr, 1, []call.CallSnapshot{dm, server}, allReal("ana", "bia"))

	want := []grant{{"s1", "ana", SourceVoice, 1}}
	if got := tr.drain(); !reflect.DeepEqual(got, want) {
		t.Errorf("drain = %+v, quer %+v", got, want)
	}
}

// Quem está AFK já chega fora de Voice, ScreenSharers e ScreenWatchers (o
// call.AFK filtra) e em Away, que a presença olha.
func TestTrackerAFKNaoConta(t *testing.T) {
	tr := newTracker(t0)
	snap := call.CallSnapshot{
		ServerID:  srv("s1"),
		Voice:     []string{"ana"},
		Listeners: []string{"ana", "bia", "caio"},
		Away:      []string{"bia", "caio"},
	}
	minutes(tr, 1, []call.CallSnapshot{snap}, allReal("ana", "bia", "caio"))

	want := []grant{{"s1", "ana", SourceVoice, 1}}
	if got := tr.drain(); !reflect.DeepEqual(got, want) {
		t.Errorf("drain = %+v, quer %+v (sem presença: só 1 pessoa ativa)", got, want)
	}
}

func TestTrackerLiveEEspectador(t *testing.T) {
	tr := newTracker(t0)
	snap := call.CallSnapshot{
		ServerID:       srv("s1"),
		Listeners:      []string{"ana", "bia"},
		ScreenSharers:  []string{"ana"},
		ScreenWatchers: []string{"bia"},
	}
	minutes(tr, 3, []call.CallSnapshot{snap}, allReal("ana", "bia"))

	want := []grant{{"s1", "ana", SourceStream, 3}, {"s1", "bia", SourceWatch, 3}}
	if got := sorted(tr.drain()); !reflect.DeepEqual(got, want) {
		t.Errorf("drain = %+v, quer %+v", got, want)
	}
}

func TestTrackerLiveSemNinguemOuvindoESpectadorSurdoNaoContam(t *testing.T) {
	tr := newTracker(t0)
	sozinha := call.CallSnapshot{ServerID: srv("s1"), Listeners: []string{"ana"}, ScreenSharers: []string{"ana"}}
	surdo := call.CallSnapshot{ServerID: srv("s2"), Listeners: []string{"caio"}, ScreenSharers: []string{"caio"}, ScreenWatchers: []string{"duda"}}
	minutes(tr, 2, []call.CallSnapshot{sozinha, surdo}, allReal("ana", "caio", "duda"))

	if got := tr.drain(); len(got) != 0 {
		t.Errorf("drain = %+v, quer nada", got)
	}
}

func TestTrackerPresencaPrecisaDeTresContasReaisAtivas(t *testing.T) {
	tr := newTracker(t0)
	snap := call.CallSnapshot{ServerID: srv("s1"), Listeners: []string{"ana", "bia", "caio", "fake"}}
	minutes(tr, 1, []call.CallSnapshot{snap}, allReal("ana", "bia", "caio"))

	want := []grant{{"s1", "ana", SourcePresence, 1}, {"s1", "bia", SourcePresence, 1}, {"s1", "caio", SourcePresence, 1}}
	if got := sorted(tr.drain()); !reflect.DeepEqual(got, want) {
		t.Errorf("drain = %+v, quer %+v", got, want)
	}

	// Duas reais e uma fake não fazem a call cheia.
	tr2 := newTracker(t0)
	snap2 := call.CallSnapshot{ServerID: srv("s1"), Listeners: []string{"ana", "bia", "fake"}}
	minutes(tr2, 1, []call.CallSnapshot{snap2}, allReal("ana", "bia"))
	if got := tr2.drain(); len(got) != 0 {
		t.Errorf("drain = %+v, quer nada (conta fake não completa a call)", got)
	}
}

func TestTrackerGuardaOsSegundosQueNaoFecharamMinuto(t *testing.T) {
	tr := newTracker(t0)
	snap := call.CallSnapshot{ServerID: srv("s1"), Voice: []string{"ana"}, Listeners: []string{"ana", "bia"}}
	for i := 1; i <= 9; i++ { // 90 s
		tr.accrue([]call.CallSnapshot{snap}, allReal("ana"), t0.Add(time.Duration(i)*tickInterval))
	}
	if got := tr.drain(); !reflect.DeepEqual(got, []grant{{"s1", "ana", SourceVoice, 1}}) {
		t.Fatalf("primeiro drain = %+v", got)
	}
	for i := 10; i <= 12; i++ { // mais 30 s: fecha o segundo minuto
		tr.accrue([]call.CallSnapshot{snap}, allReal("ana"), t0.Add(time.Duration(i)*tickInterval))
	}
	if got := tr.drain(); !reflect.DeepEqual(got, []grant{{"s1", "ana", SourceVoice, 1}}) {
		t.Errorf("segundo drain = %+v, quer o minuto fechado com o resto", got)
	}
}

func TestTrackerSaiuDaCallPerdeOResto(t *testing.T) {
	tr := newTracker(t0)
	snap := call.CallSnapshot{ServerID: srv("s1"), Voice: []string{"ana"}, Listeners: []string{"ana", "bia"}}
	for i := 1; i <= 3; i++ {
		tr.accrue([]call.CallSnapshot{snap}, allReal("ana"), t0.Add(time.Duration(i)*tickInterval))
	}
	tr.drain()
	tr.accrue(nil, nil, t0.Add(4*tickInterval))
	tr.drain()
	if len(tr.pending) != 0 {
		t.Errorf("pending = %+v, quer vazio depois de sair", tr.pending)
	}
}

func TestTrackerNaoDaDeUmaVezOTempoDeUmServidorTravado(t *testing.T) {
	tr := newTracker(t0)
	snap := call.CallSnapshot{ServerID: srv("s1"), Voice: []string{"ana"}, Listeners: []string{"ana", "bia"}}
	tr.accrue([]call.CallSnapshot{snap}, allReal("ana"), t0.Add(time.Hour))
	if got := tr.drain(); len(got) != 0 {
		t.Errorf("drain = %+v, quer nada (vale só um tick)", got)
	}
}

func TestTrackerRestoreDevolveOQueNaoFoiGravado(t *testing.T) {
	tr := newTracker(t0)
	tr.restore(grant{"s1", "ana", SourceVoice, 3})
	if got := tr.drain(); !reflect.DeepEqual(got, []grant{{"s1", "ana", SourceVoice, 3}}) {
		t.Errorf("drain = %+v", got)
	}
}
