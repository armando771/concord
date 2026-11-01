package message

import (
	"context"
	"log"
	"time"

	"gin-quickstart/backend/internal/platform/media"
)

const (
	// OrphanGrace protege o upload que está terminando agora: o arquivo já
	// está no disco mas a linha ainda não foi gravada.
	OrphanGrace = time.Hour
	// PendingTTL é quanto um upload espera virar mensagem antes de ser apagado.
	PendingTTL = 24 * time.Hour
)

type janitorRepo interface {
	DeleteStalePending(ctx context.Context, before time.Time) ([]string, error)
	KnownAttachmentIDs(ctx context.Context, ids []string) (map[string]bool, error)
	CountAttachments(ctx context.Context) (int64, error)
}

// Janitor limpa os arquivos que ficaram sem dono: uploads nunca usados (apaga
// de vez) e arquivos cujas linhas sumiram por cascata (canal, servidor ou DM
// apagados), que vão para a lixeira e só somem depois de media.TrashTTL.
type Janitor struct {
	repo  janitorRepo
	store *media.Store
}

func NewJanitor(repo janitorRepo, store *media.Store) *Janitor {
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

	purged, err := j.store.PurgeTrash(now.Add(-media.TrashTTL))
	if err != nil {
		log.Printf("media janitor: failed to purge trash: %v", err)
	}

	orphans, err := j.sweepOrphans(ctx, now)
	if err != nil {
		return err
	}

	if removed > 0 || orphans > 0 || purged > 0 {
		log.Printf("media janitor: removed %d stale uploads, moved %d orphan files to trash, purged %d from trash", removed, orphans, purged)
	}
	return nil
}

// sweepOrphans manda para a lixeira os arquivos sem linha no banco.
func (j *Janitor) sweepOrphans(ctx context.Context, now time.Time) (int, error) {
	files, err := j.store.List()
	if err != nil {
		return 0, err
	}
	ids := make([]string, 0, len(files))
	for _, f := range files {
		if !f.Temp {
			ids = append(ids, f.ID)
		}
	}
	if len(ids) == 0 {
		return j.trash(orphanFiles(files, nil, now, OrphanGrace), now), nil
	}

	// Banco sem nenhum anexo mas disco com arquivos: quase certamente o banco
	// é novo, foi perdido ou ainda vai ser restaurado. Não mexe em nada.
	total, err := j.repo.CountAttachments(ctx)
	if err != nil {
		return 0, err
	}
	if total == 0 {
		log.Printf("media janitor: WARNING: database has no attachments but %d files are on disk; skipping orphan sweep (wrong or empty DATABASE_URL, or a restore pending?)", len(ids))
		return 0, nil
	}

	known, err := j.repo.KnownAttachmentIDs(ctx, ids)
	if err != nil {
		return 0, err
	}
	return j.trash(orphanFiles(files, known, now, OrphanGrace), now), nil
}

func (j *Janitor) trash(names []string, now time.Time) int {
	n := 0
	for _, name := range names {
		if err := j.store.Trash(name, now); err != nil {
			log.Printf("media janitor: failed to trash %s: %v", name, err)
			continue
		}
		n++
	}
	return n
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
