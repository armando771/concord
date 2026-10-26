package message

import (
	"context"
	"testing"
)

type mockStickerChecker struct {
	serverID string
	err      error
}

func (m *mockStickerChecker) StickerServerID(ctx context.Context, stickerID string) (string, error) {
	return m.serverID, m.err
}

func TestValidateNewMessageWithMedia(t *testing.T) {
	// Regular message with content
	if err := validateNewMessageWithMedia("Hello", nil, false); err != nil {
		t.Fatalf("expected valid message, got %v", err)
	}

	// Message without content but with media (e.g. sticker or gif)
	if err := validateNewMessageWithMedia("", nil, true); err != nil {
		t.Fatalf("expected valid message with media, got %v", err)
	}

	// Message without content and without media should fail
	if err := validateNewMessageWithMedia("", nil, false); err == nil {
		t.Fatalf("expected error for empty message without media")
	}

	// Message with whitespace only and without media should fail
	if err := validateNewMessageWithMedia("   ", nil, false); err == nil {
		t.Fatalf("expected error for whitespace message without media")
	}
}
