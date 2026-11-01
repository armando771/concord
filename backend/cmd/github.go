package main

import (
	"log"
	"os"

	"gin-quickstart/backend/internal/proposal"
)

// newIssueCreator escolhe como as propostas aprovadas viram issue: como um
// GitHub App (GITHUB_APP_*, as issues saem como "<app>[bot]") ou com um token
// fixo (GITHUB_TOKEN). Sem repositório ou sem credencial, devolve nil e as
// propostas aprovadas ficam sem issue.
func newIssueCreator() proposal.IssueCreator {
	creator := buildIssueCreator()
	// GITHUB_API_URL: GitHub Enterprise ou servidor de teste (padrão api.github.com).
	if apiURL := os.Getenv("GITHUB_API_URL"); apiURL != "" {
		if client, ok := creator.(*proposal.GitHubClient); ok {
			log.Printf("[proposal] API do GitHub em %s", apiURL)
			creator = client.WithBaseURL(apiURL)
		}
	}
	// API_PUBLIC_URL: endereço público do backend; com ele as imagens das
	// propostas entram na issue (o GitHub precisa conseguir buscá-las).
	if publicURL := os.Getenv("API_PUBLIC_URL"); publicURL != "" {
		if client, ok := creator.(*proposal.GitHubClient); ok {
			client.WithPublicURL(publicURL)
		}
	}
	return creator
}

func buildIssueCreator() proposal.IssueCreator {
	repo := os.Getenv("GITHUB_REPO")
	if repo == "" {
		log.Println("[proposal] GITHUB_REPO vazio: propostas aprovadas ficam sem issue")
		return nil
	}
	appID, installationID := os.Getenv("GITHUB_APP_ID"), os.Getenv("GITHUB_APP_INSTALLATION_ID")
	if keyPath := os.Getenv("GITHUB_APP_PRIVATE_KEY_PATH"); appID != "" && installationID != "" && keyPath != "" {
		return githubAppClient(appID, installationID, keyPath, repo)
	}
	if token := os.Getenv("GITHUB_TOKEN"); token != "" {
		log.Printf("[proposal] issues em %s com GITHUB_TOKEN", repo)
		return proposal.NewGitHubClient(token, repo)
	}
	log.Println("[proposal] sem GITHUB_APP_* nem GITHUB_TOKEN: propostas aprovadas ficam sem issue")
	return nil
}

func githubAppClient(appID, installationID, keyPath, repo string) proposal.IssueCreator {
	pemKey, err := os.ReadFile(keyPath)
	if err != nil {
		log.Printf("[proposal] GitHub App: não consegui ler a chave %s: %v (propostas aprovadas ficam sem issue)", keyPath, err)
		return nil
	}
	client, err := proposal.NewGitHubAppClient(appID, installationID, pemKey, repo)
	if err != nil {
		log.Printf("[proposal] %v (propostas aprovadas ficam sem issue)", err)
		return nil
	}
	log.Printf("[proposal] issues em %s como GitHub App %s", repo, appID)
	return client
}
