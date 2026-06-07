import { A, useLocation, useNavigate } from "@solidjs/router";
import { For, Show, createEffect, createSignal, onCleanup, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { LogOut, Grid3x3, ChevronDown, X } from "lucide-solid";
import { useAuth } from "../../lib/store";
import { cn } from "../../lib/utils";
import { primaryNavItems, secondaryNavItems, type NavItem } from "./nav-items";

const MORE_EVENT = "ledgerify:open-more";

export const BottomNav: Component = (): JSX.Element => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");
  const onMore = (e: MouseEvent) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent(MORE_EVENT));
  };
  return (
    <nav class="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-bg/95 backdrop-blur-sm border-t border-border h-16 pb-[env(safe-area-inset-bottom)]" aria-label="Primary">
      <ul class="grid grid-cols-5 h-full">
        <For each={primaryNavItems}>
          {(item) => (
            <li class="flex">
              <A
                href={item.path}
                end={item.path === "/dashboard"}
                class="flex-1 flex flex-col items-center justify-center gap-0.5 text-muted active:text-text transition-colors"
                activeClass="text-text"
              >
                <item.icon size={22} />
                <span class="text-[11px] font-medium">{item.label}</span>
              </A>
            </li>
          )}
        </For>
        <li class="flex">
          <button
            type="button"
            onClick={onMore}
            class="flex-1 flex flex-col items-center justify-center gap-0.5 text-muted active:text-text transition-colors"
            aria-label="More navigation options"
          >
            <Grid3x3 size={22} />
            <span class="text-[11px] font-medium">More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
};

const MORE_EXPANDED_KEY = "ledgerify.sidebar.moreExpanded";

export const Sidebar: Component = (): JSX.Element => {
  const location = useLocation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = createSignal(localStorage.getItem(MORE_EXPANDED_KEY) === "1");
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");
  createEffect(() => {
    localStorage.setItem(MORE_EXPANDED_KEY, expanded() ? "1" : "0");
  });
  return (
    <aside class="hidden md:flex fixed top-0 left-0 h-screen w-60 flex-col bg-bg border-r border-border z-40">
      <div class="px-4 py-4 flex items-center gap-2">
        <div class="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-bg font-display font-bold text-lg">L</div>
        <span class="font-display font-bold text-lg text-text">Ledgerify</span>
      </div>
      <nav class="flex-1 px-2 py-2 overflow-y-auto" aria-label="Primary">
        <ul class="flex flex-col gap-1">
          <For each={primaryNavItems}>
            {(item) => (
              <li>
                <A
                  href={item.path}
                  end={item.path === "/dashboard"}
                  class="flex items-center gap-3 px-3 py-2 rounded-input text-muted hover:text-text hover:bg-surface transition-colors"
                  activeClass="bg-surface text-text"
                >
                  <item.icon size={20} />
                  <span class="text-sm font-medium">{item.label}</span>
                </A>
              </li>
            )}
          </For>
        </ul>
        <div class="h-px bg-border my-2 mx-2" />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          class="w-full flex items-center justify-between px-3 py-2 rounded-input text-muted hover:text-text hover:bg-surface transition-colors"
          aria-expanded={expanded()}
        >
          <span class="flex items-center gap-3">
            <Grid3x3 size={20} />
            <span class="text-sm font-medium">More</span>
          </span>
          <ChevronDown size={16} class={cn("transition-transform", expanded() ? "rotate-180" : "")} />
        </button>
        <Show when={expanded()}>
          <ul class="flex flex-col gap-0.5 mt-1 ml-3 pl-3 border-l border-border">
            <For each={secondaryNavItems}>
              {(item) => (
                <li>
                  <A
                    href={item.path}
                    class="flex items-center gap-3 px-3 py-1.5 rounded-input text-muted hover:text-text hover:bg-surface transition-colors text-sm"
                    activeClass="bg-surface text-text"
                  >
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </A>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </nav>
      <div class="p-2 border-t border-border">
        <button
          type="button"
          onClick={() => { logout(); navigate("/login"); }}
          class="w-full flex items-center gap-3 px-3 py-2 rounded-input text-muted hover:text-text hover:bg-surface transition-colors"
        >
          <LogOut size={18} />
          <span class="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export const MoreSheet: Component = (): JSX.Element => {
  const navigate = useNavigate();
  const [open, setOpen] = createSignal(false);
  let dialogRef: HTMLDivElement | undefined;

  createEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(MORE_EVENT, handler);
    onCleanup(() => window.removeEventListener(MORE_EVENT, handler));
  });

  createEffect(() => {
    if (!open()) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    onCleanup(() => document.removeEventListener("keydown", onKey));
  });

  createEffect(() => {
    if (!open()) return;
    const focusables = () => dialogRef?.querySelectorAll<HTMLElement>("a, button, [tabindex]:not([tabindex='-1'])");
    setTimeout(() => {
      const first = focusables()?.[0];
      first?.focus();
    }, 0);
  });

  const onSelect = (item: NavItem) => {
    setOpen(false);
    navigate(item.path);
  };

  return (
    <Show when={open()}>
      <Portal>
        <div
          class="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="more-sheet-title"
        >
          <div
            class="absolute inset-0 bg-bg/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            ref={dialogRef}
            class="absolute bottom-0 left-0 right-0 bg-surface rounded-t-[24px] p-4 pb-8 max-h-[85vh] overflow-y-auto animate-[slide-up_200ms_ease-out] motion-reduce:animate-none"
          >
            <div class="flex items-center justify-between mb-4">
              <h2 id="more-sheet-title" class="font-display font-bold text-lg text-text">More</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                class="w-10 h-10 flex items-center justify-center rounded-full text-muted hover:text-text hover:bg-surface-hover"
              >
                <X size={20} />
              </button>
            </div>
            <ul class="grid grid-cols-3 gap-2">
              <For each={secondaryNavItems}>
                {(item) => (
                  <li>
                    <button
                      type="button"
                      onClick={() => onSelect(item)}
                      class="w-full aspect-square flex flex-col items-center justify-center gap-1.5 rounded-input bg-bg text-muted hover:text-text hover:bg-surface-hover transition-colors"
                    >
                      <item.icon size={24} />
                      <span class="text-[12px] font-medium">{item.label}</span>
                    </button>
                  </li>
                )}
              </For>
            </ul>
            <button
              type="button"
              onClick={() => { setOpen(false); navigate("/settings"); }}
              class="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-input border border-border text-muted hover:text-text hover:bg-bg transition-colors text-sm font-medium"
            >
              <LogOut size={16} />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </Portal>
    </Show>
  );
};
