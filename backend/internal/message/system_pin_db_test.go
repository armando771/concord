package message

import (
	"testing"
)

// Mensagem de sistema fixada, num Postgres de verdade (TEST_DATABASE_URL).
func TestCreateAndPinSystemMessage(t *testing.T) {
	s := newSearchDB(t)
	pub := &pinTestPublisher{}
	svc := MessageService(MessageRepository(s.db), pub, &pinTestResolver{serverID: s.serverID}, nil, nil, nil)
	robo := s.users["robo"]

	has, err := svc.HasSystemMessage(s.ctx, s.geral, "music_commands")
	if err != nil || has {
		t.Fatalf("antes de postar: has=%v err=%v, want false,nil", has, err)
	}

	if err := svc.CreateAndPinSystemMessage(s.ctx, s.geral, robo, "lista de comandos", "music_commands"); err != nil {
		t.Fatal(err)
	}

	has, err = svc.HasSystemMessage(s.ctx, s.geral, "music_commands")
	if err != nil || !has {
		t.Fatalf("depois de postar: has=%v err=%v, want true,nil", has, err)
	}
	pins, err := svc.repository.ListPinnedMessages(s.ctx, s.geral)
	if err != nil {
		t.Fatal(err)
	}
	var found *PinnedMessage
	for i := range pins {
		if pins[i].Content == "lista de comandos" {
			found = &pins[i]
		}
	}
	if found == nil {
		t.Fatalf("mensagem não está entre as fixadas: %+v", pins)
	}
	if found.AuthorID != robo || found.SystemKind == nil || *found.SystemKind != "music_commands" {
		t.Fatalf("fixada = autor %q kind %v", found.AuthorID, found.SystemKind)
	}
	if len(pub.pins) != 1 || pub.pins[0].ChannelID != s.geral || pub.pins[0].ServerID != s.serverID {
		t.Fatalf("eventos de fixar = %+v, want 1 no canal", pub.pins)
	}

	// Desafixar não faz a mensagem sumir: o marcador continua, então não reposta.
	if err := svc.repository.UnpinMessage(s.ctx, s.geral, found.ID); err != nil {
		t.Fatal(err)
	}
	if has, _ := svc.HasSystemMessage(s.ctx, s.geral, "music_commands"); !has {
		t.Fatal("HasSystemMessage deveria seguir true depois de desafixar")
	}
}
