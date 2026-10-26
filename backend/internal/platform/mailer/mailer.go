// Package mailer envia os e-mails da conta (confirmação de e-mail e
// recuperação de senha).
package mailer

import (
	"context"
	"log"
	"os"
	"strings"
)

// Message é um e-mail pronto: HTML e a versão em texto puro (multipart).
type Message struct {
	To      string
	Subject string
	HTML    string
	Text    string
	// Inline: imagens embutidas, citadas no HTML por cid:<CID>.
	Inline []Inline
}

// Inline é uma imagem embutida no e-mail.
type Inline struct {
	CID         string
	ContentType string
	Data        []byte
}

// Mailer envia um e-mail. Trocável nos testes.
type Mailer interface {
	Send(ctx context.Context, m Message) error
}

// LogMailer só imprime o e-mail no log. É o padrão em dev (sem SMTP): o link
// de confirmação aparece no console.
type LogMailer struct{}

func (LogMailer) Send(_ context.Context, m Message) error {
	log.Printf("[mailer] (SMTP não configurado) para %s — %s\n%s", m.To, m.Subject, m.Text)
	return nil
}

// FromEnv escolhe o SMTP quando SMTP_HOST e MAIL_FROM estão definidos; senão
// cai no LogMailer.
func FromEnv() Mailer {
	host := strings.TrimSpace(os.Getenv("SMTP_HOST"))
	from := strings.TrimSpace(os.Getenv("MAIL_FROM"))
	if host == "" || from == "" {
		log.Printf("[mailer] SMTP_HOST/MAIL_FROM vazios: e-mails só vão para o log")
		return LogMailer{}
	}
	port := strings.TrimSpace(os.Getenv("SMTP_PORT"))
	if port == "" {
		port = "587"
	}
	return &SMTPMailer{
		Host: host,
		Port: port,
		User: os.Getenv("SMTP_USER"),
		Pass: os.Getenv("SMTP_PASS"),
		From: from,
	}
}
