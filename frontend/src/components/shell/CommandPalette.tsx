import { useNavigate } from "@solidjs/router";
import { Dynamic, Portal } from "solid-js/web";
import { For, Show, createEffect, createMemo, createResource, createSignal, onCleanup, type Component } from "solid-js";
import { Search, Plus, ArrowDownUp, FileDown, SunMoon, Wallet, LogOut, ArrowDownLeft, ArrowLeftRight } from "lucide-solid";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/store";
import { setTheme, theme, withViewTransition } from "../../lib/pwa";
import { openQuickAdd } from "../../lib/events";
import { allNavItems } from "../ui/nav-items";
import { PALETTE_EVENT, modKey } from "../ui/nav";
import { Kbd } from "../ui/kbd";
import { Money } from "../ui/money";
import { cn } from "../../lib/utils";

type Icon = Component<{ size?: number; class?: string }>;
type Entry = {
  id: string;
  group: "Actions" | "Jump to" | "Accounts";
  label: string;
  icon: Icon;
  hint?: string;
  keywords?: string;
  path?: string;
  run?: () => void;
  balance?: { value: number; currency: string };
};

interface AccountBalance { id: string; name: string; type: string; currency: string; balance: number }

/** Scored subsequence match: every query char in order; earlier and contiguous hits score higher. */
export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  const t = text.toLowerCase();
  const idx = t.indexOf(q);
  if (idx >= 0) return 100 - idx;
  let ti = 0, score = 0, streak = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found < 0) return 0;
    streak = found === ti ? streak + 1 : 0;
    score += 1 + streak;
    ti = found + 1;
  }
  return score;
}

/** ⌘K palette: actions, pages and accounts, filtered as you type. */
export const CommandPalette: Component = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [active, setActive] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  // Accounts load the first time the palette opens.
  const [accounts] = createResource(
    () => open() || undefined,
    () => api.get<{ account_balances?: AccountBalance[] }>("/v1/summary").then((s) => s.account_balances ?? []).catch(() => [] as AccountBalance[]),
  );

  const toggle = () => { setOpen((o) => !o); setQuery(""); setActive(0); };
  const onOpen = () => { if (!open()) toggle(); };
  window.addEventListener(PALETTE_EVENT, onOpen);
  onCleanup(() => window.removeEventListener(PALETTE_EVENT, onOpen));

  const onGlobalKey = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); toggle(); }
  };
  document.addEventListener("keydown", onGlobalKey);
  onCleanup(() => document.removeEventListener("keydown", onGlobalKey));

  const entries = createMemo<Entry[]>(() => {
    const next = theme() === "dark" ? "light" : theme() === "light" ? "system" : "dark";
    const actions: Entry[] = [
      { id: "new", group: "Actions", label: "New transaction", icon: Plus, hint: "N", run: () => openQuickAdd("expense") },
      { id: "new-income", group: "Actions", label: "New income", icon: ArrowDownLeft, keywords: "salary add", run: () => openQuickAdd("income") },
      { id: "new-transfer", group: "Actions", label: "New transfer", icon: ArrowLeftRight, keywords: "move add", run: () => openQuickAdd("transfer") },
      { id: "import", group: "Actions", label: "Import statement", icon: ArrowDownUp, keywords: "csv upload", path: "/import" },
      { id: "export", group: "Actions", label: "Export data", icon: FileDown, keywords: "csv json download", path: "/export" },
      { id: "theme", group: "Actions", label: `Theme: switch to ${next}`, icon: SunMoon, keywords: "dark light appearance", run: () => setTheme(next) },
      { id: "logout", group: "Actions", label: "Sign out", icon: LogOut, keywords: "logout", run: () => { logout(); navigate("/login"); } },
    ];
    const pages: Entry[] = allNavItems.map((i) => ({
      id: `go-${i.path}`, group: "Jump to", label: i.label, icon: i.icon, path: i.path,
      hint: i.go ? `G ${i.go}` : undefined, keywords: i.keywords,
    }));
    const accts: Entry[] = (accounts() ?? []).map((a) => ({
      id: `acct-${a.id}`, group: "Accounts", label: a.name, icon: Wallet, path: "/accounts",
      keywords: `${a.type} ${a.currency}`, balance: { value: a.balance, currency: a.currency },
    }));
    return [...actions, ...pages, ...accts];
  });

  const results = createMemo(() => {
    const q = query();
    const scored = entries()
      .map((e) => ({ e, s: Math.max(fuzzyScore(q, e.label), fuzzyScore(q, e.keywords ?? "") * 0.6) }))
      .filter((x) => x.s > 0);
    if (q) scored.sort((a, b) => b.s - a.s);
    // Keep group order stable: Actions, Jump to, Accounts. Cap accounts when idle.
    const order: Entry["group"][] = ["Actions", "Jump to", "Accounts"];
    return order.flatMap((g) => {
      const items = scored.filter((x) => x.e.group === g).map((x) => x.e);
      return q ? items : items.slice(0, g === "Actions" ? 3 : g === "Jump to" ? 8 : 4);
    });
  });

  createEffect(() => { query(); setActive(0); });
  createEffect(() => {
    if (!open()) return;
    const prev = document.activeElement as HTMLElement | null;
    queueMicrotask(() => inputRef?.focus());
    onCleanup(() => prev?.focus());
  });
  createEffect(() => {
    const i = active();
    listRef?.querySelector<HTMLElement>(`[data-index="${i}"]`)?.scrollIntoView({ block: "nearest" });
  });

  const choose = (e: Entry, split = false) => {
    setOpen(false);
    if (e.path) {
      if (split) window.open(e.path, "_blank", "noopener");
      else withViewTransition(() => navigate(e.path!));
    } else e.run?.();
  };

  const onKey = (e: KeyboardEvent) => {
    const list = results();
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(list.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); const it = list[active()]; if (it) choose(it, e.metaKey || e.ctrlKey); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "Tab") e.preventDefault(); // focus stays in the input
  };

  return (
    <Show when={open()}>
      <Portal>
        <div class="fixed inset-0 z-[60] bg-scrim backdrop-blur-[3px] animate-[fade-in_160ms_var(--ease-standard)] motion-reduce:animate-none" onClick={() => setOpen(false)} aria-hidden="true" />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          class="fixed z-[61] left-1/2 -translate-x-1/2 top-4 md:top-[110px] w-[calc(100vw-32px)] md:w-[600px] max-h-[min(560px,calc(100vh-140px))] flex flex-col bg-surface rounded-[16px] border border-border-strong shadow-[0_30px_80px_rgba(0,0,0,.35)] overflow-hidden animate-[palette-in_220ms_var(--ease-standard)] motion-reduce:animate-none"
        >
          <div class="flex items-center gap-3 h-14 px-4 border-b border-border shrink-0">
            <Search size={18} class="text-muted shrink-0" />
            <input
              ref={inputRef}
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={onKey}
              placeholder="Search or jump to…"
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-list"
              aria-activedescendant={results()[active()] ? `pal-${results()[active()]!.id}` : undefined}
              aria-autocomplete="list"
              class="flex-1 bg-transparent text-[16px] text-text placeholder:text-faint focus:outline-none"
            />
            <Kbd>Esc</Kbd>
          </div>
          <div ref={listRef} id="palette-list" role="listbox" class="flex-1 overflow-y-auto p-2">
            <Show when={results().length > 0} fallback={<p class="px-3 py-8 text-center text-[13.5px] text-muted">No matches for “{query()}”.</p>}>
              <For each={results()}>
                {(entry, i) => (
                  <>
                    <Show when={i() === 0 || results()[i() - 1]!.group !== entry.group}>
                      <div class="px-3 pt-2.5 pb-1.5 font-mono font-medium text-[11px] uppercase tracking-[0.1em] text-faint" role="presentation">{entry.group}</div>
                    </Show>
                    <div
                      id={`pal-${entry.id}`}
                      role="option"
                      data-index={i()}
                      aria-selected={active() === i()}
                      onMouseMove={() => setActive(i())}
                      onClick={(e) => choose(entry, e.metaKey || e.ctrlKey)}
                      class={cn("flex items-center gap-3 h-10 px-3 rounded-[10px] cursor-pointer text-[14px]", active() === i() ? "bg-raised text-text" : "text-muted")}
                    >
                      <Dynamic component={entry.icon} size={16} class="shrink-0" />
                      <span class={cn("flex-1 truncate", active() === i() && "text-text")}>{entry.label}</span>
                      <Show when={entry.balance}>
                        {(b) => <Money value={b().value} currency={b().currency} tone={b().value < 0 ? "neg" : "muted"} class="text-[12.5px]" />}
                      </Show>
                      <Show when={entry.hint}><span class="font-mono text-[10.5px] text-faint">{entry.hint}</span></Show>
                    </div>
                  </>
                )}
              </For>
            </Show>
          </div>
          <div class="hidden md:flex items-center gap-4 h-10 px-4 border-t border-border text-[12px] text-muted shrink-0" aria-hidden="true">
            <span class="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
            <span class="flex items-center gap-1.5"><Kbd>↵</Kbd> open</span>
            <span class="flex items-center gap-1.5"><Kbd>{modKey.trim()}↵</Kbd> open in split</span>
          </div>
        </div>
      </Portal>
    </Show>
  );
};
