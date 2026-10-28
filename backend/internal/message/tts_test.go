package message

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestNormalizeTTSContent(t *testing.T) {
	cases := []struct {
		name, in, want string
		err            error
	}{
		{"tira os espaços das pontas", "  oi gente  ", "oi gente", nil},
		{"vazio", "   ", "", ErrContentRequired},
		{"200 caracteres cabem (acentos contam como um)", strings.Repeat("é", TTSMaxLength), strings.Repeat("é", TTSMaxLength), nil},
		{"201 caracteres não", strings.Repeat("a", TTSMaxLength+1), "", ErrTTSTooLong},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := normalizeTTSContent(c.in)
			if !errors.Is(err, c.err) || got != c.want {
				t.Fatalf("got %q, %v; want %q, %v", got, err, c.want, c.err)
			}
		})
	}
}

func TestTTSCooldownUmaPorPessoaACada10s(t *testing.T) {
	clock := &fakeClock{now: time.Unix(1000, 0)}
	cd := newTTSCooldown(TTSCooldown, clock.Now)

	if wait := cd.Take("ana"); wait != 0 {
		t.Fatalf("primeira: wait = %v", wait)
	}
	clock.now = clock.now.Add(3 * time.Second)
	if wait := cd.Take("ana"); wait != 7*time.Second {
		t.Fatalf("3 s depois: wait = %v, want 7s", wait)
	}
	if wait := cd.Take("bia"); wait != 0 {
		t.Fatalf("outra pessoa não espera: wait = %v", wait)
	}
	clock.now = clock.now.Add(7 * time.Second)
	if wait := cd.Take("ana"); wait != 0 {
		t.Fatalf("10 s depois: wait = %v", wait)
	}
}

func TestTTSCooldownReleaseDevolveAVez(t *testing.T) {
	clock := &fakeClock{now: time.Unix(1000, 0)}
	cd := newTTSCooldown(TTSCooldown, clock.Now)
	cd.Take("ana")
	cd.Release("ana")
	if wait := cd.Take("ana"); wait != 0 {
		t.Fatalf("depois do Release: wait = %v", wait)
	}
}

func ttsEnv(store *fakeInviteStore) (*TTSService, *captureCreates, *fakeClock) {
	pub := &captureCreates{}
	clock := &fakeClock{now: time.Unix(1000, 0)}
	s := &TTSService{store: store, channels: fakeRooms{}, convs: fakeRooms{}, publisher: pub, cooldown: newTTSCooldown(TTSCooldown, clock.Now)}
	return s, pub, clock
}

func TestTTSSendToChannelPublicaMensagemTTSNoServidor(t *testing.T) {
	s, pub, _ := ttsEnv(&fakeInviteStore{})
	msg, err := s.SendToChannel(context.Background(), "ch1", "ana", "  bom dia  ")
	if err != nil {
		t.Fatal(err)
	}
	if !msg.TTS || msg.Content != "bom dia" || msg.ChannelID == nil || *msg.ChannelID != "ch1" || msg.ConversationID != nil {
		t.Fatalf("msg = %+v", msg)
	}
	if len(pub.events) != 1 || pub.events[0].ServerID != "s1" || !pub.events[0].Message.TTS {
		t.Fatalf("events = %+v", pub.events)
	}
}

func TestTTSSendToConversationAvisaOsParticipantes(t *testing.T) {
	s, pub, _ := ttsEnv(&fakeInviteStore{})
	msg, err := s.SendToConversation(context.Background(), "dm1", "ana", "oi")
	if err != nil || !msg.TTS || msg.ConversationID == nil || msg.ChannelID != nil {
		t.Fatalf("msg = %+v, err = %v", msg, err)
	}
	if len(pub.events) != 1 || len(pub.events[0].UserIDs) != 2 {
		t.Fatalf("events = %+v", pub.events)
	}
}

func TestTTSSendRespeitaOCooldown(t *testing.T) {
	s, pub, clock := ttsEnv(&fakeInviteStore{})
	if _, err := s.SendToChannel(context.Background(), "ch1", "ana", "um"); err != nil {
		t.Fatal(err)
	}
	clock.now = clock.now.Add(4 * time.Second)
	_, err := s.SendToConversation(context.Background(), "dm1", "ana", "dois")
	var cd *TTSCooldownError
	if !errors.As(err, &cd) || cd.RetryAfter != 6*time.Second {
		t.Fatalf("err = %v, want cooldown de 6s", err)
	}
	if len(pub.events) != 1 {
		t.Fatalf("a segunda não pode sair: %d eventos", len(pub.events))
	}
}

func TestTTSSendInvalidaNaoGastaAVez(t *testing.T) {
	s, _, _ := ttsEnv(&fakeInviteStore{})
	if _, err := s.SendToChannel(context.Background(), "ch1", "ana", strings.Repeat("a", 300)); !errors.Is(err, ErrTTSTooLong) {
		t.Fatalf("err = %v", err)
	}
	if _, err := s.SendToChannel(context.Background(), "ch1", "ana", "agora sim"); err != nil {
		t.Fatalf("texto longo não devia gastar a vez: %v", err)
	}
}

func TestTTSSendQueFalhaNoBancoDevolveAVez(t *testing.T) {
	store := &fakeInviteStore{err: errors.New("db")}
	s, _, _ := ttsEnv(store)
	if _, err := s.SendToChannel(context.Background(), "ch1", "ana", "oi"); err == nil {
		t.Fatal("esperava erro do banco")
	}
	store.err = nil
	if _, err := s.SendToChannel(context.Background(), "ch1", "ana", "oi"); err != nil {
		t.Fatalf("falha no banco não devia gastar a vez: %v", err)
	}
}

func TestScanMessageRowLeTTS(t *testing.T) {
	msg, err := scanMessageRow(fakeRow{tts: true})
	if err != nil || !msg.TTS {
		t.Fatalf("msg=%+v err=%v", msg, err)
	}
}

func TestTTSCooldownLimpaJanelasVencidas(t *testing.T) {
	clock := &fakeClock{now: time.Unix(1000, 0)}
	cd := newTTSCooldown(TTSCooldown, clock.Now)
	for i := 0; i < 1025; i++ {
		cd.Take(strings.Repeat("u", i+1))
	}
	clock.now = clock.now.Add(TTSCooldown)
	cd.Take("nova")
	if len(cd.last) != 1 {
		t.Fatalf("mapa com %d entradas, want só a nova", len(cd.last))
	}
}
