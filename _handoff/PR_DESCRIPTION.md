# Luxe PWA redesign: dark and light themes, desktop power-user shell, offline and installable

## Summary
This replaces the "Minimalist Bento" lime-on-zinc look with **Luxe**, a warm-ink system with two first-class themes. The dark theme pairs ink with a gold signal color; the light theme is ivory paper with bronze. It also turns the SPA into a real installable PWA.

## Why
- **Color has a job.** The signal hue (gold or bronze) is reserved for net worth, the primary action and focus.
  - Money-in, money-out and warning share one lightness and chroma, so the hue alone carries the meaning.
  - All text passes 4.5:1 contrast in both themes.
- **Desktop is a power-user surface.**
  - The sidebar shows every section in groups. Nothing is hidden behind "More".
  - It has ⌘K, G-prefixed shortcuts and dense tables.
- **Mobile is an app.**
  - Bottom tabs: Home, Activity, quick-add, Insights, Wealth.
  - Forms open as bottom sheets.
  - The app works offline, can be installed, and can receive shared statements as a share target.

## What's in this PR
**Foundation (drop-in)**
- `frontend/src/styles/custom.css` adds dark and light token sets plus a system default.
  - Legacy Tailwind names (`bg`, `surface`, `primary`, `accent`…) are kept and remapped, so existing classes don't break.
  - It adds the motion tokens, the View Transitions rules and the reduced-motion fallbacks.
- `frontend/index.html` adds the manifest, theme-color for each scheme, iOS meta tags and a pre-paint theme script.
- `frontend/public/manifest.webmanifest` defines shortcuts and a CSV share target.
- `frontend/public/sw.js` handles caching and offline writes:
  - Shell and asset caching.
  - Stale-while-revalidate for API GETs.
  - An offline outbox for transaction writes, replayed via Background Sync or the `online` event.
  - The share-target handler.
- `frontend/src/lib/pwa.ts` provides signals for online state, queued writes, install prompt, theme and view transitions.
- `cmd/server/main.go` gets the correct headers for `sw.js` and `.webmanifest`. It also fixes the `.png` Content-Type bug: the type was built from the full path instead of the extension. Finally, it adds a `/import/share` fallback.

**UI (per screen, see handoff README)**
- Shell: new `Sidebar` (grouped, with shortcuts), `CommandPalette` (⌘K), `BottomNav` (5 tabs with a centre add button), `OfflineBanner` and `InstallSheet`.
- Pages: Dashboard, Activity, Accounts, Analytics with Budgets, Net worth, Investments/SIPs/Loans, Login, Import (4-step), Export and MCP connect.
- Primitives: `Money` (mono, tabular, signed tone), `NumberRoll`, `ProgressBar` (turns amber at 90% or more) and `Segmented`. `Sheet` timing is updated.

## Screens
These are design references in the bundle: `Ledgerify Redesign.dc.html` (turns 1 and 2) and `Ledgerify Current.dc.html` (the before state).

## Test plan
- [ ] `cd frontend && bun run build`
- [ ] `go test ./... && go build ./cmd/server`
- [ ] Smoke test at 375px and 1280px in both themes and with the system theme.
- [ ] Lighthouse PWA: installable, the service worker controls the page, and the offline start URL loads.
- [ ] DevTools offline: add a transaction, check it shows as queued, go back online and check it syncs.
- [ ] Android: share a CSV from Files to Ledgerify and check it lands on `/import?shared=1` with the file preloaded.
- [ ] Reduced motion: no transforms; tickers jump to their final value.
- [ ] ⌘K opens the palette, Esc closes it, and G then A goes to Activity.

## Out of scope / follow-ups
- Saved CSV column mappings and "Undo import" need backend endpoints. The UI is designed, but the endpoints are not built yet.
- Push notifications for EMI, renewal and budget alerts need VAPID and server push.
- Icons: `icons/icon-192.png`, `icon-512.png` and `icon-maskable-512.png` need to be exported from the brand mark. They are referenced but not included.
