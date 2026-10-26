package changelog

import (
	"encoding/json"
	"net/http"
	"reflect"
	"testing"
)

func rel(version string, texts ...string) Release {
	r := Release{Version: version, Entries: []Entry{}}
	for _, t := range texts {
		r.Entries = append(r.Entries, Entry{Kind: KindFeature, Text: t})
	}
	return r
}

func entries(texts ...string) []Entry { return rel("", texts...).Entries }

func notesBody(texts ...string) string {
	b, _ := json.Marshal(Publication{Entries: entries(texts...)})
	return string(b)
}

// Regressão 0.6.33–0.6.45: o next.md só era esvaziado no runner do CI, e cada
// deploy republicava todas as notas acumuladas numa versão nova.
func TestPublishDropsNotesFromEarlierReleases(t *testing.T) {
	st := &fakeStore{releases: []Release{rel("0.6.44", "A", "B"), rel("0.6.41", "C")}}
	w := serve(t, st, "tok", http.MethodPut, "/api/changelog/0.6.45", "tok", notesBody("A", "B", "C", "D"), false)
	if w.Code != http.StatusNoContent {
		t.Fatalf("status = %d: %s", w.Code, w.Body.String())
	}
	if got := st.upserts["0.6.45"].Entries; !reflect.DeepEqual(got, entries("D")) {
		t.Fatalf("entradas = %+v", got)
	}
}

// Repetir o deploy da mesma versão mantém as notas dela (só as mais antigas contam).
func TestPublishSameVersionAgainKeepsItsOwnNotes(t *testing.T) {
	st := &fakeStore{releases: []Release{rel("0.6.46", "Z"), rel("0.6.45", "D"), rel("0.6.44", "A")}}
	serve(t, st, "tok", http.MethodPut, "/api/changelog/0.6.45", "tok", notesBody("A", "D"), false)
	if got := st.upserts["0.6.45"].Entries; !reflect.DeepEqual(got, entries("D")) {
		t.Fatalf("entradas = %+v", got)
	}
}

func TestListHidesReleasesWithoutNotes(t *testing.T) {
	withSummary := rel("0.6.2")
	withSummary.Summary = "Primeira versão"
	st := &fakeStore{releases: []Release{rel("0.6.35"), rel("0.6.33", "A"), withSummary}}
	w := serve(t, st, "tok", http.MethodGet, "/api/changelog", "", "", true)
	var got []Release
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0].Version != "0.6.33" || got[1].Version != "0.6.2" {
		t.Fatalf("releases = %+v", got)
	}
}
