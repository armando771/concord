package livekit

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRTCProxyForwardsPathAndQuery(t *testing.T) {
	var gotPath, gotQuery string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotQuery = r.URL.RawQuery
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("success"))
	}))
	defer upstream.Close()

	proxy, err := NewRTCProxy(upstream.URL)
	if err != nil {
		t.Fatalf("NewRTCProxy: %v", err)
	}

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Any("/rtc/*path", proxy)
	router.Any("/rtc", proxy)

	// Servidor real: o ReverseProxy exige um ResponseWriter com CloseNotify.
	front := httptest.NewServer(router)
	defer front.Close()

	for _, path := range []string{"/rtc/validate", "/rtc/v1/validate", "/rtc"} {
		resp, err := http.Get(front.URL + path + "?access_token=abc")
		if err != nil {
			t.Fatalf("%s: %v", path, err)
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode != http.StatusOK || string(body) != "success" {
			t.Fatalf("%s: status=%d body=%q", path, resp.StatusCode, body)
		}
		if gotPath != path || gotQuery != "access_token=abc" {
			t.Fatalf("%s: upstream got path=%q query=%q", path, gotPath, gotQuery)
		}
	}
}
