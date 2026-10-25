package message

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

type voteInput struct {
	AnswerIDs []int `json:"answer_ids"`
}

// isChannelMember confere se userID é membro do servidor do canal; se não for,
// já responde o erro.
func (h *Handler) isChannelMember(c *gin.Context, channelID string, userID string) bool {
	ch, err := h.channelService.FindByID(c.Request.Context(), channelID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
		return false
	}

	isMember, err := h.serverService.IsMember(c.Request.Context(), ch.ServerID, userID)
	if err != nil || !isMember {
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not a member of this server"})
		return false
	}
	return true
}

func (h *Handler) isConversationParticipant(c *gin.Context, conversationID string, userID string) bool {
	isParticipant, err := h.conversationService.IsParticipant(c.Request.Context(), conversationID, userID)
	if err != nil || !isParticipant {
		c.JSON(http.StatusForbidden, gin.H{"error": "you are not a participant of this conversation"})
		return false
	}
	return true
}

func pollErrorStatus(err error) int {
	switch {
	case errors.Is(err, ErrPollNotFound):
		return http.StatusNotFound
	case errors.Is(err, ErrNotPollAuthor):
		return http.StatusForbidden
	default:
		return http.StatusBadRequest
	}
}

func (h *Handler) CreateChannelPoll(c *gin.Context) {
	channelID := c.Param("channelId")

	var input CreatePollInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	if !h.isChannelMember(c, channelID, userID) {
		return
	}

	msg, err := h.service.CreateChannelPoll(c.Request.Context(), channelID, userID, input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, msg)
}

func (h *Handler) CreateConversationPoll(c *gin.Context) {
	conversationID := c.Param("id")

	var input CreatePollInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	if !h.canSendToConversation(c, conversationID, userID) {
		return
	}

	msg, err := h.service.CreateConversationPoll(c.Request.Context(), conversationID, userID, input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, msg)
}

func (h *Handler) VoteChannelPoll(c *gin.Context) {
	channelID := c.Param("channelId")
	messageID := c.Param("messageId")

	var input voteInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	if !h.isChannelMember(c, channelID, userID) {
		return
	}

	poll, err := h.service.VoteChannelPoll(c.Request.Context(), channelID, messageID, userID, input.AnswerIDs)
	if err != nil {
		c.JSON(pollErrorStatus(err), gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, poll)
}

func (h *Handler) VoteConversationPoll(c *gin.Context) {
	conversationID := c.Param("id")
	messageID := c.Param("messageId")

	var input voteInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	if !h.isConversationParticipant(c, conversationID, userID) {
		return
	}

	poll, err := h.service.VoteConversationPoll(c.Request.Context(), conversationID, messageID, userID, input.AnswerIDs)
	if err != nil {
		c.JSON(pollErrorStatus(err), gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, poll)
}

func (h *Handler) EndChannelPoll(c *gin.Context) {
	channelID := c.Param("channelId")
	messageID := c.Param("messageId")

	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	if !h.isChannelMember(c, channelID, userID) {
		return
	}

	poll, err := h.service.EndChannelPoll(c.Request.Context(), channelID, messageID, userID)
	if err != nil {
		c.JSON(pollErrorStatus(err), gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, poll)
}

func (h *Handler) EndConversationPoll(c *gin.Context) {
	conversationID := c.Param("id")
	messageID := c.Param("messageId")

	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	if !h.isConversationParticipant(c, conversationID, userID) {
		return
	}

	poll, err := h.service.EndConversationPoll(c.Request.Context(), conversationID, messageID, userID)
	if err != nil {
		c.JSON(pollErrorStatus(err), gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, poll)
}
