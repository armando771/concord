package music

import "testing"

func TestNeededVotes(t *testing.T) {
	cases := map[int]int{0: 1, 1: 1, 2: 1, 3: 2, 4: 2, 5: 3}
	for humans, want := range cases {
		if got := NeededVotes(humans); got != want {
			t.Errorf("NeededVotes(%d) = %d, want %d", humans, got, want)
		}
	}
}

func TestVotes(t *testing.T) {
	v := NewVotes()
	if !v.Add("ana") || v.Add("ana") || !v.Add("bia") || v.Count() != 2 {
		t.Fatal("add")
	}
	v.Prune([]string{"bia", "caio"})
	if v.Count() != 1 || v.Voters()[0] != "bia" {
		t.Fatalf("prune: %v", v.Voters())
	}
	v.Reset()
	if v.Count() != 0 {
		t.Fatal("reset")
	}
}
