package call

import (
	"testing"
	"time"
)

func TestCalleeReachable(t *testing.T) {
	online := map[string]bool{"ana": true}
	push := map[string]bool{"bia": true}

	t.Run("online sempre pode receber", func(t *testing.T) {
		s := serviceWithCall("call-1")
		s.isOnline = func(id string) bool { return online[id] }
		if !s.calleeReachable("ana") {
			t.Fatal("quem está online deve ser alcançável")
		}
	})

	t.Run("offline sem push continua recusado", func(t *testing.T) {
		s := serviceWithCall("call-1")
		s.isOnline = func(id string) bool { return online[id] }
		if s.calleeReachable("caio") {
			t.Fatal("offline sem push não deve tocar")
		}
	})

	t.Run("offline com push registrado pode tocar", func(t *testing.T) {
		s := serviceWithCall("call-1")
		s.isOnline = func(id string) bool { return online[id] }
		s.SetOfflineRinger(func(id string) bool { return push[id] })
		if !s.calleeReachable("bia") {
			t.Fatal("offline com push deve tocar")
		}
		if s.calleeReachable("caio") {
			t.Fatal("sem push continua recusado")
		}
	})

	t.Run("sem checagem de presença configurada, qualquer um (como antes)", func(t *testing.T) {
		s := serviceWithCall("call-1")
		s.isOnline = nil
		if !s.calleeReachable("qualquer") {
			t.Fatal("sem isOnline não há o que recusar")
		}
	})
}

// Regressão: o toque para quem está offline não pode mudar HandleDisconnect, que usa isOnline puro
// (senão quem desconectou ficaria como fantasma na chamada).
func TestOfflineRingerNaoAfetaIsOnline(t *testing.T) {
	s := serviceWithCall("call-1")
	s.isOnline = func(string) bool { return false }
	s.SetOfflineRinger(func(string) bool { return true })
	if s.isOnline("bia") {
		t.Fatal("isOnline deve continuar refletindo só a conexão")
	}
}

func ringingDM(pub *fakePublisher) *Service {
	s := serviceWithCall("call-1", "ana")
	s.publisher = pub
	ac := s.calls["call-1"]
	ac.info.Type = TypeDM
	ac.info.Status = StatusRinging
	ac.inviteeID = "bia"
	ac.info.InitiatorID = "ana"
	s.busy["ana"] = "call-1"
	return s
}

func TestExpireRinging(t *testing.T) {
	t.Run("sem resposta a chamada termina e libera quem ligou", func(t *testing.T) {
		pub := &fakePublisher{}
		s := ringingDM(pub)
		s.expireRinging("call-1")
		if _, ok := s.calls["call-1"]; ok {
			t.Fatal("a chamada deveria ter saído da memória")
		}
		if _, busy := s.busy["ana"]; busy {
			t.Fatal("quem ligou deveria ficar livre")
		}
		if len(pub.eventsOf("call:ended")) == 0 {
			t.Fatal("esperava call:ended")
		}
	})

	t.Run("chamada já atendida não é derrubada", func(t *testing.T) {
		pub := &fakePublisher{}
		s := ringingDM(pub)
		s.calls["call-1"].info.Status = StatusActive
		s.expireRinging("call-1")
		if _, ok := s.calls["call-1"]; !ok {
			t.Fatal("chamada ativa não pode expirar")
		}
	})

	t.Run("chamada que não existe mais é ignorada", func(t *testing.T) {
		s := ringingDM(&fakePublisher{})
		delete(s.calls, "call-1")
		s.expireRinging("call-1")
	})
}

func TestScheduleRingTimeout(t *testing.T) {
	pub := &fakePublisher{}
	s := ringingDM(pub)
	s.ringTimeout = 10 * time.Millisecond
	s.scheduleRingTimeout("call-1")
	deadline := time.After(2 * time.Second)
	for {
		s.mu.RLock()
		_, ok := s.calls["call-1"]
		s.mu.RUnlock()
		if !ok {
			return
		}
		select {
		case <-deadline:
			t.Fatal("o limite de toque não encerrou a chamada")
		case <-time.After(5 * time.Millisecond):
		}
	}
}

func TestDMInviteHook(t *testing.T) {
	s := serviceWithCall("call-1")
	var got []DMInvite
	s.OnDMInvite(func(i DMInvite) { got = append(got, i) })
	s.notifyDMInvite(DMInvite{CallID: "call-1", ConversationID: "cv-1", CalleeID: "bia", InitiatorName: "Ana"})
	if len(got) != 1 || got[0].CalleeID != "bia" || got[0].InitiatorName != "Ana" {
		t.Fatalf("hook recebeu %+v", got)
	}
}
