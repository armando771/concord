package message

import "testing"

type stubCommands struct{ got string }

func (s *stubCommands) HandleCommand(serverID, channelID, userID, content string) bool {
	s.got = serverID + "|" + channelID + "|" + userID + "|" + content
	return content == "/play x"
}

func TestHandlerCommandHook(t *testing.T) {
	h := &Handler{}
	stub := &stubCommands{}
	h.SetCommandHandler(stub)
	if !h.tryCommand("srv", "ch", "u", "/play x", nil) || stub.got != "srv|ch|u|/play x" {
		t.Fatalf("comando não desviado: %q", stub.got)
	}
	if h.tryCommand("srv", "ch", "u", "oi", nil) {
		t.Fatal("mensagem comum desviada")
	}
	if h.tryCommand("srv", "ch", "u", "/play x", []string{"anexo"}) {
		t.Fatal("mensagem com anexo nunca é comando")
	}
}
