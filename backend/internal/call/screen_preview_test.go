package call

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"image"
	"image/jpeg"
	"image/png"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func jpegOf(t *testing.T, w, h int) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, image.NewRGBA(image.Rect(0, 0, w, h)), nil); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func previewRequests(pub *capPublisher, userID string) int {
	n := 0
	for _, raw := range pub.userEvents[userID] {
		var ev struct {
			Type string `json:"type"`
		}
		if json.Unmarshal(raw, &ev) == nil && ev.Type == "call:screen_preview_request" {
			n++
		}
	}
	return n
}

func TestValidPreview(t *testing.T) {
	var pngBuf bytes.Buffer
	_ = png.Encode(&pngBuf, image.NewRGBA(image.Rect(0, 0, 10, 10)))
	cases := []struct {
		name  string
		image []byte
		want  bool
	}{
		{"jpeg pequeno", jpegOf(t, 384, 216), true},
		{"vazio", nil, false},
		{"png", pngBuf.Bytes(), false},
		{"lixo", []byte("<script>alert(1)</script>"), false},
		{"grande demais", jpegOf(t, 1280, 720), false},
		{"bytes demais", append(jpegOf(t, 8, 8), make([]byte, MaxScreenPreviewBytes)...), false},
	}
	for _, tc := range cases {
		if got := validPreview(tc.image); got != tc.want {
			t.Errorf("%s: validPreview = %v, want %v", tc.name, got, tc.want)
		}
	}
}

func TestScreenPreviewOnDemand(t *testing.T) {
	svc, _, pub := newVoiceService(voiceSnapshot())
	putInCall(svc, "c1", "geral", "vip", "mod")
	svc.screenSharers["c1"] = map[string]struct{}{"vip": {}}
	ctx := context.Background()
	t0 := time.Now()

	// Ninguém pediu ainda: nada foi enviado a quem transmite.
	if n := previewRequests(pub, "vip"); n != 0 {
		t.Fatalf("pedidos antes de olhar = %d", n)
	}

	// Primeiro olhar (de fora da chamada): pede a foto e ainda não tem imagem.
	res, err := svc.ScreenPreview(ctx, "c1", "vip", "ana", t0)
	if err != nil || res.Image != nil {
		t.Fatalf("primeiro olhar = %+v, %v", res, err)
	}
	if n := previewRequests(pub, "vip"); n != 1 {
		t.Fatalf("pedidos = %d, want 1", n)
	}
	// Olhar de novo logo em seguida não repete o pedido.
	if _, err := svc.ScreenPreview(ctx, "c1", "vip", "mod", t0.Add(time.Second)); err != nil {
		t.Fatal(err)
	}
	if n := previewRequests(pub, "vip"); n != 1 {
		t.Fatalf("pedidos repetidos = %d, want 1", n)
	}

	img := jpegOf(t, 384, 216)
	if err := svc.SaveScreenPreview("c1", "vip", img, t0.Add(2*time.Second)); err != nil {
		t.Fatalf("SaveScreenPreview: %v", err)
	}
	// Mandar de novo em menos de 1 s é recusado.
	if err := svc.SaveScreenPreview("c1", "vip", img, t0.Add(2500*time.Millisecond)); !errors.Is(err, ErrPreviewTooFrequent) {
		t.Fatalf("envio seguido: err = %v", err)
	}

	res, err = svc.ScreenPreview(ctx, "c1", "vip", "ana", t0.Add(5*time.Second))
	if err != nil || !bytes.Equal(res.Image, img) {
		t.Fatalf("com foto fresca: %v, %v", len(res.Image), err)
	}
	if n := previewRequests(pub, "vip"); n != 1 {
		t.Fatalf("foto fresca não pede outra: pedidos = %d", n)
	}

	// Foto velha: ainda mostra, mas pede uma nova.
	res, _ = svc.ScreenPreview(ctx, "c1", "vip", "ana", t0.Add(15*time.Second))
	if res.Image == nil {
		t.Fatal("foto de 13 s devia ser mostrada")
	}
	if n := previewRequests(pub, "vip"); n != 2 {
		t.Fatalf("foto velha: pedidos = %d, want 2", n)
	}
	// Velha demais: não mostra.
	res, _ = svc.ScreenPreview(ctx, "c1", "vip", "ana", t0.Add(2*time.Minute))
	if res.Image != nil {
		t.Fatal("foto de 2 min não devia ser mostrada")
	}
}

func TestScreenPreviewAccess(t *testing.T) {
	svc, _, _ := newVoiceService(voiceSnapshot())
	putInCall(svc, "c1", "vip-voz", "vip")
	putInCall(svc, "c2", "geral", "mod")
	svc.screenSharers["c1"] = map[string]struct{}{"vip": {}}
	svc.screenSharers["c2"] = map[string]struct{}{"mod": {}}
	ctx := context.Background()
	now := time.Now()

	// ana não entra em vip-voz: não vê a prévia.
	if _, err := svc.ScreenPreview(ctx, "c1", "vip", "ana", now); !errors.Is(err, ErrNotAllowed) {
		t.Errorf("ana em vip-voz: err = %v", err)
	}
	// Quem não é do servidor também não.
	if _, err := svc.ScreenPreview(ctx, "c2", "mod", "zeca", now); !errors.Is(err, ErrNotAllowed) {
		t.Errorf("zeca: err = %v", err)
	}
	// Sala trancada: só quem está dentro.
	svc.calls["c2"].info.Locked = true
	if _, err := svc.ScreenPreview(ctx, "c2", "mod", "ana", now); !errors.Is(err, ErrNotAllowed) {
		t.Errorf("sala trancada: err = %v", err)
	}
	if _, err := svc.ScreenPreview(ctx, "c2", "mod", "mod", now); err != nil {
		t.Errorf("quem está dentro da sala trancada: err = %v", err)
	}
	// Quem não está transmitindo.
	svc.calls["c2"].info.Locked = false
	if _, err := svc.ScreenPreview(ctx, "c2", "ana", "mod", now); !errors.Is(err, ErrStreamNotActive) {
		t.Errorf("sem transmissão: err = %v", err)
	}
	// Chamada que não existe.
	if _, err := svc.ScreenPreview(ctx, "nao-existe", "mod", "mod", now); !errors.Is(err, ErrNotFound) {
		t.Errorf("sem chamada: err = %v", err)
	}
	// Só quem transmite manda foto.
	if err := svc.SaveScreenPreview("c2", "ana", jpegOf(t, 8, 8), now); !errors.Is(err, ErrNotAllowed) {
		t.Errorf("de fora mandando: err = %v", err)
	}
	putInCall(svc, "c3", "geral", "mod", "vip")
	if err := svc.SaveScreenPreview("c3", "vip", jpegOf(t, 8, 8), now); !errors.Is(err, ErrStreamNotActive) {
		t.Errorf("sem transmitir mandando: err = %v", err)
	}
}

func TestScreenPreviewDmOnlyParticipants(t *testing.T) {
	pub := newCapPublisher()
	svc := CallService(nil, pub, nil, nil, nil, nil, nil)
	svc.calls["dm"] = &activeCall{
		info: &Call{ID: "dm", Type: TypeDM, Status: StatusActive},
		participants: map[string]*participantState{
			"a": {userID: "a"}, "b": {userID: "b"},
		},
	}
	svc.screenSharers["dm"] = map[string]struct{}{"a": {}}
	if _, err := svc.ScreenPreview(context.Background(), "dm", "a", "b", time.Now()); err != nil {
		t.Errorf("par da DM: err = %v", err)
	}
	if _, err := svc.ScreenPreview(context.Background(), "dm", "a", "x", time.Now()); !errors.Is(err, ErrNotAllowed) {
		t.Errorf("de fora da DM: err = %v", err)
	}
}

func TestScreenPreviewClearedWhenSharingStops(t *testing.T) {
	svc, _, _ := newVoiceService(voiceSnapshot())
	putInCall(svc, "c1", "geral", "vip", "mod")
	ctx := context.Background()
	if err := svc.SetScreenShare(ctx, "c1", "vip", true); err != nil {
		t.Fatal(err)
	}
	if err := svc.SaveScreenPreview("c1", "vip", jpegOf(t, 8, 8), time.Now()); err != nil {
		t.Fatal(err)
	}
	if err := svc.SetScreenShare(ctx, "c1", "vip", false); err != nil {
		t.Fatal(err)
	}
	if svc.calls["c1"].screenPreviews["vip"] != nil {
		t.Fatal("a foto devia sumir quando a transmissão acaba")
	}

	if err := svc.SetScreenShare(ctx, "c1", "vip", true); err != nil {
		t.Fatal(err)
	}
	if err := svc.SaveScreenPreview("c1", "vip", jpegOf(t, 8, 8), time.Now()); err != nil {
		t.Fatal(err)
	}
	if _, _, err := svc.detachParticipant("c1", "vip"); err != nil {
		t.Fatal(err)
	}
	if svc.calls["c1"].screenPreviews["vip"] != nil {
		t.Fatal("a foto devia sumir quando a pessoa sai")
	}
}

func TestScreenPreviewRoutes(t *testing.T) {
	svc, _, _ := newVoiceService(voiceSnapshot())
	putInCall(svc, "c1", "geral", "vip", "mod")
	svc.screenSharers["c1"] = map[string]struct{}{"vip": {}}
	img := jpegOf(t, 64, 36)

	do := func(userID, method, path string, body []byte) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(method, path, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		tokenRouter(svc, userID).ServeHTTP(rec, req)
		return rec
	}

	// Ainda sem foto: image null.
	rec := do("ana", http.MethodGet, "/api/calls/c1/screen-preview/vip", nil)
	if rec.Code != http.StatusOK || rec.Body.String() != `{"image":null}` {
		t.Fatalf("GET sem foto = %d %s", rec.Code, rec.Body.String())
	}
	if rec.Header().Get("Cache-Control") != "no-store" {
		t.Error("a prévia não pode ir para cache")
	}

	payload, _ := json.Marshal(map[string][]byte{"image": img})
	if rec := do("vip", http.MethodPut, "/api/calls/c1/screen-preview", payload); rec.Code != http.StatusNoContent {
		t.Fatalf("PUT = %d %s", rec.Code, rec.Body.String())
	}
	if rec := do("vip", http.MethodPut, "/api/calls/c1/screen-preview", []byte(`{"image":"bmFvIGUganBlZw=="}`)); rec.Code != http.StatusBadRequest {
		t.Errorf("PUT de não-JPEG = %d", rec.Code)
	}
	if rec := do("vip", http.MethodPut, "/api/calls/c1/screen-preview", bytes.Repeat([]byte("a"), screenPreviewBodyLimit+1)); rec.Code != http.StatusBadRequest {
		t.Errorf("PUT grande demais = %d", rec.Code)
	}

	rec = do("ana", http.MethodGet, "/api/calls/c1/screen-preview/vip", nil)
	var body struct {
		Image []byte `json:"image"`
	}
	if rec.Code != http.StatusOK || json.Unmarshal(rec.Body.Bytes(), &body) != nil || !bytes.Equal(body.Image, img) {
		t.Fatalf("GET com foto = %d %s", rec.Code, rec.Body.String())
	}

	if rec := do("zeca", http.MethodGet, "/api/calls/c1/screen-preview/vip", nil); rec.Code != http.StatusForbidden {
		t.Errorf("GET de fora do servidor = %d", rec.Code)
	}
	if rec := do("ana", http.MethodGet, "/api/calls/c1/screen-preview/mod", nil); rec.Code != http.StatusNotFound {
		t.Errorf("GET de quem não transmite = %d", rec.Code)
	}
}
