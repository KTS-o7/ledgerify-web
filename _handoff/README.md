# Handoff: Ledgerify Luxe PWA redesign

## Overview
This is a full visual and UX redesign of the Ledgerify SolidJS frontend.
- It has 2 themes: Luxe Dark (ink and gold) and Luxe Light (ivory and bronze), plus a system default.
- The desktop shell is built for power users: grouped sidebar, ⌘K palette and keyboard shortcuts.
- The mobile shell is app-like: 5-tab bar with a centre quick-add.
- It is an installable, offline-capable PWA, including a CSV share target.

## About the design files
The files in `design/` are **design references built in HTML**. They show the intended look and behavior; they are not production code. Recreate them in the existing **SolidJS + Tailwind v4 + lucide-solid** frontend, using its existing data fetching (`lib/api.ts`, `createResource`). Do not introduce React. Open `design/Ledgerify Redesign.dc.html` in a browser:
- turn 2 (top) covers motion, Import/Export and MCP;
- turn 1 covers the core screens, with the colour and type panel.

The files under `frontend/`, `patches/` are **production drop-ins** (tokens, manifest, SW, PWA helpers).

## Fidelity
**High-fidelity.** Colors, type, spacing, radii and motion are final. Match them closely.

## Design tokens
All tokens live in `frontend/src/styles/custom.css`. Tailwind names in parentheses.

| Role | Dark | Light |
|---|---|---|
| bg (`bg-bg`) | #0C0B09 | #F4F0E7 |
| sunken / tracks (`bg-sunken`) | #080706 | #EAE4D7 |
| surface / card (`bg-surface`) | #15130F | #FBF9F4 |
| raised / hover / active (`bg-raised`) | #1E1B16 | #FFFFFF |
| line (`border-border`) | rgba(236,224,200,.075) | rgba(50,38,15,.09) |
| line strong (`border-border-strong`) | rgba(236,224,200,.14) | rgba(50,38,15,.16) |
| text | #EEE8DC | #1D1A14 |
| muted | #A39B8B | #6A6252 |
| signal (`text-signal`, legacy `primary`) | #D9B97C | #8C6A2C |
| signal soft | rgba(217,185,124,.12) | rgba(140,106,44,.10) |
| button bg / text (`bg-btn text-btn-text`) | #D9B97C / #17120A | #1D1A14 / #F4F0E7 |
| money in (`text-pos`) | #8EC6A2 | #2F7650 |
| money out / debt (`text-neg`, legacy `accent`) | #E39783 | #A84A35 |
| warning ≥90% (`text-warn`) | #E2B463 | #9A6B12 |
| categories 1–6 (`cat-1..6`) | #CDAE78 #D9907E #86BE98 #7EB2C9 #A79CD6 #D08FB0 | #8F7238 #A65C4A #4C8862 #3F7D96 #7468A6 #9A587A |

Color rules:
- The signal color is used only for net worth, the primary CTA (dark theme), focus rings, selected states and links. Never use it as decoration.
- In the light theme the primary button is **ink**, not bronze.
- Expense amounts use `text` (not `neg`). `neg` is for debt, negative balances and overspend.

**Type**
- Instrument Serif 400 is for page titles (desktop 30px, mobile 34px), the wordmark and empty or done states (34–44px).
- Instrument Sans 400/500/600 is for all UI text. Rows are 13.5–15px, labels 12–13px, buttons 600 at 13.5–16px.
- Geist Mono 400/500 is for **every amount, date, shortcut and count**. Always use `font-variant-numeric: tabular-nums` and letter-spacing -0.03 to -0.05em at display sizes.
  - Hero net worth: 46px desktop, 38px mobile.
  - Section eyebrows: Geist Mono 500, 11px, uppercase, 0.1em tracking, muted.

**Radii.** Cards 18, inputs and buttons 10–14, chips 999, phone sheets 28, desktop palette 16.
**Spacing.** Desktop content padding is 20–24px vertical and 28px horizontal, with a 16px grid gap. Mobile uses 20px side padding.
**Shadows.** None on cards; separate them by tone. Overlays use `0 30px 80px rgba(0,0,0,.35)`.

## Motion
The tokens are in CSS (`--duration-*`, `--ease-*`).

| Use | Duration | Easing |
|---|---|---|
| Press | 90ms, scale .96–.97 | standard |
| Hover, chips, tabs | 160ms | standard |
| Page change | 220ms, fade + 8px rise | standard (.2,.7,.2,1) |
| Sheet / drawer | 340ms | sheet (.32,.72,0,1) |
| Charts, number roll | 700–900ms; digit roll staggers 40ms per digit | standard |
| New row glow | expands 260ms, signal-soft background fades over 1.2s | standard |

- Exits run at 70% of the enter duration with ease-in (.4,0,1,1).
- Route changes use `withViewTransition()` from `lib/pwa.ts`.
- Net worth counts up on first mount (quartic ease-out, 1.5s). Add a setTimeout fallback so hidden tabs show the final value.
- Reduced motion: opacity-only transitions at 120ms; tickers render the final value.

## Screens
The numbers match the labels in the design file.

**Desktop shell (01, 12, 13).** 240px sidebar with background `rail`, a 1px right border in `line`, and padding 20/14/14.
- Wordmark: a 28px rounded-8 tile with an italic serif "L", then "Ledgerify" in serif at 24px.
- Search button: 36px tall, reads "Search or jump to…", with a ⌘K keycap. It opens the command palette.
- Nav groups, each headed by a mono eyebrow:
  - Overview: Overview, Activity, Accounts, Analytics.
  - Plan: Budgets, Recurring, Savings goals, Categories & tags.
  - Wealth: Net worth, Investments, SIPs, Loans, Insurance.
  - Tools: Reports, Import / Export, MCP connect.
- Nav items are 30px tall, radius 8, 13.5px/500. The active item has a `raised` background and `text` color; the rest are `muted`. Shortcut hints sit on the right in mono 10.5px `faint`.
- Footer: a sync dot with "Synced · available offline", and an avatar row with a settings icon.
- Header: 68px with a bottom border. It holds the serif title, the month stepper (mono, 32px, bordered), shortcut hints, and the primary button "New transaction" with an `N` keycap.
- Shortcuts: `⌘K` palette, `N` new, `G O/A/C/Y/B/R/N/I` navigate, `J/K` move the row selection, `E` edit, `Esc` close.

**Command palette.**
- Scrim plus 3px blur. The panel is 600px wide, starts 110px from the top, has radius 16 and a `surface` background.
- 56px search input. Grouped results: Actions, Jump to, Accounts. Rows are 40px; the first is highlighted with `raised`.
- Footer hints: ↑↓ / ↵ / ⌘↵ (open in split).
- Filters as you type.

**01 Overview (desktop).** Rows of alert pills: a 30px pill with a dot colored warn or signal. The grid is 7fr/5fr.
- Net worth card:
  - Mono eyebrow.
  - 3M/1Y/ALL segmented control.
  - 46px mono value with a muted ₹.
  - Delta in `pos`.
  - 150px smooth area chart: signal stroke at 1.6px, gradient fill from 22% to 0.
  - 12 month labels.
- Cashflow card: In, Out and Saved % in three columns at 21px mono, then 6 month pair-bars (income in `pos`, expense in `neg`). Past months are at 45% opacity.
- Recent activity table:
  - Columns: date 64px, merchant, category (dot + label), account, amount 120px right-aligned.
  - 44px rows. The selected row uses `signal-soft`; hover uses `raised`.
  - A recurring glyph sits next to the merchant.
- Budgets card: top 4 budgets with 5px bars.
- Accounts card: 42px rows with a currency keycap and a right-aligned mono balance.

**Mobile shell.** 54px status area with safe-area padding.
- Bottom nav is 88px tall, including 26px safe area. Background `nav` with 16px blur and a top border.
- 5 items: Home, Activity, **+** (a 52px `btn` circle that opens the quick-add sheet), Insights, Wealth.
- Labels 10.5px/500; icons 21px.

**02 Sign in.** Aurora background. 52px serif "L" tile, "Ledgerify" in serif at 54px, and a tagline. Inputs are 52px with radius 14; the focused field has a signal border. "Sign in" is the primary button; "Use passkey" is an outline button; then a "Create an account" link.

**03 Home.**
- Serif wordmark, bell, avatar.
- Net worth at 38px mono with a 64px sparkline.
- A 3-up In / Out / Saved strip.
- An alert row with the highest-priority alert and a "+N" count.
- Horizontally scrolling account cards, 136px wide.
- Recent list with 58px rows and 38px category icon tiles; the icon takes the category color.

**04 Activity.**
- Serif title plus count.
- 44px search box with a filter icon.
- Type chips All / Income / Expense / Transfer; the active chip is text-colored on bg.
- Sticky date groups with their net total on the right. Rows are 60px.
- Pull-to-refresh works on this page only.

**05 Quick add sheet.**
- Radius 28, a grabber, and an Expense / Income / Transfer segmented control. The active option's color matches its type.
- 60px mono amount with a signal caret and a currency chip.
- Grouped field card: title with an AI category hint, account, date.
- 3×4 mono keypad, then a full-width "Save expense" button.

**06 Accounts.** Totals per currency (INR / USD / EUR), then groups: Bank & cash, Credit cards (with a utilization bar in `neg`), Foreign wallets (with the ≈ INR conversion as a sublabel) and Investment.

**07 Insights · Spending.** Spending / Income / Budgets segmented control. A 232px donut: r 96, stroke 20, 3px gaps between segments in the category colors. The centre shows the total and the delta versus the previous month. Category rows show the color square, name, % and amount.

**08 Budgets.**
- Summary card: remaining amount, days left, a pace bar and a pace sentence.
- Budget rows: 5px bar in signal, or warn at 90% and above; "left" amount on the right; "spent of limit · %" underneath.

**09 Net worth.** Net worth / Holdings / Loans segmented control. The value has a 1Y delta. A 170px area chart has an end dot. Range chips: 1M 6M 1Y 3Y ALL. The composition is a stacked bar with a legend; liabilities are in `neg`.

**10 Holdings.** Current value and total return tiles, a list of holdings (name, sub, value, return colored `pos` or `neg`) and SIP cards showing ₹/mo and the next debit.

**11 Offline + install.**
- Offline banner: dashed border, cloud-off icon in warn, "You're offline" and "N changes saved on this device…". The count comes from `queued()`.
- Pending rows have a dashed icon tile and "Waiting to sync" in warn.
- Install sheet: shown when `canInstall()` is true, after the second session, and at most once per 14 days. It has an app tile, the domain, three benefit lines, and "Not now" and "Install app" buttons.

**12 Import (desktop, 4 steps).** A step pill row in the header (Upload, Map columns, Review, Done). Content changes with the page transition.
1. Drop zone (dashed, signal on hover), "Choose file" and "Paste from clipboard", saved mappings and recent imports.
2. Mapping table (CSV column → field dropdown → sample), plus date format, currency and the debit/credit merge. Side cards: target account with a closing-balance check, and a "Remember mapping" toggle.
3. Review chips (Needs review / Ready / Duplicates with counts), then a table with the suggested category chip and its source: `rule`, `AI · 0.82`, or `no match` in warn. Keyboard: ↵ accept, 1–9 pick, S skip. Side panel: summary, an explanation of rules versus AI, and "Import N".
4. Done: serif headline, "View in Activity", "Import another" and "Undo import".

**13 MCP connect (desktop).** Status pill "Server online". Numbered cards:
1. URL with a Copy button. The button changes to "Copied" with a check for 1.6s, colored signal-soft.
2. Token: masked, with an eye toggle, Copy and Regenerate, plus the expiry from the JWT `exp` claim.
3. Client tabs (Claude Desktop / Cursor / Other), each with a path note and syntax-colored JSON: keys in signal, strings in pos.
4. Test connection, showing idle, then a spinner with "Connecting…", then a check with "Connected · {ms}".

Right column: an "What your assistant can reach" chip cloud (about 55 tools across the 11 domains) and "Try asking" prompt cards in serif.

**14–18 Mobile.** Share sheet with Ledgerify as a target, then Import · reading (a progress list with a live spinner), Import · review (one card at a time with category chips and "Always file X here"), MCP connect ("Finish on your computer", Copy config / Share…) and Export (range segmented control, field chips, CSV/JSON choice, "Export & share" through the Web Share API).

## State
- Global, from `lib/pwa.ts`: `online`, `queued`, `canInstall`, `theme`.
- Shell state: `paletteOpen`, `paletteQuery`, `selectedRow` (J/K).
- Import: `step` 1–4, `file`, `mapping`, `reviewFilter`, `decisions`.
- MCP: `client`, `showToken`, `copied` (timed reset), `testStatus` (idle/run/ok/fail).

## Assets
- Icons come from lucide-solid (already a dependency). The names used are in the design file as `icon-*` classes. Map them to the lucide components, e.g. `icon-receipt-text` → `ReceiptText`.
- Fonts are installed with `@fontsource` (see `package.additions.json`).
- PWA icons still need to be exported (192, 512, maskable 512).

## Files
- `design/Ledgerify Redesign.dc.html`, `LedgerifyBoard.dc.html` and `LedgerifyFlows.dc.html` are the visual references; open the first one.
- `design/Ledgerify Current.dc.html` is the before state.
- `frontend/…` and `patches/…` are the production drop-ins.
- `PR_DESCRIPTION.md` and `CLAUDE_CODE_PROMPT.md` cover opening the PR.
