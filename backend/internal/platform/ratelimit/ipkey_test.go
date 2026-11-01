package ratelimit

import "testing"

func TestIPKeyGroupsIPv6By64(t *testing.T) {
	cases := []struct{ a, b string }{
		{"2001:db8:1:2:aaaa::1", "2001:db8:1:2:bbbb:cccc:dddd:9"},
		{"2001:db8:1:2::1", "2001:0db8:0001:0002:0000:0000:0000:0002"},
	}
	for _, c := range cases {
		if IPKey(c.a) != IPKey(c.b) {
			t.Errorf("IPKey(%q) = %q e IPKey(%q) = %q, want o mesmo /64", c.a, IPKey(c.a), c.b, IPKey(c.b))
		}
	}
	if IPKey("2001:db8:1:2::1") == IPKey("2001:db8:1:3::1") {
		t.Error("/64 diferentes não podem dividir chave")
	}
	if got := IPKey("203.0.113.7"); got != "203.0.113.7" {
		t.Errorf("IPv4 = %q, want o endereço inteiro", got)
	}
	if IPKey("203.0.113.7") == IPKey("203.0.113.8") {
		t.Error("IPv4 vizinhos não podem dividir chave")
	}
	if got := IPKey("::ffff:203.0.113.7"); got != "203.0.113.7" {
		t.Errorf("IPv4 mapeado = %q, want 203.0.113.7", got)
	}
	if got := IPKey("não-é-ip"); got != "não-é-ip" {
		t.Errorf("texto qualquer = %q, want igual", got)
	}
}
