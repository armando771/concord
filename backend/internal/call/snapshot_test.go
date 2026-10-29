package call

import (
	"reflect"
	"testing"
)

func TestCallSnapshotsListActiveCallsOnly(t *testing.T) {
	s := serviceWithCall("call-1", "ana", "bia", "caio")
	s.calls["call-1"].participants["bia"].muted = true
	s.calls["call-1"].participants["caio"].deafened = true
	s.screenSharers["call-1"] = map[string]struct{}{"caio": {}}

	ringing := serviceWithCall("call-2", "duda", "eli")
	ringing.calls["call-2"].info.Status = StatusRinging
	s.calls["call-2"] = ringing.calls["call-2"]

	got := s.CallSnapshots()
	if len(got) != 1 {
		t.Fatalf("snapshots = %+v, want only the active call", got)
	}
	snap := got[0]
	if snap.CallID != "call-1" {
		t.Fatalf("call id = %q", snap.CallID)
	}
	if !reflect.DeepEqual(snap.Participants, []string{"ana", "bia", "caio"}) {
		t.Fatalf("participants = %v", snap.Participants)
	}
	if !reflect.DeepEqual(snap.Voice, []string{"ana"}) {
		t.Fatalf("voice = %v, want the XP-eligible ones (bia muted, caio deafened)", snap.Voice)
	}
	if !reflect.DeepEqual(snap.Listeners, []string{"ana", "bia"}) {
		t.Fatalf("listeners = %v, want everyone not deafened", snap.Listeners)
	}
	if !reflect.DeepEqual(snap.ScreenSharers, []string{"caio"}) {
		t.Fatalf("screen sharers = %v", snap.ScreenSharers)
	}
}

func TestCallSnapshotsListWhoWatchesSomeoneElsesLive(t *testing.T) {
	s := serviceWithCall("call-1", "ana", "bia", "caio", "duda")
	s.screenSharers["call-1"] = map[string]struct{}{"ana": {}, "bia": {}}
	s.calls["call-1"].screenWatchers = map[string]map[string]struct{}{
		// bia assiste à própria transmissão: não conta.
		"bia": {"bia": {}, "caio": {}},
		// caio vê as duas lives e aparece uma vez só; eli já saiu da call.
		"ana": {"caio": {}, "bia": {}, "eli": {}},
		// duda ficou presa a uma live que já acabou.
		"fabi": {"duda": {}},
	}

	got := s.CallSnapshots()[0].ScreenWatchers
	if !reflect.DeepEqual(got, []string{"bia", "caio"}) {
		t.Fatalf("screen watchers = %v, want bia (watching ana) and caio once", got)
	}
}

// O nível do servidor (internal/serverlevel) soma o tempo de call no servidor
// da chamada; chamada de DM vem sem servidor.
func TestCallSnapshotsCarryTheServer(t *testing.T) {
	s := serviceWithCall("call-1", "ana", "bia")
	serverID := "srv-1"
	s.calls["call-1"].info.ServerID = &serverID

	got := s.CallSnapshots()
	if len(got) != 1 || got[0].ServerID == nil || *got[0].ServerID != serverID {
		t.Fatalf("snapshots = %+v, quer ServerID %q", got, serverID)
	}
}
