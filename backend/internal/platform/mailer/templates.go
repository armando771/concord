package mailer

import (
	"bytes"
	_ "embed"
	"fmt"
	"html/template"
	"net/url"
	"strings"
	"time"
)

//go:embed templates/base.html
var baseHTML string

//go:embed templates/icon.png
var iconPNG []byte

// iconCID é o Content-ID do ícone; o base.html o cita como cid:salinha-icon.
const iconCID = "salinha-icon"

var baseTemplate = template.Must(template.New("base").Parse(baseHTML))

// content é o que muda de um e-mail para o outro; o layout é o mesmo.
type content struct {
	Subject   string
	Preheader string
	Title     string
	Name      string
	Intro     string
	Button    string
	URL       string
	Expires   string
	Note      string
	// IconSrc é typed (template.URL) porque o html/template barra o esquema cid:.
	IconSrc template.URL
}

func render(c content, to string) (Message, error) {
	var html bytes.Buffer
	c.IconSrc = template.URL("cid:" + iconCID)
	if err := baseTemplate.Execute(&html, c); err != nil {
		return Message{}, err
	}
	text := fmt.Sprintf("Olá, %s!\n\n%s\n\n%s: %s\n\n%s\n\n%s\n",
		c.Name, c.Intro, c.Button, c.URL, c.Expires, c.Note)
	return Message{
		To: to, Subject: c.Subject, HTML: html.String(), Text: text,
		Inline: []Inline{{CID: iconCID, ContentType: "image/png", Data: iconPNG}},
	}, nil
}

// link monta APP_URL + path + ?token=...; o token vai escapado.
func link(appURL, path, token string) string {
	return strings.TrimRight(appURL, "/") + path + "?token=" + url.QueryEscape(token)
}

func lifetime(d time.Duration) string {
	if d >= time.Hour && d%time.Hour == 0 {
		h := int(d / time.Hour)
		if h == 1 {
			return "1 hora"
		}
		return fmt.Sprintf("%d horas", h)
	}
	return fmt.Sprintf("%d minutos", int(d/time.Minute))
}

// VerifyEmail monta o e-mail de confirmação de endereço.
func VerifyEmail(to, name, appURL, token string, ttl time.Duration) (Message, error) {
	return render(content{
		Subject:   "Confirme seu e-mail no Salinha",
		Preheader: "Falta só um passo para confirmar seu e-mail.",
		Title:     "Confirme seu e-mail",
		Name:      name,
		Intro:     "Bem-vindo ao Salinha! Confirme que este endereço é seu para proteger sua conta e liberar todos os recursos.",
		Button:    "Confirmar e-mail",
		URL:       link(appURL, "/verify-email", token),
		Expires:   "Este link expira em " + lifetime(ttl) + ".",
		Note:      "Não criou uma conta? Pode ignorar este e-mail com tranquilidade.",
	}, to)
}

// ResetPassword monta o e-mail de redefinição de senha.
func ResetPassword(to, name, appURL, token string, ttl time.Duration) (Message, error) {
	return render(content{
		Subject:   "Redefinir sua senha do Salinha",
		Preheader: "Recebemos um pedido para redefinir sua senha.",
		Title:     "Redefinir sua senha",
		Name:      name,
		Intro:     "Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para escolher uma nova.",
		Button:    "Redefinir senha",
		URL:       link(appURL, "/reset-password", token),
		Expires:   "Este link expira em " + lifetime(ttl) + " e só pode ser usado uma vez.",
		Note:      "Não foi você? Ignore este e-mail: sua senha continua a mesma.",
	}, to)
}
