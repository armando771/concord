package message

import (
	"reflect"
	"sort"
	"testing"
	"time"

	"gin-quickstart/backend/internal/media"
)

func TestOrphanFiles(t *testing.T) {
	now := time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC)
	old := now.Add(-2 * time.Hour)
	fresh := now.Add(-10 * time.Minute)

	files := []media.FileInfo{
		{Name: "known", ID: "known", ModTime: old},                  // conhecido e velho → fica
		{Name: "gone", ID: "gone", ModTime: old},                    // linha sumiu por cascata → sai
		{Name: "arriving", ID: "arriving", ModTime: fresh},          // upload terminando agora → fica
		{Name: ".tmp-stuck", ID: "stuck", Temp: true, ModTime: old}, // temporário velho → sai
		{Name: ".tmp-live", ID: "live", Temp: true, ModTime: fresh}, // temporário novo → fica
	}
	known := map[string]bool{"known": true}

	got := orphanFiles(files, known, now, time.Hour)
	sort.Strings(got)
	want := []string{".tmp-stuck", "gone"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("orphanFiles = %v, want %v", got, want)
	}
}
