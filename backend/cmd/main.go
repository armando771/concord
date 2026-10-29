package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"gin-quickstart/backend/internal/platform/database"
	"gin-quickstart/backend/internal/platform/lifecycle"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Desligamento (SIGTERM): o processo novo só sobe depois que este sai, então
// cada espera aqui é tempo sem servidor.
const (
	// Requisições comuns em andamento (API, uploads) têm até isso para acabar;
	// o que sobrar é cortado. O TimeoutStopSec do systemd é bem maior.
	shutdownTimeout = 3 * time.Second
	// O 1012 sai na hora; isso é só o quanto se espera o "ok" de cada app
	// (um notebook que dormiu nunca responde).
	wsCloseTimeout = 500 * time.Millisecond
	// Quanto se espera os badges gravarem o que estava na memória.
	badgeFlushTimeout = 5 * time.Second
)

func main() {
	// `concord-server capabilities`: o que este binário sabe fazer, sem tocar
	// em banco nem porta. O deploy procura a marca no arquivo (sem executá-lo)
	// para não instalar, com o socket do systemd ativo, um binário que não sabe
	// usá-lo.
	if isSubcommand(os.Args, "capabilities") {
		fmt.Println(lifecycle.SocketActivationCapability)
		return
	}

	loadEnv()

	// SIGTERM (systemctl restart/stop) ou Ctrl+C: desliga com calma (ver lifecycle.Run).
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer stop()

	db := openDatabase()
	defer db.Close()
	// `concord-server migrate`: só aplica as migrations e sai. O deploy roda
	// assim com o binário antigo ainda no ar; se falhar, nada é reiniciado.
	if isSubcommand(os.Args, "migrate") {
		log.Println("migrations aplicadas")
		return
	}

	router, streams, readiness := newRouter(db)
	a := wire(ctx, db)
	a.registerRoutes(router)

	// HOST=127.0.0.1 quando há um proxy na frente (Caddy na VPS).
	ln := listen(os.Getenv("HOST") + ":" + envOr("PORT", "8080"))
	readiness.SetReady()

	srv := &http.Server{Handler: router, ReadHeaderTimeout: 10 * time.Second}
	err := lifecycle.Run(ctx, srv, ln, shutdownTimeout, func(ctx context.Context) {
		stop() // um segundo SIGTERM/Ctrl+C mata na hora
		readiness.SetStopping()
		streams.Interrupt()
		// Não tira ninguém das chamadas: o processo novo as recarrega do banco
		// e os clientes reconectam com o código 1012.
		wsCtx, cancel := context.WithTimeout(ctx, wsCloseTimeout)
		defer cancel()
		a.hub.Shutdown(wsCtx)
	})
	// Os badges gravam o último minuto e as maratonas em andamento (o ctx já
	// foi cancelado pelo SIGTERM); o db.Close do defer vem depois.
	must(finishShutdown(err, a.badgeDone, badgeFlushTimeout), "")
	log.Println("servidor desligado")
}

// isSubcommand: `concord-server <name>`.
func isSubcommand(args []string, name string) bool {
	return len(args) > 1 && args[1] == name
}

// openDatabase conecta (esperando o Postgres, que pode subir depois do
// backend num boot da VPS) e aplica as migrations.
func openDatabase() *pgxpool.Pool {
	db, err := database.ConnectWithRetry(os.Getenv("DATABASE_URL"), 30*time.Second)
	must(err, "")
	must(database.Migrate(db, findMigrationsDir()), "failed to run migrations")
	return db
}

// listen abre a porta. Com o socket do systemd (deploy/concord-server.socket)
// a porta fica aberta durante o reinício e as conexões esperam na fila; sem
// ele, a porta só abre com tudo pronto. Nos dois casos nada é atendido antes
// de pronto.
func listen(addr string) net.Listener {
	ln, activated, err := lifecycle.Listen(addr)
	if err != nil {
		log.Fatal(err)
	}
	suffix := ""
	if activated {
		suffix = " (socket do systemd)"
	}
	log.Printf("servidor pronto em %s%s", ln.Addr(), suffix)
	return ln
}

// must derruba o boot com o erro (prefixado por msg, se houver).
func must(err error, msg string) {
	if err == nil {
		return
	}
	if msg == "" {
		log.Fatal(err)
	}
	log.Fatalf("%s: %v", msg, err)
}

// finishShutdown: erro do lifecycle.Run tratado e espera dos badges.
func finishShutdown(runErr error, badgeDone <-chan struct{}, timeout time.Duration) error {
	if err := shutdownError(runErr); err != nil {
		return err
	}
	if !waitDone(badgeDone, timeout) {
		log.Println("desligamento: badges não terminaram de gravar a tempo")
	}
	return nil
}

// shutdownError: requisições cortadas no prazo do desligamento são esperadas
// (só vão para o log); qualquer outro erro é fatal.
func shutdownError(err error) error {
	if errors.Is(err, context.DeadlineExceeded) {
		log.Printf("desligamento: requisições ainda em andamento após %s foram cortadas", shutdownTimeout)
		return nil
	}
	return err
}

// waitDone espera done fechar por até timeout.
func waitDone(done <-chan struct{}, timeout time.Duration) bool {
	select {
	case <-done:
		return true
	case <-time.After(timeout):
		return false
	}
}
