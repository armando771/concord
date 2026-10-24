package server

import (
	"strings"
	"testing"
)

func TestNewInviteCodeIsShortAndUnambiguous(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 200; i++ {
		code := newInviteCode()
		if len(code) != inviteCodeLength {
			t.Fatalf("code %q has length %d", code, len(code))
		}
		// sem 0/O e 1/I/L, que se confundem ao digitar
		if strings.ContainsAny(code, "01OIL") {
			t.Fatalf("code %q has ambiguous characters", code)
		}
		seen[code] = true
	}
	if len(seen) < 195 {
		t.Fatalf("codes repeat too much: %d unique of 200", len(seen))
	}
}

func TestNormalizeInviteCodeAcceptsWhatPeopleType(t *testing.T) {
	cases := map[string]string{
		"ABCD2345":     "ABCD2345",
		"abcd2345":     "ABCD2345",
		"  abcd-2345 ": "ABCD2345",
		"ab cd 23 45":  "ABCD2345",
	}
	for input, want := range cases {
		if got := normalizeInviteCode(input); got != want {
			t.Errorf("normalizeInviteCode(%q) = %q, want %q", input, got, want)
		}
	}
}
