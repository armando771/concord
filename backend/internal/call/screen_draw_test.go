package call

import (
	"context"
	"encoding/json"
	"testing"
	"time"
)

func TestScreenDraw_Workflow(t *testing.T) {
	pub := newCapPublisher()
	svc := CallService(nil, pub, nil, nil, nil, nil, nil)

	callID := "call-draw-test"
	sharerID := "streamer"
	viewerID := "viewer"

	svc.calls[callID] = &activeCall{
		info: &Call{
			ID:     callID,
			Type:   TypeChannel,
			Status: StatusActive,
		},
		participants: map[string]*participantState{
			sharerID: {userID: sharerID, role: RoleMember, joinedAt: time.Now()},
			viewerID: {userID: viewerID, role: RoleMember, joinedAt: time.Now()},
		},
	}

	ctx := context.Background()

	// 1. Draw a stroke
	stroke := DrawStroke{
		ID:    "stroke-1",
		Tool:  "pen",
		Color: "#ef4444",
		Width: 4,
		Points: []DrawPoint{
			{X: 0.1, Y: 0.2},
			{X: 0.3, Y: 0.4},
		},
	}
	err := svc.HandleScreenDraw(ctx, viewerID, ScreenDrawPayload{
		CallID:   callID,
		SharerID: sharerID,
		Stroke:   stroke,
	})
	if err != nil {
		t.Fatalf("HandleScreenDraw failed: %v", err)
	}

	events := pub.callEvents[callID]
	if len(events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(events))
	}

	var drawEv struct {
		Type    string            `json:"type"`
		Payload ScreenDrawPayload `json:"payload"`
	}
	if err := json.Unmarshal(events[0], &drawEv); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if drawEv.Type != "call:screen_draw" {
		t.Errorf("expected call:screen_draw, got %s", drawEv.Type)
	}
	if drawEv.Payload.Stroke.UserID != viewerID {
		t.Errorf("expected stroke user_id = viewer, got %s", drawEv.Payload.Stroke.UserID)
	}
	if len(drawEv.Payload.Stroke.Points) != 2 {
		t.Errorf("expected 2 points, got %d", len(drawEv.Payload.Stroke.Points))
	}

	// 2. Undo a stroke
	err = svc.HandleScreenDrawUndo(ctx, viewerID, ScreenDrawUndoPayload{
		CallID:   callID,
		SharerID: sharerID,
		StrokeID: "stroke-1",
	})
	if err != nil {
		t.Fatalf("HandleScreenDrawUndo failed: %v", err)
	}
	events = pub.callEvents[callID]
	var undoEv struct {
		Type    string                `json:"type"`
		Payload ScreenDrawUndoPayload `json:"payload"`
	}
	if err := json.Unmarshal(events[len(events)-1], &undoEv); err != nil {
		t.Fatalf("unmarshal undo failed: %v", err)
	}
	if undoEv.Type != "call:screen_draw_undo" || undoEv.Payload.StrokeID != "stroke-1" {
		t.Errorf("unexpected undo payload: %+v", undoEv)
	}

	// 3. Clear all drawings
	err = svc.HandleScreenDrawClear(ctx, sharerID, ScreenDrawClearPayload{
		CallID:   callID,
		SharerID: sharerID,
	})
	if err != nil {
		t.Fatalf("HandleScreenDrawClear failed: %v", err)
	}
	events = pub.callEvents[callID]
	var clearEv struct {
		Type    string                 `json:"type"`
		Payload ScreenDrawClearPayload `json:"payload"`
	}
	if err := json.Unmarshal(events[len(events)-1], &clearEv); err != nil {
		t.Fatalf("unmarshal clear failed: %v", err)
	}
	if clearEv.Type != "call:screen_draw_clear" || clearEv.Payload.SharerID != sharerID {
		t.Errorf("unexpected clear payload: %+v", clearEv)
	}

	// 4. Intruders cannot draw
	err = svc.HandleScreenDraw(ctx, "intruder", ScreenDrawPayload{
		CallID:   callID,
		SharerID: sharerID,
		Stroke:   stroke,
	})
	if err != ErrNotAllowed {
		t.Errorf("expected ErrNotAllowed, got %v", err)
	}
}
