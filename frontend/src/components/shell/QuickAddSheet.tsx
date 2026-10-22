import { createSignal, Show, type Component } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { Sheet } from "../ui/sheet";
import { TransactionForm } from "../forms/transaction-form";
import { onQuickAdd, notifyDataChanged, type TxKind } from "../../lib/events";

/** One quick-add sheet for the whole app: N, the mobile + button, the palette and ?new=expense. */
export const QuickAddSheet: Component = () => {
  const [params, setParams] = useSearchParams();
  const [kind, setKind] = createSignal<TxKind | null>(null);
  onQuickAdd((k) => setKind(k));

  // Manifest shortcut: /activity?new=expense
  const fromUrl = params.new;
  if (fromUrl === "expense" || fromUrl === "income" || fromUrl === "transfer") {
    setKind(fromUrl);
    setParams({ new: undefined }, { replace: true });
  }

  const close = () => setKind(null);
  return (
    <Sheet open={kind() !== null} onClose={close} title="New transaction">
      <Show when={kind()} keyed>
        {(k) => (
          <TransactionForm
            initialType={k}
            onSuccess={() => { close(); notifyDataChanged(); }}
            onClose={close}
          />
        )}
      </Show>
    </Sheet>
  );
};
