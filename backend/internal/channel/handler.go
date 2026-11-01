package channel

import (
	"context"
	"errors"
	"net/http"

	"gin-quickstart/backend/internal/permission"

	"github.com/gin-gonic/gin"
)

// Permissions é o que o handler usa do permission.Service.
type Permissions interface {
	Snapshot(ctx context.Context, serverID string) (*permission.Snapshot, error)
}

type Handler struct {
	service *Service
	perms   Permissions
}

func ChannelHandler(service *Service, perms Permissions) *Handler {
	return &Handler{
		service: service,
		perms:   perms,
	}
}

var (
	ErrInvalidOverwrite = errors.New("uma permissão não pode ser liberada e negada ao mesmo tempo")
	ErrInvalidTarget    = errors.New("cargo ou membro não encontrado neste servidor")
	ErrCannotGrant      = errors.New("você não pode liberar ou negar uma permissão que não tem")
)

func (h *Handler) Create(c *gin.Context) {
	serverID := c.Param("id")

	var input struct {
		Name    string   `json:"name"`
		Type    string   `json:"type"`
		Private bool     `json:"private"`
		RoleIDs []string `json:"role_ids"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	if input.Type == "" {
		input.Type = TypeText
	}
	if input.Type != TypeText && input.Type != TypeVoice {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type must be text or voice"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	snap, herr := h.requireServer(c.Request.Context(), serverID, userID.(string), permission.ManageChannels)
	if herr != nil {
		herr.respond(c)
		return
	}

	var overwrites []permission.Overwrite
	if input.Private {
		var err error
		overwrites, err = PrivateOverwrites(snap, input.Type, userID.(string), input.RoleIDs)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "invalid_target"})
			return
		}
	}

	ch := &Channel{
		ServerID:  serverID,
		Name:      input.Name,
		Type:      input.Type,
		CreatedBy: userID.(string),
	}

	if err := h.service.Create(c.Request.Context(), ch, overwrites...); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, ch)
}

// PrivateOverwrites monta as sobrescritas de um canal privado: o @everyone não
// vê, os cargos escolhidos veem (e conectam, se for voz) e quem criou continua
// vendo mesmo sem nenhum desses cargos.
func PrivateOverwrites(snap *permission.Snapshot, chType string, creatorID string, roleIDs []string) ([]permission.Overwrite, error) {
	access := permission.ViewChannel
	if chType == TypeVoice {
		access |= permission.Connect
	}
	overwrites := []permission.Overwrite{{
		TargetType: permission.TargetRole,
		TargetID:   snap.Everyone.ID,
		Deny:       permission.ViewChannel,
	}}
	seen := map[string]bool{}
	for _, id := range roleIDs {
		r, ok := snap.Roles[id]
		if !ok || r.IsDefault {
			return nil, ErrInvalidTarget
		}
		if seen[id] {
			continue
		}
		seen[id] = true
		overwrites = append(overwrites, permission.Overwrite{TargetType: permission.TargetRole, TargetID: id, Allow: access})
	}
	perms := permission.ForChannel(snap.Server(creatorID), chType, overwrites, snap.Everyone.ID, creatorID, snap.MemberRoles[creatorID])
	if perms&permission.ViewChannel == 0 {
		overwrites = append(overwrites, permission.Overwrite{TargetType: permission.TargetMember, TargetID: creatorID, Allow: access})
	}
	return overwrites, nil
}

// ListByServer devolve só os canais que o membro vê, com as sobrescritas.
func (h *Handler) ListByServer(c *gin.Context) {
	serverID := c.Param("id")

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	snap, herr := h.requireServer(c.Request.Context(), serverID, userID.(string), 0)
	if herr != nil {
		herr.respond(c)
		return
	}

	channels, err := h.service.ListByServerID(c.Request.Context(), serverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list channels"})
		return
	}

	c.JSON(http.StatusOK, VisibleChannels(snap, userID.(string), channels))
}

// VisibleChannels filtra os canais que userID vê e preenche as sobrescritas.
func VisibleChannels(snap *permission.Snapshot, userID string, channels []Channel) []Channel {
	visible := make([]Channel, 0, len(channels))
	for _, ch := range channels {
		if !snap.CanView(ch.ID, userID) {
			continue
		}
		ch.Overwrites = OverwritesOf(snap, ch.ID)
		visible = append(visible, ch)
	}
	return visible
}

// OverwritesOf: as sobrescritas do canal no snapshot (nunca nil).
func OverwritesOf(snap *permission.Snapshot, channelID string) []permission.Overwrite {
	overwrites := append([]permission.Overwrite{}, snap.Channels[channelID].Overwrites...)
	return overwrites
}

func (h *Handler) Update(c *gin.Context) {
	serverID := c.Param("id")
	channelID := c.Param("channelId")

	var input struct {
		Name string `json:"name"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	snap, _, herr := h.requireChannel(c.Request.Context(), serverID, channelID, userID.(string), permission.ManageChannels)
	if herr != nil {
		herr.respond(c)
		return
	}

	updated, err := h.service.Update(c.Request.Context(), channelID, input.Name)
	if err != nil {
		if errors.Is(err, ErrSystemChannel) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error(), "code": "system_channel"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	updated.Overwrites = OverwritesOf(snap, channelID)

	c.JSON(http.StatusOK, updated)
}

func (h *Handler) Delete(c *gin.Context) {
	serverID := c.Param("id")
	channelID := c.Param("channelId")

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if _, _, herr := h.requireChannel(c.Request.Context(), serverID, channelID, userID.(string), permission.ManageChannels); herr != nil {
		herr.respond(c)
		return
	}

	if err := h.service.Delete(c.Request.Context(), channelID); err != nil {
		if errors.Is(err, ErrSystemChannel) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error(), "code": "system_channel"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete channel"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "channel deleted"})
}

// Reorder: PUT /servers/:id/channels/order {type, channel_ids}. Exige
// MANAGE_CHANNELS no servidor.
func (h *Handler) Reorder(c *gin.Context) {
	serverID := c.Param("id")

	var input struct {
		Type       string   `json:"type"`
		ChannelIDs []string `json:"channel_ids"`
		RequestID  string   `json:"request_id"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if _, herr := h.requireServer(c.Request.Context(), serverID, userID.(string), permission.ManageChannels); herr != nil {
		herr.respond(c)
		return
	}

	err := h.service.Reorder(c.Request.Context(), serverID, input.Type, input.ChannelIDs, input.RequestID)
	switch {
	case errors.Is(err, ErrInvalidType), errors.Is(err, ErrInvalidOrder), errors.Is(err, ErrInvalidRequestID):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	case err != nil:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reorder channels"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"type": input.Type, "channel_ids": input.ChannelIDs})
}

// SetOverwrite: PUT /servers/:id/channels/:channelId/overwrites/:type/:targetId
// {allow, deny}. Exige MANAGE_ROLES no canal e só mexe em bits que o ator tem
// no canal.
func (h *Handler) SetOverwrite(c *gin.Context) {
	var input struct {
		Allow int64 `json:"allow"`
		Deny  int64 `json:"deny"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	h.changeOverwrite(c, &permission.Overwrite{
		TargetType: c.Param("type"),
		TargetID:   c.Param("targetId"),
		Allow:      permission.Normalize(input.Allow),
		Deny:       permission.Normalize(input.Deny),
	})
}

// DeleteOverwrite: volta o cargo/membro a herdar tudo do servidor.
func (h *Handler) DeleteOverwrite(c *gin.Context) {
	h.changeOverwrite(c, nil)
}

func (h *Handler) changeOverwrite(c *gin.Context, next *permission.Overwrite) {
	serverID, channelID := c.Param("id"), c.Param("channelId")
	targetType, targetID := c.Param("type"), c.Param("targetId")

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	snap, ch, herr := h.requireChannel(c.Request.Context(), serverID, channelID, userID.(string), permission.ManageRoles)
	if herr != nil {
		herr.respond(c)
		return
	}

	current, err := CheckOverwrite(snap, channelID, userID.(string), targetType, targetID, next)
	if err != nil {
		status, code := http.StatusBadRequest, "invalid"
		switch {
		case errors.Is(err, ErrCannotGrant):
			status, code = http.StatusForbidden, "cannot_grant"
		case errors.Is(err, ErrInvalidTarget):
			status, code = http.StatusNotFound, "invalid_target"
		}
		c.JSON(status, gin.H{"error": err.Error(), "code": code})
		return
	}

	if next == nil {
		err = h.service.DeleteOverwrite(c.Request.Context(), ch, targetType, targetID)
	} else {
		err = h.service.SetOverwrite(c.Request.Context(), ch, *next)
	}
	if err != nil {
		if errors.Is(err, ErrSystemChannel) {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error(), "code": "system_channel"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to change permissions"})
		return
	}

	if next == nil {
		c.JSON(http.StatusOK, gin.H{"message": "overwrite deleted", "previous": current})
		return
	}
	next.ChannelID = channelID
	c.JSON(http.StatusOK, next)
}

// CheckOverwrite valida a troca da sobrescrita (next nil = apagar) e devolve a
// atual. O alvo tem que ser cargo ou membro do servidor; ninguém libera nem
// nega bits que não tem no canal.
func CheckOverwrite(snap *permission.Snapshot, channelID, actorID, targetType, targetID string, next *permission.Overwrite) (permission.Overwrite, error) {
	switch targetType {
	case permission.TargetRole:
		if _, ok := snap.Roles[targetID]; !ok {
			return permission.Overwrite{}, ErrInvalidTarget
		}
	case permission.TargetMember:
		if !snap.IsMember(targetID) {
			return permission.Overwrite{}, ErrInvalidTarget
		}
	default:
		return permission.Overwrite{}, ErrInvalidTarget
	}

	var current permission.Overwrite
	for _, o := range snap.Channels[channelID].Overwrites {
		if o.TargetType == targetType && o.TargetID == targetID {
			current = o
		}
	}

	var allow, deny int64
	if next != nil {
		if next.Allow&next.Deny != 0 {
			return current, ErrInvalidOverwrite
		}
		allow, deny = next.Allow, next.Deny
	}
	changed := (current.Allow ^ allow) | (current.Deny ^ deny)
	if !permission.CanGrant(snap.Channel(channelID, actorID), changed) {
		return current, ErrCannotGrant
	}
	return current, nil
}

type handlerError struct {
	Status  int
	Message string
	Code    string
}

func (e *handlerError) respond(c *gin.Context) {
	body := gin.H{"error": e.Message}
	if e.Code != "" {
		body["code"] = e.Code
	}
	c.JSON(e.Status, body)
}

// requireServer: membro do servidor com os bits want (0 = só ser membro).
func (h *Handler) requireServer(ctx context.Context, serverID string, userID string, want int64) (*permission.Snapshot, *handlerError) {
	snap, err := h.perms.Snapshot(ctx, serverID)
	if err != nil || !snap.IsMember(userID) {
		return nil, &handlerError{http.StatusForbidden, "you are not a member of this server", "not_member"}
	}
	if !permission.Has(snap.Server(userID), want) {
		return nil, &handlerError{http.StatusForbidden, permission.ErrMissingPermission.Error(), "missing_permission"}
	}
	return snap, nil
}

// requireChannel: o canal é deste servidor e o membro tem want nele.
func (h *Handler) requireChannel(ctx context.Context, serverID, channelID, userID string, want int64) (*permission.Snapshot, *Channel, *handlerError) {
	snap, herr := h.requireServer(ctx, serverID, userID, 0)
	if herr != nil {
		return nil, nil, herr
	}
	ch, err := h.service.FindByID(ctx, channelID)
	if err != nil || ch.ServerID != serverID || !snap.CanView(channelID, userID) {
		return nil, nil, &handlerError{http.StatusNotFound, "channel not found", "channel_not_found"}
	}
	if !permission.Has(snap.Channel(channelID, userID), want) {
		return nil, nil, &handlerError{http.StatusForbidden, permission.ErrMissingPermission.Error(), "missing_permission"}
	}
	ch.Overwrites = OverwritesOf(snap, channelID)
	return snap, ch, nil
}
