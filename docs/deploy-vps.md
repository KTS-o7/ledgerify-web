# Deploying ledgerify-web to the VPS from `main`

A runbook for the manual, VPS-side build/deploy. There is no CI on `main` (the deploy workflow was never merged) and no Makefile. The image is built directly on the VPS from a git clone of the repo, then started by docker compose.

## Architecture

The VPS runs two stacks in `/opt/ledgerify/`:

| Path | Role |
|---|---|
| `/opt/ledgerify/src/` | Git clone of `github.com/KTS-o7/ledgerify-web`. The `main` branch. Used as the build context for `docker build`. |
| `/opt/ledgerify/docker-compose.prod.yml` | Production compose file. Wires the app container to the postgres container + reads env vars from `.env`. |
| `/opt/ledgerify/.env` | Gitignored. Holds `DATABASE_URL`, `JWT_SECRET`, `JWT_TTL`, `LLM_*`, etc. |
| `/opt/ledgerify/pg_data` (named volume `ledgerify_pg_data`) | Postgres data. Persists across restarts and rebuilds. |

The build produces the image `ghcr.io/kts-o7/ledgerify-web:latest` — but it's **built locally on the VPS**, not pushed to ghcr. The `:latest` tag is purely a label used by `docker-compose.prod.yml` to reference the in-VPS image.

Builds use the `ledgerify` buildx builder (created from the `docker-container` driver), which persists BuildKit's cache across runs. The Dockerfile has `--mount=type=cache` directives on `bun install`, `go mod download`, and `go build` so the warm-cache redeploy is 3–10s instead of 5–6 min. First-time setup of the builder is below.

Port mapping: `127.0.0.1:8080:8080` on the host → app container. nginx + Cloudflare sit in front of `:443` and proxy public traffic to it.

## First-time setup (one-time, per VPS)

If you're provisioning a fresh VPS, do this once:

```bash
# 1. Clone the repo
ssh personal "git clone https://github.com/KTS-o7/ledgerify-web.git /opt/ledgerify/src"

# 2. Create .env (NEVER commit this). Minimum required keys:
ssh personal "cat > /opt/ledgerify/.env <<'EOF'
DATABASE_URL=postgresql://ledgerify:<password>@postgres:5432/ledgerify
POSTGRES_DB=ledgerify
POSTGRES_USER=ledgerify
POSTGRES_PASSWORD=<password>
AUTH_SECRET=<base64 32+ bytes>
JWT_SECRET=<base64 32+ bytes>          # can equal AUTH_SECRET
JWT_TTL=168h                            # 7 days; agent can re-issue via refresh_token
AUTH_URL=https://money.shenthar.me
NEXT_PUBLIC_APP_URL=https://money.shenthar.me
CRON_SECRET=<random>
LLM_API_URL=http://host-gateway:9123
LLM_API_KEY=<from taalas or your LLM provider>
LLM_MODEL=taalas-llama3.1-8b
EOF"

# 3. Copy docker-compose.prod.yml from the repo
ssh personal "cp /opt/ledgerify/src/docker-compose.prod.yml /opt/ledgerify/"

# 4. Install buildx (Ubuntu's docker package doesn't include it) and create
#    a persistent BuildKit builder. One-time per VPS.
ssh personal "mkdir -p /usr/libexec/docker/cli-plugins
  curl -sSL https://github.com/docker/buildx/releases/download/v0.18.0/buildx-v0.18.0.linux-amd64 \
    -o /usr/libexec/docker/cli-plugins/docker-buildx
  chmod +x /usr/libexec/docker/cli-plugins/docker-buildx
  docker buildx create --name ledgerify --driver docker-container --use
  docker buildx inspect ledgerify --bootstrap"

# 5. Bring it up
ssh personal "cd /opt/ledgerify && docker compose -f docker-compose.prod.yml up -d"

# 6. Apply schema (only the first time, or after schema/ changes)
ssh personal "docker exec -i ledgerify-postgres-1 psql -U ledgerify -d ledgerify < /opt/ledgerify/src/schema/001_schema.sql"
```

## Deploy (the daily workflow)

```bash
# Pull latest main, build image with BuildKit cache, restart containers
ssh personal "set -e
  cd /opt/ledgerify/src && git pull origin main
  docker buildx build --builder ledgerify -t ghcr.io/kts-o7/ledgerify-web:latest --load .
  cd /opt/ledgerify && docker compose -f docker-compose.prod.yml up -d
  sleep 4 && docker logs --tail 5 ledgerify-app-1"
```

That's it. Compose reuses the local image (no registry round-trip), recreates only the containers whose config changed, and `docker logs` confirms it started.

**Build times with the `ledgerify` buildx builder** (uses BuildKit cache mounts for bun modules and Go module/build caches):

| Scenario | Time |
|---|---|
| Cold cache (first build, or after `docker buildx prune`) | ~5–6 min |
| Warm cache (typical `git pull` deploy) | 3–10 seconds |

The warm-cache speedup comes from `--mount=type=cache` directives in the Dockerfile for `bun install`, `go mod download`, and `go build`. Without BuildKit these would re-download everything on every build (because `git pull` updates file mtimes, invalidating the COPY layer cache).

## Verify

Smoke-test the live server from your Mac:

```bash
# 1. Health
curl -sS https://money.shenthar.me/health

# 2. Login + bearer-protected endpoint
#    Use a real test account you control; do not bake credentials into
#    any committed file. Common options:
#      - read creds from a local 1Password/Bitwarden entry
#      - read from an env var: $EMAIL and $PASSWORD
#      - hit /mcp-connect in a browser and paste the JWT it returns
TOKEN=$(EMAIL="$EMAIL" PASSWORD="$PASSWORD" curl -sS -X POST https://money.shenthar.me/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["token"])')
curl -sS https://money.shenthar.me/api/v1/auth/me -H "Authorization: Bearer $TOKEN"

# 3. MCP transports (init both)
SID=$(curl -sS -D - -o /dev/null -X POST https://money.shenthar.me/api/v1/mcp/stream \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","clientInfo":{"name":"verify","version":"1.0.0"},"capabilities":{}}}' \
  | grep -i '^mcp-session-id' | awk '{print $2}' | tr -d '\r\n')
curl -sS -X POST https://money.shenthar.me/api/v1/mcp/stream \
  -H "Authorization: Bearer $TOKEN" -H "Mcp-Session-Id: $SID" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | python3 -c 'import json,sys;d=json.load(sys.stdin);r=json.loads(d["result"]);print(f"tools: {len(r[\"tools\"])}")'
```

## Common operations

| Task | Command |
|---|---|
| Tail app logs | `ssh personal "docker logs --tail 100 -f ledgerify-app-1"` |
| Tail postgres logs | `ssh personal "docker logs --tail 100 -f ledgerify-postgres-1"` |
| Restart app only (no rebuild) | `ssh personal "cd /opt/ledgerify && docker compose -f docker-compose.prod.yml restart app"` |
| Stop everything | `ssh personal "cd /opt/ledgerify && docker compose -f docker-compose.prod.yml down"` |
| Start everything | `ssh personal "cd /opt/ledgerify && docker compose -f docker-compose.prod.yml up -d"` |
| Open psql | `ssh personal "docker exec -it ledgerify-postgres-1 psql -U ledgerify -d ledgerify"` |
| Open shell in app | `ssh personal "docker exec -it ledgerify-app-1 sh"` |
| Check image size / age | `ssh personal "docker images ghcr.io/kts-o7/ledgerify-web --format '{{.Tag}} {{.Size}} {{.CreatedSince}}'"` |

### Rolling back

The image is built locally — there is no image history. To roll back:

```bash
# 1. Pin main to the previous commit
ssh personal "cd /opt/ledgerify/src && git fetch origin && git reset --hard <previous-commit-sha>"

# 2. Rebuild + restart
ssh personal "cd /opt/ledgerify/src && docker build -t ghcr.io/kts-o7/ledgerify-web:latest ."
ssh personal "cd /opt/ledgerify && docker compose -f docker-compose.prod.yml up -d"
```

There is **no DB migration rollback path**. Schema changes are forward-only; keep a backup of the DB before any deploy that touches `schema/`.

```bash
ssh personal "docker exec ledgerify-postgres-1 pg_dump -U ledgerify ledgerify | gzip > /tmp/backup-\$(date +%F).sql.gz"
```

## Troubleshooting

### "Connection refused" / 404 on `127.0.0.1:8080` from your Mac
**Not the VPS.** Port 8080 on macOS is taken by Docker Desktop. From your Mac, hit the public URL `https://money.shenthar.me` (or use `ssh personal "curl http://127.0.0.1:8080/..."` to test on the VPS itself).

### Login returns `{"detail":"Not Found"}`
The container is mid-restart. Wait 2–3s and retry. The `/health` endpoint should respond immediately after `connected to database` appears in `docker logs`.

### MCP streamHTTP returns `404 Invalid session ID` on `tools/list`/`tools/call`
You forgot to send the `Mcp-Session-Id` header. The `initialize` call returns it in the response headers; include it on every subsequent call. `mcp-go` and Anthropic's official MCP SDKs handle this automatically.

### JWT_TTL env var has no effect
Make sure `docker-compose.prod.yml` has `JWT_TTL: ${JWT_TTL:-168h}` in the app service's `environment:` block. Without that line, compose never passes the var to the container even if it's in `.env`. (Regressed once; commit `917689d` fixed it.)

### SSE messages get buffered, client never gets responses
Cloudflare / nginx needs `proxy_buffering off` on the SSE route. The `/api/v1/mcp/stream` (streamHTTP) transport doesn't have this problem — use that if you control the client.

### Image is 19 days stale
That's because nothing pushed to the registry. The image is built on the VPS from the local git checkout. The tag `ghcr.io/...:latest` is just a label, not a pull from the registry.

### Postgres password is wrong / won't connect
Recreate with the password in `.env`:

```bash
ssh personal "cd /opt/ledgerify && docker compose -f docker-compose.prod.yml down"
ssh personal "docker volume rm ledgerify_pg_data"   # ⚠️ destroys DB
ssh personal "cd /opt/ledgerify && docker compose -f docker-compose.prod.yml up -d"
ssh personal "docker exec -i ledgerify-postgres-1 psql -U ledgerify -d ledgerify < /opt/ledgerify/src/schema/001_schema.sql"
```

Then re-seed any test data. **This is destructive** — only do it if the password is unrecoverable from `.env`.

## Gotchas (lessons learned the hard way)

- **No CI on main.** Don't expect a push to `main` to trigger a deploy. You have to `ssh personal` and run the deploy commands.
- **No auto image GC.** The local image registry on the VPS grows forever. Periodically `docker image prune -f` to reclaim space.
- **JWT_SECRET must be the same across deploys** or all existing tokens invalidate. Don't rotate it without warning.
- **The MCP transport is dual.** `/api/v1/mcp/sse` (legacy, for Claude Desktop) and `/api/v1/mcp/stream` (modern, Anthropic spec 2025-03-26). Both share the same auth, the same 55 tools. Prefer `stream` for new clients.
- **AGENTS.md is stale.** It still references `web/templates/` and `web/static/css/custom.css` from the old HTMX/Pico stack. SolidJS replaced that in PR #46. Treat the file as guidance, not gospel.
- **Don't mix `docker-compose.yml` and `docker-compose.prod.yml`.** The former has a hardcoded password and is for local dev. Always use the `.prod.yml` on the VPS.
