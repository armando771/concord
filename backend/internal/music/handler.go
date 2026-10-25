package music

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

// MediaTokens valida o token curto que vai na URL do <video> (igual aos anexos).
type MediaTokens interface {
	VerifyMediaToken(token string) (string, error)
}

type Handler struct {
	m      *Manager
	tokens MediaTokens
}

func NewHandler(m *Manager, tokens MediaTokens) *Handler { return &Handler{m: m, tokens: tokens} }

func userID(c *gin.Context) string { return c.GetString("userID") }

func (h *Handler) State(c *gin.Context) {
	st, ok := h.m.StateFor(userID(c), c.Param("id"))
	if !ok {
		c.Status(http.StatusNoContent)
		return
	}
	c.JSON(http.StatusOK, st)
}

func (h *Handler) Presence(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"channel_ids": h.m.Presence(c.Param("id"))})
}

func (h *Handler) Pick(c *gin.Context) {
	var in struct {
		Token string `json:"token"`
		Index int    `json:"index"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if err := h.m.Pick(c.Request.Context(), userID(c), in.Token, in.Index); err != nil {
		c.JSON(http.StatusGone, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) Skip(c *gin.Context) {
	r, err := h.m.SkipREST(userID(c), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	kind := map[SkipKind]string{SkipNothing: "nothing", SkipDone: "done", SkipVoted: "voted", SkipAlready: "already"}[r.Kind]
	c.JSON(http.StatusOK, gin.H{"kind": kind, "votes": r.Votes, "needed": r.Needed})
}

func queueError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrNotYours), errors.Is(err, ErrNotInMusicCall):
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	case errors.Is(err, ErrItemNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	}
}

func (h *Handler) Remove(c *gin.Context) {
	if err := h.m.Remove(userID(c), c.Param("id"), c.Param("itemId")); err != nil {
		queueError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) Swap(c *gin.Context) {
	var in struct {
		A string `json:"a"`
		B string `json:"b"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if err := h.m.Swap(userID(c), c.Param("id"), in.A, in.B); err != nil {
		queueError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) VideoWatch(c *gin.Context) {
	var in struct {
		Watching bool `json:"watching"`
	}
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if err := h.m.SetWatching(userID(c), c.Param("id"), in.Watching); err != nil {
		queueError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// Video serve o arquivo com Range (http.ServeFile via c.File).
func (h *Handler) Video(c *gin.Context) {
	uid, err := h.tokens.VerifyMediaToken(c.Query("token"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid media token"})
		return
	}
	path, ok := h.m.VideoFile(uid, c.Param("itemId"))
	if !ok {
		c.Status(http.StatusNotFound)
		return
	}
	c.Header("Cache-Control", "private, max-age=3600")
	c.File(path)
}
