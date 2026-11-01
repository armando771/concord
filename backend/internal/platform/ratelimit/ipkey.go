package ratelimit

import "net/netip"

// IPKey: IPv4 inteiro; IPv6 pelo /64 (um cliente costuma ter o /64 inteiro e
// trocar de endereço à vontade dentro dele).
func IPKey(ip string) string {
	addr, err := netip.ParseAddr(ip)
	if err != nil {
		return ip
	}
	addr = addr.Unmap()
	if addr.Is4() {
		return addr.String()
	}
	prefix, err := addr.WithZone("").Prefix(64)
	if err != nil {
		return ip
	}
	return prefix.String()
}
