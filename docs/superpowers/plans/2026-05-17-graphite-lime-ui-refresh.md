# Graphite Lime UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework Ledgerify's Go-rendered UI into a polished graphite/lime finance console while preserving the lightweight Go + HTMX + Pico architecture.

**Architecture:** Keep rendering in existing Go templates and concentrate the visual system in `web/static/css/custom.css`. Update shared shell and page templates to use consistent classes, semantic HTML, dense financial tables, compact cards, and responsive navigation without adding dependencies.

**Tech Stack:** Go, html/template, chi, HTMX, Alpine.js, Pico.css, Chart.js, hand-authored CSS.

---

## File Structure

- Modify `web/static/css/custom.css`: define the graphite/lime token system and all shared UI primitives, including shell, navigation, buttons, cards, forms, tables, badges, chart shells, auth, settings, report tiles, empty states, and responsive behavior.
- Modify `web/templates/base.html`: refine global shell, page header, theme button, flash placement, and body hooks without changing script dependencies.
- Modify `web/templates/partials/nav.html`: replace emoji-heavy sidebar with compact graphite navigation using lightweight labels and CSS-friendly markers.
- Modify `web/templates/pages/dashboard.html`: apply KPI cards, dark emphasis card, dense recent rows, budget cards, and shared chart shell.
- Modify `web/templates/pages/transactions.html`: apply toolbar filters, disclosure form panel, dense transaction table, chips, muted delete action, and shared empty state.
- Modify `web/templates/pages/accounts.html`, `budgets.html`, `investments.html`, `loans.html`, `insurance.html`: apply shared add panels, table/list styling, chips, and empty states.
- Modify `web/templates/pages/reports-index.html` and report chart pages: apply tile grid and chart shell consistency.
- Modify `web/templates/pages/settings.html`, `settings-categories.html`, `import.html`, `export.html`, `login.html`, `register.html`, `placeholder.html`: align secondary surfaces with the shared system.
- Optional modify `internal/templates/funcs.go`: only if template class helper duplication becomes harmful. Do not add helpers unless they directly reduce repeated brittle template logic.

## Task 1: Create Branch and Baseline Verification

**Files:**
- No source edits.

- [ ] **Step 1: Create the feature branch**

Run:

```bash
git checkout -b feat/graphite-lime-ui-refresh
```

Expected: Git switches to `feat/graphite-lime-ui-refresh`.

- [ ] **Step 2: Confirm working tree scope**

Run:

```bash
git status --short --branch
```

Expected: branch is `feat/graphite-lime-ui-refresh`; planned docs and `.superpowers/` mockup files may be present if created during planning.

- [ ] **Step 3: Run baseline tests**

Run:

```bash
go test ./...
```

Expected: either all packages pass, or any pre-existing failure is recorded before UI edits. Do not modify UI until the baseline result is understood.

## Task 2: Replace CSS Foundation

**Files:**
- Modify: `web/static/css/custom.css`

- [ ] **Step 1: Replace top-level tokens**

In `web/static/css/custom.css`, replace the current root token block with:

```css
:root {
    --sidebar-width: 76px;
    --sidebar-expanded-width: 232px;
    --header-height: 64px;
    --radius: 8px;
    --radius-sm: 6px;
    --canvas: #f7f8f5;
    --surface: #ffffff;
    --surface-muted: #eef3ec;
    --graphite: #17241e;
    --graphite-2: #22322a;
    --graphite-3: #30443a;
    --lime: #d7ff67;
    --lime-strong: #bff03f;
    --line: #dfe5dc;
    --line-strong: #cbd6ca;
    --text: #111814;
    --text-muted: #66736a;
    --positive: #16835a;
    --negative: #bd3e3e;
    --warning: #b7791f;
    --info: #2563eb;
    --shadow-soft: 0 10px 30px rgba(23, 36, 30, .08);
    --pico-font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --pico-border-radius: var(--radius);
    --pico-primary: var(--graphite);
    --pico-primary-background: var(--graphite);
    --pico-primary-border: var(--graphite);
    --pico-primary-hover-background: var(--graphite-2);
    --pico-primary-hover-border: var(--graphite-2);
}

[data-theme="dark"] {
    --canvas: #0f1713;
    --surface: #16211c;
    --surface-muted: #1f2d26;
    --line: #2d4036;
    --line-strong: #40574b;
    --text: #edf5ee;
    --text-muted: #aebcb2;
    --pico-background-color: var(--canvas);
    --pico-color: var(--text);
    --pico-card-background-color: var(--surface);
    --pico-card-border-color: var(--line);
}

[data-theme="light"] {
    --pico-background-color: var(--canvas);
    --pico-color: var(--text);
    --pico-card-background-color: var(--surface);
    --pico-card-border-color: var(--line);
}
```

- [ ] **Step 2: Add global element polish**

Add after tokens:

```css
* {
    box-sizing: border-box;
}

html {
    background: var(--canvas);
}

body {
    min-height: 100vh;
    background: var(--canvas);
    color: var(--text);
    font-size: 15px;
}

a {
    color: inherit;
}

button,
input,
select,
textarea {
    font: inherit;
}

:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--lime) 70%, transparent);
    outline-offset: 2px;
}
```

- [ ] **Step 3: Commit CSS token foundation**

Run:

```bash
git add web/static/css/custom.css
git commit -m "style: add graphite lime ui tokens"
```

Expected: commit succeeds.

## Task 3: Rebuild Shell and Navigation

**Files:**
- Modify: `web/templates/base.html`
- Modify: `web/templates/partials/nav.html`
- Modify: `web/static/css/custom.css`

- [ ] **Step 1: Update base shell classes**

In `web/templates/base.html`, keep the external CSS and script includes unchanged. Replace the body shell with this structure:

```html
<body hx-boost="true">
    <div class="app-layout">
        {{template "nav.html" .}}
        <main class="main-content">
            <header class="page-header">
                <div>
                    <p class="page-kicker">Ledgerify</p>
                    <h1>{{.Title}}</h1>
                </div>
                <div class="header-actions">
                    <button class="theme-toggle"
                            aria-label="Toggle theme"
                            @click="document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; $dispatch('theme-changed')">
                        <span x-show="document.documentElement.dataset.theme === 'dark'">Light</span>
                        <span x-show="document.documentElement.dataset.theme === 'light'" x-cloak>Dark</span>
                    </button>
                </div>
            </header>

            {{if .Flashes}}
            <div class="flashes">
                {{range .Flashes}}
                <article class="flash flash-{{.Type}}">{{.Message}}</article>
                {{end}}
            </div>
            {{end}}

            <section class="page-content">
                {{template "content" .}}
            </section>
        </main>
    </div>
```

Leave the existing Alpine theme persistence script in place.

- [ ] **Step 2: Replace navigation markup**

In `web/templates/partials/nav.html`, use:

```html
{{define "nav.html"}}
<nav class="sidebar" x-data="{ mobileOpen: false }" aria-label="Primary">
    <div class="sidebar-top">
        <a href="/dashboard" class="brand-link" aria-label="Ledgerify dashboard">
            <span class="brand-mark">L</span>
            <span class="brand-name">Ledgerify</span>
        </a>
        <button class="mobile-toggle" @click="mobileOpen = !mobileOpen" aria-label="Toggle menu">
            <span x-show="!mobileOpen">Menu</span>
            <span x-show="mobileOpen">Close</span>
        </button>
    </div>

    <div class="sidebar-links" x-bind:class="mobileOpen ? 'open' : ''">
        <a href="/dashboard" class="nav-link{{if eqStr .CurrentPath "/dashboard"}} active{{end}}"><span class="nav-key">D</span><span>Dashboard</span></a>
        <a href="/transactions" class="nav-link{{if hasPrefix .CurrentPath "/transactions"}} active{{end}}"><span class="nav-key">T</span><span>Transactions</span></a>
        <a href="/accounts" class="nav-link{{if hasPrefix .CurrentPath "/accounts"}} active{{end}}"><span class="nav-key">A</span><span>Accounts</span></a>
        <a href="/budgets" class="nav-link{{if hasPrefix .CurrentPath "/budgets"}} active{{end}}"><span class="nav-key">B</span><span>Budgets</span></a>
        <a href="/investments" class="nav-link{{if hasPrefix .CurrentPath "/investments"}} active{{end}}"><span class="nav-key">I</span><span>Investments</span></a>
        <a href="/loans" class="nav-link{{if hasPrefix .CurrentPath "/loans"}} active{{end}}"><span class="nav-key">L</span><span>Loans</span></a>
        <a href="/insurance" class="nav-link{{if hasPrefix .CurrentPath "/insurance"}} active{{end}}"><span class="nav-key">P</span><span>Insurance</span></a>
        <a href="/networth" class="nav-link{{if hasPrefix .CurrentPath "/networth"}} active{{end}}"><span class="nav-key">N</span><span>Net Worth</span></a>

        <hr class="nav-divider">

        <a href="/reports" class="nav-link{{if hasPrefix .CurrentPath "/reports"}} active{{end}}"><span class="nav-key">R</span><span>Reports</span></a>
        <a href="/import" class="nav-link{{if hasPrefix .CurrentPath "/import"}} active{{end}}"><span class="nav-key">M</span><span>Import</span></a>

        <hr class="nav-divider">

        <a href="/settings" class="nav-link{{if hasPrefix .CurrentPath "/settings"}} active{{end}}"><span class="nav-key">S</span><span>Settings</span></a>
        <a href="/logout" class="nav-link nav-logout"><span class="nav-key">Q</span><span>Logout</span></a>
    </div>
</nav>
{{end}}
```

- [ ] **Step 3: Add shell/navigation CSS**

Replace the existing layout/sidebar/main/header CSS sections with:

```css
.app-layout {
    display: grid;
    grid-template-columns: var(--sidebar-expanded-width) minmax(0, 1fr);
    min-height: 100vh;
}

.sidebar {
    position: sticky;
    top: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--graphite);
    color: #edf5ee;
    border-right: 1px solid rgba(215, 255, 103, .12);
    z-index: 100;
}

.sidebar-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: .75rem;
    padding: 1rem;
}

.brand-link {
    display: flex;
    align-items: center;
    gap: .75rem;
    color: inherit !important;
    text-decoration: none !important;
    min-width: 0;
}

.brand-mark {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    border-radius: var(--radius);
    background: var(--lime);
    color: var(--graphite);
    font-weight: 850;
}

.brand-name {
    font-weight: 780;
    letter-spacing: 0;
}

.sidebar-links {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: .25rem;
    padding: .25rem .75rem 1rem;
}

.nav-link {
    display: flex;
    align-items: center;
    gap: .75rem;
    min-height: 40px;
    padding: .45rem .55rem;
    border-radius: var(--radius);
    color: #b8c8bd !important;
    text-decoration: none !important;
    font-size: .9rem;
    font-weight: 620;
}

.nav-link:hover {
    background: rgba(255, 255, 255, .06);
    color: #fff !important;
}

.nav-link.active {
    background: var(--lime);
    color: var(--graphite) !important;
}

.nav-key {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, .08);
    font-size: .75rem;
    font-weight: 800;
}

.nav-link.active .nav-key {
    background: rgba(23, 36, 30, .12);
}

.nav-divider {
    margin: .6rem .35rem;
    border-color: rgba(255, 255, 255, .1);
}

.nav-logout {
    margin-top: auto;
}

.mobile-toggle {
    display: none;
    border: 1px solid rgba(255, 255, 255, .16);
    background: rgba(255, 255, 255, .08);
    color: #edf5ee;
    border-radius: var(--radius);
    padding: .45rem .65rem;
}

.main-content {
    min-width: 0;
    padding: 1.5rem clamp(1rem, 2vw, 2rem) 2.5rem;
}

.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.25rem;
}

.page-kicker {
    margin: 0 0 .2rem;
    color: var(--text-muted);
    font-size: .76rem;
    font-weight: 760;
    letter-spacing: .08em;
    text-transform: uppercase;
}

.page-header h1 {
    margin: 0;
    color: var(--text);
    font-size: clamp(1.55rem, 3vw, 2.25rem);
    line-height: 1.05;
}

.page-content {
    max-width: 1240px;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: .5rem;
}

.theme-toggle {
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--text);
    border-radius: var(--radius);
    padding: .45rem .7rem;
    font-size: .85rem;
    font-weight: 700;
}
```

- [ ] **Step 4: Commit shell changes**

Run:

```bash
git add web/templates/base.html web/templates/partials/nav.html web/static/css/custom.css
git commit -m "style: refresh app shell navigation"
```

Expected: commit succeeds.

## Task 4: Add Shared Components CSS

**Files:**
- Modify: `web/static/css/custom.css`

- [ ] **Step 1: Add card, metric, button, form, badge, table, and empty state styles**

Add these sections after the shell CSS:

```css
.card-grid,
.metric-grid,
.tile-grid,
.report-grid,
.settings-grid,
.export-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: .9rem;
    margin-bottom: 1.25rem;
}

.dashboard-card,
.metric-card,
.panel,
.report-card,
.settings-card,
.export-card,
.auth-card,
.chart-container,
.table-wrapper,
.add-section,
.filters-bar,
.import-box,
.coming-soon {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
}

.dashboard-card,
.metric-card,
.panel,
.report-card,
.settings-card,
.export-card,
.auth-card,
.chart-container,
.table-wrapper,
.add-section,
.filters-bar,
.import-box,
.coming-soon {
    padding: 1rem;
}

.metric-card.dark,
.dashboard-card.dark {
    background: var(--graphite);
    border-color: var(--graphite);
    color: #edf5ee;
}

.card-label,
.metric-label,
.muted {
    color: var(--text-muted);
    font-size: .78rem;
}

.card-label,
.metric-label {
    margin-bottom: .35rem;
    font-weight: 780;
    letter-spacing: .06em;
    text-transform: uppercase;
}

.card-value,
.metric-value {
    color: inherit;
    font-size: clamp(1.45rem, 3vw, 2rem);
    font-weight: 820;
    line-height: 1.1;
}

.card-sub,
.metric-sub {
    margin-top: .3rem;
    color: var(--text-muted);
    font-size: .84rem;
}

.dark .card-sub,
.dark .metric-sub,
.dark .card-label,
.dark .metric-label {
    color: #b8c8bd;
}

.btn,
a[role="button"],
button,
input[type="submit"] {
    border-radius: var(--radius);
    font-weight: 730;
}

.btn-primary,
button[type="submit"],
summary.btn-primary {
    border-color: var(--graphite) !important;
    background: var(--graphite) !important;
    color: #fff !important;
}

.btn-primary:hover,
button[type="submit"]:hover,
summary.btn-primary:hover {
    border-color: var(--graphite-2) !important;
    background: var(--graphite-2) !important;
}

.btn-outline,
a.outline {
    border: 1px solid var(--line-strong) !important;
    background: var(--surface) !important;
    color: var(--text) !important;
}

.btn-sm {
    padding: .45rem .65rem;
    font-size: .84rem;
}

.btn-icon {
    width: 30px;
    height: 30px;
    display: inline-grid;
    place-items: center;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--text-muted);
    border-radius: var(--radius-sm);
    padding: 0;
}

.btn-icon.danger:hover {
    border-color: rgba(189, 62, 62, .3);
    background: rgba(189, 62, 62, .08);
    color: var(--negative);
}

.form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: .85rem;
}

.form-full {
    grid-column: 1 / -1;
}

.inline-form,
.txn-form,
.import-form {
    display: grid;
    gap: .9rem;
}

label {
    color: var(--text-muted);
    font-size: .82rem;
    font-weight: 700;
}

input,
select,
textarea {
    border-color: var(--line-strong) !important;
    background-color: var(--surface) !important;
    color: var(--text) !important;
}

details.add-section,
.add-txn-section details {
    margin-bottom: 1rem;
}

details > summary {
    cursor: pointer;
    list-style: none;
}

details > summary::-webkit-details-marker {
    display: none;
}

.badge {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: .18rem .55rem;
    background: var(--surface-muted);
    color: var(--text);
    font-size: .76rem;
    font-weight: 760;
    white-space: nowrap;
}

.category-badge {
    border-color: color-mix(in srgb, var(--cat-color, var(--line)) 35%, var(--line));
    background: color-mix(in srgb, var(--cat-color, var(--surface-muted)) 14%, var(--surface));
}

.type-badge,
.period-badge {
    background: #eef6e7;
    border-color: #d8e8ca;
    color: #365225;
}

.amount-positive,
.positive {
    color: var(--positive) !important;
}

.amount-negative,
.negative {
    color: var(--negative) !important;
}

.amount-zero,
.no-data {
    color: var(--text-muted) !important;
}

.table-wrapper {
    overflow-x: auto;
    padding: 0;
}

.txn-table,
.data-table,
.table-striped {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
}

.txn-table th,
.data-table th,
.table-striped th {
    padding: .72rem .85rem;
    border-bottom: 1px solid var(--line);
    color: var(--text-muted);
    font-size: .72rem;
    font-weight: 820;
    letter-spacing: .06em;
    text-align: left;
    text-transform: uppercase;
}

.txn-table td,
.data-table td,
.table-striped td {
    padding: .78rem .85rem;
    border-bottom: 1px solid var(--line);
    color: var(--text);
    font-size: .9rem;
    vertical-align: middle;
}

.txn-table tr:last-child td,
.data-table tr:last-child td,
.table-striped tr:last-child td {
    border-bottom: 0;
}

.txn-row:hover,
.data-table tbody tr:hover,
.table-striped tbody tr:hover {
    background: color-mix(in srgb, var(--lime) 8%, transparent);
}

.amount-col,
.action-col,
.txn-amount {
    text-align: right;
    white-space: nowrap;
}

.empty-state {
    display: grid;
    place-items: center;
    gap: .55rem;
    min-height: 180px;
    padding: 2rem 1rem;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--surface) 72%, var(--canvas));
    color: var(--text-muted);
    text-align: center;
}

.empty-state .empty-icon {
    font-size: 1.6rem;
}

.section-title {
    margin: 1.5rem 0 .75rem;
    color: var(--text);
    font-size: 1rem;
    font-weight: 820;
}
```

- [ ] **Step 2: Add responsive CSS**

Add near the end of the file:

```css
@media (max-width: 860px) {
    .app-layout {
        display: block;
    }

    .sidebar {
        position: sticky;
        height: auto;
        min-height: 0;
        border-right: 0;
        border-bottom: 1px solid rgba(215, 255, 103, .12);
    }

    .sidebar-top {
        padding: .75rem 1rem;
    }

    .mobile-toggle {
        display: inline-flex;
    }

    .sidebar-links {
        display: none;
        padding: 0 1rem 1rem;
    }

    .sidebar-links.open {
        display: flex;
    }

    .nav-logout {
        margin-top: 0;
    }

    .main-content {
        padding: 1rem;
    }

    .page-header {
        align-items: flex-start;
    }

    .card-grid,
    .metric-grid,
    .tile-grid,
    .report-grid,
    .settings-grid,
    .export-options,
    .two-col {
        grid-template-columns: 1fr;
    }
}
```

- [ ] **Step 3: Run CSS selector scan**

Run:

```bash
rg -n "emoji|brand-icon|nav-icon|card-radius|brand-bg|modal-overlay|filters-bar|report-card|settings-card|auth-card" web/static/css/custom.css web/templates
```

Expected: old token names such as `brand-bg`, `brand-icon`, `nav-icon`, and `card-radius` are removed or intentionally unused. Active classes from templates exist in CSS.

- [ ] **Step 4: Commit shared primitives**

Run:

```bash
git add web/static/css/custom.css
git commit -m "style: add shared graphite lime primitives"
```

Expected: commit succeeds.

## Task 5: Refresh Dashboard

**Files:**
- Modify: `web/templates/pages/dashboard.html`
- Modify: `web/static/css/custom.css`

- [ ] **Step 1: Replace summary card markup**

Replace the dashboard summary card section with:

```html
<div class="metric-grid dashboard-metrics">
    <div class="metric-card">
        <div class="metric-label">Income</div>
        <div class="metric-value positive">{{formatCurrency .Data.TotalIncome .Data.Currency}}</div>
        <div class="metric-sub">This month</div>
    </div>
    <div class="metric-card">
        <div class="metric-label">Spend</div>
        <div class="metric-value negative">{{formatCurrency .Data.TotalExpenses .Data.Currency}}</div>
        <div class="metric-sub">This month</div>
    </div>
    <div class="metric-card dark">
        <div class="metric-label">Net</div>
        <div class="metric-value {{amountClass .Data.NetAmount}}">{{formatAmount .Data.NetAmount .Data.Currency}}</div>
        <div class="metric-sub">Income minus spend</div>
    </div>
    <div class="metric-card">
        <div class="metric-label">Balance</div>
        <div class="metric-value">{{formatCurrency .Data.TotalBalance .Data.Currency}}</div>
        <div class="metric-sub">{{.Data.AccountCount}} accounts</div>
    </div>
</div>
```

- [ ] **Step 2: Replace recent transactions table with dense rows**

Use this recent section:

```html
<div class="section-row">
    <h2 class="section-title">Recent Transactions</h2>
    <a href="/transactions" class="subtle-link">View all</a>
</div>
{{if .Data.RecentTransactions}}
<div class="table-wrapper">
    <table class="txn-table">
        <thead>
            <tr>
                <th>When</th>
                <th>Transaction</th>
                <th>Category</th>
                <th>Account</th>
                <th class="amount-col">Amount</th>
            </tr>
        </thead>
        <tbody>
        {{range .Data.RecentTransactions}}
            <tr class="txn-row">
                <td class="txn-date">{{.DateFormatted}}</td>
                <td><strong>{{.Title}}</strong></td>
                <td>{{if .CategoryName}}<span class="badge category-badge">{{.CategoryName}}</span>{{else}}<span class="no-data">Uncategorized</span>{{end}}</td>
                <td>{{.AccountName}}</td>
                <td class="txn-amount {{amountClass .Amount}}">{{formatCurrency .Amount $.Data.Currency}}</td>
            </tr>
        {{end}}
        </tbody>
    </table>
</div>
{{else}}
<div class="empty-state">
    <div class="empty-icon">+</div>
    <p>No transactions yet</p>
    <a href="/transactions" role="button" class="outline">Add your first transaction</a>
</div>
{{end}}
```

- [ ] **Step 3: Update budget and chart sections**

Keep existing budget loop and chart script, but change wrappers to shared classes:

```html
{{if .Data.BudgetStatus}}
<h2 class="section-title">Budget Status</h2>
<div class="card-grid budget-grid">
{{range .Data.BudgetStatus}}
    <div class="dashboard-card">
        <div class="card-label">{{.Name}}</div>
        <div class="card-value">{{formatCurrency .Spent $.Data.Currency}} <small>of {{formatCurrency .Amount $.Data.Currency}}</small></div>
        <div class="budget-bar">
            <div class="budget-bar-fill {{ternary (lt .SpentPct 70) "safe" (ternary (lt .SpentPct 90) "warning" "danger")}}"
                 style="width:{{.SpentPct}}%"></div>
        </div>
        <div class="card-sub">{{formatPercent .SpentPct}} spent · {{formatCurrency .Remaining $.Data.Currency}} remaining</div>
    </div>
{{end}}
</div>
{{end}}

<h2 class="section-title">Net Worth Trend</h2>
<div class="chart-container">
    <canvas id="networth-chart" height="200"></canvas>
</div>
```

- [ ] **Step 4: Add dashboard-specific CSS**

Add:

```css
.dashboard-metrics {
    grid-template-columns: repeat(4, minmax(0, 1fr));
}

.section-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 1.35rem;
}

.subtle-link {
    color: var(--text-muted);
    font-size: .85rem;
    font-weight: 760;
    text-decoration: none;
}

.subtle-link:hover {
    color: var(--text);
}

.budget-bar {
    width: 100%;
    height: 9px;
    margin-top: .65rem;
    overflow: hidden;
    border-radius: 999px;
    background: var(--surface-muted);
}

.budget-bar-fill {
    height: 100%;
    border-radius: inherit;
}

.budget-bar-fill.safe {
    background: var(--lime);
}

.budget-bar-fill.warning {
    background: #f2b84b;
}

.budget-bar-fill.danger {
    background: var(--negative);
}

.chart-container canvas {
    width: 100%;
    max-height: 400px;
}

@media (max-width: 980px) {
    .dashboard-metrics {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 620px) {
    .dashboard-metrics {
        grid-template-columns: 1fr;
    }
}
```

- [ ] **Step 5: Commit dashboard refresh**

Run:

```bash
git add web/templates/pages/dashboard.html web/static/css/custom.css
git commit -m "style: refresh dashboard finance console"
```

Expected: commit succeeds.

## Task 6: Refresh Transactions

**Files:**
- Modify: `web/templates/pages/transactions.html`
- Modify: `web/static/css/custom.css`

- [ ] **Step 1: Replace filter form shell**

Keep the same inputs and names, but ensure the filter markup starts with:

```html
<div class="filters-bar">
    <form method="get" action="/transactions" class="filters-form">
        <div class="filter-row">
```

and ends with:

```html
        </div>
        <div class="filter-actions">
            <button type="submit" class="btn btn-primary btn-sm">Filter</button>
            <a href="/transactions" class="btn btn-outline btn-sm">Clear</a>
        </div>
    </form>
</div>
```

- [ ] **Step 2: Keep add form behavior but align class names**

Set the add section wrapper to:

```html
<div class="add-txn-section">
    <details class="add-section">
        <summary class="btn btn-primary">Add Transaction</summary>
```

Leave all form field `name` attributes unchanged.

- [ ] **Step 3: Replace transaction table rows**

Use:

```html
<div class="table-wrapper">
    <table class="txn-table">
        <thead>
            <tr>
                <th>Date</th>
                <th>Transaction</th>
                <th>Category</th>
                <th>Account</th>
                <th class="amount-col">Amount</th>
                <th class="action-col"></th>
            </tr>
        </thead>
        <tbody>
            {{range .Data.Transactions}}
            <tr class="txn-row txn-{{.Type}}">
                <td class="txn-date"><span class="date-display">{{.DateFormatted}}</span></td>
                <td class="txn-title"><strong>{{.Title}}</strong><span class="txn-kind">{{.Type}}</span></td>
                <td>
                    {{if .CategoryName}}
                    <span class="badge category-badge" style="--cat-color: {{defaultStr .CategoryColor "#6b7280"}}">{{.CategoryName}}</span>
                    {{else}}
                    <span class="no-data">Uncategorized</span>
                    {{end}}
                </td>
                <td>{{.AccountName}}</td>
                <td class="txn-amount {{if eq .Type "income"}}positive{{else}}negative{{end}}">
                    {{if eq .Type "income"}}+{{else}}-{{end}}{{.Currency}} {{printf "%.2f" .Amount}}
                </td>
                <td class="action-col">
                    <form method="post" action="/transactions/delete" onsubmit="return confirm('Delete this transaction?')" style="display:inline">
                        <input type="hidden" name="id" value="{{.ID}}">
                        <button type="submit" class="btn-icon danger" title="Delete">x</button>
                    </form>
                </td>
            </tr>
            {{end}}
        </tbody>
    </table>
</div>
```

- [ ] **Step 4: Add transaction CSS**

Add:

```css
.filters-form {
    display: grid;
    gap: .75rem;
}

.filter-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: .65rem;
    align-items: end;
}

.filter-actions {
    display: flex;
    gap: .5rem;
    justify-content: flex-end;
}

.txn-title {
    min-width: 180px;
}

.txn-kind {
    display: block;
    margin-top: .12rem;
    color: var(--text-muted);
    font-size: .76rem;
    text-transform: capitalize;
}

.txn-date {
    color: var(--text-muted);
    white-space: nowrap;
}

.pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 1rem;
}

.txn-count {
    color: var(--text-muted);
    font-size: .85rem;
}
```

- [ ] **Step 5: Commit transactions refresh**

Run:

```bash
git add web/templates/pages/transactions.html web/static/css/custom.css
git commit -m "style: refresh transaction workspace"
```

Expected: commit succeeds.

## Task 7: Refresh Core List Pages

**Files:**
- Modify: `web/templates/pages/accounts.html`
- Modify: `web/templates/pages/budgets.html`
- Modify: `web/templates/pages/investments.html`
- Modify: `web/templates/pages/loans.html`
- Modify: `web/templates/pages/insurance.html`

- [ ] **Step 1: Remove duplicate page `<h2>` headings**

For each listed page, remove the first redundant heading such as:

```html
<h2>Accounts</h2>
```

The shared `page-header` already provides the title.

- [ ] **Step 2: Standardize add disclosure labels**

Use plain labels without emoji:

```html
<summary class="btn btn-primary">Add Account</summary>
<summary class="btn btn-primary">Add Budget</summary>
<summary class="btn btn-primary">Add Investment</summary>
<summary class="btn btn-primary">Add Loan</summary>
<summary class="btn btn-primary">Add Policy</summary>
```

- [ ] **Step 3: Ensure table wrappers use `table-wrapper` and tables use `data-table`**

For each page, keep existing columns and values, but ensure the table pattern is:

```html
<div class="table-wrapper">
    <table class="data-table">
```

Do not change form field names or route actions.

- [ ] **Step 4: Normalize empty states**

Use this pattern with page-specific text:

```html
<div class="empty-state">
    <p>No accounts yet. Add your first account above.</p>
</div>
```

Apply matching copy for budgets, investments, loans, and insurance.

- [ ] **Step 5: Commit core list pages**

Run:

```bash
git add web/templates/pages/accounts.html web/templates/pages/budgets.html web/templates/pages/investments.html web/templates/pages/loans.html web/templates/pages/insurance.html
git commit -m "style: align core finance list pages"
```

Expected: commit succeeds.

## Task 8: Refresh Reports, Settings, Import, Export, Auth, and Placeholders

**Files:**
- Modify: `web/templates/pages/reports-index.html`
- Modify: `web/templates/pages/reports-cashflow.html`
- Modify: `web/templates/pages/reports-category.html`
- Modify: `web/templates/pages/reports-budget.html`
- Modify: `web/templates/pages/reports-networth.html`
- Modify: `web/templates/pages/reports-investments.html`
- Modify: `web/templates/pages/reports-debt.html`
- Modify: `web/templates/pages/settings.html`
- Modify: `web/templates/pages/settings-categories.html`
- Modify: `web/templates/pages/import.html`
- Modify: `web/templates/pages/export.html`
- Modify: `web/templates/pages/login.html`
- Modify: `web/templates/pages/register.html`
- Modify: `web/templates/pages/placeholder.html`
- Modify: `web/static/css/custom.css`

- [ ] **Step 1: Remove duplicate page headings on report and settings index pages**

Remove redundant top-level `<h2>` from pages that already receive `{{.Title}}` in the shared page header.

- [ ] **Step 2: Keep report index links but rely on shared tile CSS**

Ensure `reports-index.html` remains a `report-grid` containing `a.report-card` entries with `h3`, `p`, and `span.report-arrow`.

- [ ] **Step 3: Standardize chart page containers**

For report chart pages, remove inline `style="max-width: ...; margin: ..."` from `.chart-container`. Keep the `canvas` IDs and existing scripts unchanged.

- [ ] **Step 4: Align auth pages**

Keep login/register form fields unchanged. Ensure both pages use:

```html
<div class="auth-page">
    <div class="auth-card">
```

and keep `auth-subtitle` plus `auth-footer` for shared styling.

- [ ] **Step 5: Add secondary page CSS**

Add:

```css
.report-card,
.settings-card,
.export-card {
    position: relative;
    display: block;
    min-height: 132px;
    color: var(--text) !important;
    text-decoration: none !important;
}

.report-card:hover,
.settings-card:hover,
.export-card:hover {
    border-color: var(--line-strong);
    box-shadow: var(--shadow-soft);
    transform: translateY(-1px);
}

.report-card h3,
.settings-card h3,
.export-card h3 {
    margin: 0 0 .45rem;
    font-size: 1rem;
}

.report-card p,
.settings-card p,
.export-card p,
.auth-subtitle,
.auth-footer {
    color: var(--text-muted);
    font-size: .88rem;
}

.report-arrow,
.settings-arrow,
.export-arrow {
    position: absolute;
    right: 1rem;
    bottom: 1rem;
    color: var(--graphite);
    font-weight: 850;
}

.auth-page {
    display: grid;
    place-items: center;
    min-height: calc(100vh - 4rem);
}

.auth-card {
    width: min(100%, 420px);
    box-shadow: var(--shadow-soft);
}

.auth-card h1 {
    margin-bottom: .25rem;
}

.auth-footer {
    margin-top: 1rem;
    text-align: center;
}

.w-full {
    width: 100%;
}

.import-box {
    display: grid;
    gap: .75rem;
    min-height: 180px;
    place-items: center;
    text-align: center;
}

.file-label {
    display: grid;
    gap: .5rem;
    place-items: center;
}

.file-icon {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: var(--radius);
    background: var(--lime);
    color: var(--graphite);
    font-weight: 850;
}

.back-link {
    display: inline-flex;
    margin-top: 1rem;
    color: var(--text-muted);
    font-size: .86rem;
    font-weight: 760;
    text-decoration: none;
}
```

- [ ] **Step 6: Commit secondary pages**

Run:

```bash
git add web/templates/pages web/static/css/custom.css
git commit -m "style: align reports settings auth pages"
```

Expected: commit succeeds.

## Task 9: Build, Template, and Visual Verification

**Files:**
- Modify only if verification finds issues.

- [ ] **Step 1: Run Go formatting**

Run only if Go files changed:

```bash
gofmt -w internal/templates/funcs.go
```

Expected: no output.

- [ ] **Step 2: Run full Go tests**

Run:

```bash
go test ./...
```

Expected: all packages pass. If failures pre-existed from Task 1, confirm no new failures were introduced by template/CSS work.

- [ ] **Step 3: Build binary**

Run:

```bash
go build ./cmd/server
```

Expected: build exits 0 and produces a `server` binary in the current directory or the Go toolchain default output.

- [ ] **Step 4: Start local server if environment has database access**

Run:

```bash
go run ./cmd/server
```

Expected: app starts on `http://localhost:8080` or configured `PORT`. If it fails because PostgreSQL/env vars are unavailable, record the exact blocker and continue with compile-level verification.

- [ ] **Step 5: Inspect key pages**

In browser, inspect:

```text
/login
/register
/dashboard
/transactions
/accounts
/budgets
/investments
/loans
/insurance
/reports
/reports/cash-flow
/settings
/import
```

Expected: no overlapping text, no broken navigation, no unreadable colors, no huge mobile sidebar when collapsed, and no missing form controls.

- [ ] **Step 6: Check final diff**

Run:

```bash
git diff --stat main...HEAD
git diff --check
```

Expected: changed files match the plan, and `git diff --check` reports no whitespace errors.

- [ ] **Step 7: Final commit if verification fixes were needed**

If Task 9 required fixes, commit them:

```bash
git add web/templates web/static/css/custom.css internal/templates/funcs.go
git commit -m "fix: polish graphite lime ui verification issues"
```

Expected: commit succeeds only if there were verification fixes.

