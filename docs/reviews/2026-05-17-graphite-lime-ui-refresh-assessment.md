# Graphite Lime UI Refresh Assessment

**Date:** 2026-05-17
**Branch assessed:** `feat/graphite-lime-ui-refresh`
**Verdict:** Not ready. This is a broad token/template pass, not a finished "stellar but ultra-light" UI refresh. It compiles, but there are avoidable regressions and signs of careless mechanical work.

## Verification Run

- `go test ./...` passed.
- `go build ./cmd/server` passed after running with escalated permissions because the first sandboxed run hit a Go module cache write denial.
- `git diff --check main...HEAD` failed.
- Current working tree has an untracked generated `server` binary.

## Findings

### 1. Destructive icon buttons are accidentally styled as primary submit buttons

**Severity:** High

`web/static/css/custom.css:361-366` globally styles every `button[type="submit"]` as the primary graphite button with `!important`. That includes destructive icon submits:

- `web/templates/pages/transactions.html:125-127`
- `web/templates/pages/settings-categories.html:46-49`

This is sloppy CSS. The implementation claims to make delete actions quieter, but the cascade does the opposite: it turns icon delete submits into primary-looking controls unless later overridden with equal specificity and `!important`.

**Fix:** Stop styling every submit button globally. Use `.btn-primary`, `form .primary-action`, or a scoped selector for normal form actions. Keep `.btn-icon.danger` visually quiet and give it `aria-label`.

### 2. The approved Graphite + Lime direction is undermined by the default dark theme

**Severity:** High

The approved direction was a graphite shell with a light work surface. The app still defaults to dark:

- `internal/templates/pages.go:75-81`

The new dark theme then makes the canvas and cards dark:

- `web/static/css/custom.css:39-50`

Most first-run users will not see the selected design direction. They will see a dark-on-dark app, which is not the "Graphite + Lime Console" mockup that was selected.

**Fix:** Either change the default theme to `light`, or make the graphite/lime shell independent from the user theme while keeping the main workspace light by default. If dark mode is kept, it needs a deliberate separate design pass, not a byproduct of token inversion.

### 3. Sidebar lost vertical overflow handling

**Severity:** Medium-High

The old sidebar had vertical scrolling. The new sidebar is `height: 100vh` with no overflow rule:

- `web/static/css/custom.css:100-109`
- `web/static/css/custom.css:146-151`

There are 12 nav links plus dividers and brand chrome:

- `web/templates/partials/nav.html:15-32`

On short laptop windows, zoomed pages, or OS accessibility font settings, lower nav items can become unreachable. This is a basic shell robustness miss.

**Fix:** Add `overflow-y: auto` to `.sidebar` or `.sidebar-links`, and make sure the logout/settings region remains reachable.

### 4. Mobile responsive order is internally inconsistent

**Severity:** Medium

The dashboard grid media queries are ordered backwards:

- `web/static/css/custom.css:861-863`
- `web/static/css/custom.css:866-870`
- `web/static/css/custom.css:872-875`

The `max-width: 980px` rule appears after the `max-width: 620px` rule, so at widths below 620px the later 980px rule wins and forces two columns again. That is a real mobile layout bug.

**Fix:** Move the `max-width: 980px` block before the `max-width: 620px` block, or combine them into a clear desktop/tablet/mobile sequence.

### 5. Empty color swatches are still invisible

**Severity:** Medium

`settings-categories.html` renders an empty span with only inline background:

- `web/templates/pages/settings-categories.html:42`

There is no `.color-swatch` styling in the new CSS. An empty inline span with a background has no useful box, so the color column can render as effectively invisible.

**Fix:** Add a real `.color-swatch` rule with width, height, display, border, and radius.

### 6. The implementation leaves obvious mechanical debris

**Severity:** Medium

Examples:

- `web/templates/pages/transactions.html:7`
- `web/templates/pages/transactions.html:13`
- `web/templates/pages/transactions.html:20`
- `web/templates/pages/transactions.html:27-30`

These fields have `class=""`. That is not a functional failure, but it is careless template churn and should not ship in a polish branch.

The branch also has an untracked generated `server` binary in the repo root. That is build artifact leakage.

**Fix:** Remove empty class attributes. Delete the generated binary or update the build command to avoid writing it into the repo root, for example `go build -o /tmp/ledgerify-server ./cmd/server`.

### 7. `git diff --check` fails

**Severity:** Medium

Current failures:

- `docs/superpowers/plans/2026-05-17-graphite-lime-ui-refresh.md:1498`
- `docs/superpowers/specs/2026-05-17-graphite-lime-ui-refresh-design.md:160`

Both report extra blank lines at EOF. This is small, but it means the branch cannot pass the stated plan verification.

**Fix:** Remove the extra EOF blank lines and rerun `git diff --check`.

### 8. Accessibility polish is incomplete

**Severity:** Medium

Icon-like destructive buttons rely on visible `x` text and sometimes only `title`:

- `web/templates/pages/transactions.html:127`
- `web/templates/pages/settings-categories.html:49`

Auth forms also use `autofocus`:

- `web/templates/pages/login.html:18`
- `web/templates/pages/register.html:18`

The fetched Web Interface Guidelines flag icon buttons without `aria-label` and recommend sparing `autoFocus`. This implementation did not tighten those basics while touching the exact surfaces.

**Fix:** Add explicit `aria-label` values for destructive icon buttons. Remove `autofocus` unless there is a strong reason to force focus on every auth page load.

### 9. Placeholder and copy cleanup was not handled consistently

**Severity:** Low-Medium

Examples:

- `web/templates/pages/transactions.html:30`
- `web/templates/pages/transactions.html:55`
- `web/templates/pages/transactions.html:84`
- `web/templates/pages/accounts.html:10`
- `web/templates/pages/budgets.html:10`

The branch still uses `...` placeholders after a visual polish pass. This is not catastrophic, but it is shoddy for a branch whose whole point is perceived quality.

**Fix:** Use the ellipsis character where appropriate, or rewrite placeholders as concrete examples.

## What Is Good

- The branch stays lightweight: no new framework, no icon package, no font dependency.
- The app compiles and Go tests pass.
- The broad file coverage matches the requested full visible sweep.
- The visual direction is present in the token system and shell.

## Handoff Recommendation

Send this back for cleanup before any PR. The agent should not add more visual ideas yet. First fix the cascade bug, mobile breakpoint bug, default theme mismatch, sidebar overflow, swatch styling, generated binary, whitespace failure, and empty template attributes. Then run:

```bash
go test ./...
go build -o /tmp/ledgerify-server ./cmd/server
git diff --check
git status --short
```

After that, inspect dashboard, transactions, settings categories, login/register, and mobile widths below 620px.

