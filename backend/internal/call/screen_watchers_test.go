package call

import (
	"context"
	"encoding/json"
	"testing"
	"time"
)

func TestScreenWatchers_Workflow(t *testing.T) {
	pub := newCapPublisher()
	svc := CallService(nil, pub, nil, nil, nil, nil, nil)
	svc.lookupUser = func(_ context.Context, uid string) (UserInfo, error) {
		return UserInfo{ID: uid, Username: uid, DisplayName: "User " + uid}, nil
	}

	callID := "call-test"
	sharerID := "user-streamer"
	watcher1 := "user-w1"
	watcher2 := "user-w2"

	svc.calls[callID] = &activeCall{
		info: &Call{
			ID:     callID,
			Type:   TypeChannel,
			Status: StatusActive,
		},
		participants: map[string]*participantState{
			sharerID: {userID: sharerID, role: RoleMember, joinedAt: time.Now()},
			watcher1: {userID: watcher1, role: RoleMember, joinedAt: time.Now()},
			watcher2: {userID: watcher2, role: RoleMember, joinedAt: time.Now()},
		},
	}
	svc.screenSharers[callID] = map[string]struct{}{
		sharerID: {},
	}

	ctx := context.Background()

	// 1. watcher1 starts watching
	err := svc.SetScreenWatching(ctx, callID, sharerID, watcher1, true)
	if err != nil {
		t.Fatalf("SetScreenWatching(true) failed: %v", err)
	}

	events := pub.callEvents[callID]
	if len(events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(events))
	}

	var ev struct {
		Type    string              `json:"type"`
		Payload ScreenWatchersEvent `json:"payload"`
	}
	if err := json.Unmarshal(events[0], &ev); err != nil {
		t.Fatalf("unmarshal event failed: %v", err)
	}
	if ev.Type != "call:screen_watchers" {
		t.Errorf("expected type call:screen_watchers, got %s", ev.Type)
	}
	if len(ev.Payload.Watchers) != 1 || ev.Payload.Watchers[0].ID != watcher1 {
		t.Fatalf("expected watchers [watcher1], got %+v", ev.Payload.Watchers)
	}

	// 2. watcher2 also starts watching
	err = svc.SetScreenWatching(ctx, callID, sharerID, watcher2, true)
	if err != nil {
		t.Fatalf("SetScreenWatching(watcher2) failed: %v", err)
	}
	events = pub.callEvents[callID]
	if err := json.Unmarshal(events[len(events)-1], &ev); err != nil {
		t.Fatalf("unmarshal event failed: %v", err)
	}
	if len(ev.Payload.Watchers) != 2 {
		t.Fatalf("expected 2 watchers, got %d", len(ev.Payload.Watchers))
	}

	// 3. GetState should include watchers
	state, err := svc.GetState(ctx, callID)
	if err != nil {
		t.Fatalf("GetState failed: %v", err)
	}
	if len(state.ScreenWatchers[sharerID]) != 2 {
		t.Fatalf("expected 2 watchers in GetState, got %d", len(state.ScreenWatchers[sharerID]))
	}

	// 4. watcher1 stops watching
	err = svc.SetScreenWatching(ctx, callID, sharerID, watcher1, false)
	if err != nil {
		t.Fatalf("SetScreenWatching(false) failed: %v", err)
	}
	events = pub.callEvents[callID]
	if err := json.Unmarshal(events[len(events)-1], &ev); err != nil {
		t.Fatalf("unmarshal event failed: %v", err)
	}
	if len(ev.Payload.Watchers) != 1 || ev.Payload.Watchers[0].ID != watcher2 {
		t.Fatalf("expected [watcher2], got %+v", ev.Payload.Watchers)
	}

	// 5. watcher2 leaves call -> watchers becomes empty
	_, _, err = svc.detachParticipant(callID, watcher2)
	if err != nil {
		t.Fatalf("detachParticipant failed: %v", err)
	}
	events = pub.callEvents[callID]
	if err := json.Unmarshal(events[len(events)-1], &ev); err != nil {
		t.Fatalf("unmarshal event failed: %v", err)
	}
	if len(ev.Payload.Watchers) != 0 {
		t.Fatalf("expected 0 watchers after watcher2 leaves, got %+v", ev.Payload.Watchers)
	}
}

func TestScreenWatchers_SharerStopsSharing(t *testing.T) {
	pub := newCapPublisher()
	svc := CallService(nil, pub, nil, nil, nil, nil, nil)
	svc.lookupUser = func(_ context.Context, uid string) (UserInfo, error) {
		return UserInfo{ID: uid, Username: uid, DisplayName: "User " + uid}, nil
	}

	callID := "call-stop-sharing"
	sharerID := "streamer"
	watcher1 := "watcher"

	svc.calls[callID] = &activeCall{
		info: &Call{
			ID:     callID,
			Type:   TypeChannel,
			Status: StatusActive,
		},
		participants: map[string]*participantState{
			sharerID: {userID: sharerID, role: RoleMember, joinedAt: time.Now()},
			watcher1: {userID: watcher1, role: RoleMember, joinedAt: time.Now()},
		},
	}
	svc.screenSharers[callID] = map[string]struct{}{
		sharerID: {},
	}

	ctx := context.Background()

	_ = svc.SetScreenWatching(ctx, callID, sharerID, watcher1, true)

	// Streamer stops sharing screen
	err := svc.SetScreenShare(ctx, callID, sharerID, false)
	if err != nil {
		t.Fatalf("SetScreenShare(false) failed: %v", err)
	}

	events := pub.callEvents[callID]
	var foundWatchersEmpty bool
	for _, raw := range events {
		var ev struct {
			Type    string              `json:"type"`
			Payload ScreenWatchersEvent `json:"payload"`
		}
		if err := json.Unmarshal(raw, &ev); err == nil && ev.Type == "call:screen_watchers" {
			if ev.Payload.SharerID == sharerID && len(ev.Payload.Watchers) == 0 {
				foundWatchersEmpty = true
				break
			}
		}
	}
	if !foundWatchersEmpty {
		t.Fatal("expected empty watchers event when screen share stopped")
	}
}
