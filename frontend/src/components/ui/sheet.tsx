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
          class="fixed inset-0 bg-bg/80 backdrop-blur-sm z-50"
          onClick={props.onClose}
          aria-hidden="true"
        />

        {/* Drawer */}
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          class="fixed bottom-0 left-0 right-0 md:left-auto md:right-0 md:top-0 md:bottom-0 md:w-[420px] bg-surface rounded-t-[24px] md:rounded-none md:rounded-l-[24px] border-t md:border-t-0 md:border-l border-border z-50 flex flex-col max-h-[90vh] md:max-h-none overflow-y-auto animate-[slide-up_200ms_ease-out] md:animate-[slide-right_200ms_ease-out] motion-reduce:animate-none"
        >
          {/* Header */}
          <div class="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <h2 id={titleId} class="font-display font-bold text-lg text-text">
              {props.title}
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={props.onClose}
              class="w-9 h-9 flex items-center justify-center rounded-full text-muted hover:text-text hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div class="flex-1 p-5">
            {props.children}
          </div>
        </div>
      </Portal>
    </Show>
  );
}
