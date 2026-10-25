package birthday

import (
	"strings"
	"testing"
)

// Aviso de aniversário sem canal principal escolhido vai para o canal de
// texto mais antigo, não para o primeiro da ordem da barra lateral.
func TestBirthdayChannelFallbackIgnoresSidebarOrder(t *testing.T) {
	if strings.Contains(primaryChannelFallback, "position") {
		t.Fatalf("fallback não pode seguir a ordem da barra: %s", primaryChannelFallback)
	}
	if !strings.Contains(primaryChannelFallback, "ORDER BY c.created_at, c.id") {
		t.Fatalf("fallback deve ser o canal de texto mais antigo: %s", primaryChannelFallback)
	}
}
