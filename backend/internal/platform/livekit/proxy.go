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
//
// Na VPS o Caddy manda /rtc direto para o LiveKit (deploy/Caddyfile) e este
// proxy fica só de reserva: a conexão de sinalização vive dentro deste
// processo, então reiniciar o backend a corta e o cliente faz um ICE restart
// (voz e tela travam por um instante). Continua para o PC de casa (playit, um
// túnel só) e para qualquer bloco do Caddy sem a rota /rtc.
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
