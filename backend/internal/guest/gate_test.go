package guest

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

type recRouter struct{ got []string }

func (r *recRouter) HandleCallMessage(userID, evType string, _ json.RawMessage) {
	r.got = append(r.got, userID+" "+evType)
}
func (r *recRouter) IsParticipant(callID, userID string) bool { return callID == "c" && userID == "u" }

func TestGateBlocksGuestOnlyActionsInTheirCall(t *testing.T) {
	w := newWorld()
	inv := w.invite()
	sess, _ := w.svc.JoinAsGuest(context.Background(), inv.Token, "Visita")
	w.calls.in[sess.User.ID] = "sala"
	next := &recRouter{}
	gate := w.svc.Gate(next)

	for _, ev := range []string{"call:lock", "call:knock_respond", "call:activity", "call:activity:stop", "call:soundboard"} {
		gate.HandleCallMessage(sess.User.ID, ev, nil)
	}
	for _, ev := range []string{"call:voice", "call:screen", "call:screen_watch", "call:leave"} {
		gate.HandleCallMessage(sess.User.ID, ev, nil)
	}
	// Membro na mesma call tranca normalmente.
	gate.HandleCallMessage("mod", "call:lock", nil)

	want := []string{
		sess.User.ID + " call:voice", sess.User.ID + " call:screen", sess.User.ID + " call:screen_watch",
		sess.User.ID + " call:leave", "mod call:lock",
	}
	if strings.Join(next.got, ",") != strings.Join(want, ",") {
		t.Fatalf("repassado = %v, want %v", next.got, want)
	}
	refusals := w.notify.sent[sess.User.ID]
	if n := len(refusals); n != 5 || !strings.Contains(refusals[0], `"type":"guest:refused"`) {
		t.Fatalf("o visitante recebe o aviso de cada recusa: %v", refusals)
	}
	// Regressão: call:error sem call_id derruba a call no app (cleanup); a
	// recusa não pode tirar o visitante da call.
	for _, ev := range refusals {
		if strings.Contains(ev, "call:error") {
			t.Fatalf("recusa como call:error derruba a call: %s", ev)
		}
	}
	if !gate.IsParticipant("c", "u") || gate.IsParticipant("c", "x") {
		t.Fatal("IsParticipant repassa")
	}
}
