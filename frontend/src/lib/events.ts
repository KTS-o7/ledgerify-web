/**
 * App-wide events between the shell and pages. The shell owns the quick-add
 * sheet, the palette and keyboard shortcuts; pages own their data.
 */
import { onCleanup } from "solid-js";

export type TxKind = "expense" | "income" | "transfer";

const QUICK_ADD = "ledgerify:quick-add";
const DATA_CHANGED = "ledgerify:data-changed";
const ROW_MOVE = "ledgerify:row-move";
const ROW_EDIT = "ledgerify:row-edit";
const OPEN_MORE = "ledgerify:open-more";

export const openQuickAdd = (kind: TxKind = "expense") =>
  window.dispatchEvent(new CustomEvent<TxKind>(QUICK_ADD, { detail: kind }));
export const notifyDataChanged = () => window.dispatchEvent(new CustomEvent(DATA_CHANGED));
export const emitRowMove = (delta: 1 | -1) => window.dispatchEvent(new CustomEvent<number>(ROW_MOVE, { detail: delta }));
export const emitRowEdit = () => window.dispatchEvent(new CustomEvent(ROW_EDIT));
export const openMoreSheet = () => window.dispatchEvent(new CustomEvent(OPEN_MORE));

function listen<T>(name: string, fn: (detail: T) => void) {
  const h = (e: Event) => fn((e as CustomEvent<T>).detail);
  window.addEventListener(name, h);
  onCleanup(() => window.removeEventListener(name, h));
}

/** Call inside a component: runs `fn` when the quick-add sheet asks to open. */
export const onQuickAdd = (fn: (kind: TxKind) => void) => listen<TxKind>(QUICK_ADD, fn);
/** Call inside a page: refetch when a transaction was added anywhere in the shell. */
export const onDataChanged = (fn: () => void) => listen<void>(DATA_CHANGED, fn);
/** J/K row selection; the page decides what a row is. */
export const onRowMove = (fn: (delta: number) => void) => listen<number>(ROW_MOVE, fn);
/** E on the selected row. */
export const onRowEdit = (fn: () => void) => listen<void>(ROW_EDIT, fn);
export const onOpenMore = (fn: () => void) => listen<void>(OPEN_MORE, fn);
