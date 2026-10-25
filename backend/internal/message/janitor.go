package message

import (
	"context"
	"log"
	"time"

	"gin-quickstart/backend/internal/media"
)

const (
	// OrphanGrace protege o upload que está terminando agora: o arquivo já
	// está no disco mas a linha ainda não foi gravada.
	OrphanGrace = time.Hour
	// PendingTTL é quanto um upload espera virar mensagem antes de ser apagado.
	PendingTTL = 24 * time.Hour
)

// Janitor apaga os arquivos que ficaram sem dono: uploads nunca usados e
// arquivos cujas linhas sumiram por cascata (canal, servidor ou DM apagados).
type Janitor struct {
	repo  *Repository
	store *media.Store
}

func NewJanitor(repo *Repository, store *media.Store) *Janitor {
	return &Janitor{repo: repo, store: store}
}

// Run roda a limpeza agora e depois a cada every, até ctx acabar.
func (j *Janitor) Run(ctx context.Context, every time.Duration) {
	ticker := time.NewTicker(every)
	defer ticker.Stop()
	for {
		if err := j.RunOnce(ctx, time.Now()); err != nil {
			log.Printf("media janitor: %v", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (j *Janitor) RunOnce(ctx context.Context, now time.Time) error {
	stale, err := j.repo.DeleteStalePending(ctx, now.Add(-PendingTTL))
	if err != nil {
		return err
	}
	removed := j.remove(stale)

	files, err := j.store.List()
	if err != nil {
		return err
	}
	ids := make([]string, 0, len(files))
	for _, f := range files {
		if !f.Temp {
			ids = append(ids, f.ID)
		}
	}
	known, err := j.repo.KnownAttachmentIDs(ctx, ids)
	if err != nil {
		return err
	}
	orphans := j.remove(orphanFiles(files, known, now, OrphanGrace))

	if removed > 0 || orphans > 0 {
		log.Printf("media janitor: removed %d stale uploads and %d orphan files", removed, orphans)
	}
	return nil
}

func (j *Janitor) remove(names []string) int {
	n := 0
	for _, name := range names {
		if err := j.store.Remove(name); err != nil {
			log.Printf("media janitor: failed to remove %s: %v", name, err)
			continue
		}
		n++
	}
	return n
}

// orphanFiles escolhe o que apagar: temporários velhos (upload que morreu no
// meio) e arquivos velhos sem linha no banco.
func orphanFiles(files []media.FileInfo, known map[string]bool, now time.Time, grace time.Duration) []string {
	var names []string
	for _, f := range files {
		if now.Sub(f.ModTime) <= grace {
			continue
		}
		if f.Temp || !known[f.ID] {
			names = append(names, f.Name)
		}
	}
	return names
}
