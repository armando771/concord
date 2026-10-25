package channel

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

type memoryChannelStore struct {
	channels []Channel
	members  map[string]string // userID -> role ("owner", "admin", "member")
}

func newMemoryStore() *memoryChannelStore {
	return &memoryChannelStore{
		members: map[string]string{
			"owner-1":  "owner",
			"mod-1":    "admin",
			"member-1": "member",
		},
	}
}

func (m *memoryChannelStore) Create(_ context.Context, ch *Channel) error {
	maxPos := -1
	for _, existing := range m.channels {
		if existing.ServerID == ch.ServerID && existing.Type == ch.Type && existing.Position > maxPos {
			maxPos = existing.Position
		}
	}
	ch.Position = maxPos + 1
	ch.CreatedAt = time.Now()
	ch.UpdatedAt = ch.CreatedAt
	m.channels = append(m.channels, *ch)
	return nil
}

func (m *memoryChannelStore) FindByID(_ context.Context, id string) (*Channel, error) {
	for _, ch := range m.channels {
		if ch.ID == id {
			copied := ch
			return &copied, nil
		}
	}
	return nil, ErrChannelNotFound
}

func (m *memoryChannelStore) Update(_ context.Context, id string, name string) error {
	for i := range m.channels {
		if m.channels[i].ID == id {
			m.channels[i].Name = name
			m.channels[i].UpdatedAt = time.Now()
			return nil
		}
	}
	return ErrChannelNotFound
}

func (m *memoryChannelStore) Reorder(_ context.Context, serverID string, channelIDs []string) error {
	// Transacional: valida que todos pertencem ao servidor antes de gravar.
	indexByID := make(map[string]int, len(m.channels))
	for i, ch := range m.channels {
		if ch.ServerID == serverID {
			indexByID[ch.ID] = i
		}
	}
	for _, id := range channelIDs {
		if _, ok := indexByID[id]; !ok {
			return ErrChannelNotFound
		}
	}
	for pos, id := range channelIDs {
		idx := indexByID[id]
		m.channels[idx].Position = pos
		m.channels[idx].UpdatedAt = time.Now()
	}
	return nil
}

func (m *memoryChannelStore) Delete(_ context.Context, id string) error {
	for i, ch := range m.channels {
		if ch.ID == id {
			m.channels = append(m.channels[:i], m.channels[i+1:]...)
			return nil
		}
	}
	return ErrChannelNotFound
}

func (m *memoryChannelStore) ListByServerID(_ context.Context, serverID string) ([]Channel, error) {
	var out []Channel
	for _, ch := range m.channels {
		if ch.ServerID == serverID {
			out = append(out, ch)
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Position != out[j].Position {
			return out[i].Position < out[j].Position
		}
		if !out[i].CreatedAt.Equal(out[j].CreatedAt) {
			return out[i].CreatedAt.Before(out[j].CreatedAt)
		}
		return out[i].Name < out[j].Name
	})
	if out == nil {
		out = []Channel{}
	}
	return out, nil
}

func (m *memoryChannelStore) IsMember(_ context.Context, _ string, userID string) (bool, error) {
	_, ok := m.members[userID]
	return ok, nil
}

func (m *memoryChannelStore) IsAdminOrOwner(_ context.Context, _ string, userID string) (bool, error) {
	role := m.members[userID]
	return role == "owner" || role == "admin", nil
}

type recordedPublisher struct {
	reorders []ReorderEvent
	creates  []CreateEvent
	updates  []CreateEvent
	deletes  []DeleteEvent
}

func (p *recordedPublisher) PublishChannelCreate(e CreateEvent)   { p.creates = append(p.creates, e) }
func (p *recordedPublisher) PublishChannelUpdate(e CreateEvent)   { p.updates = append(p.updates, e) }
func (p *recordedPublisher) PublishChannelDelete(e DeleteEvent)   { p.deletes = append(p.deletes, e) }
func (p *recordedPublisher) PublishChannelReorder(e ReorderEvent) { p.reorders = append(p.reorders, e) }

func TestServiceReorderValidation(t *testing.T) {
	svc := ChannelService(newMemoryStore(), nil)

	if _, err := svc.Reorder(context.Background(), "srv-1", nil); !errors.Is(err, ErrInvalidChannelOrder) {
		t.Fatalf("expected ErrInvalidChannelOrder for empty slice, got %v", err)
	}

	if _, err := svc.Reorder(context.Background(), "srv-1", []string{""}); !errors.Is(err, ErrInvalidChannelOrder) {
		t.Fatalf("expected ErrInvalidChannelOrder for blank id, got %v", err)
	}

	if _, err := svc.Reorder(context.Background(), "srv-1", []string{"c1", "c1"}); !errors.Is(err, ErrInvalidChannelOrder) {
		t.Fatalf("expected ErrInvalidChannelOrder for duplicate ids, got %v", err)
	}
}

func TestChannelSandboxEndToEndFlow(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store := newMemoryStore()
	pub := &recordedPublisher{}
	svc := ChannelService(store, pub)
	handler := ChannelHandler(svc)

	router := gin.New()
	api := router.Group("/api")
	ChannelRoutes(api, handler, func(c *gin.Context) {
		if uid := c.GetHeader("X-Test-User"); uid != "" {
			c.Set("userID", uid)
		}
		c.Next()
	})

	doJSON := func(method, path, user string, payload any) *httptest.ResponseRecorder {
		var body []byte
		if payload != nil {
			var err error
			body, err = json.Marshal(payload)
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
		}
		req := httptest.NewRequest(method, path, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if user != "" {
			req.Header.Set("X-Test-User", user)
		}
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}

	// 1. Cria canais de texto e de voz (como no servidor BH RX da evidência)
	createChan := func(name, chType string) Channel {
		rec := doJSON(http.MethodPost, "/api/servers/srv-1/channels", "owner-1", map[string]string{
			"name": name,
			"type": chType,
		})
		if rec.Code != http.StatusCreated {
			t.Fatalf("create %s (%s): status %d body %s", name, chType, rec.Code, rec.Body.String())
		}
		var ch Channel
		if err := json.Unmarshal(rec.Body.Bytes(), &ch); err != nil {
			t.Fatalf("unmarshal channel: %v", err)
		}
		return ch
	}

	t1 := createChan("chat-dos-brothers", TypeText)
	t2 := createChan("avisos", TypeText)
	t3 := createChan("memes", TypeText)

	v1 := createChan("predador", TypeVoice)
	v2 := createChan("conversinhas-2", TypeVoice)
	v3 := createChan("conversinhas-3", TypeVoice)
	v4 := createChan("conversinhas-4", TypeVoice)

	if t1.Position != 0 || t2.Position != 1 || t3.Position != 2 {
		t.Fatalf("unexpected initial text positions: %d, %d, %d", t1.Position, t2.Position, t3.Position)
	}
	if v1.Position != 0 || v2.Position != 1 || v3.Position != 2 || v4.Position != 3 {
		t.Fatalf("unexpected initial voice positions: %d, %d, %d, %d", v1.Position, v2.Position, v3.Position, v4.Position)
	}

	// 2. Permissões: membro comum e não-membro não podem reordenar
	if rec := doJSON(http.MethodPut, "/api/servers/srv-1/channels", "outsider", map[string]any{
		"channel_ids": []string{v4.ID, v1.ID, v2.ID, v3.ID},
	}); rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for outsider, got %d", rec.Code)
	}

	if rec := doJSON(http.MethodPut, "/api/servers/srv-1/channels", "member-1", map[string]any{
		"channel_ids": []string{v4.ID, v1.ID, v2.ID, v3.ID},
	}); rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for regular member, got %d", rec.Code)
	}

	// 3. Moderador (admin) reordena os canais de voz: conversinhas-4 para o topo, conversinhas-2 para o fim
	newVoiceOrder := []string{v4.ID, v1.ID, v3.ID, v2.ID}
	rec := doJSON(http.MethodPut, "/api/servers/srv-1/channels", "mod-1", map[string]any{
		"channel_ids": newVoiceOrder,
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("moderator reorder failed: %d %s", rec.Code, rec.Body.String())
	}

	// Verifica que o evento WebSocket foi emitido para sincronizar todos os usuários
	if len(pub.reorders) != 1 || pub.reorders[0].ServerID != "srv-1" {
		t.Fatalf("expected 1 reorder WS event for srv-1, got %+v", pub.reorders)
	}

	// 4. Dono reordena canais de texto: memes, chat-dos-brothers, avisos
	newTextOrder := []string{t3.ID, t1.ID, t2.ID}
	rec = doJSON(http.MethodPut, "/api/servers/srv-1/channels", "owner-1", map[string]any{
		"channel_ids": newTextOrder,
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("owner reorder failed: %d %s", rec.Code, rec.Body.String())
	}

	// 5. Consulta GET /api/servers/srv-1/channels como membro comum e valida a ordem de texto e voz
	listRec := doJSON(http.MethodGet, "/api/servers/srv-1/channels", "member-1", nil)
	if listRec.Code != http.StatusOK {
		t.Fatalf("list channels failed: %d", listRec.Code)
	}
	var listed []Channel
	if err := json.Unmarshal(listRec.Body.Bytes(), &listed); err != nil {
		t.Fatalf("unmarshal listed: %v", err)
	}

	var gotText, gotVoice []string
	for _, ch := range listed {
		if ch.Type == TypeText {
			gotText = append(gotText, ch.Name)
		} else {
			gotVoice = append(gotVoice, ch.Name)
		}
	}
	wantText := []string{"memes", "chat-dos-brothers", "avisos"}
	wantVoice := []string{"conversinhas-4", "predador", "conversinhas-3", "conversinhas-2"}
	if strings.Join(gotText, ",") != strings.Join(wantText, ",") {
		t.Fatalf("text order = %v, want %v", gotText, wantText)
	}
	if strings.Join(gotVoice, ",") != strings.Join(wantVoice, ",") {
		t.Fatalf("voice order = %v, want %v", gotVoice, wantVoice)
	}

	// 6. Criar novo canal depois de reordenar deve entrar no final (position = 4)
	v5 := createChan("conversinhas-5", TypeVoice)
	if v5.Position != 4 {
		t.Fatalf("new channel position after reorder = %d, want 4", v5.Position)
	}

	// 7. ID inexistente deve retornar 400 sem corromper a ordem anterior
	badRec := doJSON(http.MethodPut, "/api/servers/srv-1/channels", "owner-1", map[string]any{
		"channel_ids": []string{v1.ID, "id-inexistente"},
	})
	if badRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for unknown channel ID, got %d", badRec.Code)
	}

	// 8. Renomear canal existente via PUT /:channelId continua funcionando normalmente
	updRec := doJSON(http.MethodPut, "/api/servers/srv-1/channels/"+v1.ID, "owner-1", map[string]string{
		"name": "predador-lobo",
	})
	if updRec.Code != http.StatusOK {
		t.Fatalf("update channel name failed: %d %s", updRec.Code, updRec.Body.String())
	}
}
