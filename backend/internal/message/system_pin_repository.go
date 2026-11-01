package message

import "context"

// ChannelHasSystemKind: o canal tem alguma mensagem com esse system_kind?
func (r *Repository) ChannelHasSystemKind(ctx context.Context, channelID, kind string) (bool, error) {
	var found bool
	err := r.db.QueryRow(
		ctx,
		`SELECT EXISTS(SELECT 1 FROM messages WHERE channel_id = $1 AND system_kind = $2)`,
		channelID,
		kind,
	).Scan(&found)
	return found, err
}
