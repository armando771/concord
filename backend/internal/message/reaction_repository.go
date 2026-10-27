package message

import (
	"context"
	"slices"
)

// Reações: pôr, tirar e agrupar por mensagem (emoji, quantos, quem).

func (r *Repository) AddReaction(ctx context.Context, messageID string, userID string, emoji string) (bool, error) {
	tag, err := r.db.Exec(
		ctx,
		`
		INSERT INTO message_reactions (message_id, user_id, emoji)
		VALUES ($1, $2, $3)
		ON CONFLICT (message_id, user_id, emoji) DO NOTHING
		`,
		messageID,
		userID,
		emoji,
	)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (r *Repository) RemoveReaction(ctx context.Context, messageID string, userID string, emoji string) (bool, error) {
	tag, err := r.db.Exec(
		ctx,
		`DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
		messageID,
		userID,
		emoji,
	)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func GroupReactions(rows []ReactionRow) map[string][]ReactionSummary {
	byMessage := make(map[string][]ReactionSummary)
	indexByMessageEmoji := make(map[string]map[string]int)

	for _, row := range rows {
		emojiMap, ok := indexByMessageEmoji[row.MessageID]
		if !ok {
			emojiMap = make(map[string]int)
			indexByMessageEmoji[row.MessageID] = emojiMap
		}

		if idx, exists := emojiMap[row.Emoji]; exists {
			summary := &byMessage[row.MessageID][idx]
			if !slices.Contains(summary.UserIDs, row.UserID) {
				summary.UserIDs = append(summary.UserIDs, row.UserID)
				summary.Count = len(summary.UserIDs)
			}
		} else {
			emojiMap[row.Emoji] = len(byMessage[row.MessageID])
			byMessage[row.MessageID] = append(byMessage[row.MessageID], ReactionSummary{
				Emoji:   row.Emoji,
				Count:   1,
				UserIDs: []string{row.UserID},
			})
		}
	}

	return byMessage
}
