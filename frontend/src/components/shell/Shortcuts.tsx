import { useNavigate } from "@solidjs/router";
import { onCleanup, type Component } from "solid-js";
import { openQuickAdd, emitRowMove, emitRowEdit } from "../../lib/events";
import { withViewTransition } from "../../lib/pwa";
import { allNavItems } from "../ui/nav-items";

/** True when the user is typing, so single-key shortcuts must not fire. */
export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/**
 * Global single-key shortcuts:
 *   N        new transaction
 *   G then X jump to a section (O A C Y B R N I)
 *   J / K    move the row selection on list pages
 *   E        edit the selected row
 * ⌘K and Esc live with the palette and sheets.
 */
export const Shortcuts: Component = () => {
  const navigate = useNavigate();
  let gPending = false;
  let gTimer: ReturnType<typeof setTimeout> | undefined;

  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;
    if (document.querySelector("[aria-modal='true']")) return; // a dialog owns the keyboard
    const k = e.key.toLowerCase();

    if (gPending) {
      gPending = false;
      clearTimeout(gTimer);
      const item = allNavItems.find((i) => i.go?.toLowerCase() === k);
      if (item) { e.preventDefault(); withViewTransition(() => navigate(item.path)); }
      return;
    }
    if (k === "g") { gPending = true; gTimer = setTimeout(() => (gPending = false), 1200); return; }
    if (k === "n") { e.preventDefault(); openQuickAdd("expense"); return; }
    if (k === "j") { e.preventDefault(); emitRowMove(1); return; }
    if (k === "k") { e.preventDefault(); emitRowMove(-1); return; }
    if (k === "e") { e.preventDefault(); emitRowEdit(); }
  };

  document.addEventListener("keydown", onKey);
  onCleanup(() => { document.removeEventListener("keydown", onKey); clearTimeout(gTimer); });
  return null;
};
