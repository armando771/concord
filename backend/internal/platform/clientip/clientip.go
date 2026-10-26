// Package clientip decide em quem o backend confia para dizer o IP do
// cliente (X-Forwarded-For), para c.ClientIP() não poder ser forjado.
package clientip

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// TrustedProxies devolve os proxies cujo X-Forwarded-For vale.
//
// env é TRUSTED_PROXIES: lista separada por vírgula (IPs ou CIDRs), ou "none".
// Vazio, decide pelo HOST: HOST local (127.0.0.1/localhost/::1) é o caso do
// Caddy na mesma VPS, então confia só no loopback; qualquer outro HOST (playit,
// LAN) recebe conexões direto dos clientes — e o túnel do playit entrega pelo
// loopback sem reescrever cabeçalhos —, então não confia em ninguém.
func TrustedProxies(host, env string) []string {
	env = strings.TrimSpace(env)
	if strings.EqualFold(env, "none") {
		return nil
	}
	if env != "" {
		var out []string
		for _, p := range strings.Split(env, ",") {
			if p = strings.TrimSpace(p); p != "" {
				out = append(out, p)
			}
		}
		return out
	}
	switch strings.TrimSpace(host) {
	case "127.0.0.1", "localhost", "::1", "[::1]":
		return []string{"127.0.0.1", "::1"}
	}
	return nil
}

// Configure aplica a lista ao gin. Só o X-Forwarded-For conta (o Caddy não
// manda X-Real-IP). Sem proxies, c.ClientIP() é o endereço da conexão.
func Configure(router *gin.Engine, proxies []string) error {
	router.RemoteIPHeaders = []string{"X-Forwarded-For"}
	return router.SetTrustedProxies(proxies)
}
