package level

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type RankingHandler struct {
	service *RankingService
}

func LevelRankingHandler(service *RankingService) *RankingHandler {
	return &RankingHandler{service: service}
}

// Get devolve o ranking global: GET /levels/ranking?limit=100.
func (h *RankingHandler) Get(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	limit, _ := strconv.Atoi(c.Query("limit"))

	ranking, err := h.service.Get(c.Request.Context(), userID.(string), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load ranking"})
		return
	}
	if ranking.Entries == nil {
		ranking.Entries = []RankingEntry{}
	}
	c.JSON(http.StatusOK, ranking)
}
