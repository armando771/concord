package websocket

import (
	"encoding/json"
	"testing"

	"gin-quickstart/backend/internal/message"
)

// O aviso de menção, @all/@here e DM é decidido no app, a partir do
// message:create. Ele precisa chegar a quem não está com a conversa aberta
// (sala do servidor para canal, sala user:<id> para DM) e a mais ninguém.

type deliveredMessage struct {
	ServerID string          `json:"server_id"`
	Message  message.Message `json:"message"`
}

// messageCreates devolve os message:create que chegaram ao cliente.
func messageCreates(t *testing.T, c *Client) []deliveredMessage {
	t.Helper()
	var out []deliveredMessage
	for len(c.send) > 0 {
		var ev struct {
			Type    string           `json:"type"`
			Payload deliveredMessage `json:"payload"`
		}
		if err := json.Unmarshal(<-c.send, &ev); err != nil {
			t.Fatalf("evento inválido: %v", err)
		}
		if ev.Type == "message:create" {
			out = append(out, ev.Payload)
		}
	}
	return out
}

// connectAs registra o usuário com a sala pessoal (como o app ao conectar)
// e as salas pedidas.
func connectAs(h *Hub, userID string, rooms ...string) *Client {
	c := newTestClient(h, userID)
	h.Register(c)
	h.Subscribe(c, "user:"+userID)
	for _, room := range rooms {
		h.Subscribe(c, room)
	}
	return c
}

func TestChannelMentionReachesMembersWithTheChannelClosed(t *testing.T) {
	h := NewHub()
	h.SetVisibility(staticVisibility{visibilitySnapshot()})

	// ana está em outro canal (ou na tela de amigos): só a sala do servidor.
	ana := connectAs(h, "ana", "server:s1")
	// dono está lendo o geral.
	dono := connectAs(h, "dono", "server:s1", "channel:geral")
	// intruso não é membro: nem a sala do servidor ele consegue (o validador
	// barra), e mesmo se estivesse nela o filtro por permissão não entrega.
	intruso := connectAs(h, "intruso", "server:s1")
	// estranho não tem nada a ver com o servidor.
	estranho := connectAs(h, "estranho")
	for _, c := range []*Client{ana, dono, intruso, estranho} {
		events(c)
	}

	geral := "geral"
	everyone := message.MentionAll
	for _, content := range []string{"oi @ana", "@all reunião"} {
		msg := message.Message{ID: content, AuthorID: "dono", ChannelID: &geral, Content: content}
		if content == "@all reunião" {
			msg.MentionEveryone = &everyone
		}
		h.PublishMessageCreate(message.CreateEvent{ServerID: "s1", ChannelID: &geral, Message: msg})
	}

	got := messageCreates(t, ana)
	if len(got) != 2 {
		t.Fatalf("ana recebeu %d message:create, want 2", len(got))
	}
	for _, ev := range got {
		// O app só monta a menção com o server_id (rota do aviso).
		if ev.ServerID != "s1" || ev.Message.ChannelID == nil || *ev.Message.ChannelID != "geral" {
			t.Fatalf("payload sem servidor/canal: %+v", ev)
		}
	}
	if got[1].Message.MentionEveryone == nil || *got[1].Message.MentionEveryone != "all" {
		t.Fatalf("@all perdeu o mention_everyone: %+v", got[1].Message)
	}
	// Quem está no canal recebe pelas duas salas (o app junta pelo id).
	if n := len(messageCreates(t, dono)); n == 0 {
		t.Fatal("dono, lendo o canal, não recebeu a mensagem")
	}
	if n := len(messageCreates(t, intruso)); n != 0 {
		t.Fatalf("não-membro recebeu %d mensagens do canal", n)
	}
	if n := len(messageCreates(t, estranho)); n != 0 {
		t.Fatalf("usuário de fora recebeu %d mensagens do canal", n)
	}
}

func TestMentionInPrivateChannelSkipsWhoCannotSeeIt(t *testing.T) {
	h := NewHub()
	h.SetVisibility(staticVisibility{visibilitySnapshot()})
	ana := connectAs(h, "ana", "server:s1")
	vip := connectAs(h, "vip", "server:s1")
	events(ana)
	events(vip)

	secret := "segredo"
	h.PublishMessageCreate(message.CreateEvent{ServerID: "s1", ChannelID: &secret, Message: message.Message{
		ID: "m1", AuthorID: "dono", ChannelID: &secret, Content: "@ana @vip olhem isso",
	}})

	if n := len(messageCreates(t, ana)); n != 0 {
		t.Fatalf("ana não vê o canal privado mas recebeu %d mensagens", n)
	}
	if n := len(messageCreates(t, vip)); n != 1 {
		t.Fatalf("vip vê o canal privado e recebeu %d mensagens, want 1", n)
	}
}

func TestDMReachesParticipantsWithTheConversationClosed(t *testing.T) {
	h := NewHub()
	// bia não abriu a DM: só a sala pessoal. ana está com ela aberta.
	bia := connectAs(h, "bia")
	ana := connectAs(h, "ana", "conversation:c1")
	carol := connectAs(h, "carol")
	for _, c := range []*Client{bia, ana, carol} {
		events(c)
	}

	conv := "c1"
	h.PublishMessageCreate(message.CreateEvent{
		ConversationID: &conv,
		UserIDs:        []string{"ana", "bia"},
		Message:        message.Message{ID: "m1", AuthorID: "ana", ConversationID: &conv, Content: "oi"},
	})

	got := messageCreates(t, bia)
	if len(got) != 1 || got[0].Message.ConversationID == nil || *got[0].Message.ConversationID != "c1" {
		t.Fatalf("bia (DM fechada) recebeu %+v, want a mensagem da c1", got)
	}
	if n := len(messageCreates(t, ana)); n == 0 {
		t.Fatal("ana, com a DM aberta, não recebeu a mensagem")
	}
	if n := len(messageCreates(t, carol)); n != 0 {
		t.Fatalf("carol não participa da DM e recebeu %d mensagens", n)
	}
}
