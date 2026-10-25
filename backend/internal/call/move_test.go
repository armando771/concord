package call

import (
	"errors"
	"testing"

	"gin-quickstart/backend/internal/channel"
)

func voiceChannel(id string) *channel.Channel {
	return &channel.Channel{ID: id, ServerID: "server-1", Type: channel.TypeVoice}
}

var inGeral = voiceLocation{callID: "call-1", channelID: "geral", serverID: "server-1"}

func TestModeratorMovesMember(t *testing.T) {
	if err := checkMove(true, "mod", "dono", "ana", inGeral, true, voiceChannel("jogos")); err != nil {
		t.Fatalf("moderator moving member: %v", err)
	}
}

func TestOnlyModeratorsMove(t *testing.T) {
	err := checkMove(false, "bia", "dono", "ana", inGeral, true, voiceChannel("jogos"))
	if !errors.Is(err, ErrNotModerator) {
		t.Fatalf("member moving = %v, want ErrNotModerator", err)
	}
}

func TestModeratorCannotMoveOwner(t *testing.T) {
	err := checkMove(true, "mod", "dono", "dono", inGeral, true, voiceChannel("jogos"))
	if !errors.Is(err, ErrCannotMoveOwner) {
		t.Fatalf("moving owner = %v, want ErrCannotMoveOwner", err)
	}
	if err := checkMove(true, "dono", "dono", "dono", inGeral, true, voiceChannel("jogos")); err != nil {
		t.Fatalf("owner moving self: %v", err)
	}
}

func TestMoveDestinationRules(t *testing.T) {
	text := &channel.Channel{ID: "chat", ServerID: "server-1", Type: channel.TypeText}
	if err := checkMove(true, "mod", "dono", "ana", inGeral, true, text); !errors.Is(err, ErrNotVoiceChannel) {
		t.Fatalf("text channel = %v, want ErrNotVoiceChannel", err)
	}

	other := &channel.Channel{ID: "x", ServerID: "server-2", Type: channel.TypeVoice}
	if err := checkMove(true, "mod", "dono", "ana", inGeral, true, other); !errors.Is(err, ErrNotInVoice) {
		t.Fatalf("other server = %v, want ErrNotInVoice", err)
	}

	if err := checkMove(true, "mod", "dono", "ana", voiceLocation{}, false, voiceChannel("jogos")); !errors.Is(err, ErrNotInVoice) {
		t.Fatalf("not in voice = %v, want ErrNotInVoice", err)
	}

	if err := checkMove(true, "mod", "dono", "ana", inGeral, true, voiceChannel("geral")); !errors.Is(err, ErrSameChannel) {
		t.Fatalf("same channel = %v, want ErrSameChannel", err)
	}
}

func TestVoiceLocationOf(t *testing.T) {
	s := serviceWithCall("call-1", "ana")
	channelID, serverID := "geral", "server-1"
	s.calls["call-1"].info.ChannelID = &channelID
	s.calls["call-1"].info.ServerID = &serverID
	s.busy["ana"] = "call-1"

	loc, ok := s.voiceLocationOf("ana")
	if !ok || loc != inGeral {
		t.Fatalf("voiceLocationOf(ana) = %+v, %v", loc, ok)
	}
	if _, ok := s.voiceLocationOf("bia"); ok {
		t.Fatal("bia is not in any call")
	}

	s.calls["call-1"].info.Type = TypeDM
	if _, ok := s.voiceLocationOf("ana"); ok {
		t.Fatal("a DM call is not a voice channel")
	}
}
