package level

import "testing"

func TestFromXPStartsAtLevelOne(t *testing.T) {
	level, into, next := FromXP(0)
	if level != 1 || into != 0 || next != 155 {
		t.Fatalf("FromXP(0) = %d,%d,%d, want 1,0,155", level, into, next)
	}
}

func TestFromXPCrossesLevelsExactly(t *testing.T) {
	if level, into, _ := FromXP(154); level != 1 || into != 154 {
		t.Fatalf("FromXP(154) = level %d into %d, want 1/154", level, into)
	}
	if level, into, next := FromXP(155); level != 2 || into != 0 || next != 220 {
		t.Fatalf("FromXP(155) = %d,%d,%d, want 2,0,220", level, into, next)
	}
	// 155 + 220 + 295 = 670 → nível 4.
	if level, _, _ := FromXP(670); level != 4 {
		t.Fatalf("FromXP(670) = %d, want 4", level)
	}
}

func TestCurveIsHardAndUnbounded(t *testing.T) {
	// Nível 10 exige mais de 7 horas de call.
	var total int64
	for l := 1; l < 10; l++ {
		total += XPToNext(l)
	}
	if minutes := total / XPPerMinute; minutes < 7*60 {
		t.Fatalf("level 10 in %d minutes, want at least 7h", minutes)
	}

	if level, _, _ := FromXP(1 << 40); level < 1000 {
		t.Fatalf("huge XP gave level %d, want no cap", level)
	}
}
