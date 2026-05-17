# Ledgerify Agent Notes

This is a Go + HTMX + Pico.css app. The active UI lives in `web/templates/` and `web/static/css/custom.css`. The server entrypoint is `cmd/server/main.go`.

Do not add or modify old Next.js/React files; that stack has been removed.

Before claiming completion, run:

```bash
go test ./...
go build -o /tmp/ledgerify-server ./cmd/server
git diff --check
```
