package message

import (
	"context"
	"errors"
	"testing"
)

func TestNewCallInviteMessageIsPlainDMMessageFromInviter(t *testing.T) {
	server := "srv"
	m := newCallInviteMessage("dm1", "ana", CallInvite{CallID: "c1", ChannelID: "ch", ServerID: &server, ChannelName: "Geral", ServerName: "Salinha"})
	if m.AuthorID != "ana" || m.ConversationID == nil || *m.ConversationID != "dm1" || m.ChannelID != nil {
		t.Fatalf("msg = %+v", m)
	}
	// Não é mensagem do sistema: o autor é quem convidou.
	if m.SystemKind != nil || m.CallInvite == nil || m.CallInvite.CallID != "c1" || m.Content != CallInviteContent {
		t.Fatalf("msg = %+v", m)
	}
}

func TestCallInviteColumnRoundTrip(t *testing.T) {
	if callInviteBytes(nil) != nil || parseCallInvite(nil) != nil {
		t.Fatal("sem convite = coluna nula")
	}
	raw := callInviteBytes(&CallInvite{CallID: "c1", ChannelID: "ch", ChannelName: "Geral"})
	got := parseCallInvite(raw)
	if got == nil || got.CallID != "c1" || got.ChannelName != "Geral" {
		t.Fatalf("got = %+v", got)
	}
	// JSON antigo/quebrado não derruba a listagem: vira mensagem comum.
	if parseCallInvite([]byte("{")) != nil || parseCallInvite([]byte("{}")) != nil {
		t.Fatal("JSON ilegível ou sem call_id deve ser ignorado")
	}
}

func TestEditRejectsCallInviteMessages(t *testing.T) {
	invite := convMsg("inv", "ana", CallInviteContent)
	invite.CallInvite = &CallInvite{CallID: "c1", ChannelID: "ch"}
	s, _, _ := editEnv(invite)
	if _, err := s.EditConversationMessage(context.Background(), "dm1", "inv", "ana", "x"); !errors.Is(err, ErrNotEditable) {
		t.Fatalf("convite: err = %v", err)
	}
}
