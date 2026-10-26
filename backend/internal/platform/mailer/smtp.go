package mailer

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"mime"
	"mime/multipart"
	"net"
	"net/mail"
	"net/smtp"
	"net/textproto"
	"strings"
	"time"
)

const smtpTimeout = 30 * time.Second

// SMTPMailer envia por SMTP: porta 465 usa TLS direto; as outras fazem
// STARTTLS. Com usuário e senha, recusa mandar a senha sem TLS.
type SMTPMailer struct {
	Host, Port, User, Pass, From string
}

func (s *SMTPMailer) Send(ctx context.Context, m Message) error {
	from, err := mail.ParseAddress(s.From)
	if err != nil {
		return fmt.Errorf("MAIL_FROM inválido: %w", err)
	}
	to, err := mail.ParseAddress(m.To)
	if err != nil {
		return fmt.Errorf("destinatário inválido: %w", err)
	}
	if strings.ContainsAny(m.Subject, "\r\n") {
		return errors.New("assunto inválido")
	}
	body, err := buildMessage(from, to, m)
	if err != nil {
		return err
	}

	dialer := net.Dialer{Timeout: 10 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(s.Host, s.Port))
	if err != nil {
		return err
	}
	_ = conn.SetDeadline(time.Now().Add(smtpTimeout))

	tlsConf := &tls.Config{ServerName: s.Host, MinVersion: tls.VersionTLS12}
	implicitTLS := s.Port == "465"
	if implicitTLS {
		conn = tls.Client(conn, tlsConf)
	}
	c, err := smtp.NewClient(conn, s.Host)
	if err != nil {
		conn.Close()
		return err
	}
	defer c.Close()

	if !implicitTLS {
		if ok, _ := c.Extension("STARTTLS"); ok {
			if err := c.StartTLS(tlsConf); err != nil {
				return err
			}
		} else if s.User != "" {
			return errors.New("servidor SMTP sem STARTTLS: não envio a senha sem criptografia")
		}
	}
	if s.User != "" {
		if err := c.Auth(smtp.PlainAuth("", s.User, s.Pass, s.Host)); err != nil {
			return err
		}
	}
	if err := c.Mail(from.Address); err != nil {
		return err
	}
	if err := c.Rcpt(to.Address); err != nil {
		return err
	}
	w, err := c.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(body); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return c.Quit()
}

// buildMessage monta o multipart/alternative (texto + HTML) em base64. Com
// imagens embutidas, o HTML vai num multipart/related junto delas.
func buildMessage(from, to *mail.Address, m Message) ([]byte, error) {
	var b bytes.Buffer
	fmt.Fprintf(&b, "From: %s\r\n", from.String())
	fmt.Fprintf(&b, "To: %s\r\n", to.String())
	fmt.Fprintf(&b, "Subject: %s\r\n", mime.QEncoding.Encode("utf-8", m.Subject))
	fmt.Fprintf(&b, "Date: %s\r\n", time.Now().Format(time.RFC1123Z))
	b.WriteString("MIME-Version: 1.0\r\n")

	alt := multipart.NewWriter(&b)
	fmt.Fprintf(&b, "Content-Type: multipart/alternative; boundary=%q\r\n\r\n", alt.Boundary())

	if err := writeBase64Part(alt, "text/plain; charset=utf-8", nil, []byte(m.Text)); err != nil {
		return nil, err
	}
	if len(m.Inline) == 0 {
		if err := writeBase64Part(alt, "text/html; charset=utf-8", nil, []byte(m.HTML)); err != nil {
			return nil, err
		}
		return b.Bytes(), alt.Close()
	}

	var rel bytes.Buffer
	related := multipart.NewWriter(&rel)
	if err := writeBase64Part(related, "text/html; charset=utf-8", nil, []byte(m.HTML)); err != nil {
		return nil, err
	}
	for _, img := range m.Inline {
		extra := textproto.MIMEHeader{}
		extra.Set("Content-ID", "<"+img.CID+">")
		extra.Set("Content-Disposition", "inline")
		if err := writeBase64Part(related, img.ContentType, extra, img.Data); err != nil {
			return nil, err
		}
	}
	if err := related.Close(); err != nil {
		return nil, err
	}
	hdr := textproto.MIMEHeader{}
	hdr.Set("Content-Type", fmt.Sprintf("multipart/related; boundary=%q", related.Boundary()))
	w, err := alt.CreatePart(hdr)
	if err != nil {
		return nil, err
	}
	if _, err := w.Write(rel.Bytes()); err != nil {
		return nil, err
	}
	return b.Bytes(), alt.Close()
}

func writeBase64Part(w *multipart.Writer, contentType string, extra textproto.MIMEHeader, data []byte) error {
	hdr := textproto.MIMEHeader{}
	hdr.Set("Content-Type", contentType)
	hdr.Set("Content-Transfer-Encoding", "base64")
	for k, v := range extra {
		hdr[k] = v
	}
	part, err := w.CreatePart(hdr)
	if err != nil {
		return err
	}
	enc := base64.StdEncoding.EncodeToString(data)
	for len(enc) > 76 {
		if _, err := part.Write([]byte(enc[:76] + "\r\n")); err != nil {
			return err
		}
		enc = enc[76:]
	}
	_, err = part.Write([]byte(enc + "\r\n"))
	return err
}
