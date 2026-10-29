package serverlevel

import "testing"

func TestXPToNextCresceComOQuadradoDoNivel(t *testing.T) {
	tests := []struct {
		level int
		want  int64
	}{
		{1, 250},
		{2, 1000},
		{4, 4000},
		{10, 25000},
	}
	for _, tt := range tests {
		if got := XPToNext(tt.level); got != tt.want {
			t.Errorf("XPToNext(%d) = %d, quer %d", tt.level, got, tt.want)
		}
	}
}

func TestFromXP(t *testing.T) {
	tests := []struct {
		name      string
		xp        int64
		level     int
		into, nxt int64
	}{
		{"sem XP é nível 1", 0, 1, 0, 250},
		{"5 membros novos já dão o nível 2", 250, 2, 0, 1000},
		{"no meio do nível 2", 700, 2, 450, 1000},
		{"nível 5 com 7.500", 7500, 5, 0, 6250},
		{"nível 10 com 71.250", 71250, 10, 0, 25000},
		{"XP negativo fica no nível 1", -10, 1, 0, 250},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			level, into, next := FromXP(tt.xp)
			if level != tt.level || into != tt.into || next != tt.nxt {
				t.Errorf("FromXP(%d) = (%d, %d, %d), quer (%d, %d, %d)", tt.xp, level, into, next, tt.level, tt.into, tt.nxt)
			}
		})
	}
}

func TestNewProgress(t *testing.T) {
	got := newProgress("srv", 1300)
	want := Progress{ServerID: "srv", Level: 3, XP: 1300, XPIntoLevel: 50, XPForNext: 2250}
	if got != want {
		t.Errorf("newProgress = %+v, quer %+v", got, want)
	}
}
