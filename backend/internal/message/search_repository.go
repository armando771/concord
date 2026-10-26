package message

import (
	"context"
	"strconv"
)

// SearchResult é uma mensagem achada, com o nome do canal (servidor) para o
// painel mostrar de onde ela é.
type SearchResult struct {
	Message
	ChannelName *string `json:"channel_name,omitempty"`
}

// SearchPage: uma página de resultados. Total para em SearchMaxResults
// (TotalCapped = "1000+").
type SearchPage struct {
	Results     []SearchResult `json:"results"`
	Total       int            `json:"total"`
	TotalCapped bool           `json:"total_capped"`
	Offset      int            `json:"offset"`
	Limit       int            `json:"limit"`
}

const searchFrom = messageFrom + `
	LEFT JOIN channels c ON c.id = m.channel_id
`

// Search acha as mensagens do escopo que batem com o filtro. Mensagem apagada
// some da tabela (DELETE), então nunca aparece.
func (r *Repository) Search(ctx context.Context, scope SearchScope, f SearchFilter, viewerID string) (*SearchPage, error) {
	page := &SearchPage{Results: []SearchResult{}, Offset: f.Offset, Limit: f.Limit}
	if scope.ConversationID == "" && len(scope.ChannelIDs) == 0 {
		return page, nil
	}

	countArgs := &sqlArgs{}
	where := buildSearchWhere(scope, f, countArgs)
	// Conta até o teto: COUNT(*) de tudo numa busca vaga custaria caro.
	if err := r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM (
			SELECT 1
			FROM messages m
			JOIN users u ON u.id = m.author_id
			LEFT JOIN channels c ON c.id = m.channel_id
			WHERE `+where+`
			LIMIT `+strconv.Itoa(SearchMaxResults+1)+`
		) t`, countArgs.values...).Scan(&page.Total); err != nil {
		return nil, err
	}
	if page.Total > SearchMaxResults {
		page.Total = SearchMaxResults
		page.TotalCapped = true
	}
	if f.Limit <= 0 || f.Offset >= page.Total {
		return page, nil
	}

	args := &sqlArgs{}
	where = buildSearchWhere(scope, f, args)
	order := buildSearchOrder(f, args)
	limit := args.add(f.Limit)
	offset := args.add(f.Offset)
	rows, err := r.db.Query(ctx, `
		SELECT `+messageColumns+`, c.name
		`+searchFrom+`
		WHERE `+where+`
		ORDER BY `+order+`
		LIMIT `+limit+` OFFSET `+offset, args.values...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []Message
	var names []*string
	for rows.Next() {
		var name *string
		msg, err := scanMessageRow(rows, &name)
		if err != nil {
			return nil, err
		}
		messages = append(messages, msg)
		names = append(names, name)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := r.attachReactions(ctx, messages); err != nil {
		return nil, err
	}
	if err := r.AttachPolls(ctx, messages, viewerID); err != nil {
		return nil, err
	}
	if err := r.AttachAttachments(ctx, messages); err != nil {
		return nil, err
	}
	for i := range messages {
		page.Results = append(page.Results, SearchResult{Message: messages[i], ChannelName: names[i]})
	}
	return page, nil
}
