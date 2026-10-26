package proposal

import (
	"context"
	"errors"
	"os"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"gin-quickstart/backend/internal/platform/database"

	"github.com/google/uuid"
)

// SQL do quadro, das imagens, dos comentários e das menções num Postgres de
// verdade (TEST_DATABASE_URL, banco descartável).
func TestRepositoryDB(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL não definido")
	}
	ctx := context.Background()
	db, err := database.Connect(url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := database.Migrate(db, "../../migrations"); err != nil {
		t.Fatal(err)
	}
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	newUser := func() string {
		t.Helper()
		id := uuid.NewString()
		name := "p" + strings.ReplaceAll(id, "-", "")[:12]
		exec(`INSERT INTO users (id, username, display_name, email, password_hash) VALUES ($1, $2::text, $2::text, $2::text || '@ex.com', 'x')`, id, name)
		t.Cleanup(func() { db.Exec(ctx, `DELETE FROM users WHERE id = $1`, id) })
		return id
	}
	author, other, third := newUser(), newUser(), newUser()

	repo := ProposalRepository(db)
	now := time.Now()
	ends := now.Add(VotingDuration)

	// Limite por autor, mesmo com pedidos simultâneos.
	var wg sync.WaitGroup
	var mu sync.Mutex
	created, refused := 0, 0
	for range 8 {
		wg.Go(func() {
			_, err := repo.CreateWithLimit(ctx, author, "Concorrente", "", ends, now, MaxOpenPerUser, nil)
			mu.Lock()
			defer mu.Unlock()
			if err == nil {
				created++
			} else if errors.Is(err, ErrTooManyOpen) {
				refused++
			} else {
				t.Errorf("create: %v", err)
			}
		})
	}
	wg.Wait()
	if created != MaxOpenPerUser || refused != 8-MaxOpenPerUser {
		t.Fatalf("criadas=%d recusadas=%d, esperado %d e %d", created, refused, MaxOpenPerUser, 8-MaxOpenPerUser)
	}

	// Imagens: pendente de outra pessoa não vale; do próprio autor sim.
	img1, img2, foreign := uuid.NewString(), uuid.NewString(), uuid.NewString()
	for _, im := range []struct{ id, uploader string }{{img1, other}, {img2, other}, {foreign, third}} {
		if err := repo.CreateImage(ctx, im.id, im.uploader, "image/png", 10); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := repo.CreateWithLimit(ctx, other, "Imagem alheia", "", ends, now, MaxOpenPerUser, []string{foreign}); !errors.Is(err, ErrInvalidImage) {
		t.Fatalf("imagem de outra pessoa: got %v", err)
	}
	id, err := repo.CreateWithLimit(ctx, other, "Com imagens", "d", ends, now, MaxOpenPerUser, []string{img2, img1})
	if err != nil {
		t.Fatal(err)
	}
	p, err := repo.Get(ctx, id, &other)
	if err != nil {
		t.Fatal(err)
	}
	if len(p.Images) != 2 || p.Images[0].ID != img2 || p.Images[1].ID != img1 || p.Images[0].URL != imageURL(img2) {
		t.Fatalf("imagens na ordem dada: %+v", p.Images)
	}
	if len(p.Images) != 2 || p.CommentCount != 0 || p.EditedAt != nil {
		t.Fatalf("estado inicial: %+v", p)
	}

	// Editar: tirar uma imagem apaga a linha e devolve a id; nenhuma imagem
	// (nil) remove todas.
	removed, err := repo.Update(ctx, id, other, "Título 2", "d2", []string{img2})
	if err != nil || !slices.Equal(removed, []string{img1}) {
		t.Fatalf("update: removidas=%v err=%v", removed, err)
	}
	if removed, err = repo.Update(ctx, id, other, "Título 3", "d3", nil); err != nil || !slices.Equal(removed, []string{img2}) {
		t.Fatalf("update sem imagens: removidas=%v err=%v", removed, err)
	}
	p, _ = repo.Get(ctx, id, nil)
	if p.Title != "Título 3" || p.EditedAt == nil || len(p.Images) != 0 {
		t.Fatalf("depois de editar: %+v", p)
	}

	// Imagens pendentes antigas são limpas.
	old := uuid.NewString()
	if err := repo.CreateImage(ctx, old, other, "image/png", 10); err != nil {
		t.Fatal(err)
	}
	exec(`UPDATE proposal_images SET created_at = NOW() - INTERVAL '2 days' WHERE id = $1`, old)
	cleaned, err := repo.DeletePendingImages(ctx, now.Add(-PendingImageTTL))
	if err != nil || !slices.Contains(cleaned, old) || slices.Contains(cleaned, foreign) {
		t.Fatalf("limpeza de pendentes: %v %v", cleaned, err)
	}

	// Mover antes do prazo marca o fechamento e a proposta segue no quadro.
	before := p.MovedAt
	if err := repo.SetStatus(ctx, id, other, StatusInProgress, other); err != nil {
		t.Fatal(err)
	}
	p, _ = repo.Get(ctx, id, nil)
	if p.Status != StatusInProgress || p.ClosedAt == nil {
		t.Fatalf("mover antes do prazo: %+v", p)
	}
	if !p.MovedAt.After(before) {
		t.Fatalf("moved_at não avançou: %v -> %v", before, p.MovedAt)
	}
	if p.CloseReason == nil || *p.CloseReason != CloseManual || p.ClosedByName == nil {
		t.Fatalf("quem encerrou a votação: reason=%v by=%v", p.CloseReason, p.ClosedByName)
	}
	// Mover de novo avança moved_at e mantém quem encerrou a votação.
	firstMove, closedBy := p.MovedAt, *p.ClosedByName
	if err := repo.SetStatus(ctx, id, third, StatusDone, third); err != nil {
		t.Fatal(err)
	}
	p, _ = repo.Get(ctx, id, nil)
	if !p.MovedAt.After(firstMove) || *p.ClosedByName != closedBy {
		t.Fatalf("segundo move: moved_at %v -> %v, closed_by %q -> %q", firstMove, p.MovedAt, closedBy, *p.ClosedByName)
	}
	if err := repo.SetStatus(ctx, id, other, StatusInProgress, other); err != nil {
		t.Fatal(err)
	}
	missing, _ := repo.WithoutIssue(ctx)
	if !slices.ContainsFunc(missing, func(m Proposal) bool { return m.ID == id }) {
		t.Fatal("proposta movida deveria aparecer em WithoutIssue")
	}

	// Responsável, issue e sincronização (estado + assignee pelo login do GitHub).
	p, _ = repo.Get(ctx, id, nil)
	if p.Assignee == nil || p.Assignee.ID != other {
		t.Fatalf("responsável depois do move: %+v", p.Assignee)
	}
	if err := repo.SetIssue(ctx, id, 77, "https://github.com/o/r/issues/77"); err != nil {
		t.Fatal(err)
	}
	needs := func() bool {
		list, err := repo.NeedingIssueSync(ctx)
		if err != nil {
			t.Fatal(err)
		}
		return slices.ContainsFunc(list, func(m Proposal) bool { return m.ID == id })
	}
	if needs() {
		t.Fatal("issue recém-criada, aberta e sem login do dev: já está em dia")
	}
	login := "Dev-Outro"
	if err := repo.SetGithubUsername(ctx, other, &login); err != nil {
		t.Fatal(err)
	}
	if got, _ := repo.GithubUsername(ctx, other); got == nil || *got != login {
		t.Fatalf("login salvo: %v", got)
	}
	if !needs() {
		t.Fatal("o dev ganhou login: a issue precisa do assignee")
	}
	if err := repo.SetIssueSynced(ctx, id, IssueOpen, &login); err != nil {
		t.Fatal(err)
	}
	if needs() {
		t.Fatal("assignee aplicado: em dia")
	}
	if err := repo.SetStatus(ctx, id, other, StatusDone, other); err != nil {
		t.Fatal(err)
	}
	p, _ = repo.Get(ctx, id, nil)
	if !needs() || p.WantedIssueState() != IssueCompleted || p.AssigneeGithub == nil {
		t.Fatalf("Concluída: a issue precisa fechar (%+v)", p)
	}
	if err := repo.SetIssueSynced(ctx, id, IssueCompleted, &login); err != nil {
		t.Fatal(err)
	}
	if needs() {
		t.Fatal("fechada: em dia")
	}

	// Salinha Bot (migration 000054): bot, sem login e fora dos servidores.
	var isBot bool
	var servers int
	if err := db.QueryRow(ctx, `SELECT is_bot, (SELECT COUNT(*) FROM server_members WHERE user_id = u.id)
		FROM users u WHERE id = '53414c49-4e48-4100-8000-000000000002'`).Scan(&isBot, &servers); err != nil {
		t.Fatalf("Salinha Bot: %v", err)
	}
	if !isBot || servers != 0 {
		t.Fatalf("Salinha Bot: is_bot=%v servidores=%d", isBot, servers)
	}
	if closed, _ := repo.CloseDue(ctx, now.Add(2*VotingDuration)); slices.Contains(closed, id) {
		t.Fatal("CloseDue não pode reprocessar um card já movido")
	}

	// Comentários e menções.
	c1, err := repo.CreateComment(ctx, id, third, "oi @um", []string{other, author}, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := repo.CreateComment(ctx, id, other, "segundo", nil, nil, nil); err != nil {
		t.Fatal(err)
	}
	comments, err := repo.ListComments(ctx, id)
	if err != nil || len(comments) != 2 || comments[0].ID != c1 || len(comments[0].Mentions) != 2 || comments[1].Mentions == nil {
		t.Fatalf("comentários: %+v %v", comments, err)
	}
	if p, _ = repo.Get(ctx, id, nil); p.CommentCount != 2 {
		t.Fatalf("comment_count = %d", p.CommentCount)
	}
	if n, _ := repo.CountRecentComments(ctx, third, now.Add(-time.Minute)); n != 1 {
		t.Fatalf("CountRecentComments = %d", n)
	}
	if err := repo.UpdateComment(ctx, c1, "editado"); err != nil {
		t.Fatal(err)
	}
	if got, _ := repo.GetComment(ctx, c1); got.Body != "editado" || got.EditedAt == nil {
		t.Fatalf("editar comentário: %+v", got)
	}
	if err := repo.UpdateComment(ctx, uuid.NewString(), "x"); !errors.Is(err, ErrCommentNotFound) {
		t.Fatalf("editar inexistente: %v", err)
	}

	pending, err := repo.UnseenMentions(ctx, other)
	if err != nil || len(pending) != 1 || pending[0].CommentID != c1 || pending[0].ProposalTitle != "Título 3" {
		t.Fatalf("menções pendentes: %+v %v", pending, err)
	}
	if err := repo.MarkMentionsSeen(ctx, other, &id); err != nil {
		t.Fatal(err)
	}
	if pending, _ = repo.UnseenMentions(ctx, other); len(pending) != 0 {
		t.Fatalf("depois de ver: %+v", pending)
	}
	if pending, _ = repo.UnseenMentions(ctx, author); len(pending) != 1 {
		t.Fatalf("a menção de outra pessoa continua pendente: %+v", pending)
	}
	if err := repo.MarkMentionsSeen(ctx, author, nil); err != nil {
		t.Fatal(err)
	}
	if pending, _ = repo.UnseenMentions(ctx, author); len(pending) != 0 {
		t.Fatalf("marcar todas: %+v", pending)
	}

	// Bloqueio nos dois sentidos impede a menção; o próprio autor também.
	exec(`INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)`, author, third)
	ok, err := repo.MentionableUsers(ctx, third, []string{author, other, third, uuid.NewString()})
	if err != nil || !slices.Equal(ok, []string{other}) {
		t.Fatalf("MentionableUsers = %v %v", ok, err)
	}

	// Apagar o comentário e depois a proposta leva tudo junto.
	if err := repo.DeleteComment(ctx, c1); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.GetComment(ctx, c1); !errors.Is(err, ErrCommentNotFound) {
		t.Fatalf("comentário apagado: %v", err)
	}
	if err := repo.Delete(ctx, id); err != nil {
		t.Fatal(err)
	}
	if n, _ := repo.ListComments(ctx, id); len(n) != 0 {
		t.Fatalf("comentários deveriam sumir com a proposta: %+v", n)
	}
	t.Cleanup(func() {
		db.Exec(ctx, `DELETE FROM proposals WHERE author_id = ANY($1)`, []string{author, other, third})
	})
}
