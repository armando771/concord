package lifecycle

import (
	"fmt"
	"net"
	"os"
	"strconv"
)

// listenFdsStart é o primeiro fd que o systemd passa (sd_listen_fds).
const listenFdsStart = 3

// SocketActivationCapability fica gravada no binário: scripts/deploy-vps.sh a
// procura (grep) antes de instalar um binário com o concord-server.socket
// ativo — um binário sem ela não usa o socket e não sobe (porta ocupada).
const SocketActivationCapability = "concord-capability:socket-activation-v1"

// Listen abre a porta do servidor. Com ativação por socket do systemd
// (deploy/concord-server.socket) usa o socket que o systemd mantém aberto: no
// reinício a porta nunca fecha — as conexões ficam na fila do kernel até o
// processo novo aceitar, em vez de recusadas (e o Caddy não precisa repetir
// nada, nem POST com corpo). Sem ativação, escuta em addr como sempre.
func Listen(addr string) (ln net.Listener, activated bool, err error) {
	ln, activated, err = activatedListener(os.Getenv, os.Getpid(), listenFdsStart)
	if err != nil || activated {
		return ln, activated, err
	}
	ln, err = net.Listen("tcp", addr)
	return ln, false, err
}

// activatedListener segue o protocolo do sd_listen_fds: LISTEN_PID tem que ser
// este processo e LISTEN_FDS ≥ 1; usa o primeiro socket.
func activatedListener(getenv func(string) string, pid int, fd uintptr) (net.Listener, bool, error) {
	if getenv("LISTEN_PID") != strconv.Itoa(pid) {
		return nil, false, nil
	}
	n, err := strconv.Atoi(getenv("LISTEN_FDS"))
	if err != nil || n < 1 {
		return nil, false, nil
	}
	// Não passa adiante para processos filhos.
	_ = os.Unsetenv("LISTEN_PID")
	_ = os.Unsetenv("LISTEN_FDS")
	_ = os.Unsetenv("LISTEN_FDNAMES")

	f := os.NewFile(fd, "systemd-socket")
	ln, err := net.FileListener(f) // duplica o fd: fechar o nosso não fecha o do systemd
	_ = f.Close()
	if err != nil {
		return nil, false, fmt.Errorf("socket do systemd: %w", err)
	}
	return ln, true, nil
}
