package lifecycle

import (
	"net"
	"os"
	"strconv"
	"syscall"
	"testing"
	"time"
)

// listenerFile devolve um *os.File de um socket já escutando (a cópia que o
// systemd guarda) e o endereço dele. inherited dá o fd que o processo recebe.
func listenerFile(t *testing.T) (*os.File, string) {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	f, err := ln.(*net.TCPListener).File()
	if err != nil {
		t.Fatalf("file: %v", err)
	}
	addr := ln.Addr().String()
	ln.Close() // o dup em f continua escutando, como o socket do systemd
	t.Cleanup(func() { f.Close() })
	return f, addr
}

// inherited duplica o fd, como o systemd faz ao passar o socket ao serviço.
func inherited(t *testing.T, f *os.File) uintptr {
	t.Helper()
	fd, err := syscall.Dup(int(f.Fd()))
	if err != nil {
		t.Fatalf("dup: %v", err)
	}
	return uintptr(fd)
}

func envOf(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

func TestActivatedListenerUsesSocketFromSystemd(t *testing.T) {
	f, addr := listenerFile(t)
	pid := os.Getpid()

	ln, ok, err := activatedListener(envOf(map[string]string{
		"LISTEN_FDS": "1", "LISTEN_PID": strconv.Itoa(pid),
	}), pid, inherited(t, f))
	if err != nil || !ok {
		t.Fatalf("activatedListener = %v, %v", ok, err)
	}
	defer ln.Close()

	accepted := make(chan struct{})
	go func() {
		if c, err := ln.Accept(); err == nil {
			c.Close()
			close(accepted)
		}
	}()
	c, err := net.DialTimeout("tcp", addr, time.Second)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	c.Close()
	select {
	case <-accepted:
	case <-time.After(time.Second):
		t.Fatal("não aceitou pelo socket herdado")
	}
}

// Fechar o listener herdado (desligamento) não fecha o socket do systemd:
// conexões novas ficam na fila para o processo seguinte, em vez de recusadas.
func TestClosingActivatedListenerKeepsPortQueuing(t *testing.T) {
	f, addr := listenerFile(t)
	pid := os.Getpid()
	ln, _, err := activatedListener(envOf(map[string]string{"LISTEN_FDS": "1", "LISTEN_PID": strconv.Itoa(pid)}), pid, inherited(t, f))
	if err != nil {
		t.Fatalf("activatedListener: %v", err)
	}
	ln.Close()

	c, err := net.DialTimeout("tcp", addr, time.Second)
	if err != nil {
		t.Fatalf("porta recusou depois de fechar o listener herdado: %v", err)
	}
	c.Close()
}

func TestNotActivatedWithoutEnvOrForAnotherProcess(t *testing.T) {
	f, _ := listenerFile(t)
	pid := os.Getpid()
	for _, env := range []map[string]string{
		{},
		{"LISTEN_FDS": "0", "LISTEN_PID": strconv.Itoa(pid)},
		{"LISTEN_FDS": "1", "LISTEN_PID": strconv.Itoa(pid + 1)},
	} {
		if ln, ok, err := activatedListener(envOf(env), pid, f.Fd()); ok || ln != nil || err != nil {
			t.Fatalf("env %v: ativado = %v (%v)", env, ok, err)
		}
	}
}
