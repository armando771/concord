package birthday

import (
	"reflect"
	"testing"
	"time"
)

func TestFormatMessage(t *testing.T) {
	cases := []struct {
		names []string
		want  string
	}{
		{[]string{"ana"}, "🎂 O servidor Galera deseja um feliz aniversário para @ana! Muitas felicidades e ótimas calls! 🎉"},
		{[]string{"ana", "bia"}, "🎂 O servidor Galera deseja um feliz aniversário para @ana e @bia! Muitas felicidades e ótimas calls! 🎉"},
		{[]string{"ana", "bia", "caio"}, "🎂 O servidor Galera deseja um feliz aniversário para @ana, @bia e @caio! Muitas felicidades e ótimas calls! 🎉"},
	}
	for _, c := range cases {
		if got := FormatMessage("Galera", c.names); got != c.want {
			t.Errorf("FormatMessage(%v)\n got %q\nwant %q", c.names, got, c.want)
		}
	}
}

func date(y, m, d int) time.Time { return time.Date(y, time.Month(m), d, 9, 0, 0, 0, time.UTC) }

func TestDatesToCelebrate(t *testing.T) {
	if m, d := DatesToCelebrate(date(2026, 10, 25)); m != 10 || !reflect.DeepEqual(d, []int{25}) {
		t.Fatalf("25/10 = %d %v", m, d)
	}
	// 2026 não é bissexto: quem faz em 29/02 comemora em 28/02.
	if m, d := DatesToCelebrate(date(2026, 2, 28)); m != 2 || !reflect.DeepEqual(d, []int{28, 29}) {
		t.Fatalf("28/02/2026 = %d %v", m, d)
	}
	if _, d := DatesToCelebrate(date(2028, 2, 28)); !reflect.DeepEqual(d, []int{28}) {
		t.Fatalf("28/02/2028 (bissexto) = %v", d)
	}
}

func TestIsBirthday(t *testing.T) {
	if !IsBirthday(25, 10, date(2026, 10, 25)) || IsBirthday(25, 10, date(2026, 10, 26)) {
		t.Fatal("25/10")
	}
	if !IsBirthday(29, 2, date(2026, 2, 28)) || !IsBirthday(29, 2, date(2028, 2, 29)) {
		t.Fatal("29/02 in leap and non-leap years")
	}
}

func TestAge(t *testing.T) {
	if got := Age(2000, date(2026, 10, 25)); got != 26 {
		t.Fatalf("Age = %d, want 26", got)
	}
	// Nascido em 29/02/2004, comemorando em 28/02/2026: faz 22.
	if got := Age(2004, date(2026, 2, 28)); got != 22 {
		t.Fatalf("Age (29/02) = %d, want 22", got)
	}
}
