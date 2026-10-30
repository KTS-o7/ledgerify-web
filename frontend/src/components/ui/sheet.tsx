import { type JSX, onCleanup, onMount, Show, createUniqueId } from "solid-js";
import { Portal } from "solid-js/web";
import { X } from "lucide-solid";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: JSX.Element;
};

export function Sheet(props: SheetProps) {
  const titleId = createUniqueId();
  let drawerRef: HTMLDivElement | undefined;

  // Focus trap helpers
  function getFocusable(): HTMLElement[] {
    if (!drawerRef) return [];
    return Array.from(
      drawerRef.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
    );
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      props.onClose();
      return;
    }
    if (e.key === "Tab") {
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }

  // When the sheet opens, focus the first focusable element inside
  function focusFirst() {
    requestAnimationFrame(() => {
      const focusable = getFocusable();
      if (focusable.length > 0) focusable[0]!.focus();
    });
  }

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
    onCleanup(() => document.removeEventListener("keydown", handleKeyDown));
  });

  // Focus drawer when it opens
  let previousFocus: HTMLElement | null = null;

  return (
    <Show when={props.open}>
      {/* Mount effect: save previous focus, focus first element on open */}
      {(() => {
        previousFocus = document.activeElement as HTMLElement;
        focusFirst();
        onCleanup(() => previousFocus?.focus());
        return null;
      })()}
      <Portal>
        {/* Backdrop */}
        <div
          class="fixed inset-0 bg-scrim backdrop-blur-[3px] z-50 animate-[fade-in_220ms_var(--ease-standard)] motion-reduce:animate-none"
          onClick={props.onClose}
          aria-hidden="true"
        />

        {/* Drawer */}
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          class="fixed bottom-0 left-0 right-0 md:left-auto md:right-0 md:top-0 md:bottom-0 md:w-[440px] bg-surface rounded-t-[28px] md:rounded-none md:rounded-l-[18px] border-t md:border-t-0 md:border-l border-border-strong shadow-frame z-50 flex flex-col max-h-[92vh] md:max-h-none overflow-y-auto pb-[env(safe-area-inset-bottom)] animate-slide-up md:animate-slide-right motion-reduce:animate-[fade-in_120ms_linear]"
        >
          {/* Grabber (mobile) */}
          <div class="md:hidden flex justify-center pt-2.5" aria-hidden="true">
            <span class="w-9 h-[5px] rounded-pill bg-border-strong" />
          </div>
          {/* Header */}
          <div class="flex items-center justify-between px-5 pt-3 pb-3 md:py-4 md:border-b border-border shrink-0">
            <h2 id={titleId} class="font-display font-normal text-[26px] leading-none text-text">
              {props.title}
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={props.onClose}
              class="w-9 h-9 flex items-center justify-center rounded-full text-muted hover:text-text hover:bg-raised transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div class="flex-1 px-5 pb-5 md:pt-5">
            {props.children}
          </div>
        </div>
      </Portal>
    </Show>
  );
}
