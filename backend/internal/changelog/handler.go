package changelog

import (
	"context"
	"crypto/subtle"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	store store
	token string
}

func NewHandler(store store, token string) *Handler {
	return &Handler{store: store, token: token}
}

// List devolve as releases com conteúdo, da mais nova para a mais antiga: GET /changelog.
func (h *Handler) List(c *gin.Context) {
	releases, err := h.store.List(c.Request.Context())
	if err != nil {
		log.Printf("[changelog] list: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load changelog"})
		return
	}
	c.JSON(http.StatusOK, visible(releases))
}

// Publish grava (ou regrava) uma release: PUT /changelog/:version. Quem chama é
// o deploy, com o token do CI; sem CHANGELOG_TOKEN no servidor fica desligado.
func (h *Handler) Publish(c *gin.Context) {
	if h.token == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "publishing disabled"})
		return
	}
	if subtle.ConstantTimeCompare([]byte(c.GetHeader("X-Changelog-Token")), []byte(h.token)) != 1 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	version := c.Param("version")
	if !versionRe.MatchString(version) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid version"})
		return
	}
	var p Publication
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	if err := p.validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.publish(c.Request.Context(), version, p); err != nil {
		log.Printf("[changelog] publish %s: %v", version, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to publish"})
		return
	}
	c.Status(http.StatusNoContent)
}

// publish grava a release só com as notas que nenhuma release anterior trouxe.
func (h *Handler) publish(ctx context.Context, version string, p Publication) error {
	releases, err := h.store.List(ctx)
	if err != nil {
		return fmt.Errorf("listar releases: %w", err)
	}
	p.Entries = newEntries(releases, version, p.Entries)
	return h.store.Upsert(ctx, version, p)
}
