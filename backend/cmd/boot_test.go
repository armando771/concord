package main

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"gin-quickstart/backend/internal/channel"
	"gin-quickstart/backend/internal/message"
	"gin-quickstart/backend/internal/proposal"
	"gin-quickstart/backend/internal/server"
)

func TestIsSubcommand(t *testing.T) {
	if !isSubcommand([]string{"bin", "migrate"}, "migrate") {
		t.Error("migrate deveria ser subcomando")
	}
	if isSubcommand([]string{"bin"}, "migrate") || isSubcommand([]string{"bin", "capabilities"}, "migrate") {
		t.Error("sem argumento ou outro argumento não é migrate")
	}
}

func TestShutdownError(t *testing.T) {
	if shutdownError(nil) != nil || shutdownError(context.DeadlineExceeded) != nil {
		t.Error("nil e prazo estourado não são fatais")
	}
	boom := errors.New("boom")
	if !errors.Is(shutdownError(boom), boom) {
		t.Error("outro erro é fatal")
	}
}

func TestFinishShutdown(t *testing.T) {
	done := make(chan struct{})
	close(done)
	if finishShutdown(context.DeadlineExceeded, done, time.Second) != nil {
		t.Error("prazo estourado não é fatal")
	}
	if finishShutdown(nil, make(chan struct{}), time.Millisecond) != nil {
		t.Error("badges atrasados só vão para o log")
	}
	if finishShutdown(errors.New("boom"), done, time.Second) == nil {
		t.Error("outro erro é fatal")
	}
}

func TestWaitDone(t *testing.T) {
	done := make(chan struct{})
	close(done)
	if !waitDone(done, time.Second) {
		t.Error("canal fechado termina na hora")
	}
	if waitDone(make(chan struct{}), time.Millisecond) {
		t.Error("canal aberto estoura o prazo")
	}
}

func TestEnvHelpers(t *testing.T) {
	t.Setenv("CONCORD_TEST_X", "")
	if envOr("CONCORD_TEST_X", "padrão") != "padrão" {
		t.Error("vazio usa o padrão")
	}
	t.Setenv("CONCORD_TEST_X", "valor")
	if envOr("CONCORD_TEST_X", "padrão") != "valor" {
		t.Error("definido usa o valor")
	}
	t.Setenv("CONCORD_TEST_LIST", " a, ,b ,")
	if got := envList("CONCORD_TEST_LIST"); len(got) != 2 || got[0] != "a" || got[1] != "b" {
		t.Errorf("envList = %v", got)
	}
}

func TestLoadEnv(t *testing.T) {
	dir := t.TempDir()
	t.Chdir(dir)
	loadEnv() // sem .env: só loga
	if err := os.WriteFile(filepath.Join(dir, ".env"), []byte("CONCORD_TEST_LOADED=sim\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("CONCORD_TEST_LOADED", "")
	os.Unsetenv("CONCORD_TEST_LOADED")
	loadEnv()
	if os.Getenv("CONCORD_TEST_LOADED") != "sim" {
		t.Error(".env do diretório atual deveria ser carregado")
	}
}

func TestLiveKitCredentials(t *testing.T) {
	t.Setenv("LIVEKIT_API_KEY", "k")
	t.Setenv("LIVEKIT_API_SECRET", "")
	if _, _, err := liveKitCredentials(); err == nil {
		t.Error("sem segredo é erro")
	}
	t.Setenv("LIVEKIT_API_SECRET", "s")
	if key, secret, err := liveKitCredentials(); err != nil || key != "k" || secret != "s" {
		t.Errorf("credenciais: %q %q %v", key, secret, err)
	}
}

func TestIssueCreatorFromEnv(t *testing.T) {
	for _, key := range []string{"GITHUB_REPO", "GITHUB_APP_ID", "GITHUB_APP_INSTALLATION_ID", "GITHUB_APP_PRIVATE_KEY_PATH", "GITHUB_TOKEN", "GITHUB_API_URL", "API_PUBLIC_URL"} {
		t.Setenv(key, "")
	}
	if newIssueCreator() != nil {
		t.Error("sem repositório não cria issue")
	}
	t.Setenv("GITHUB_REPO", "dono/repo")
	if newIssueCreator() != nil {
		t.Error("sem credencial não cria issue")
	}
	t.Setenv("GITHUB_APP_ID", "1")
	t.Setenv("GITHUB_APP_INSTALLATION_ID", "2")
	t.Setenv("GITHUB_APP_PRIVATE_KEY_PATH", filepath.Join(t.TempDir(), "nao-existe.pem"))
	if newIssueCreator() != nil {
		t.Error("chave ilegível não cria issue")
	}
	bad := filepath.Join(t.TempDir(), "ruim.pem")
	if err := os.WriteFile(bad, []byte("não é PEM"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("GITHUB_APP_PRIVATE_KEY_PATH", bad)
	if newIssueCreator() != nil {
		t.Error("chave inválida não cria issue")
	}
	t.Setenv("GITHUB_APP_ID", "")
	t.Setenv("GITHUB_TOKEN", "tok")
	t.Setenv("GITHUB_API_URL", "http://github.local")
	t.Setenv("API_PUBLIC_URL", "https://salinha.example")
	if _, ok := newIssueCreator().(*proposal.GitHubClient); !ok {
		t.Error("com token cria o cliente do GitHub")
	}
}

type fakeLoginIndexes struct {
	hasUsername, hasEmail bool
	conflicts             int
	err                   error
}

func (f fakeLoginIndexes) LoginIndexes(context.Context) (bool, bool, error) {
	return f.hasUsername, f.hasEmail, f.err
}

func (f fakeLoginIndexes) CaseConflicts(context.Context) (int, int, error) {
	return f.conflicts, 0, f.err
}

func TestCheckLoginIndexesSoLoga(t *testing.T) {
	// Só loga: o que importa é passar por todos os ramos sem derrubar o boot.
	checkLoginIndexes(fakeLoginIndexes{err: errors.New("db fora")})
	checkLoginIndexes(fakeLoginIndexes{})
	checkLoginIndexes(fakeLoginIndexes{hasUsername: true, hasEmail: true, conflicts: 2})
}

type fakeNotices struct{ err error }

func (f fakeNotices) NoticesChannel(context.Context, string) (*channel.Channel, error) {
	return &channel.Channel{ID: "avisos"}, f.err
}

type fakePoster struct {
	posted []string
	err    error
}

func (f *fakePoster) CreateSystemChannelMessage(_ context.Context, channelID, authorID, _, kind string) (*message.Message, error) {
	f.posted = append(f.posted, channelID+"|"+authorID+"|"+kind)
	return nil, f.err
}

func TestWelcomeMember(t *testing.T) {
	ctx := context.Background()
	member := server.ServerMember{UserID: "u1", Username: "ana"}

	poster := &fakePoster{}
	welcomeMember(ctx, fakeNotices{}, poster, "s1", member)
	if len(poster.posted) != 1 || poster.posted[0] != "avisos|u1|"+server.WelcomeSystemKind {
		t.Errorf("boas-vindas: %v", poster.posted)
	}

	poster = &fakePoster{}
	welcomeMember(ctx, fakeNotices{}, poster, "s1", server.ServerMember{UserID: "bot"})
	welcomeMember(ctx, fakeNotices{err: errors.New("sem canal")}, poster, "s1", member)
	if len(poster.posted) != 0 {
		t.Errorf("sem username ou sem canal não posta: %v", poster.posted)
	}

	welcomeMember(ctx, fakeNotices{}, &fakePoster{err: errors.New("falhou")}, "s1", member) // só loga
}
