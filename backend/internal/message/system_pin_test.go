package message

import (
	"context"
	"testing"
)

func TestPublishPinAvisaOServidorDoCanal(t *testing.T) {
	pub := &pinTestPublisher{}
	svc := &Service{publisher: pub, channelResolver: &pinTestResolver{serverID: "s1"}}

	svc.publishPin(context.Background(), "c1", &PinnedMessage{})

	if len(pub.pins) != 1 || pub.pins[0].ChannelID != "c1" || pub.pins[0].ServerID != "s1" {
		t.Fatalf("eventos = %+v, want 1 evento de fixar do canal c1 no servidor s1", pub.pins)
	}
}

func TestPublishPinSemPublisherNaoQuebra(t *testing.T) {
	(&Service{}).publishPin(context.Background(), "c1", &PinnedMessage{})
}
