package call

import (
	"errors"
	"testing"
)

func TestAlreadyInCallLocked(t *testing.T) {
	svc, _, _ := newVoiceService(voiceSnapshot())
	putInCall(svc, "c1", "geral", "ana")

	if call, busy, err := svc.alreadyInCallLocked("ana", "geral"); !busy || err != nil || call.ID != "c1" {
		t.Fatalf("na chamada do mesmo canal: (%v, %v, %v), want a própria chamada", call, err, busy)
	}
	if _, busy, err := svc.alreadyInCallLocked("ana", "palco"); !busy || !errors.Is(err, ErrBusy) {
		t.Fatalf("em outra chamada: (%v, %v), want ErrBusy", err, busy)
	}
	if _, busy, _ := svc.alreadyInCallLocked("vip", "geral"); busy {
		t.Fatal("quem não está em chamada está livre")
	}
}
