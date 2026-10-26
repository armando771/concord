package proposal

import (
	"strings"
	"testing"
	"time"
)

func TestIssueBodyFull(t *testing.T) {
	closed := time.Date(2026, 10, 20, 2, 0, 0, 0, time.UTC) // 19/10 em Brasília
	edited := time.Date(2026, 10, 15, 15, 0, 0, 0, time.UTC)
	reason, by := CloseManual, "Léo"
	p := Proposal{
		Description: "Quero isso, @octocat", AuthorName: "Ana",
		CreatedAt: time.Date(2026, 10, 13, 12, 0, 0, 0, time.UTC),
		ClosedAt:  &closed, CloseReason: &reason, ClosedByName: &by, EditedAt: &edited,
		YesVotes: 3, NoVotes: 1, CommentCount: 2,
		Comments: []Comment{
			{AuthorName: "Bia", Body: "Boa ideia\nconcordo", CreatedAt: closed, Attachments: []CommentAttachment{{}, {}}},
			{AuthorName: "Caio", Body: "Eu também </details> @ana", CreatedAt: closed},
		},
	}
	got := issueBody(p, "")
	for _, want := range []string{
		"Quero isso, @\u200boctocat",
		"## Sobre a proposta",
		"| Autor | Ana |",
		"| Aberta em | 13/10/2026 |",
		"| Votação | 3 sim, 1 não (75% a favor) |",
		"| Resultado | Movida pelo time (Léo) em 19/10/2026 |",
		"| Comentários | 2 |",
		"| Editada em | 15/10/2026 |",
		"<summary>Discussão no card (2)</summary>",
		"**Bia** (19/10/2026):\n> Boa ideia\n> concordo [2 anexo(s)]",
		"Eu também  @\u200bana",
		"Criada automaticamente a partir de uma proposta da comunidade.",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("corpo sem %q:\n%s", want, got)
		}
	}
	if strings.Count(got, "</details>") != 1 {
		t.Errorf("</details> colado pela pessoa quebra o bloco:\n%s", got)
	}
}

func TestIssueBodyMinimal(t *testing.T) {
	got := issueBody(Proposal{AuthorName: "Ana"}, "")
	for _, want := range []string{"_Sem descrição._", "| Votação | 0 sim, 0 não |", "Prazo da votação encerrado"} {
		if !strings.Contains(got, want) {
			t.Errorf("corpo sem %q:\n%s", want, got)
		}
	}
	for _, not := range []string{"<details>", "Editada em", "% a favor"} {
		if strings.Contains(got, not) {
			t.Errorf("corpo não deveria ter %q:\n%s", not, got)
		}
	}
}

func TestIssueBodyDiscussionLimits(t *testing.T) {
	comments := make([]Comment, 12)
	for i := range comments {
		comments[i] = Comment{AuthorName: "Ana", Body: strings.Repeat("x", 400)}
	}
	got := issueBody(Proposal{Comments: comments}, "")
	if !strings.Contains(got, "Discussão no card (12)") || !strings.Contains(got, "e mais 2 comentários") {
		t.Errorf("limite de comentários:\n%s", got)
	}
	if strings.Count(got, "**Ana**") != issueMaxComments {
		t.Errorf("esperava %d comentários no corpo", issueMaxComments)
	}
	if strings.Contains(got, strings.Repeat("x", issueCommentLen+1)) || !strings.Contains(got, "…") {
		t.Error("comentário longo deve ser cortado")
	}
}

func TestIssueBodyDeadline(t *testing.T) {
	closed := time.Date(2026, 10, 20, 15, 0, 0, 0, time.UTC)
	reason := CloseDeadline
	got := issueBody(Proposal{ClosedAt: &closed, CloseReason: &reason}, "")
	if !strings.Contains(got, "| Resultado | Prazo da votação encerrado em 20/10/2026 |") {
		t.Errorf("resultado por prazo:\n%s", got)
	}
}
