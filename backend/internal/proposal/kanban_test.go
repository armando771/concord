package proposal

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

// approvedCard cria um card do u1 já fora da votação (Aprovada, com issue 7).
func approvedCard(t *testing.T, s *Service, st *fakeStore) *Proposal {
	t.Helper()
	p, err := s.Create(context.Background(), "u1", "Modo escuro melhor", "", nil)
	if err != nil {
		t.Fatal(err)
	}
	st.items[p.ID].Status = StatusProposed
	return p
}

func newKanbanService(issues IssueCreator) (*Service, *fakeStore, *fakeNotifier) {
	st, pub := newFakeStore(), &fakePublisher{}
	s := newService(st, pub, issues, []string{"tech", "tech2"})
	s.now = func() time.Time { return t0 }
	n := &fakeNotifier{}
	s.WithNotifier(n)
	return s, st, n
}

func TestNextAssignee(t *testing.T) {
	ana := &UserRef{ID: "ana", Name: "Ana"}
	cases := []struct {
		name     string
		current  *UserRef
		mover    string
		status   string
		takeOver bool
		want     string
		conflict bool
	}{
		{"ninguém com o card: quem move fica", nil, "beto", StatusInProgress, false, "beto", false},
		{"o próprio dev move", ana, "ana", StatusProposed, false, "ana", false},
		{"Concluída mantém quem estava", ana, "beto", StatusDone, false, "ana", false},
		{"Concluída sem ninguém: quem fechou fica", nil, "beto", StatusDone, false, "beto", false},
		{"card de outro dev sem confirmar", ana, "beto", StatusInProgress, false, "", true},
		{"tirar de Concluída também pede", ana, "beto", StatusProposed, false, "", true},
		{"confirmou: passa para quem moveu", ana, "beto", StatusRejected, true, "beto", false},
	}
	for _, c := range cases {
		got, err := nextAssignee(c.current, c.mover, c.status, c.takeOver)
		if c.conflict {
			var conflict *AssigneeConflictError
			if !errors.As(err, &conflict) || conflict.AssigneeName != "Ana" || !errors.Is(err, ErrAssigneeConflict) {
				t.Errorf("%s: esperava conflito com Ana, veio %v", c.name, err)
			}
			continue
		}
		if err != nil || got != c.want {
			t.Errorf("%s: got %q %v, want %q", c.name, got, err, c.want)
		}
	}
}

func TestSetStatusAssignsAndAsksToTakeOver(t *testing.T) {
	s, st, _ := newKanbanService(nil)
	ctx := context.Background()
	p := approvedCard(t, s, st)

	got, err := s.SetStatus(ctx, p.ID, "tech", StatusInProgress, false)
	if err != nil || got.Assignee == nil || got.Assignee.ID != "tech" {
		t.Fatalf("quem arrastou fica com o card: %+v %v", got.Assignee, err)
	}
	// Outro dev fecha (deploy do colega): o card continua com quem estava.
	got, err = s.SetStatus(ctx, p.ID, "tech2", StatusDone, false)
	if err != nil || got.Assignee.ID != "tech" {
		t.Fatalf("Concluída mantém o responsável: %+v %v", got.Assignee, err)
	}
	// Outro dev tirando de Concluída: precisa confirmar.
	if _, err := s.SetStatus(ctx, p.ID, "tech2", StatusInProgress, false); !errors.Is(err, ErrAssigneeConflict) {
		t.Fatalf("esperava pedir confirmação, veio %v", err)
	}
	if st.items[p.ID].Status != StatusDone {
		t.Fatal("sem confirmar o card não pode mover")
	}
	got, err = s.SetStatus(ctx, p.ID, "tech2", StatusInProgress, true)
	if err != nil || got.Assignee.ID != "tech2" || got.Status != StatusInProgress {
		t.Fatalf("confirmado: muda o responsável: %+v %v", got, err)
	}
}

func TestBotTellsTheAuthor(t *testing.T) {
	issues := &fakeIssues{}
	s, st, n := newKanbanService(issues)
	ctx := context.Background()
	p := approvedCard(t, s, st)

	if _, err := s.SetStatus(ctx, p.ID, "tech", StatusInProgress, false); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SetStatus(ctx, p.ID, "tech", StatusDone, false); err != nil {
		t.Fatal(err)
	}
	msgs := n.sent["u1"]
	if len(msgs) != 2 {
		t.Fatalf("o autor deveria receber 2 avisos, veio %v", msgs)
	}
	if !strings.Contains(msgs[0], "nome-tech") || !strings.Contains(msgs[0], "Modo escuro melhor") {
		t.Errorf("em andamento diz quem está fazendo: %q", msgs[0])
	}
	if !strings.Contains(msgs[1], "concluída") || !strings.Contains(msgs[1], "issues/7") {
		t.Errorf("concluída leva o link da issue: %q", msgs[1])
	}
	for uid := range n.sent {
		if uid != "u1" {
			t.Errorf("só o autor recebe aviso, veio para %s", uid)
		}
	}
}

func TestBotSkipsAuthorWhoMovedOwnCard(t *testing.T) {
	s, st, n := newKanbanService(nil)
	p, _ := s.Create(context.Background(), "tech", "Ideia do próprio dev", "", nil)
	st.items[p.ID].Status = StatusProposed
	if _, err := s.SetStatus(context.Background(), p.ID, "tech", StatusInProgress, false); err != nil {
		t.Fatal(err)
	}
	if len(n.sent) != 0 {
		t.Fatalf("quem moveu o próprio card não recebe aviso: %v", n.sent)
	}
}

func TestBotTellsVotingResult(t *testing.T) {
	s, st, n := newKanbanService(nil)
	ctx := context.Background()
	p, _ := s.Create(ctx, "u1", "Votação encerrada", "", nil)
	if _, err := s.Vote(ctx, p.ID, "u2", true); err != nil {
		t.Fatal(err)
	}
	st.items[p.ID].VotingEndsAt = t0.Add(-time.Minute)
	s.Tick(ctx)
	if msgs := n.sent["u1"]; len(msgs) != 1 || !strings.Contains(msgs[0], "aprovada na votação (1 sim, 0 não)") {
		t.Fatalf("aviso do fim da votação: %v", msgs)
	}
}

func TestStatusMessages(t *testing.T) {
	manual, deadline := CloseManual, CloseDeadline
	url := "https://github.com/o/r/issues/9"
	base := Proposal{Title: "Tema", YesVotes: 3, NoVotes: 1}
	with := func(status string, reason *string) Proposal {
		p := base
		p.Status, p.CloseReason = status, reason
		return p
	}
	done := with(StatusDone, &manual)
	done.GithubIssueURL = &url
	cases := []struct {
		before, after Proposal
		want          string
	}{
		{with(StatusVoting, nil), with(StatusProposed, &deadline), "aprovada na votação (3 sim, 1 não)"},
		{with(StatusVoting, nil), with(StatusProposed, &manual), "aprovada pelo time"},
		{with(StatusVoting, nil), with(StatusRejected, &deadline), "não foi aprovada na votação"},
		{with(StatusProposed, nil), with(StatusRejected, &manual), "recusada pelo time"},
		{with(StatusInProgress, nil), with(StatusProposed, &manual), "voltou para a fila"},
		{with(StatusInProgress, nil), done, "concluída! 🎉 Acompanhe: " + url},
	}
	for _, c := range cases {
		if got := statusMessage(c.before, c.after); !strings.Contains(got, c.want) || !strings.Contains(got, "“Tema”") {
			t.Errorf("%s → %s: %q não contém %q", c.before.Status, c.after.Status, got, c.want)
		}
	}
	if statusMessage(with(StatusDone, nil), with(StatusDone, nil)) != "" {
		t.Error("sem mudar de coluna não há aviso")
	}
}

func TestIssueFollowsTheCard(t *testing.T) {
	issues := &fakeIssues{}
	s, st, _ := newKanbanService(issues)
	ctx := context.Background()
	st.github["tech"] = "dev-tech"
	p := approvedCard(t, s, st)

	if _, err := s.SetStatus(ctx, p.ID, "tech", StatusInProgress, false); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SetStatus(ctx, p.ID, "tech", StatusDone, false); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SetStatus(ctx, p.ID, "tech", StatusRejected, false); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SetStatus(ctx, p.ID, "tech", StatusProposed, false); err != nil {
		t.Fatal(err)
	}
	want := []fakeIssueUpdate{
		{7, IssueOpen, "dev-tech"},       // assignee ao pegar o card
		{7, IssueCompleted, "dev-tech"},  // Concluída fecha
		{7, IssueNotPlanned, "dev-tech"}, // Rejeitada fecha como não planejada
		{7, IssueOpen, "dev-tech"},       // voltou: reabre
	}
	if len(issues.updates) != len(want) {
		t.Fatalf("atualizações da issue: %+v", issues.updates)
	}
	for i := range want {
		if issues.updates[i] != want[i] {
			t.Fatalf("atualização %d: got %+v want %+v", i, issues.updates[i], want[i])
		}
	}
}

func TestRateLimitWaitsAndContinues(t *testing.T) {
	issues := &fakeIssues{limited: true}
	s, st, _ := newKanbanService(issues)
	ctx := context.Background()
	st.github["tech"] = "dev-tech" // a issue nova precisa ganhar o assignee
	p := approvedCard(t, s, st)

	// Sem API: o card move do mesmo jeito; a issue fica para depois.
	if _, err := s.SetStatus(ctx, p.ID, "tech", StatusInProgress, false); err != nil {
		t.Fatalf("o limite da API não pode travar o quadro: %v", err)
	}
	s.Tick(ctx)
	if st.items[p.ID].GithubIssueURL != nil || len(issues.updates) != 0 {
		t.Fatal("com o limite esgotado nada pode ser aplicado")
	}
	// O limite resetou: o próximo Tick cria a issue e aplica o estado.
	issues.limited = false
	s.Tick(ctx)
	if st.items[p.ID].GithubIssueURL == nil {
		t.Fatal("depois do reset a issue deveria ser criada")
	}
	if len(issues.updates) == 0 {
		t.Fatal("depois do reset a issue deveria ser sincronizada")
	}
}

func TestRejectedAssigneeIsNotRetriedForever(t *testing.T) {
	issues := &fakeIssues{rejectAssignee: "sem-acesso"}
	s, st, _ := newKanbanService(issues)
	ctx := context.Background()
	st.github["tech"] = "sem-acesso"
	p := approvedCard(t, s, st)
	if _, err := s.SetStatus(ctx, p.ID, "tech", StatusInProgress, false); err != nil {
		t.Fatal(err)
	}
	n := len(issues.updates)
	s.Tick(ctx)
	s.Tick(ctx)
	if len(issues.updates) != n {
		t.Fatalf("assignee recusado não pode ser tentado de novo: %+v", issues.updates)
	}
}

func TestGithubUsername(t *testing.T) {
	s, st, _ := newKanbanService(nil)
	ctx := context.Background()
	if _, err := s.SetGithubUsername(ctx, "u1", "alguem"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("só o time tech: %v", err)
	}
	for _, bad := range []string{"-comeca", "tem espaço", "a--b", strings.Repeat("a", 40)} {
		if _, err := s.SetGithubUsername(ctx, "tech", bad); !errors.Is(err, ErrInvalidGithubLogin) {
			t.Errorf("%q deveria ser recusado: %v", bad, err)
		}
	}
	got, err := s.SetGithubUsername(ctx, "tech", " @Dev-Tech ")
	if err != nil || got == nil || *got != "Dev-Tech" || st.github["tech"] != "Dev-Tech" {
		t.Fatalf("salvar: %v %v", got, err)
	}
	board, _ := s.Board(ctx, "tech")
	if board.GithubUsername == nil || *board.GithubUsername != "Dev-Tech" {
		t.Fatal("o quadro devolve o login de quem é do time")
	}
	if got, err := s.SetGithubUsername(ctx, "tech", ""); err != nil || got != nil {
		t.Fatalf("vazio apaga: %v %v", got, err)
	}
}
