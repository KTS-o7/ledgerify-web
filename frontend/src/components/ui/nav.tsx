import { A, useLocation, useNavigate } from "@solidjs/router";
import { Dynamic, Portal } from "solid-js/web";
import { For, Show, createEffect, createSignal, onCleanup, type Component, type JSX } from "solid-js";
import { Search, Settings, Plus, X, LogOut } from "lucide-solid";
import { useAuth } from "../../lib/store";
import { cn } from "../../lib/utils";
import { online, queued } from "../../lib/pwa";
import { openQuickAdd, onOpenMore, openMoreSheet } from "../../lib/events";
import { navGroups, extraNavItems, mobileTabs, type NavItem } from "./nav-items";
import { Kbd } from "./kbd";
import { Eyebrow } from "./eyebrow";

export const PALETTE_EVENT = "ledgerify:open-palette";
export const openPalette = () => window.dispatchEvent(new CustomEvent(PALETTE_EVENT));

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
export const modKey = isMac ? "⌘" : "Ctrl ";

function initials(name?: string, email?: string) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** 28px ink tile with an italic serif L, then the serif wordmark. */
export const Wordmark: Component<{ size?: "sm" | "lg" }> = (props) => (
  <div class="flex items-center gap-2.5">
    <div class={cn("rounded-[8px] bg-btn text-btn-text flex items-center justify-center font-display italic leading-none",
      props.size === "lg" ? "w-[52px] h-[52px] rounded-[14px] text-[36px]" : "w-7 h-7 text-[20px]")} aria-hidden="true">L</div>
    <span class={cn("font-display text-text leading-none tracking-[-0.01em]", props.size === "lg" ? "text-[54px]" : "text-[24px]")}>Ledgerify</span>
  </div>
);

const SidebarLink: Component<{ item: NavItem }> = (props) => (
  <li>
    <A
      href={props.item.path}
      end={props.item.path === "/dashboard"}
      class="group flex items-center gap-2.5 h-[30px] px-2.5 rounded-[8px] text-[13.5px] font-medium text-muted hover:text-text hover:bg-raised transition-colors duration-[160ms]"
      activeClass="!bg-raised !text-text"
      aria-keyshortcuts={props.item.go ? `g ${props.item.go.toLowerCase()}` : undefined}
    >
      <Dynamic component={props.item.icon} size={16} class="shrink-0" />
      <span class="flex-1 truncate">{props.item.label}</span>
      <Show when={props.item.go}>
        <span class="font-mono text-[10.5px] text-faint tabular" aria-hidden="true">G {props.item.go}</span>
      </Show>
    </A>
  </li>
);

/** Desktop rail: wordmark, ⌘K search, grouped nav, sync status, avatar. */
export const Sidebar: Component = (): JSX.Element => {
  const { user } = useAuth();
  const synced = () => online() && queued() === 0;
  return (
    <aside class="hidden md:flex fixed top-0 left-0 h-screen w-60 flex-col gap-[18px] bg-rail backdrop-blur-[16px] border-r border-border pt-5 px-3.5 pb-3.5 z-40">
      <div class="px-2"><Wordmark /></div>
      <button
        type="button"
        onClick={openPalette}
        aria-keyshortcuts="Meta+K Control+K"
        class="flex items-center gap-2.5 h-9 px-2.5 rounded-[10px] border border-border-strong bg-surface text-muted text-[13px] text-left hover:border-signal transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      >
        <Search size={15} />
        <span class="flex-1">Search or jump to…</span>
        <Kbd>{modKey.trim()}K</Kbd>
      </button>
      <nav class="flex-1 flex flex-col gap-4 overflow-y-auto -mx-1 px-1" aria-label="Primary">
        <For each={navGroups}>
          {(group) => (
            <div class="flex flex-col gap-1">
              <Eyebrow class="px-2.5 mb-1 text-faint">{group.label}</Eyebrow>
              <ul class="flex flex-col gap-px">
                <For each={group.items}>{(item) => <SidebarLink item={item} />}</For>
              </ul>
            </div>
          )}
        </For>
      </nav>
      <div class="flex flex-col gap-2.5 pt-3 border-t border-border">
        <div class="flex items-center gap-2 px-2.5 text-[12px] text-muted" role="status">
          <span class={cn("w-1.5 h-1.5 rounded-full", synced() ? "bg-pos" : "bg-warn")} aria-hidden="true" />
          <span>
            {!online() ? "Offline · changes saved here" : queued() > 0 ? `Syncing ${queued()} change${queued() === 1 ? "" : "s"}…` : "Synced · available offline"}
          </span>
        </div>
        <div class="flex items-center gap-2.5 px-1.5">
          <div class="w-7 h-7 rounded-full bg-raised text-text flex items-center justify-center font-mono text-[11px]" aria-hidden="true">
            {initials(user()?.name, user()?.email)}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-[13px] font-medium text-text truncate">{user()?.name || "Account"}</div>
            <div class="text-[11.5px] text-muted truncate">{user()?.email}</div>
          </div>
          <A href="/settings" aria-label="Settings" class="w-8 h-8 flex items-center justify-center rounded-[8px] text-muted hover:text-text hover:bg-raised transition-colors duration-[160ms]">
            <Settings size={16} />
          </A>
        </div>
      </div>
    </aside>
  );
};

/** Mobile tab bar: Home, Activity, centre quick-add, Insights, Wealth. */
export const BottomNav: Component = (): JSX.Element => {
  const location = useLocation();
  const isActive = (match: string[]) => match.some((p) => (p === "/" ? location.pathname === "/" : location.pathname === p || location.pathname.startsWith(p + "/")));
  const tab = (t: (typeof mobileTabs)[number]) => (
    <li class="flex">
      <A
        href={t.path}
        aria-current={isActive(t.match) ? "page" : undefined}
        class={cn("flex-1 flex flex-col items-center justify-center gap-1 pt-2 transition-colors duration-[160ms]", isActive(t.match) ? "text-text" : "text-muted")}
      >
        <Dynamic component={t.icon} size={21} />
        <span class="text-[10.5px] font-medium">{t.label}</span>
      </A>
    </li>
  );
  return (
    <nav class="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-nav backdrop-blur-[16px] border-t border-border h-[calc(62px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)]" aria-label="Primary">
      <ul class="grid grid-cols-5 h-[62px]">
        {tab(mobileTabs[0]!)}
        {tab(mobileTabs[1]!)}
        <li class="flex items-center justify-center">
          <button
            type="button"
            onClick={() => openQuickAdd("expense")}
            aria-label="Add transaction"
            class="w-[52px] h-[52px] -mt-1 rounded-full bg-btn text-btn-text flex items-center justify-center active:scale-[0.96] transition-transform duration-[90ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Plus size={24} />
          </button>
        </li>
        {tab(mobileTabs[2]!)}
        {tab(mobileTabs[3]!)}
      </ul>
    </nav>
  );
};

/** Mobile sheet listing every section; opened from the header avatar. */
export const MoreSheet: Component = (): JSX.Element => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [open, setOpen] = createSignal(false);
  let dialogRef: HTMLDivElement | undefined;

  onOpenMore(() => setOpen(true));

  createEffect(() => {
    if (!open()) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); return; }
      if (e.key !== "Tab" || !dialogRef) return;
      const focusables = Array.from(dialogRef.querySelectorAll<HTMLElement>("a, button")).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement;
      if (e.shiftKey && (active === first || !dialogRef.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    setTimeout(() => dialogRef?.querySelector<HTMLElement>("button")?.focus(), 0);
    onCleanup(() => { document.removeEventListener("keydown", onKey); prev?.focus(); });
  });

  const go = (path: string) => { setOpen(false); navigate(path); };

  return (
    <Show when={open()}>
      <Portal>
        <div class="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-labelledby="more-sheet-title">
          <div class="absolute inset-0 bg-scrim backdrop-blur-[3px]" onClick={() => setOpen(false)} />
          <div ref={dialogRef} class="absolute bottom-0 left-0 right-0 bg-surface rounded-t-[28px] border-t border-border-strong px-5 pt-2.5 pb-[calc(20px+env(safe-area-inset-bottom))] max-h-[88vh] overflow-y-auto animate-slide-up motion-reduce:animate-none">
            <div class="flex justify-center mb-3" aria-hidden="true"><span class="w-9 h-[5px] rounded-pill bg-border-strong" /></div>
            <div class="flex items-center justify-between mb-4">
              <div class="min-w-0">
                <h2 id="more-sheet-title" class="font-display text-[28px] leading-none text-text">Everything</h2>
                <p class="text-[12.5px] text-muted mt-1 truncate">{user()?.email}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close"
                class="w-9 h-9 flex items-center justify-center rounded-full text-muted hover:text-text hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
                <X size={18} />
              </button>
            </div>
            <div class="flex flex-col gap-5">
              <For each={[...navGroups, { label: "More", items: extraNavItems }]}>
                {(group) => (
                  <div>
                    <Eyebrow class="mb-2 block">{group.label}</Eyebrow>
                    <ul class="grid grid-cols-3 gap-2">
                      <For each={group.items}>
                        {(item) => (
                          <li>
                            <button type="button" onClick={() => go(item.path)}
                              class="w-full h-[76px] flex flex-col items-center justify-center gap-1.5 rounded-[14px] bg-bg text-muted hover:text-text active:scale-[0.97] transition-[transform,color] duration-[90ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
                              <Dynamic component={item.icon} size={20} />
                              <span class="text-[12px] font-medium text-center leading-tight px-1">{item.label}</span>
                            </button>
                          </li>
                        )}
                      </For>
                    </ul>
                  </div>
                )}
              </For>
              <button type="button" onClick={() => { setOpen(false); logout(); navigate("/login"); }}
                class="w-full h-11 flex items-center justify-center gap-2 rounded-[12px] border border-border-strong text-muted hover:text-text text-[13.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
};

/** Mobile-only avatar that opens the "Everything" sheet. */
export const MobileMenuButton: Component = () => {
  const { user } = useAuth();
  return (
    <button type="button" onClick={openMoreSheet} aria-label="All sections and settings"
      class="md:hidden w-9 h-9 rounded-full bg-raised text-text flex items-center justify-center font-mono text-[12px] active:scale-[0.96] transition-transform duration-[90ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
      {initials(user()?.name, user()?.email)}
    </button>
  );
};
