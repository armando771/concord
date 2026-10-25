package websocket

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"time"

	"github.com/coder/websocket"
)

const (
	writeWait      = 10 * time.Second
	maxMessageSize = 65536
	// O app avisa "falando/parei" no máximo umas poucas vezes por segundo
	// (debounce de 1,5 s); acima disso descarta, para um cliente modificado
	// não ficar travando o estado global das chamadas.
	maxSpeakingPerSecond = 5
)

type subscribeValidator func(ctx context.Context, userID string, channelID string, conversationID string, serverID string, userRoomID string, callID string) bool

type CallRouter interface {
	HandleCallMessage(userID string, evType string, payload json.RawMessage)
	IsParticipant(callID string, userID string) bool
}

type Client struct {
	hub        *Hub
	conn       *websocket.Conn
	userID     string
	send       chan []byte
	rooms      map[string]struct{}
	validator  subscribeValidator
	callRouter CallRouter
	// Cancela a leitura (e com isso fecha a conexão); usado no desligamento.
	cancel context.CancelFunc
	// Limite de call:speaking (só o readPump mexe).
	speakingWindow time.Time
	speakingCount  int
}

// allowSpeaking aplica o limite de call:speaking por conexão (janela de 1 s).
func (c *Client) allowSpeaking(now time.Time) bool {
	if now.Sub(c.speakingWindow) >= time.Second {
		c.speakingWindow = now
		c.speakingCount = 0
	}
	c.speakingCount++
	return c.speakingCount <= maxSpeakingPerSecond
}

func (c *Client) readPump(ctx context.Context) {
	defer func() {
		c.hub.Unregister(c)
		c.conn.Close(websocket.StatusNormalClosure, "")
	}()

	c.conn.SetReadLimit(maxMessageSize)

	for {
		_, data, err := c.conn.Read(ctx)
		if err != nil {
			return
		}

		var ev struct {
			Type    string          `json:"type"`
			Payload json.RawMessage `json:"payload"`
		}
		if err := json.Unmarshal(data, &ev); err != nil {
			continue
		}

		switch ev.Type {
		case "subscribe":
			var p struct {
				Room string `json:"room"`
			}
			if err := json.Unmarshal(ev.Payload, &p); err != nil {
				continue
			}

			channelID, conversationID, serverID, userRoomID, callID := parseRoom(p.Room)
			if channelID == "" && conversationID == "" && serverID == "" && userRoomID == "" && callID == "" {
				continue
			}

			if c.validator != nil && !c.validator(ctx, c.userID, channelID, conversationID, serverID, userRoomID, callID) {
				continue
			}

			c.hub.Subscribe(c, p.Room)
		case "unsubscribe":
			var p struct {
				Room string `json:"room"`
			}
			if err := json.Unmarshal(ev.Payload, &p); err != nil {
				continue
			}

			c.hub.Unsubscribe(c, p.Room)
		// call:speaking: voz captada (detector do LiveKit no app) — é o que
		// conta para o XP de voz.
		case "call:invite", "call:accept", "call:decline", "call:leave", "call:screen", "call:voice", "call:speaking":
			if ev.Type == "call:speaking" && !c.allowSpeaking(time.Now()) {
				continue
			}
			if c.callRouter != nil {
				c.callRouter.HandleCallMessage(c.userID, ev.Type, ev.Payload)
			}
		}
	}
}

func (c *Client) writePump(ctx context.Context) {
	for {
		select {
		case msg, ok := <-c.send:
			if !ok {
				return
			}
			if err := c.conn.Write(ctx, websocket.MessageText, msg); err != nil {
				log.Printf("ws write error (user %s): %v", c.userID, err)
				return
			}
		case <-ctx.Done():
			return
		}
	}
}

func parseRoom(room string) (channelID string, conversationID string, serverID string, userRoomID string, callID string) {
	if strings.HasPrefix(room, "channel:") {
		return strings.TrimPrefix(room, "channel:"), "", "", "", ""
	}
	if strings.HasPrefix(room, "conversation:") {
		return "", strings.TrimPrefix(room, "conversation:"), "", "", ""
	}
	if strings.HasPrefix(room, "server:") {
		return "", "", strings.TrimPrefix(room, "server:"), "", ""
	}
	if strings.HasPrefix(room, "user:") {
		return "", "", "", strings.TrimPrefix(room, "user:"), ""
	}
	if strings.HasPrefix(room, "call:") {
		return "", "", "", "", strings.TrimPrefix(room, "call:")
	}
	return "", "", "", "", ""
}

func writeEvent(typ string, payload interface{}) []byte {
	data, err := json.Marshal(map[string]interface{}{
		"type":    typ,
		"payload": payload,
	})
	if err != nil {
		return nil
	}
	return data
}
