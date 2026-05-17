# Strict Review: Graphite Lime UI Refresh

**Date:** 2026-05-17
**Branch:** `feat/graphite-lime-ui-refresh`
**Review standard:** Performance and aesthetics are top priority. No regressions tolerated.

## Verdict

**Not ready. Do not merge.**

The branch is in better shape than the prior pass, and the obvious CSS cascade/mobile/sidebar issues were mostly repaired. But it still contains serious process and repo-quality regressions. Most importantly, the implementation **destroyed the design and implementation docs by replacing them with one blank line each**, and it left `AGENTS.md` actively lying about the project being a special Next.js app after deleting the Next.js stack.

This branch cannot be considered clean until those are fixed.

## Verification Performed

- `go test ./...` passed.
- `go build -o /tmp/ledgerify-server ./cmd/server` passed with escalated permissions.
- `git diff --check main...HEAD` passed.
- Web Interface Guidelines were fetched fresh from `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`.
- Confirmed `server` binary is no longer untracked.
- Confirmed tracked Next/React artifacts were deleted.

## Blocking Findings

### 1. The design and implementation docs were gutted

**Severity:** Blocker

Current files:

- `docs/superpowers/specs/2026-05-17-graphite-lime-ui-refresh-design.md`
- `docs/superpowers/plans/2026-05-17-graphite-lime-ui-refresh.md`

Both files are now effectively blank:

```text
1 line each
```

The original committed versions had:

```text
160 lines in the design spec
1498 lines in the implementation plan
```

This happened in commit `0b1f618 fix: graphite lime ui review findings`, which replaced the docs with a single blank line while trying to fix EOF whitespace. That is not cleanup. That is document destruction.

**Why this matters:** These files are the source of truth for the feature direction and handoff. Losing them removes the design rationale, implementation sequence, and verification requirements.

**Required fix:** Restore both files from commit `a9b776d`, then fix only the trailing blank-line issue. Do not rewrite them from memory.

Suggested commands:

```bash
git checkout a9b776d -- docs/superpowers/specs/2026-05-17-graphite-lime-ui-refresh-design.md docs/superpowers/plans/2026-05-17-graphite-lime-ui-refresh.md
```

Then remove only the extra trailing blank line and rerun:

```bash
git diff --check
```

### 2. `AGENTS.md` is now stale and actively harmful

**Severity:** Blocker

`AGENTS.md:1-5` still says:

```text
This is NOT the Next.js you know
Read the relevant guide in node_modules/next/dist/docs/ before writing any code.
```

But this branch deletes:

- `package.json`
- `package-lock.json`
- `bun.lock`
- `src/app/**`
- `src/components/**`
- `src/lib/**`
- `public/**`
- `tsconfig.json`
- `eslint.config.mjs`
- `components.json`
- Drizzle config/migrations

The active app is Go + HTMX + Pico templates. Keeping a Next.js-specific agent instruction after deleting Next.js is a sharp edge for every future agent. It tells them to read docs that will not exist in a clean checkout.

**Required fix:** Replace `AGENTS.md` with Go-app instructions that match the current runtime. At minimum:

```markdown
# Ledgerify Agent Notes

This is a Go + HTMX + Pico.css app. The active UI lives in `web/templates/` and `web/static/css/custom.css`. The server entrypoint is `cmd/server/main.go`.

Do not add or modify old Next.js/React files; that stack has been removed.

Before claiming completion, run:

```bash
go test ./...
go build -o /tmp/ledgerify-server ./cmd/server
git diff --check
```
```

### 3. Global Chart.js loading is incompatible with the “ultra-light” standard

**Severity:** High

`web/templates/base.html:16-17` loads Chart.js globally:

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
```

That means auth, settings, import/export, accounts, budgets, and other non-chart pages pay for Chart.js. This existed before, but the project goal is explicitly “stellar and ultra light”. Leaving a large charting library global is not acceptable for the final shape.

**Required fix:** Move Chart.js loading out of `base.html` and into only the pages that render charts:

- `web/templates/pages/dashboard.html`
- `web/templates/pages/reports-cashflow.html`
- `web/templates/pages/reports-category.html`
- `web/templates/pages/reports-budget.html`
- `web/templates/pages/reports-networth.html`

If dashboard keeps its hand-drawn canvas chart and does not use Chart.js, do not load Chart.js there.

### 4. CDN performance was not tightened

**Severity:** High

`web/templates/base.html:8-17` pulls Pico, HTMX, Alpine, and Chart.js from CDNs with no `preconnect`.

For a deliberately lightweight app, network setup matters. If CDN assets remain, add preconnect hints:

```html
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="preconnect" href="https://unpkg.com">
```

Better still: self-host the tiny assets under `web/static/` if the deployment goal is fast and stable. At minimum, do not load Chart.js globally.

### 5. The cleanup removed Drizzle artifacts without documenting the migration path

**Severity:** Medium-High

The branch deletes all Drizzle files:

- `drizzle.config.ts`
- `drizzle/*.sql`
- `drizzle/meta/*.json`
- `package.json`
- lockfiles

This may be correct because the active Go stack uses:

- `schema/001_schema.sql`
- `queries/001_queries.sql`
- `sqlc.yaml`
- `internal/db/*.go`

But the cleanup commit does not update README or add a note explaining that `schema/001_schema.sql` is now the single migration/bootstrap source. This is a maintainability risk, especially because old docs still discuss Drizzle/Next workflows.

**Required fix:** Update README or add a short docs note stating that Drizzle has been removed and the canonical DB bootstrap path is `schema/001_schema.sql` plus sqlc-generated Go code.

## Important UI/Aesthetic Findings

### 6. The UI still has leftover mechanical polish issues

**Severity:** Medium

Examples:

- `web/templates/pages/transactions.html:55` still says `Select account...`
- `web/templates/pages/transactions.html:84` still says `Transaction title...`
- `web/templates/pages/accounts.html:15` still says `Select type...`
- `web/templates/pages/budgets.html:23` still says `Select period...`

This is small, but it matters in a polish branch. The UI should not mix typographic quality levels.

**Required fix:** Replace obvious `...` placeholders with `…` or concrete examples.

### 7. Inline styles remain in common paths

**Severity:** Medium

Examples:

- `web/templates/pages/settings.html:21`
- `web/templates/pages/settings-categories.html:42`
- `web/templates/pages/settings-categories.html:47`
- `web/templates/pages/dashboard.html:75`
- `web/templates/pages/transactions.html:115`
- `web/templates/pages/transactions.html:125`

Some inline styles are dynamic CSS variables and progress widths, which is acceptable. But `style="margin-top: 3rem;"` and `style="display:inline"` are not. This branch was supposed to centralize the visual system in CSS.

**Required fix:** Move static inline styles to classes. Keep only dynamic style values that genuinely need template data.

### 8. Delete buttons still use a visible lowercase `x`

**Severity:** Medium

Examples:

- `web/templates/pages/transactions.html:127`
- `web/templates/pages/settings-categories.html:49`

They now have `aria-label`, which is good, but the visual treatment still looks cheap. This branch is about aesthetics. A lowercase `x` is not a polished control.

**Required fix:** Use a simple typographic `×` with `aria-hidden="true"`, or use visually hidden text if available:

```html
<button type="submit" class="btn-icon danger" aria-label="Delete transaction"><span aria-hidden="true">&times;</span></button>
```

### 9. The app has no skip link

**Severity:** Medium

The fetched Web Interface Guidelines call out skip links for keyboard users. `web/templates/base.html` has no skip link before navigation.

**Required fix:** Add a visually hidden skip link before the app layout:

```html
<a class="skip-link" href="#main-content">Skip to content</a>
```

and give `<main>` an id:

```html
<main id="main-content" class="main-content">
```

Style `.skip-link` so it appears on focus.

## Confirmed Repairs From Previous Review

These are improved from the previous assessment:

- The broad `button[type="submit"]` primary cascade was removed.
- Default theme now returns light when no cookie is present.
- Sidebar links have `overflow-y: auto`.
- Dashboard mobile breakpoints are now ordered correctly.
- `.color-swatch` exists and gives swatches a real box.
- Empty `class=""` attributes in transactions were removed.
- Delete icon buttons now have `aria-label`.
- `git diff --check` passes.
- Repo-root generated `server` binary is gone.

## Next.js Cleanup Assessment

The file removals are broadly aligned with a Go-only app. The active runtime and deployment files are still present:

- `cmd/server/main.go`
- `internal/**`
- `web/templates/**`
- `web/static/css/custom.css`
- `schema/001_schema.sql`
- `queries/001_queries.sql`
- `sqlc.yaml`
- `Dockerfile`
- `docker-compose*.yml`
- `go.mod`
- `go.sum`

But the cleanup is incomplete because `AGENTS.md` still advertises Next.js and the DB tooling removal is not documented.

## Required Verification After Fixes

Run:

```bash
go test ./...
go build -o /tmp/ledgerify-server ./cmd/server
git diff --check
git status --short
```

Then manually inspect at desktop and sub-620px mobile widths:

- `/login`
- `/register`
- `/dashboard`
- `/transactions`
- `/settings/categories`
- `/reports`
- `/reports/cash-flow`

## Final Bar

Do not accept “it compiles” as enough. This branch is specifically about making a lightweight app feel excellent. The final version should:

- preserve the Go-only cleanup without stale instructions,
- keep the design docs intact,
- avoid global heavyweight JS on pages that do not need it,
- remove careless inline/static styling,
- polish visible controls instead of merely making them functional,
- and pass all verification without generated artifacts or whitespace noise.

