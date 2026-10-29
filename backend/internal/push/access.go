package push

import (
	"context"

	"gin-quickstart/backend/internal/permission"
)

// ViewAccess diz se a pessoa enxerga o canal (cargos e sobrescritas), para não vazar menção de canal privado.
type ViewAccess struct{ Perms *permission.Service }

func (a ViewAccess) CanView(ctx context.Context, channelID, userID string) bool {
	return a.Perms.RequireChannel(ctx, channelID, userID, permission.ViewChannel) == nil
}
