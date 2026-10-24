package call

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// recordLeaves troca a saída real (que usa banco e WS) por um registro.
func recordLeaves(s *Service) (*sync.Mutex, *[]string) {
	var mu sync.Mutex
	left := []string{}
	s.leaveAfterDisconnect = func(_ context.Context, callID, userID string) error {
		mu.Lock()
		defer mu.Unlock()
		left = append(left, callID+"/"+userID)
		return nil
	}
	return &mu, &left
}

func TestDisconnectWithinGraceKeepsParticipant(t *testing.T) {
	var online atomic.Bool
	s := serviceWithCall("call-1", "user-1")
	s.isOnline = func(string) bool { return online.Load() }
	s.disconnectGrace = 30 * time.Millisecond
	mu, left := recordLeaves(s)

	s.HandleDisconnect("user-1")
	online.Store(true) // reconectou o WS antes do prazo
	time.Sleep(80 * time.Millisecond)

	mu.Lock()
	defer mu.Unlock()
	if len(*left) != 0 {
		t.Fatalf("user left despite reconnecting: %v", *left)
	}
}

func TestDisconnectPastGraceLeavesCall(t *testing.T) {
	s := serviceWithCall("call-1", "user-1")
	s.isOnline = func(string) bool { return false }
	s.disconnectGrace = 10 * time.Millisecond
	mu, left := recordLeaves(s)

	s.HandleDisconnect("user-1")
	time.Sleep(60 * time.Millisecond)

	mu.Lock()
	defer mu.Unlock()
	if len(*left) != 1 || (*left)[0] != "call-1/user-1" {
		t.Fatalf("left = %v, want [call-1/user-1]", *left)
	}
}
