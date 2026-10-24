package livekit

import (
	"net/http/httputil"
	"net/url"

	"github.com/gin-gonic/gin"
)

// NewRTCProxy repassa a sinalização do LiveKit (/rtc, /rtc/v1, /rtc/validate…)
// para o servidor local. Assim só a porta do backend precisa de túnel TCP; a
// mídia segue direto para as portas rtc do LiveKit. O ReverseProxy cuida do
// upgrade para WebSocket.
func NewRTCProxy(target string) (gin.HandlerFunc, error) {
	upstream, err := url.Parse(target)
	if err != nil {
		return nil, err
	}

	proxy := httputil.NewSingleHostReverseProxy(upstream)

	return func(c *gin.Context) {
		proxy.ServeHTTP(c.Writer, c.Request)
	}, nil
}
