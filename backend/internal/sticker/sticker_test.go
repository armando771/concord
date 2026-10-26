package sticker

import (
	"context"
	"errors"
	"testing"
	"time"
)

type mockRepo struct {
	stickers map[string]*Sticker
}

func newMockRepo() *mockRepo {
	return &mockRepo{stickers: make(map[string]*Sticker)}
}

func (m *mockRepo) Create(ctx context.Context, s *Sticker) error {
	s.CreatedAt = time.Now()
	m.stickers[s.ID] = s
	return nil
}

func (m *mockRepo) ListByServer(ctx context.Context, serverID string) ([]Sticker, error) {
	res := []Sticker{}
	for _, s := range m.stickers {
		if s.ServerID == serverID {
			res = append(res, *s)
		}
	}
	return res, nil
}

func (m *mockRepo) FindByID(ctx context.Context, id string) (*Sticker, error) {
	if s, ok := m.stickers[id]; ok {
		return s, nil
	}
	return nil, ErrStickerNotFound
}

func (m *mockRepo) CountByServer(ctx context.Context, serverID string) (int, error) {
	count := 0
	for _, s := range m.stickers {
		if s.ServerID == serverID {
			count++
		}
	}
	return count, nil
}

func (m *mockRepo) Delete(ctx context.Context, id string) error {
	if _, ok := m.stickers[id]; !ok {
		return ErrStickerNotFound
	}
	delete(m.stickers, id)
	return nil
}

func TestSanitizeName(t *testing.T) {
	t.Parallel()

	valid, err := sanitizeName("  Legal! ")
	if err != nil || valid != "Legal!" {
		t.Fatalf("expected 'Legal!', got %q (err: %v)", valid, err)
	}

	_, err = sanitizeName("")
	if !errors.Is(err, ErrInvalidName) {
		t.Fatalf("expected ErrInvalidName for empty, got %v", err)
	}

	tooLong := "123456789012345678901234567890123" // 33 chars
	_, err = sanitizeName(tooLong)
	if !errors.Is(err, ErrInvalidName) {
		t.Fatalf("expected ErrInvalidName for too long, got %v", err)
	}
}

func TestMockRepo(t *testing.T) {
	t.Parallel()
	repo := newMockRepo()
	ctx := context.Background()

	stk := &Sticker{
		ID:          "stk-1",
		ServerID:    "srv-1",
		UploaderID:  "usr-1",
		Name:        "smile",
		ContentType: "image/webp",
		SizeBytes:   1234,
	}

	if err := repo.Create(ctx, stk); err != nil {
		t.Fatalf("create failed: %v", err)
	}

	found, err := repo.FindByID(ctx, "stk-1")
	if err != nil || found.Name != "smile" {
		t.Fatalf("find failed: %v, got %+v", err, found)
	}

	count, _ := repo.CountByServer(ctx, "srv-1")
	if count != 1 {
		t.Fatalf("expected count 1, got %d", count)
	}

	list, _ := repo.ListByServer(ctx, "srv-1")
	if len(list) != 1 {
		t.Fatalf("expected list len 1, got %d", len(list))
	}

	if err := repo.Delete(ctx, "stk-1"); err != nil {
		t.Fatalf("delete failed: %v", err)
	}

	_, err = repo.FindByID(ctx, "stk-1")
	if !errors.Is(err, ErrStickerNotFound) {
		t.Fatalf("expected ErrStickerNotFound, got %v", err)
	}
}
