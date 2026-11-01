package user

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"gin-quickstart/backend/internal/namestyle"
	"gin-quickstart/backend/internal/profiletheme"
)

// ApplySnapshot do repositório falso: troca campos, avatar e banner e devolve
// as URLs que saíram.
func (r *fakeProfileRepo) ApplySnapshot(_ context.Context, id string, s ProfileSnapshot) (*User, []*string, error) {
	u, err := r.find(id)
	if err != nil {
		return nil, nil, err
	}
	old := []*string{u.AvatarURL, u.BannerURL}
	u.AvatarURL, u.BannerURL = s.AvatarURL, s.BannerURL
	updated, err := r.UpdateProfile(context.Background(), id, s.Fields)
	return updated, old, err
}

const (
	snapAvatar = "/api/profile-media/a_33333333-3333-4333-8333-333333333333"
	snapBanner = "/api/profile-media/44444444-4444-4444-8444-444444444444"
)

func TestSnapshotCopiesWholeProfile(t *testing.T) {
	avatar, banner, color := snapAvatar, snapBanner, "#112233"
	u := &User{
		DisplayName: "Mugis", Pronouns: "ele", Bio: "oi", StatusText: "nota",
		BannerColor: &color, Links: []ProfileLink{{URL: "https://x.com/a"}},
		AvatarURL: &avatar, BannerURL: &banner,
		NameStyle:    namestyle.Style{Font: "default", Effect: "solid", Colors: []string{}},
		ProfileTheme: profiletheme.Default(),
	}
	s := u.Snapshot()
	f := s.Fields
	if f.DisplayName != "Mugis" || f.Pronouns != "ele" || f.Bio != "oi" || f.StatusText != "nota" || *f.BannerColor != color || len(f.Links) != 1 {
		t.Fatalf("campos = %+v", f)
	}
	if f.NameStyle == nil || f.ProfileTheme == nil {
		t.Fatal("o estilo do nome e o tema vão sempre na foto")
	}
	if *s.AvatarURL != avatar || *s.BannerURL != banner {
		t.Fatalf("mídia = %v %v", s.AvatarURL, s.BannerURL)
	}
	// A foto não muda se o perfil mudar depois.
	u.Links[0].URL = "https://outro.com"
	*u.BannerColor = "#000000"
	if f.Links[0].URL != "https://x.com/a" || *f.BannerColor != "#112233" {
		t.Fatal("a foto deveria ser uma cópia")
	}
}

func TestValidateSnapshot(t *testing.T) {
	good := func() ProfileSnapshot {
		a, b := snapAvatar, snapBanner
		return ProfileSnapshot{Fields: ProfileInput{DisplayName: "Mugis"}, AvatarURL: &a, BannerURL: &b}
	}
	cases := []struct {
		name string
		edit func(*ProfileSnapshot)
		ok   bool
	}{
		{"completo", func(*ProfileSnapshot) {}, true},
		{"sem imagens", func(s *ProfileSnapshot) { s.AvatarURL, s.BannerURL = nil, nil }, true},
		{"avatar de fora", func(s *ProfileSnapshot) { s.AvatarURL = strPtr("https://evil.com/x.png") }, false},
		{"banner com id torto", func(s *ProfileSnapshot) { s.BannerURL = strPtr("/api/profile-media/../x") }, false},
		{"nome vazio", func(s *ProfileSnapshot) { s.Fields.DisplayName = " " }, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			s := good()
			tc.edit(&s)
			_, err := ValidateSnapshot(s)
			if tc.ok != (err == nil) {
				t.Fatalf("err = %v", err)
			}
			if !tc.ok && !errors.Is(err, ErrInvalidProfile) {
				t.Fatalf("err = %v, want ErrInvalidProfile", err)
			}
		})
	}
}

func TestApplySnapshotSwapsAndPublishesOnce(t *testing.T) {
	e := newProfileEnv(t)
	oldAvatar := "/api/profile-media/55555555-5555-4555-8555-555555555555"
	e.repo.users[meID].AvatarURL = &oldAvatar
	a, b := snapAvatar, snapBanner
	snap := ProfileSnapshot{Fields: ProfileInput{DisplayName: " Outro "}, AvatarURL: &a, BannerURL: &b}

	u, old, err := e.h.service.ApplySnapshot(context.Background(), meID, snap)
	if err != nil {
		t.Fatal(err)
	}
	if u.DisplayName != "Outro" || *u.AvatarURL != a || *u.BannerURL != b {
		t.Fatalf("usuário = %+v", u)
	}
	if len(old) != 1 || *old[0] != oldAvatar {
		t.Fatalf("só o avatar antigo saiu (o banner era nulo): %v", old)
	}
	if len(e.events.published) != 1 || e.events.published[0].DisplayName != "Outro" {
		t.Fatalf("eventos = %+v", e.events.published)
	}
}

func TestApplySnapshotKeepsSameMedia(t *testing.T) {
	e := newProfileEnv(t)
	a := snapAvatar
	e.repo.users[meID].AvatarURL = &a
	_, old, err := e.h.service.ApplySnapshot(context.Background(), meID, ProfileSnapshot{Fields: ProfileInput{DisplayName: "x"}, AvatarURL: &a})
	if err != nil {
		t.Fatal(err)
	}
	if len(old) != 0 {
		t.Fatalf("a mesma imagem não sai: %v", old)
	}
}

func TestApplySnapshotInvalidDoesNotTouch(t *testing.T) {
	e := newProfileEnv(t)
	_, _, err := e.h.service.ApplySnapshot(context.Background(), meID, ProfileSnapshot{Fields: ProfileInput{DisplayName: "x"}, AvatarURL: strPtr("https://evil.com/a.png")})
	if !errors.Is(err, ErrInvalidProfile) {
		t.Fatalf("err = %v", err)
	}
	if e.repo.users[meID].AvatarURL != nil || len(e.events.published) != 0 {
		t.Fatal("foto inválida não muda nada")
	}
	if _, _, err := e.h.service.ApplySnapshot(context.Background(), "99999999-9999-4999-8999-999999999999", ProfileSnapshot{Fields: ProfileInput{DisplayName: "x"}}); !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("err = %v", err)
	}
}

type fakeKeeper struct {
	used map[string]bool
	err  error
}

func (k fakeKeeper) MediaInUse(_ context.Context, url string) (bool, error) {
	return k.used[url], k.err
}

// Trocar o avatar não apaga o arquivo que um perfil salvo ainda usa.
func TestReplaceKeepsMediaInUse(t *testing.T) {
	for _, keeper := range []fakeKeeper{{used: map[string]bool{}}, {err: errors.New("banco fora")}} {
		e := newProfileEnv(t)
		e.upload(t, "/api/users/me/avatar", map[string][]byte{"file": pngData()})
		first := *e.repo.users[meID].AvatarURL
		if keeper.used != nil {
			keeper.used[first] = true
		}
		e.h.SetMediaKeeper(keeper)
		rec := e.upload(t, "/api/users/me/avatar", map[string][]byte{"file": pngData()})
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d", rec.Code)
		}
		if e.fileCount(t, e.store) != 2 {
			t.Fatal("o arquivo em uso (ou na dúvida) fica no disco")
		}
	}
}

func TestRemoveMediaURLWithoutUseDeletes(t *testing.T) {
	e := newProfileEnv(t)
	e.upload(t, "/api/users/me/avatar", map[string][]byte{"file": pngData()})
	url := *e.repo.users[meID].AvatarURL
	e.h.SetMediaKeeper(fakeKeeper{used: map[string]bool{}})
	e.h.RemoveMediaURL(&url)
	if e.fileCount(t, e.store) != 0 {
		t.Fatal("ninguém usa: o arquivo sai")
	}
}
