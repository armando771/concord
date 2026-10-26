package message

import (
	"context"
	"errors"
	"testing"

	"gin-quickstart/backend/internal/permission"
)

type pinTestPublisher struct {
	pins   []PinEvent
	unpins []UnpinEvent
}

func (p *pinTestPublisher) PublishMessageCreate(CreateEvent)       {}
func (p *pinTestPublisher) PublishMessageDelete(DeleteEvent)       {}
func (p *pinTestPublisher) PublishMessageUpdate(UpdateEvent)       {}
func (p *pinTestPublisher) PublishPollUpdate(PollUpdateEvent)     {}
func (p *pinTestPublisher) PublishReactionAdd(ReactionEvent)       {}
func (p *pinTestPublisher) PublishReactionRemove(ReactionEvent)    {}
func (p *pinTestPublisher) PublishMessagePin(event PinEvent)       { p.pins = append(p.pins, event) }
func (p *pinTestPublisher) PublishMessageUnpin(event UnpinEvent)   { p.unpins = append(p.unpins, event) }

type pinTestResolver struct {
	serverID string
}

func (r *pinTestResolver) ChannelServerID(ctx context.Context, channelID string) (string, error) {
	return r.serverID, nil
}

type pinTestPerms struct {
	perms int64
	err   error
}

func (p *pinTestPerms) ChannelPerms(ctx context.Context, channelID string, userID string) (int64, error) {
	return p.perms, p.err
}

func TestPinLimits(t *testing.T) {
	if MaxPinnedMessagesPerChannel != 50 {
		t.Fatalf("expected max pins per channel to be 50, got %d", MaxPinnedMessagesPerChannel)
	}
}

func TestPinServicePermissions(t *testing.T) {
	pub := &pinTestPublisher{}
	resolver := &pinTestResolver{serverID: "s1"}
	perms := &pinTestPerms{perms: permission.ViewChannel} // Sem ManageMessages

	svc := MessageService(nil, pub, resolver, nil, nil, perms)

	ctx := context.Background()

	// Tenta verificar permissão sem ManageMessages
	err := svc.canManageChannelMessages(ctx, "ch1", "u1")
	if !errors.Is(err, permission.ErrMissingPermission) {
		t.Fatalf("expected ErrMissingPermission, got %v", err)
	}

	// Com ManageMessages
	perms.perms = permission.ViewChannel | permission.ManageMessages
	if err := svc.canManageChannelMessages(ctx, "ch1", "u1"); err != nil {
		t.Fatalf("expected nil error with ManageMessages, got %v", err)
	}
}
