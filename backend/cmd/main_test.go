package main

import (
	"net/http/httptest"
	"testing"
)

func TestIsLongDownload(t *testing.T) {
	cases := []struct {
		method, path string
		want         bool
	}{
		{"GET", "/updates/Salinha-0.7.0-setup.exe", true},
		{"HEAD", "/updates/latest.yml", true},
		{"GET", "/api/media/3f2a", true},
		{"GET", "/api/media/token", false},
		{"POST", "/api/channels/1/attachments", false},
		{"GET", "/api/channels/1/messages", false},
		{"GET", "/ws", false},
	}
	for _, c := range cases {
		if got := isLongDownload(httptest.NewRequest(c.method, c.path, nil)); got != c.want {
			t.Errorf("%s %s = %v, want %v", c.method, c.path, got, c.want)
		}
	}
}
