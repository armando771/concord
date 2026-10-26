package changelog

// O next.md acumula as notas entre deploys (o CI não consegue esvaziá-lo no
// git), então cada release guarda só o que ainda não saiu numa mais antiga.

// newEntries tira de entries as notas que já estão numa release anterior a
// version. releases vem do store, da mais nova para a mais antiga; se version
// já existe, só contam as que vêm depois dela (repetir o deploy dá o mesmo).
func newEntries(releases []Release, version string, entries []Entry) []Entry {
	older := releases
	for i, r := range releases {
		if r.Version == version {
			older = releases[i+1:]
			break
		}
	}
	published := map[string]bool{}
	for _, r := range older {
		for _, e := range r.Entries {
			published[e.Text] = true
		}
	}
	kept := []Entry{}
	for _, e := range entries {
		if !published[e.Text] {
			kept = append(kept, e)
		}
	}
	return kept
}

// visible esconde as releases que ficaram sem nota nem resumo.
func visible(releases []Release) []Release {
	shown := []Release{}
	for _, r := range releases {
		if len(r.Entries) > 0 || r.Summary != "" {
			shown = append(shown, r)
		}
	}
	return shown
}
