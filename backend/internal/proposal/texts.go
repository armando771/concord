package proposal

import "fmt"

// statusMessage é o que o Salinha Bot manda na DM de quem sugeriu quando o
// card muda de coluna ("" = nada a avisar). Texto puro (o chat não formata).
func statusMessage(before, after Proposal) string {
	if before.Status == after.Status {
		return ""
	}
	title := fmt.Sprintf("Sua sugestão “%s”", after.Title)
	manual := after.CloseReason != nil && *after.CloseReason == CloseManual
	switch after.Status {
	case StatusProposed:
		if before.Status != StatusVoting {
			return title + " voltou para a fila de aprovadas."
		}
		if manual {
			return title + " foi aprovada pelo time e entrou na fila. 🎉"
		}
		return fmt.Sprintf("%s foi aprovada na votação (%d sim, %d não) e entrou na fila do time. 🎉",
			title, after.YesVotes, after.NoVotes)
	case StatusInProgress:
		if after.Assignee != nil {
			return fmt.Sprintf("%s está sendo feita por %s. 🛠️", title, after.Assignee.Name)
		}
		return title + " está sendo feita pelo time. 🛠️"
	case StatusDone:
		msg := title + " foi concluída! 🎉"
		if after.GithubIssueURL != nil {
			msg += " Acompanhe: " + *after.GithubIssueURL
		}
		return msg
	case StatusRejected:
		if before.Status == StatusVoting && !manual {
			return fmt.Sprintf("%s não foi aprovada na votação (%d sim, %d não).",
				title, after.YesVotes, after.NoVotes)
		}
		return title + " foi recusada pelo time."
	}
	return ""
}
