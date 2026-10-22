# Claude Code brief — open the Luxe PWA PR

Run this from the root of `KTS-o7/ledgerify-web`, with this folder unzipped at `./_handoff/`.

```
Read AGENTS.md, then _handoff/README.md and _handoff/PR_DESCRIPTION.md.

1. git checkout -b feat/luxe-pwa
2. Copy drop-in files over the repo:
   _handoff/frontend/src/styles/custom.css   -> frontend/src/styles/custom.css
   _handoff/frontend/index.html              -> frontend/index.html
   _handoff/frontend/public/manifest.webmanifest, sw.js -> frontend/public/
   _handoff/frontend/src/lib/pwa.ts          -> frontend/src/lib/pwa.ts
   _handoff/frontend/src/index.tsx           -> frontend/src/index.tsx
   Apply _handoff/patches/main.go.spaHandler.diff by hand to cmd/server/main.go.
   Merge _handoff/frontend/package.additions.json into frontend/package.json, bun install.
3. Commit "feat(pwa): Luxe tokens, manifest, service worker, offline outbox".
4. Rebuild the UI screen by screen, following _handoff/README.md section "Screens".
   Open _handoff/design/Ledgerify Redesign.dc.html in a browser as the visual reference.
   SolidJS + Tailwind v4 only; no React. Reuse existing pages' data fetching unchanged.
   One commit per area: shell (sidebar, bottom nav, palette, offline/install),
   dashboard, activity, accounts, insights+budgets, wealth, import/export, mcp, login.
5. Run the AGENTS.md checks (bun run build, go test ./..., go build), plus 375px/1280px
   smoke in dark, light, and system theme.
6. Export placeholder PWA icons (192, 512, maskable 512) from favicon.svg into frontend/public/icons/.
7. git push -u origin feat/luxe-pwa
   gh pr create --title "Luxe PWA redesign: dark + light themes, desktop power-user shell, offline & installable" --body-file _handoff/PR_DESCRIPTION.md
```
